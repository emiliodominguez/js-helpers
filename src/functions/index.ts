import type { AnyFunction } from '../utils/index.js';

/**
 * A function whose `this` and arguments are all `unknown`. Used internally to invoke user callbacks after their public types have been checked.
 */
type UnknownFunction = (this: unknown, ...args: unknown[]) => unknown;

/**
 * A timer handle as returned by the host's `setTimeout`. Kept internal so that Node timer types never leak into public signatures.
 */
type TimerHandle = ReturnType<typeof setTimeout>;

/**
 * Throws a `RangeError` unless `value` is a finite number `>= 0`.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {string} name - Name of the validated parameter
 * @param {number} value - The value to validate
 * @returns {void}
 * @throws {RangeError} when `value` is `NaN`, infinite or negative
 */
function assertWait(caller: string, name: string, value: number): void {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		throw new RangeError(`${caller}: \`${name}\` must be a finite number >= 0, got ${String(value)}`);
	}
}

/**
 * Throws a `RangeError` unless `value` is an integer `>= 0`.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {string} name - Name of the validated parameter
 * @param {number} value - The value to validate
 * @returns {void}
 * @throws {RangeError} when `value` is not a non-negative integer
 */
function assertCount(caller: string, name: string, value: number): void {
	if (!Number.isInteger(value) || value < 0) {
		throw new RangeError(`${caller}: \`${name}\` must be an integer >= 0, got ${String(value)}`);
	}
}

/**
 * Throws a `TypeError` unless `value` is callable.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {unknown} value - The value to validate
 * @returns {void}
 * @throws {TypeError} when `value` is not a function
 */
function assertFunction(caller: string, value: unknown): asserts value is AnyFunction {
	if (typeof value !== 'function') {
		throw new TypeError(`${caller}: expected a function, got ${typeof value}`);
	}
}

// ---------------------------------------------------------------------------------------------------------------------
// bind / partial / curry
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Creates a function that always invokes `fn` with `thisArg` as `this`, regardless of how it is called.
 * @template T - The `this` type expected by `fn`
 * @template A - The parameter types of `fn`
 * @template R - The return type of `fn`
 * @param {(this: T, ...args: A) => R} fn - The function to bind
 * @param {T} thisArg - The value used as `this` on every call
 * @returns {(...args: A) => R} A new function forwarding its arguments to `fn` with `this` fixed to `thisArg`
 * @throws {TypeError} when `fn` is not a function
 * @example
 * const user = { name: 'Ada' };
 * function greet(this: { name: string }, greeting: string): string { return `${greeting}, ${this.name}`; }
 * bind(greet, user)('Hi'); // 'Hi, Ada'
 */
export function bind<T, A extends unknown[], R>(fn: (this: T, ...args: A) => R, thisArg: T): (...args: A) => R {
	assertFunction('bind', fn);

	return function bound(...args: A): R {
		return fn.apply(thisArg, args);
	};
}

/**
 * Creates a function that invokes `fn` with `args` prepended to the arguments it receives. `this` is forwarded.
 * @template A - The types of the pre-applied arguments
 * @template B - The types of the remaining arguments
 * @template R - The return type of `fn`
 * @param {(...args: [...A, ...B]) => R} fn - The function to partially apply
 * @param {...A} args - The leading arguments to pre-apply
 * @returns {(...rest: B) => R} A function accepting the remaining arguments
 * @throws {TypeError} when `fn` is not a function
 * @example
 * function add(a: number, b: number): number { return a + b; }
 * partial(add, 1)(2); // 3
 */
export function partial<A extends unknown[], B extends unknown[], R>(fn: (...args: [...A, ...B]) => R, ...args: A): (...rest: B) => R {
	assertFunction('partial', fn);

	return function partiallyApplied(this: unknown, ...rest: B): R {
		return (fn as unknown as (this: unknown, ...all: unknown[]) => R).apply(this, [...args, ...rest]);
	};
}

/**
 * The non-empty prefixes of the tuple `A`.
 * @example
 * type P = NonEmptyPrefix<[number, string]>; // [number] | [number, string]
 */
type NonEmptyPrefix<A extends unknown[]> = A extends [infer Head, ...infer Tail] ? [Head] | [Head, ...NonEmptyPrefix<Tail>] : never;

/**
 * Removes as many leading elements from `A` as `P` has.
 * @example
 * type D = DropPrefix<[number, string, boolean], [number]>; // [string, boolean]
 */
type DropPrefix<A extends unknown[], P extends unknown[]> = P extends [unknown, ...infer PTail] ? (A extends [unknown, ...infer ATail] ? DropPrefix<ATail, PTail> : []) : A;

/**
 * The type returned once the arguments `P` have been supplied to a {@link Curried} function expecting `A`.
 */
type CurryStep<A extends unknown[], R> = [] extends A ? R : Curried<A, R>;

/**
 * The type of a curried function produced by {@link curry}: it accepts any non-empty prefix of the remaining arguments and returns
 * either another curried function or, once every argument has been supplied, the result.
 * For non-tuple parameter lists (rest parameters) the precise shape is unknown, so the call returns `unknown`.
 * @template A - The (tuple) parameter types still expected
 * @template R - The final return type
 * @example
 * declare const add3: Curried<[number, number, number], number>;
 * add3(1)(2)(3); // number
 * add3(1, 2)(3); // number
 */
export type Curried<A extends unknown[], R> = number extends A['length']
	? (...args: A) => unknown
	: A extends []
		? () => R
		: <P extends NonEmptyPrefix<A>>(...args: P) => CurryStep<DropPrefix<A, P>, R>;

/**
 * Curries `fn`: the returned function collects arguments (one or several at a time) until `arity` of them have been supplied, then
 * invokes `fn` with all of them and the `this` of the final call. Extra arguments in the final call are forwarded too.
 *
 * `fn.length` does not count rest parameters or parameters with default values, so pass `arity` explicitly for such functions
 * (and an explicit tuple type argument if you want precise types).
 * @template A - The parameter types of `fn`
 * @template R - The return type of `fn`
 * @param {(...args: A) => R} fn - The function to curry
 * @param {number} [arity=fn.length] - Number of arguments to collect before invoking `fn`
 * @returns {Curried<A, R>} The curried function
 * @throws {TypeError} when `fn` is not a function
 * @throws {RangeError} when `arity` is negative or not an integer
 * @example
 * const add3 = curry(function (a: number, b: number, c: number): number { return a + b + c; });
 * add3(1)(2)(3); // 6
 * add3(1, 2)(3); // 6
 * const sum = function (...nums: number[]): number { return nums.reduce(function (a, b) { return a + b; }, 0); };
 * curry<[number, number], number>(sum, 2)(1)(2); // 3
 */
export function curry<A extends unknown[], R>(fn: (...args: A) => R, arity: number = fn.length): Curried<A, R> {
	assertFunction('curry', fn);
	assertCount('curry', 'arity', arity);

	const call = fn as unknown as UnknownFunction;

	/**
	 * Accumulates `collected` arguments and invokes `fn` once `arity` of them are available.
	 * @param {unknown[]} collected - The arguments supplied so far
	 * @returns {UnknownFunction} The next curried step
	 */
	function step(collected: unknown[]): UnknownFunction {
		return function curried(this: unknown, ...args: unknown[]): unknown {
			const all = collected.concat(args);

			return all.length >= arity ? call.apply(this, all) : step(all);
		};
	}

	return step([]) as unknown as Curried<A, R>;
}

// ---------------------------------------------------------------------------------------------------------------------
// compose / pipe
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Composes functions from right to left: `compose(f, g, h)(...args)` is `f(g(h(...args)))`.
 * The rightmost function may take any number of arguments; the others receive a single value. `this` is forwarded to every function.
 * With no functions, the result is the identity function (returns its first argument).
 * @template A - The parameter types of the rightmost function
 * @template R - The return type of the composition
 * @param {...Function} fns - The functions to compose
 * @returns {Function} The composed function
 * @throws {TypeError} when one of `fns` is not a function
 * @example
 * function inc(x: number): number { return x + 1; }
 * function double(x: number): number { return x * 2; }
 * compose(double, inc)(3); // 8
 * compose()(5); // 5
 */
export function compose(): <T>(value: T) => T;
export function compose<A extends unknown[], R>(f1: (...args: A) => R): (...args: A) => R;
export function compose<A extends unknown[], R1, R>(f2: (value: R1) => R, f1: (...args: A) => R1): (...args: A) => R;
export function compose<A extends unknown[], R1, R2, R>(f3: (value: R2) => R, f2: (value: R1) => R2, f1: (...args: A) => R1): (...args: A) => R;
export function compose<A extends unknown[], R1, R2, R3, R>(f4: (value: R3) => R, f3: (value: R2) => R3, f2: (value: R1) => R2, f1: (...args: A) => R1): (...args: A) => R;
export function compose<A extends unknown[], R1, R2, R3, R4, R>(
	f5: (value: R4) => R,
	f4: (value: R3) => R4,
	f3: (value: R2) => R3,
	f2: (value: R1) => R2,
	f1: (...args: A) => R1
): (...args: A) => R;
export function compose<A extends unknown[], R1, R2, R3, R4, R5, R>(
	f6: (value: R5) => R,
	f5: (value: R4) => R5,
	f4: (value: R3) => R4,
	f3: (value: R2) => R3,
	f2: (value: R1) => R2,
	f1: (...args: A) => R1
): (...args: A) => R;
export function compose<R = unknown>(...fns: AnyFunction[]): (...args: unknown[]) => R;
/**
 * Implementation of {@link compose} (see the first overload for the full documentation).
 * @param {...AnyFunction} fns - The functions to compose, applied right to left
 * @returns {(...args: unknown[]) => unknown} The composed function
 */
export function compose(...fns: AnyFunction[]): (...args: unknown[]) => unknown {
	return pipe(...fns.slice().reverse());
}

/**
 * Composes functions from left to right: `pipe(f, g, h)(...args)` is `h(g(f(...args)))`.
 * The first function may take any number of arguments; the others receive a single value. `this` is forwarded to every function.
 * With no functions, the result is the identity function (returns its first argument).
 * @template A - The parameter types of the first function
 * @template R - The return type of the pipeline
 * @param {...Function} fns - The functions to chain
 * @returns {Function} The piped function
 * @throws {TypeError} when one of `fns` is not a function
 * @example
 * function inc(x: number): number { return x + 1; }
 * function double(x: number): number { return x * 2; }
 * pipe(double, inc)(3); // 7
 */
export function pipe(): <T>(value: T) => T;
export function pipe<A extends unknown[], R>(f1: (...args: A) => R): (...args: A) => R;
export function pipe<A extends unknown[], R1, R>(f1: (...args: A) => R1, f2: (value: R1) => R): (...args: A) => R;
export function pipe<A extends unknown[], R1, R2, R>(f1: (...args: A) => R1, f2: (value: R1) => R2, f3: (value: R2) => R): (...args: A) => R;
export function pipe<A extends unknown[], R1, R2, R3, R>(f1: (...args: A) => R1, f2: (value: R1) => R2, f3: (value: R2) => R3, f4: (value: R3) => R): (...args: A) => R;
export function pipe<A extends unknown[], R1, R2, R3, R4, R>(
	f1: (...args: A) => R1,
	f2: (value: R1) => R2,
	f3: (value: R2) => R3,
	f4: (value: R3) => R4,
	f5: (value: R4) => R
): (...args: A) => R;
export function pipe<A extends unknown[], R1, R2, R3, R4, R5, R>(
	f1: (...args: A) => R1,
	f2: (value: R1) => R2,
	f3: (value: R2) => R3,
	f4: (value: R3) => R4,
	f5: (value: R4) => R5,
	f6: (value: R5) => R
): (...args: A) => R;
export function pipe<R = unknown>(...fns: AnyFunction[]): (...args: unknown[]) => R;
/**
 * Implementation of {@link pipe} (see the first overload for the full documentation).
 * @param {...AnyFunction} fns - The functions to chain, applied left to right
 * @returns {(...args: unknown[]) => unknown} The piped function
 * @throws {TypeError} when one of `fns` is not a function
 */
export function pipe(...fns: AnyFunction[]): (...args: unknown[]) => unknown {
	fns.forEach(function (fn) {
		assertFunction('compose/pipe', fn);
	});

	const chain = fns.slice() as unknown as UnknownFunction[];

	return function piped(this: unknown, ...args: unknown[]): unknown {
		if (chain.length === 0) return args[0];

		let result = chain[0].apply(this, args);

		for (let i = 1; i < chain.length; i++) {
			result = chain[i].call(this, result);
		}

		return result;
	};
}

// ---------------------------------------------------------------------------------------------------------------------
// memoize
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The subset of the `Map` API used by {@link memoize} as a cache. A `Map` (or e.g. an LRU cache with the same API) satisfies it.
 * @template K - The cache key type
 * @template V - The cached value type
 */
export interface MemoizeCache<K, V> {
	has(key: K): boolean;
	get(key: K): V | undefined;
	set(key: K, value: V): unknown;
	delete(key: K): boolean;
	clear(): void;
}

/**
 * Options accepted by {@link memoize}.
 * @template F - The memoized function type
 * @template C - The cache type
 */
export interface MemoizeOptions<F extends AnyFunction, C extends MemoizeCache<unknown, ReturnType<F>> = Map<unknown, ReturnType<F>>> {
	/** Computes the cache key from the call arguments (`this` is forwarded). Defaults to {@link defaultMemoizeKey}. */
	resolver?: (...args: Parameters<F>) => unknown;
	/** The cache to use. Defaults to a new `Map`. */
	cache?: C;
}

/**
 * A memoized function as returned by {@link memoize}: callable like `F`, plus access to its cache.
 * @template F - The original function type
 * @template C - The cache type (a `Map` unless a custom cache was supplied)
 */
export type Memoized<F extends AnyFunction, C extends MemoizeCache<unknown, ReturnType<F>> = Map<unknown, ReturnType<F>>> = F & {
	/** The underlying cache, keyed by the resolver's result. */
	readonly cache: C;
	/** Empties the cache. */
	clear(): void;
};

/**
 * The default cache-key resolver used by {@link memoize} (and the `memoize` decorator).
 *
 * - A single primitive argument is used as the key itself, so `1` and `'1'`, `undefined` and `null`, or `NaN` are all distinct keys.
 * - Anything else (zero or several arguments, or an object) is serialised with `JSON.stringify(args)` (bigints are serialised as `'<n>n'`).
 *
 * Limitations of the serialised form: functions, symbols and `undefined` inside arrays/objects collapse to `null` or are dropped,
 * `Map`/`Set` serialise as `{}`, objects are compared structurally (not by identity), key order matters, and circular structures throw.
 * Supply a custom `resolver` for such arguments.
 * @param {...unknown} args - The call arguments
 * @returns {unknown} The cache key
 * @throws {TypeError} when the arguments contain a circular structure
 * @example
 * defaultMemoizeKey(1); // 1
 * defaultMemoizeKey('a', 2); // '["a",2]'
 */
export function defaultMemoizeKey(...args: unknown[]): unknown {
	if (args.length === 1) {
		const [value] = args;
		const isPrimitive = value === null || (typeof value !== 'object' && typeof value !== 'function');

		// Strings starting with '[' could clash with a serialised argument list, so they go through the serialiser too.
		if (isPrimitive && !(typeof value === 'string' && value.startsWith('['))) return value;
	}

	return JSON.stringify(args, function (_key: string, value: unknown): unknown {
		return typeof value === 'bigint' ? `${value.toString()}n` : value;
	});
}

/**
 * Creates a function that caches the results of `fn` by key (see {@link defaultMemoizeKey}). Falsy results (`0`, `''`, `false`, `null`,
 * `undefined`) are cached like any other value. `this` is forwarded to `fn` and to the resolver, but it is NOT part of the default key.
 * @template F - The type of the function to memoize
 * @template C - The cache type (defaults to `Map`)
 * @param {F} fn - The function to memoize
 * @param {MemoizeOptions<F, C>} [options] - Optional `resolver` (custom key function) and `cache` (Map-like store)
 * @returns {Memoized<F, C>} The memoized function, exposing `.cache` and `.clear()`
 * @throws {TypeError} when `fn` or `options.resolver` is not a function
 * @example
 * const square = memoize(function (n: number): number { return n * n; });
 * square(3); // 9 (computed)
 * square(3); // 9 (cached)
 * square.cache.size; // 1
 * square.clear();
 */
export function memoize<F extends AnyFunction, C extends MemoizeCache<unknown, ReturnType<F>> = Map<unknown, ReturnType<F>>>(
	fn: F,
	options: MemoizeOptions<F, C> = {}
): Memoized<F, C> {
	assertFunction('memoize', fn);

	const resolver = (options.resolver ?? defaultMemoizeKey) as UnknownFunction;
	assertFunction('memoize', resolver);

	const cache: MemoizeCache<unknown, ReturnType<F>> = options.cache ?? new Map<unknown, ReturnType<F>>();
	const call = fn as unknown as UnknownFunction;

	/**
	 * The memoized wrapper.
	 * @param {...unknown} args - The call arguments
	 * @returns {unknown} The cached or freshly computed result
	 */
	function memoized(this: unknown, ...args: unknown[]): unknown {
		const key = resolver.apply(this, args);

		if (cache.has(key)) return cache.get(key);

		const result = call.apply(this, args) as ReturnType<F>;
		cache.set(key, result);

		return result;
	}

	Object.defineProperty(memoized, 'cache', { value: cache, enumerable: true });
	Object.defineProperty(memoized, 'clear', {
		value: function clear(): void {
			cache.clear();
		}
	});

	return memoized as unknown as Memoized<F, C>;
}

// ---------------------------------------------------------------------------------------------------------------------
// throttle / debounce
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Options accepted by {@link throttle}.
 */
export interface ThrottleOptions {
	/** Invoke on the leading edge of the window. Defaults to `true`. */
	leading?: boolean;
	/** Invoke on the trailing edge of the window with the latest arguments, if the function was called during the window. Defaults to `false`. */
	trailing?: boolean;
}

/**
 * A throttled function as returned by {@link throttle}.
 * @template F - The original function type
 */
export interface Throttled<F extends AnyFunction> {
	(this: ThisParameterType<F>, ...args: Parameters<F>): ReturnType<F> | undefined;
	/** Cancels a pending trailing invocation and resets the throttle window. */
	cancel(): void;
}

/**
 * Creates a throttled function that invokes `fn` at most once per `wait` milliseconds.
 * By default (`leading: true, trailing: false`) the first call of a window invokes `fn` immediately and later calls in the same window are ignored.
 * With `trailing: true`, the latest call made during a window is invoked (with its own `this` and arguments) when the window ends.
 * Each call returns the result of the most recent invocation of `fn` (`undefined` before the first one).
 * @template F - The type of the function to throttle
 * @param {F} fn - The function to throttle
 * @param {number} wait - The window length in milliseconds
 * @param {ThrottleOptions} [options] - `leading` (default `true`) and `trailing` (default `false`)
 * @returns {Throttled<F>} The throttled function, with a `.cancel()` method
 * @throws {TypeError} when `fn` is not a function, or when both `leading` and `trailing` are `false`
 * @throws {RangeError} when `wait` is negative, `NaN` or infinite
 * @example
 * const onScroll = throttle(function (y: number): void { console.log(y); }, 100, { trailing: true });
 * window.addEventListener('scroll', function () { onScroll(window.scrollY); });
 */
export function throttle<F extends AnyFunction>(fn: F, wait: number, options: ThrottleOptions = {}): Throttled<F> {
	assertFunction('throttle', fn);
	assertWait('throttle', 'wait', wait);

	const leading = options.leading ?? true;
	const trailing = options.trailing ?? false;

	if (!leading && !trailing) throw new TypeError('throttle: at least one of `leading` or `trailing` must be true');

	const call = fn as unknown as UnknownFunction;
	let windowStart: number | undefined;
	let timer: TimerHandle | undefined;
	let hasPending = false;
	let pendingThis: unknown;
	let pendingArgs: unknown[] = [];
	let result: unknown;

	/**
	 * Invokes `fn` and starts a new window at `time`.
	 * @param {unknown} thisArg - The `this` to use
	 * @param {unknown[]} args - The arguments to use
	 * @param {number} time - The current timestamp
	 * @returns {unknown} The result of `fn`
	 */
	function invoke(thisArg: unknown, args: unknown[], time: number): unknown {
		windowStart = time;
		hasPending = false;
		pendingThis = undefined;
		pendingArgs = [];
		result = call.apply(thisArg, args);

		return result;
	}

	/**
	 * Fires at the end of a window and performs the pending trailing invocation, if any.
	 * @returns {void}
	 */
	function onWindowEnd(): void {
		timer = undefined;

		if (hasPending) invoke(pendingThis, pendingArgs, Date.now());
	}

	/**
	 * Schedules the trailing invocation for the end of the current window.
	 * @param {number} delay - Milliseconds until the window ends
	 * @returns {void}
	 */
	function schedule(delay: number): void {
		if (timer === undefined) timer = setTimeout(onWindowEnd, delay);
	}

	/**
	 * The throttled wrapper.
	 * @param {...unknown} args - The call arguments
	 * @returns {unknown} The result of the latest invocation
	 */
	function throttled(this: unknown, ...args: unknown[]): unknown {
		const now = Date.now();
		const inWindow = windowStart !== undefined && now >= windowStart && now - windowStart < wait;

		if (!inWindow) {
			if (timer !== undefined) {
				// A late timer: the newer call supersedes the pending one.
				clearTimeout(timer);
				timer = undefined;
			}

			if (leading) return invoke(this, args, now);

			windowStart = now;
		}

		if (trailing) {
			hasPending = true;
			// eslint-disable-next-line @typescript-eslint/no-this-alias -- the trailing invocation needs the latest call's `this`
			pendingThis = this;
			pendingArgs = args;
			schedule((windowStart as number) + wait - now);
		}

		return result;
	}

	Object.defineProperty(throttled, 'cancel', {
		value: function cancel(): void {
			if (timer !== undefined) clearTimeout(timer);
			timer = undefined;
			windowStart = undefined;
			hasPending = false;
			pendingThis = undefined;
			pendingArgs = [];
		}
	});

	return throttled as unknown as Throttled<F>;
}

/**
 * Options accepted by {@link debounce}.
 */
export interface DebounceOptions {
	/** Invoke on the leading edge of a burst of calls. Defaults to `false`. */
	leading?: boolean;
	/** Invoke on the trailing edge (after `wait` ms without calls) with the latest arguments. Defaults to `true`. */
	trailing?: boolean;
	/** The maximum time `fn` may be delayed before it is invoked (clamped to at least `wait`). */
	maxWait?: number;
}

/**
 * A debounced function as returned by {@link debounce}.
 * @template F - The original function type
 */
export interface Debounced<F extends AnyFunction> {
	(this: ThisParameterType<F>, ...args: Parameters<F>): ReturnType<F> | undefined;
	/** Cancels the pending invocation, if any. */
	cancel(): void;
	/** Immediately performs the pending invocation, if any, and returns the latest result. */
	flush(): ReturnType<F> | undefined;
	/** Whether a trailing invocation is pending. */
	pending(): boolean;
}

/**
 * Creates a debounced function that delays invoking `fn` until `wait` milliseconds have elapsed since the last call.
 * The trailing invocation uses the `this` and arguments of the latest call. With `leading: true`, the first call of a burst is invoked
 * immediately; with `maxWait`, `fn` is guaranteed to be invoked at least every `maxWait` ms during a continuous burst.
 * Each call returns the result of the most recent invocation of `fn` (`undefined` before the first one).
 * @template F - The type of the function to debounce
 * @param {F} fn - The function to debounce
 * @param {number} wait - The quiet period in milliseconds
 * @param {DebounceOptions} [options] - `leading` (default `false`), `trailing` (default `true`) and `maxWait`
 * @returns {Debounced<F>} The debounced function, with `.cancel()`, `.flush()` and `.pending()` methods
 * @throws {TypeError} when `fn` is not a function, or when both `leading` and `trailing` are `false`
 * @throws {RangeError} when `wait` or `maxWait` is negative, `NaN` or infinite
 * @example
 * const save = debounce(function (text: string): void { api.save(text); }, 300);
 * input.addEventListener('input', function () { save(input.value); });
 * window.addEventListener('beforeunload', function () { save.flush(); });
 */
export function debounce<F extends AnyFunction>(fn: F, wait: number, options: DebounceOptions = {}): Debounced<F> {
	assertFunction('debounce', fn);
	assertWait('debounce', 'wait', wait);

	const leading = options.leading ?? false;
	const trailing = options.trailing ?? true;
	const maxing = options.maxWait !== undefined;

	if (maxing) assertWait('debounce', 'maxWait', options.maxWait as number);
	if (!leading && !trailing) throw new TypeError('debounce: at least one of `leading` or `trailing` must be true');

	const maxWait = Math.max(options.maxWait ?? 0, wait);
	const call = fn as unknown as UnknownFunction;
	let timer: TimerHandle | undefined;
	let lastArgs: unknown[] | undefined;
	let lastThis: unknown;
	let lastCallTime: number | undefined;
	let lastInvokeTime = 0;
	let result: unknown;

	/**
	 * Invokes `fn` with the latest `this` and arguments.
	 * @param {number} time - The current timestamp
	 * @returns {unknown} The result of `fn`
	 */
	function invoke(time: number): unknown {
		const args = lastArgs as unknown[];
		const thisArg = lastThis;

		lastArgs = undefined;
		lastThis = undefined;
		lastInvokeTime = time;
		result = call.apply(thisArg, args);

		return result;
	}

	/**
	 * Whether enough time has elapsed for an invocation at `time`.
	 * @param {number} time - The current timestamp
	 * @returns {boolean} `true` when `fn` should be invoked
	 */
	function shouldInvoke(time: number): boolean {
		if (lastCallTime === undefined) return true;

		const sinceCall = time - lastCallTime;

		return sinceCall >= wait || sinceCall < 0 || (maxing && time - lastInvokeTime >= maxWait);
	}

	/**
	 * Milliseconds until the next possible invocation.
	 * @param {number} time - The current timestamp
	 * @returns {number} The remaining delay
	 */
	function remainingWait(time: number): number {
		const remaining = wait - (time - (lastCallTime as number));

		return maxing ? Math.min(remaining, maxWait - (time - lastInvokeTime)) : remaining;
	}

	/**
	 * Ends a burst: performs the trailing invocation if one is due.
	 * @param {number} time - The current timestamp
	 * @returns {unknown} The latest result
	 */
	function trailingEdge(time: number): unknown {
		timer = undefined;

		if (trailing && lastArgs !== undefined) return invoke(time);

		lastArgs = undefined;
		lastThis = undefined;

		return result;
	}

	/**
	 * Timer callback: either ends the burst or re-arms the timer.
	 * @returns {void}
	 */
	function onTimer(): void {
		const time = Date.now();

		if (shouldInvoke(time)) {
			trailingEdge(time);
		} else {
			timer = setTimeout(onTimer, remainingWait(time));
		}
	}

	/**
	 * The debounced wrapper.
	 * @param {...unknown} args - The call arguments
	 * @returns {unknown} The result of the latest invocation
	 */
	function debounced(this: unknown, ...args: unknown[]): unknown {
		const time = Date.now();
		const isInvoking = shouldInvoke(time);

		lastArgs = args;
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- the deferred invocation needs the latest call's `this`
		lastThis = this;
		lastCallTime = time;

		if (isInvoking) {
			if (timer === undefined) {
				// Leading edge of a new burst.
				lastInvokeTime = time;
				timer = setTimeout(onTimer, wait);

				return leading ? invoke(time) : result;
			}

			if (maxing) {
				clearTimeout(timer);
				timer = setTimeout(onTimer, wait);

				return invoke(time);
			}
		}

		if (timer === undefined) timer = setTimeout(onTimer, wait);

		return result;
	}

	Object.defineProperties(debounced, {
		cancel: {
			value: function cancel(): void {
				if (timer !== undefined) clearTimeout(timer);
				timer = undefined;
				lastArgs = undefined;
				lastThis = undefined;
				lastCallTime = undefined;
				lastInvokeTime = 0;
			}
		},
		flush: {
			value: function flush(): unknown {
				if (timer === undefined) return result;

				clearTimeout(timer);

				return trailingEdge(Date.now());
			}
		},
		pending: {
			value: function pending(): boolean {
				return timer !== undefined && trailing && lastArgs !== undefined;
			}
		}
	});

	return debounced as unknown as Debounced<F>;
}

// ---------------------------------------------------------------------------------------------------------------------
// once / before / after / negate / identity / noop
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Creates a function that invokes `fn` only on its first call and returns that first result on every later call.
 * If the first call throws, every later call rethrows the same error. `this` is forwarded to the single invocation.
 * @template F - The type of the function
 * @param {F} fn - The function to restrict
 * @returns {F} A function that invokes `fn` at most once
 * @throws {TypeError} when `fn` is not a function
 * @example
 * const init = once(function (): number { console.log('init'); return 42; });
 * init(); // logs 'init', returns 42
 * init(); // returns 42
 */
export function once<F extends AnyFunction>(fn: F): F {
	assertFunction('once', fn);

	const call = fn as unknown as UnknownFunction;
	let state: { ok: true; value: unknown } | { ok: false; error: unknown } | undefined;

	return function onceWrapper(this: unknown, ...args: unknown[]): unknown {
		if (state === undefined) {
			try {
				state = { ok: true, value: call.apply(this, args) };
			} catch (error) {
				state = { ok: false, error };
			}
		}

		if (state.ok) return state.value;

		throw state.error;
	} as unknown as F;
}

/**
 * Creates a function that invokes `fn` only while it has been called fewer than `n` times; later calls return the last result.
 * `this` is forwarded.
 * @template F - The type of the function
 * @param {number} n - The number of calls after which `fn` is no longer invoked (`before(3, fn)` invokes `fn` on the first two calls)
 * @param {F} fn - The function to restrict
 * @returns {(this: ThisParameterType<F>, ...args: Parameters<F>) => ReturnType<F> | undefined} The restricted function
 * @throws {TypeError} when `fn` is not a function
 * @throws {RangeError} when `n` is not a non-negative integer
 * @example
 * const f = before(3, function (x: number): number { return x * 2; });
 * [f(1), f(2), f(3)]; // [2, 4, 4]
 */
export function before<F extends AnyFunction>(n: number, fn: F): (this: ThisParameterType<F>, ...args: Parameters<F>) => ReturnType<F> | undefined {
	assertCount('before', 'n', n);
	assertFunction('before', fn);

	const call = fn as unknown as UnknownFunction;
	let calls = 0;
	let result: unknown;

	return function beforeWrapper(this: unknown, ...args: unknown[]): unknown {
		calls += 1;

		if (calls < n) result = call.apply(this, args);

		return result;
	} as unknown as (this: ThisParameterType<F>, ...args: Parameters<F>) => ReturnType<F> | undefined;
}

/**
 * Creates a function that invokes `fn` only once it has been called at least `n` times (from the `n`-th call on); earlier calls return `undefined`.
 * `this` is forwarded.
 * @template F - The type of the function
 * @param {number} n - The number of calls before `fn` starts being invoked
 * @param {F} fn - The function to restrict
 * @returns {(this: ThisParameterType<F>, ...args: Parameters<F>) => ReturnType<F> | undefined} The restricted function
 * @throws {TypeError} when `fn` is not a function
 * @throws {RangeError} when `n` is not a non-negative integer
 * @example
 * const done = after(2, function (): string { return 'all loaded'; });
 * done(); // undefined
 * done(); // 'all loaded'
 */
export function after<F extends AnyFunction>(n: number, fn: F): (this: ThisParameterType<F>, ...args: Parameters<F>) => ReturnType<F> | undefined {
	assertCount('after', 'n', n);
	assertFunction('after', fn);

	const call = fn as unknown as UnknownFunction;
	let calls = 0;

	return function afterWrapper(this: unknown, ...args: unknown[]): unknown {
		calls += 1;

		return calls >= n ? call.apply(this, args) : undefined;
	} as unknown as (this: ThisParameterType<F>, ...args: Parameters<F>) => ReturnType<F> | undefined;
}

/**
 * Creates a predicate that returns the boolean negation of `predicate`. `this` is forwarded.
 * @template A - The parameter types of the predicate
 * @template T - The `this` type of the predicate
 * @param {(this: T, ...args: A) => unknown} predicate - The predicate to negate
 * @returns {(this: T, ...args: A) => boolean} The negated predicate
 * @throws {TypeError} when `predicate` is not a function
 * @example
 * const isOdd = negate(function (n: number): boolean { return n % 2 === 0; });
 * [1, 2, 3].filter(isOdd); // [1, 3]
 */
export function negate<A extends unknown[], T = unknown>(predicate: (this: T, ...args: A) => unknown): (this: T, ...args: A) => boolean {
	assertFunction('negate', predicate);

	return function negated(this: T, ...args: A): boolean {
		return !predicate.apply(this, args);
	};
}

/**
 * Returns its argument unchanged.
 * @template T - The value type
 * @param {T} value - Any value
 * @returns {T} `value`
 * @example
 * [1, 0, 2].filter(identity); // [1, 2]
 */
export function identity<T>(value: T): T {
	return value;
}

/**
 * Does nothing and returns `undefined`, whatever the arguments. Handy as a default callback.
 * @param {...unknown} _args - Ignored
 * @returns {void}
 * @example
 * promise.catch(noop);
 */
export function noop(..._args: unknown[]): void {
	// Intentionally empty.
}
