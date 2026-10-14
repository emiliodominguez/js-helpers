import { retry, withTimeout, type RetryOptions } from '../async/index.js';
import {
	debounce,
	defaultMemoizeKey,
	memoize as memoizeFunction,
	noop,
	once as onceFunction,
	throttle,
	type DebounceOptions,
	type Debounced,
	type Memoized,
	type Throttled,
	type ThrottleOptions
} from '../functions/index.js';
import type { AnyFunction, RandomGenerator } from '../utils/index.js';

/**
 * Supported decorator flavours, detected from the arguments a decorator receives:
 *
 * - **TypeScript legacy** (`experimentalDecorators: true`): methods get `(target, key, descriptor)`, fields get `(target, key)`
 *   (TypeScript's helper passes `undefined` as a third argument).
 * - **Babel legacy** (`@babel/plugin-proposal-decorators` with `legacy: true`): like TypeScript, but fields receive a descriptor
 *   with an `initializer` function.
 * - **TC39 standard** (TypeScript 5+ without `experimentalDecorators`, Babel `2023-05`+): methods get `(value, context)` with
 *   `context.kind === 'method'`, fields get `(undefined, context)` with `context.kind === 'field'`.
 */

/**
 * A method with unknown `this` and arguments, used internally once public types have been checked.
 */
type UnknownMethod = (this: unknown, ...args: unknown[]) => unknown;

/**
 * Wraps a decorated method. Called once per decorated method (not per instance).
 */
type MethodWrapper = (method: UnknownMethod, name: string) => UnknownMethod;

/**
 * The parts of a TC39 standard decorator context used by this module.
 */
interface StandardContext {
	readonly kind: string;
	readonly name: string | symbol;
	readonly private?: boolean;
	addInitializer?(initializer: (this: unknown) => void): void;
}

/**
 * A field descriptor as passed by Babel's legacy decorators transform (it carries the field `initializer`).
 */
export interface BabelFieldDescriptor extends PropertyDescriptor {
	initializer?: (() => unknown) | null;
}

/**
 * A method decorator usable both with TypeScript's `experimentalDecorators` (and Babel legacy) and with TC39 standard decorators.
 * Returned by the decorator factories of this module ({@link debounced}, {@link throttled}, {@link deprecated}).
 */
export interface UniversalMethodDecorator {
	<T extends AnyFunction>(target: object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T>;
	<T extends AnyFunction>(value: T, context: ClassMethodDecoratorContext): T;
}

/**
 * A method decorator for methods returning a promise, usable both with TypeScript's `experimentalDecorators` (and Babel legacy) and
 * with TC39 standard decorators. Returned by {@link retryable} and {@link timeout}.
 */
export interface AsyncMethodDecorator {
	<T extends (...args: never[]) => PromiseLike<unknown>>(target: object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T>;
	<T extends (...args: never[]) => PromiseLike<unknown>>(value: T, context: ClassMethodDecoratorContext): T;
}

/**
 * Largest delay accepted by `setTimeout` (2^31 - 1 ms).
 */
const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * Key used for the per-instance state of methods called with a non-object `this` (e.g. detached calls in sloppy code).
 */
const NO_INSTANCE: object = {};

/**
 * Whether `value` looks like a TC39 standard decorator context object.
 * @param {unknown} value - The second decorator argument
 * @returns {boolean} `true` for a standard decorator context
 */
function isStandardContext(value: unknown): value is StandardContext {
	return typeof value === 'object' && value !== null && typeof (value as { kind?: unknown }).kind === 'string';
}

/**
 * Whether `value` is an object or a function (i.e. can own properties and be a `WeakMap` key).
 * @param {unknown} value - Any value
 * @returns {boolean} `true` for objects and functions
 */
function isObjectLike(value: unknown): value is object {
	return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

/**
 * Whether `value` is a class prototype (an object whose own `constructor` points back to it).
 * @param {object} value - Any object
 * @returns {boolean} `true` for prototype objects
 */
function isPrototypeObject(value: object): boolean {
	const ctor = Object.prototype.hasOwnProperty.call(value, 'constructor') ? (value as { constructor: unknown }).constructor : undefined;

	return typeof ctor === 'function' && ctor.prototype === value;
}

/**
 * Whether `value` is a thenable.
 * @param {unknown} value - Any value
 * @returns {boolean} `true` when `value` has a callable `then`
 */
function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	return isObjectLike(value) && typeof (value as { then?: unknown }).then === 'function';
}

/**
 * The object used to key per-instance state for a call with the given `this`.
 * @param {unknown} thisArg - The `this` of the call
 * @returns {object} `thisArg` itself, or a shared sentinel for primitive/undefined `this`
 */
function ownerOf(thisArg: unknown): object {
	return isObjectLike(thisArg) ? thisArg : NO_INSTANCE;
}

/**
 * Finds the property descriptor that a lookup of `key` on `obj` resolves to (walking the prototype chain).
 * @param {object} obj - The object to start from
 * @param {string | symbol} key - The property key
 * @returns {PropertyDescriptor | undefined} The first descriptor found, if any
 */
function resolveDescriptor(obj: object, key: string | symbol): PropertyDescriptor | undefined {
	for (let current: object | null = obj; current !== null; current = Object.getPrototypeOf(current) as object | null) {
		const descriptor = Object.getOwnPropertyDescriptor(current, key);

		if (descriptor) return descriptor;
	}

	return undefined;
}

/**
 * Applies `wrap` to a method, whatever the decorator flavour (see the module notes).
 * @param {string} decoratorName - Name used in error messages
 * @param {MethodWrapper} wrap - Produces the replacement method
 * @param {unknown} targetOrValue - Legacy: the prototype/constructor; standard: the method
 * @param {unknown} keyOrContext - Legacy: the property key; standard: the context object
 * @param {unknown} descriptor - Legacy: the property descriptor
 * @returns {unknown} Legacy: a new descriptor; standard: the replacement method
 * @throws {TypeError} when the decorated member is not a method
 */
function decorateMethod(decoratorName: string, wrap: MethodWrapper, targetOrValue: unknown, keyOrContext: unknown, descriptor: unknown): unknown {
	if (isStandardContext(keyOrContext)) {
		if (keyOrContext.kind !== 'method' || typeof targetOrValue !== 'function') {
			throw new TypeError(`@${decoratorName} can only decorate methods, not ${keyOrContext.kind}s`);
		}

		return wrap(targetOrValue as UnknownMethod, String(keyOrContext.name));
	}

	const legacy = descriptor as PropertyDescriptor | undefined;

	if (legacy === undefined || typeof legacy.value !== 'function') {
		throw new TypeError(`@${decoratorName} can only decorate methods (${String(keyOrContext)} is not a method)`);
	}

	return { ...legacy, value: wrap(legacy.value as UnknownMethod, String(keyOrContext)) };
}

/**
 * Builds a {@link UniversalMethodDecorator} from a method wrapper.
 * @param {string} decoratorName - Name used in error messages
 * @param {MethodWrapper} wrap - Produces the replacement method
 * @returns {UniversalMethodDecorator} The decorator
 */
function createMethodDecorator(decoratorName: string, wrap: MethodWrapper): UniversalMethodDecorator {
	return function decorator(targetOrValue: unknown, keyOrContext: unknown, descriptor?: unknown): unknown {
		return decorateMethod(decoratorName, wrap, targetOrValue, keyOrContext, descriptor);
	} as UniversalMethodDecorator;
}

// ---------------------------------------------------------------------------------------------------------------------
// readonly
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Makes a class field write-once: the value assigned by the field initializer (or the first assignment) is kept, and the
 * instance gets an enumerable, non-writable, non-configurable own property. Later assignments throw a `TypeError` in strict mode
 * (and are silently ignored in sloppy mode). Each instance has its own value.
 *
 * - TypeScript `experimentalDecorators`: defines an accessor on the prototype whose setter, on first assignment, defines the
 *   read-only own property on the instance (before that, reading returns `undefined`). This relies on fields being initialised by
 *   assignment (`useDefineForClassFields: false`, TypeScript's default for targets below ES2022); with `[[Define]]` semantics the
 *   instance field shadows the accessor and the decorator has no effect. On a static field, the existing value is made non-writable.
 * - Babel legacy: returns the field descriptor with `writable: false`. On a method, the method becomes non-writable.
 * - TC39 standard decorators: registers an initializer that locks the own property once the field has been defined. Runtimes that
 *   run field `addInitializer` callbacks before the field is defined (pre-2023 drafts) are not supported: the field stays writable.
 *   Private (`#field`) fields are rejected.
 * @param {object | undefined} targetOrValue - Legacy: the prototype (or constructor); standard: `undefined`
 * @param {string | symbol | ClassFieldDecoratorContext} keyOrContext - Legacy: the field name; standard: the decorator context
 * @param {BabelFieldDescriptor} [descriptor] - Babel legacy: the field descriptor
 * @returns {void | BabelFieldDescriptor} Babel legacy: the read-only descriptor; otherwise nothing
 * @throws {TypeError} when applied to an accessor, a private field, or (standard) anything other than a field
 * @example
 * ```ts
 * class Config {
 *   @readonly
 *   url: string = 'https://example.com';
 * }
 * const config = new Config();
 * config.url = 'x'; // TypeError: Cannot assign to read only property 'url'
 * ```
 */
export function readonly(targetOrValue: object, keyOrContext: string | symbol, descriptor?: undefined): void;
export function readonly<D extends BabelFieldDescriptor>(targetOrValue: object, keyOrContext: string | symbol, descriptor: D): D;
export function readonly(targetOrValue: undefined, keyOrContext: ClassFieldDecoratorContext): void;
/**
 * Implementation of {@link readonly} (see the first overload for the full documentation).
 * @param {unknown} targetOrValue - Legacy: the prototype (or constructor); standard: `undefined`
 * @param {unknown} keyOrContext - Legacy: the field name; standard: the decorator context
 * @param {BabelFieldDescriptor} [descriptor] - Babel legacy: the field descriptor
 * @returns {void | BabelFieldDescriptor} Babel legacy: the read-only descriptor; otherwise nothing
 * @throws {TypeError} when applied to an unsupported member
 */
export function readonly(targetOrValue: unknown, keyOrContext: unknown, descriptor?: BabelFieldDescriptor): BabelFieldDescriptor | void {
	if (isStandardContext(keyOrContext)) {
		const context = keyOrContext;

		if (context.kind !== 'field' || context.private || typeof context.addInitializer !== 'function') {
			throw new TypeError(`@readonly can only decorate public fields when used as a standard decorator, not ${context.private ? 'private ' : ''}${context.kind}s`);
		}

		context.addInitializer(function lockField(this: unknown): void {
			const owner = this as object;

			if (Object.prototype.hasOwnProperty.call(owner, context.name)) {
				Object.defineProperty(owner, context.name, { writable: false, configurable: false });
			}
		});

		return;
	}

	const key = keyOrContext as string | symbol;

	if (descriptor !== undefined) {
		if (descriptor.get !== undefined || descriptor.set !== undefined) {
			throw new TypeError(`@readonly cannot decorate the accessor ${String(key)}`);
		}

		// Babel legacy field (with `initializer`) or legacy method: just make it non-writable.
		return { ...descriptor, writable: false };
	}

	const target = targetOrValue as object;
	const existing = Object.getOwnPropertyDescriptor(target, key);

	if (existing !== undefined && 'value' in existing) {
		// A static field already initialised by assignment before the decorator ran.
		Object.defineProperty(target, key, { writable: false });
		return;
	}

	Object.defineProperty(target, key, {
		configurable: true,
		enumerable: false,
		get: function (): undefined {
			return undefined;
		},
		set: function (this: unknown, value: unknown): void {
			Object.defineProperty(this as object, key, { value, writable: false, enumerable: true, configurable: false });
		}
	});
}

// ---------------------------------------------------------------------------------------------------------------------
// log
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Wraps a method so that its calls and results are logged.
 * @param {UnknownMethod} method - The original method
 * @param {string} name - The method name
 * @returns {UnknownMethod} The logging method
 */
function wrapLog(method: UnknownMethod, name: string): UnknownMethod {
	return function logged(this: unknown, ...args: unknown[]): unknown {
		// eslint-disable-next-line no-console
		console.log(`${name} method called with arguments:`, args);

		let result: unknown;

		try {
			result = method.apply(this, args);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.log(`${name} method threw:`, error);
			throw error;
		}

		if (isPromiseLike(result)) {
			result.then(
				function (value) {
					// eslint-disable-next-line no-console
					console.log(`${name} method resolved:`, value);
				},
				function (error: unknown) {
					// eslint-disable-next-line no-console
					console.log(`${name} method rejected:`, error);
				}
			);
		} else {
			// eslint-disable-next-line no-console
			console.log(`${name} method returned:`, result);
		}

		return result;
	};
}

/**
 * Logs every call of the decorated method with `console.log`: `"<name> method called with arguments:" args`, then
 * `"<name> method returned:" result`. When the method returns a promise-like, `"<name> method resolved:" value` or
 * `"<name> method rejected:" error` is logged once it settles (the original promise is returned unchanged); a synchronous
 * exception is logged as `"<name> method threw:" error` and rethrown. `this` is preserved.
 * Works with TypeScript/Babel legacy decorators and with TC39 standard decorators.
 * @template T - The method type
 * @param {object | T} targetOrValue - Legacy: the prototype (or constructor); standard: the method
 * @param {string | symbol | ClassMethodDecoratorContext} keyOrContext - Legacy: the method name; standard: the decorator context
 * @param {TypedPropertyDescriptor<T>} [descriptor] - Legacy: the method descriptor
 * @returns {TypedPropertyDescriptor<T> | T} Legacy: the new descriptor; standard: the wrapped method
 * @throws {TypeError} when applied to something other than a method
 * @example
 * ```ts
 * class Api {
 *   @log
 *   get(id: number): Promise<User> { ... }
 * }
 * ```
 */
export function log<T extends AnyFunction>(targetOrValue: object, keyOrContext: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T>;
export function log<T extends AnyFunction>(targetOrValue: T, keyOrContext: ClassMethodDecoratorContext): T;
/**
 * Implementation of {@link log} (see the first overload for the full documentation).
 * @param {unknown} targetOrValue - Legacy: the prototype (or constructor); standard: the method
 * @param {unknown} keyOrContext - Legacy: the method name; standard: the decorator context
 * @param {unknown} [descriptor] - Legacy: the method descriptor
 * @returns {unknown} Legacy: the new descriptor; standard: the wrapped method
 * @throws {TypeError} when applied to something other than a method
 */
export function log(targetOrValue: unknown, keyOrContext: unknown, descriptor?: unknown): unknown {
	return decorateMethod('log', wrapLog, targetOrValue, keyOrContext, descriptor);
}

// ---------------------------------------------------------------------------------------------------------------------
// memoize
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Wraps a method so that its results are cached per instance.
 * @param {UnknownMethod} method - The original method
 * @returns {UnknownMethod} The memoized method
 */
function wrapMemoize(method: UnknownMethod): UnknownMethod {
	const perInstance = new WeakMap<object, Memoized<UnknownMethod>>();

	return function memoizedMethod(this: unknown, ...args: unknown[]): unknown {
		const owner = ownerOf(this);
		let memoized = perInstance.get(owner);

		if (memoized === undefined) {
			memoized = memoizeFunction(method, { resolver: defaultMemoizeKey });
			perInstance.set(owner, memoized);
		}

		return memoized.apply(this, args);
	};
}

/**
 * Caches the results of the decorated method, separately for every instance (instances never see each other's results, and caches
 * are garbage-collected with their instance). Keys are computed with {@link defaultMemoizeKey} (see its limitations).
 * Works with TypeScript/Babel legacy decorators and with TC39 standard decorators.
 * @template T - The method type
 * @param {object | T} targetOrValue - Legacy: the prototype (or constructor); standard: the method
 * @param {string | symbol | ClassMethodDecoratorContext} keyOrContext - Legacy: the method name; standard: the decorator context
 * @param {TypedPropertyDescriptor<T>} [descriptor] - Legacy: the method descriptor
 * @returns {TypedPropertyDescriptor<T> | T} Legacy: the new descriptor; standard: the wrapped method
 * @throws {TypeError} when applied to something other than a method
 * @example
 * ```ts
 * class Calculator {
 *   @memoize
 *   fibonacci(n: number): number { return n < 2 ? n : this.fibonacci(n - 1) + this.fibonacci(n - 2); }
 * }
 * ```
 */
export function memoize<T extends AnyFunction>(targetOrValue: object, keyOrContext: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T>;
export function memoize<T extends AnyFunction>(targetOrValue: T, keyOrContext: ClassMethodDecoratorContext): T;
/**
 * Implementation of {@link memoize} (see the first overload for the full documentation).
 * @param {unknown} targetOrValue - Legacy: the prototype (or constructor); standard: the method
 * @param {unknown} keyOrContext - Legacy: the method name; standard: the decorator context
 * @param {unknown} [descriptor] - Legacy: the method descriptor
 * @returns {unknown} Legacy: the new descriptor; standard: the wrapped method
 * @throws {TypeError} when applied to something other than a method
 */
export function memoize(targetOrValue: unknown, keyOrContext: unknown, descriptor?: unknown): unknown {
	return decorateMethod('memoize', wrapMemoize, targetOrValue, keyOrContext, descriptor);
}

// ---------------------------------------------------------------------------------------------------------------------
// bound
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Auto-binds the decorated method to its instance, so it can be passed around as a callback (`button.onclick = obj.method`).
 *
 * - Legacy decorators: the method is replaced by a lazy getter that, on first access through an instance, binds the method and caches
 *   it as a (non-enumerable, writable) own property of that instance. Accessing it through the prototype returns the unbound method,
 *   and `super.method` accesses from an overriding subclass bind without caching (so the override is not shadowed). On non-extensible
 *   (e.g. frozen) instances, a freshly bound method is returned on every access.
 * - Standard decorators: an initializer binds the method on each new instance (unless a subclass overrides it). Private methods are rejected.
 *   When combining decorators, put `@bound` first (outermost), so that it sees the final method.
 * @template T - The method type
 * @param {object | T} targetOrValue - Legacy: the prototype (or constructor); standard: the method
 * @param {string | symbol | ClassMethodDecoratorContext} keyOrContext - Legacy: the method name; standard: the decorator context
 * @param {TypedPropertyDescriptor<T>} [descriptor] - Legacy: the method descriptor
 * @returns {TypedPropertyDescriptor<T> | void} Legacy: the accessor descriptor; standard: nothing
 * @throws {TypeError} when applied to something other than a (public) method
 * @example
 * ```ts
 * class Counter {
 *   count = 0;
 *   @bound
 *   increment(): void { this.count++; }
 * }
 * const { increment } = new Counter();
 * increment(); // works
 * ```
 */
export function bound<T extends AnyFunction>(targetOrValue: object, keyOrContext: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T>;
export function bound<T extends AnyFunction>(targetOrValue: T, keyOrContext: ClassMethodDecoratorContext): void;
/**
 * Implementation of {@link bound} (see the first overload for the full documentation).
 * @param {unknown} targetOrValue - Legacy: the prototype (or constructor); standard: the method
 * @param {unknown} keyOrContext - Legacy: the method name; standard: the decorator context
 * @param {PropertyDescriptor} [descriptor] - Legacy: the method descriptor
 * @returns {PropertyDescriptor | void} Legacy: the accessor descriptor; standard: nothing
 * @throws {TypeError} when applied to something other than a (public) method
 */
export function bound(targetOrValue: unknown, keyOrContext: unknown, descriptor?: PropertyDescriptor): PropertyDescriptor | void {
	if (isStandardContext(keyOrContext)) {
		const context = keyOrContext;

		if (context.kind !== 'method' || context.private || typeof targetOrValue !== 'function' || typeof context.addInitializer !== 'function') {
			throw new TypeError(`@bound can only decorate public methods, not ${context.private ? 'private ' : ''}${context.kind}s`);
		}

		const method = targetOrValue as UnknownMethod;

		context.addInitializer(function bindMethod(this: unknown): void {
			const owner = this as Record<string | symbol, unknown>;

			// Skip when a subclass overrides the method: binding ours would shadow the override.
			if (owner[context.name] === method) {
				Object.defineProperty(owner, context.name, { value: method.bind(owner), configurable: true, writable: true, enumerable: false });
			}
		});

		return;
	}

	const key = keyOrContext as string | symbol;

	if (descriptor === undefined || typeof descriptor.value !== 'function') {
		throw new TypeError(`@bound can only decorate methods (${String(key)} is not a method)`);
	}

	const method = descriptor.value as UnknownMethod;

	/**
	 * Lazily binds the method to the instance it is read from.
	 * @returns {UnknownMethod} The bound (or, through a prototype, the original) method
	 */
	function get(this: unknown): UnknownMethod {
		if (!isObjectLike(this) || isPrototypeObject(this)) return method;

		const boundMethod = method.bind(this) as UnknownMethod;

		// Cache only on extensible instances that still resolve to this getter (frozen/sealed instances get a fresh bound method).
		if (Object.isExtensible(this) && resolveDescriptor(this, key)?.get === get) {
			Object.defineProperty(this, key, { value: boundMethod, configurable: true, writable: true, enumerable: false });
		}

		return boundMethod;
	}

	return {
		configurable: true,
		enumerable: descriptor.enumerable,
		get,
		set: function (this: unknown, value: unknown): void {
			Object.defineProperty(this as object, key, { value, configurable: true, writable: true, enumerable: true });
		}
	};
}

// ---------------------------------------------------------------------------------------------------------------------
// debounced / throttled / deprecated
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Creates a method decorator that debounces the method with {@link debounce}, with separate timers for every instance.
 * The decorated method returns the result of the latest invocation (or `undefined`), like a debounced function.
 * @param {number} wait - The quiet period in milliseconds
 * @param {DebounceOptions} [options] - `leading`, `trailing` and `maxWait`, as for {@link debounce}
 * @returns {UniversalMethodDecorator} The decorator (legacy and standard)
 * @throws {RangeError} when `wait` or `options.maxWait` is negative, `NaN` or infinite
 * @throws {TypeError} when both `leading` and `trailing` are `false`, or when applied to something other than a method
 * @example
 * ```ts
 * class Search {
 *   @debounced(300)
 *   query(text: string): void { ... }
 * }
 * ```
 */
export function debounced(wait: number, options?: DebounceOptions): UniversalMethodDecorator {
	// Validate eagerly, at class definition time.
	debounce(noop, wait, options);

	return createMethodDecorator('debounced', function (method: UnknownMethod): UnknownMethod {
		const perInstance = new WeakMap<object, Debounced<UnknownMethod>>();

		return function debouncedMethod(this: unknown, ...args: unknown[]): unknown {
			const owner = ownerOf(this);
			let wrapped = perInstance.get(owner);

			if (wrapped === undefined) {
				wrapped = debounce(method, wait, options);
				perInstance.set(owner, wrapped);
			}

			return wrapped.apply(this, args);
		};
	});
}

/**
 * Creates a method decorator that throttles the method with {@link throttle}, with separate windows for every instance.
 * The decorated method returns the result of the latest invocation (or `undefined`), like a throttled function.
 * @param {number} wait - The window length in milliseconds
 * @param {ThrottleOptions} [options] - `leading` and `trailing`, as for {@link throttle}
 * @returns {UniversalMethodDecorator} The decorator (legacy and standard)
 * @throws {RangeError} when `wait` is negative, `NaN` or infinite
 * @throws {TypeError} when both `leading` and `trailing` are `false`, or when applied to something other than a method
 * @example
 * ```ts
 * class Tracker {
 *   @throttled(1000, { trailing: true })
 *   onScroll(y: number): void { ... }
 * }
 * ```
 */
export function throttled(wait: number, options?: ThrottleOptions): UniversalMethodDecorator {
	// Validate eagerly, at class definition time.
	throttle(noop, wait, options);

	return createMethodDecorator('throttled', function (method: UnknownMethod): UnknownMethod {
		const perInstance = new WeakMap<object, Throttled<UnknownMethod>>();

		return function throttledMethod(this: unknown, ...args: unknown[]): unknown {
			const owner = ownerOf(this);
			let wrapped = perInstance.get(owner);

			if (wrapped === undefined) {
				wrapped = throttle(method, wait, options);
				perInstance.set(owner, wrapped);
			}

			return wrapped.apply(this, args);
		};
	});
}

/**
 * Creates a method decorator that emits a deprecation warning with `console.warn` the first time the method is called
 * (once per decorated method, not once per call or per instance). `this` is preserved.
 * @param {string} [message] - The warning; defaults to `"<name> is deprecated."`
 * @returns {UniversalMethodDecorator} The decorator (legacy and standard)
 * @throws {TypeError} when applied to something other than a method
 * @example
 * ```ts
 * class Client {
 *   @deprecated('Client.fetchAll is deprecated, use Client.list instead.')
 *   fetchAll(): Item[] { return this.list(); }
 * }
 * ```
 */
export function deprecated(message?: string): UniversalMethodDecorator {
	return createMethodDecorator('deprecated', function (method: UnknownMethod, name: string): UnknownMethod {
		let warned = false;

		return function deprecatedMethod(this: unknown, ...args: unknown[]): unknown {
			if (!warned) {
				warned = true;
				// eslint-disable-next-line no-console
				console.warn(message ?? `${name} is deprecated.`);
			}

			return method.apply(this, args);
		};
	});
}

// ---------------------------------------------------------------------------------------------------------------------
// once / retryable / timeout
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Wraps a method so that it runs at most once per instance.
 * @param {UnknownMethod} method - The original method
 * @returns {UnknownMethod} The restricted method
 */
function wrapOnce(method: UnknownMethod): UnknownMethod {
	const perInstance = new WeakMap<object, UnknownMethod>();

	return function onceMethod(this: unknown, ...args: unknown[]): unknown {
		const owner = ownerOf(this);
		let wrapped = perInstance.get(owner);

		if (wrapped === undefined) {
			wrapped = onceFunction(method);
			perInstance.set(owner, wrapped);
		}

		return wrapped.apply(this, args);
	};
}

/**
 * Makes the decorated method run at most once per instance (per class for static methods), like `once` from the functions module:
 * later calls on the same instance return the first result (or rethrow the first error) without running the method again, and a
 * re-entrant call made by the method itself returns `undefined`. Each instance has its own state, garbage-collected with it.
 * Works with TypeScript/Babel legacy decorators and with TC39 standard decorators.
 * @template T - The method type
 * @param {object | T} targetOrValue - Legacy: the prototype (or constructor); standard: the method
 * @param {string | symbol | ClassMethodDecoratorContext} keyOrContext - Legacy: the method name; standard: the decorator context
 * @param {TypedPropertyDescriptor<T>} [descriptor] - Legacy: the method descriptor
 * @returns {TypedPropertyDescriptor<T> | T} Legacy: the new descriptor; standard: the wrapped method
 * @throws {TypeError} when applied to something other than a method
 * @example
 * ```ts
 * class Connection {
 *   @once
 *   connect(): Promise<void> { return this.socket.open(); }
 * }
 * ```
 */
export function once<T extends AnyFunction>(targetOrValue: object, keyOrContext: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T>;
export function once<T extends AnyFunction>(targetOrValue: T, keyOrContext: ClassMethodDecoratorContext): T;
/**
 * Implementation of {@link once} (see the first overload for the full documentation).
 * @param {unknown} targetOrValue - Legacy: the prototype (or constructor); standard: the method
 * @param {unknown} keyOrContext - Legacy: the method name; standard: the decorator context
 * @param {unknown} [descriptor] - Legacy: the method descriptor
 * @returns {unknown} Legacy: the new descriptor; standard: the wrapped method
 * @throws {TypeError} when applied to something other than a method
 */
export function once(targetOrValue: unknown, keyOrContext: unknown, descriptor?: unknown): unknown {
	return decorateMethod('once', wrapOnce, targetOrValue, keyOrContext, descriptor);
}

/**
 * Creates a decorator for async methods that retries failed calls with {@link retry} (exponential backoff, optional jitter,
 * `shouldRetry`, `onRetry`, `signal`). Every attempt calls the original method with the same `this` and arguments. The decorated method
 * always returns a native promise. Invalid options are reported when the method is called (as a rejection), like `retry` does.
 * @param {RetryOptions} [options] - Options forwarded to {@link retry}
 * @param {RandomGenerator} [random=Math.random] - Random source used for jitter
 * @returns {AsyncMethodDecorator} The decorator (legacy and standard)
 * @throws {TypeError} when applied to something other than a method
 * @example
 * ```ts
 * class Api {
 *   @retryable({ retries: 3, delay: 200, jitter: true })
 *   getUser(id: string): Promise<User> { return this.http.get(`/users/${id}`); }
 * }
 * ```
 */
export function retryable(options: RetryOptions = {}, random: RandomGenerator = Math.random): AsyncMethodDecorator {
	const snapshot: RetryOptions = { ...options };

	return createMethodDecorator('retryable', function (method: UnknownMethod): UnknownMethod {
		return function retryableMethod(this: unknown, ...args: unknown[]): Promise<unknown> {
			// eslint-disable-next-line @typescript-eslint/no-this-alias -- every attempt needs the caller's `this`
			const self = this;

			return retry(
				function (): unknown {
					return method.apply(self, args);
				},
				snapshot,
				random
			);
		};
	}) as unknown as AsyncMethodDecorator;
}

/**
 * Creates a decorator for async methods that rejects with a {@link TimeoutError} when the returned promise does not settle within
 * `ms` milliseconds (using {@link withTimeout}; the timer is always cleared, but the underlying operation is not cancelled).
 * A synchronous throw of the method becomes a rejection. `this` is preserved.
 * @param {number} ms - The time limit in milliseconds (`0` to `2^31 - 1`)
 * @param {string} [message] - Message of the `TimeoutError` (defaults to `Operation timed out after <ms> ms`)
 * @returns {AsyncMethodDecorator} The decorator (legacy and standard)
 * @throws {RangeError} when `ms` is negative, `NaN` or larger than `2^31 - 1`
 * @throws {TypeError} when applied to something other than a method
 * @example
 * ```ts
 * class Api {
 *   @timeout(5000)
 *   fetchReport(): Promise<Report> { ... }
 * }
 * ```
 */
export function timeout(ms: number, message?: string): AsyncMethodDecorator {
	if (typeof ms !== 'number' || !(ms >= 0 && ms <= MAX_TIMEOUT)) {
		throw new RangeError(`@timeout: \`ms\` must be a number between 0 and ${MAX_TIMEOUT}, got ${String(ms)}`);
	}

	return createMethodDecorator('timeout', function (method: UnknownMethod): UnknownMethod {
		return function timeoutMethod(this: unknown, ...args: unknown[]): Promise<unknown> {
			let result: unknown;

			try {
				result = method.apply(this, args);
			} catch (error) {
				return Promise.reject(error);
			}

			return withTimeout(result, ms, message);
		};
	}) as unknown as AsyncMethodDecorator;
}
