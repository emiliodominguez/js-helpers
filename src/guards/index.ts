import type { AnyFunction, Primitive } from '../utils/index.js';

/**
 * Returns the internal `[object Tag]` string of a value (as produced by `Object.prototype.toString`).
 * @param {unknown} value - The value to inspect
 * @returns {string} The tag string, e.g. `'[object Date]'`
 */
function getTag(value: unknown): string {
	return Object.prototype.toString.call(value);
}

/**
 * Brand check used by the built-in guards: calls a built-in method that throws when the receiver lacks the right
 * internal slot. Unlike `instanceof` (or `Object.prototype.toString` tags) it cannot be fooled by
 * `Object.create(Map.prototype)`, proxies or a fake `Symbol.toStringTag`, and it recognises instances from other realms
 * (iframes, `vm` contexts) as well as subclass instances.
 * @param {unknown} value - The value to check
 * @param {(target: object) => void} brandCheck - A function that throws when `target` is not a real instance
 * @returns {boolean} Whether the value is a genuine (possibly cross-realm) instance
 */
function hasBrand(value: unknown, brandCheck: (target: object) => void): boolean {
	if (typeof value !== 'object' || value === null) return false;

	try {
		brandCheck(value);
		return true;
	} catch {
		return false;
	}
}

const regExpSourceGetter = (Object.getOwnPropertyDescriptor(RegExp.prototype, 'source') as PropertyDescriptor).get as (this: RegExp) => string;

/**
 * Brand check for `Date` (throws for non-dates).
 * @param {object} target - The candidate
 * @returns {void}
 */
function checkDate(target: object): void {
	Date.prototype.getTime.call(target as Date);
}

/**
 * Brand check for `RegExp` (throws for non-regexps).
 * @param {object} target - The candidate
 * @returns {void}
 */
function checkRegExp(target: object): void {
	// The `source` getter special-cases `RegExp.prototype` itself (returns '(?:)') instead of throwing.
	if (target === RegExp.prototype) throw new TypeError('RegExp.prototype is not a regular expression');
	regExpSourceGetter.call(target as RegExp);
}

/**
 * Brand check for `Map` (throws for non-maps).
 * @param {object} target - The candidate
 * @returns {void}
 */
function checkMap(target: object): void {
	Map.prototype.has.call(target as Map<unknown, unknown>, undefined);
}

/**
 * Brand check for `Set` (throws for non-sets).
 * @param {object} target - The candidate
 * @returns {void}
 */
function checkSet(target: object): void {
	Set.prototype.has.call(target as Set<unknown>, undefined);
}

/**
 * Brand check for `WeakMap` (throws for non-weakmaps).
 * @param {object} target - The candidate
 * @returns {void}
 */
function checkWeakMap(target: object): void {
	WeakMap.prototype.has.call(target as WeakMap<object, unknown>, {});
}

/**
 * Brand check for `WeakSet` (throws for non-weaksets).
 * @param {object} target - The candidate
 * @returns {void}
 */
function checkWeakSet(target: object): void {
	WeakSet.prototype.has.call(target as WeakSet<object>, {});
}

/**
 * Checks whether a value is a non-null object (`typeof value === 'object'`).
 * Functions are NOT considered objects by this guard (use {@link isFunction} for them).
 * Note: at the type level `object` also includes functions, so a narrowed `object` may still be callable in TypeScript's eyes.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a non-null, non-function object
 * @example
 * isObject({}); // true
 * isObject([]); // true
 * isObject(null); // false
 * isObject(function () {}); // false
 */
export function isObject(value: unknown): value is object {
	return value !== null && typeof value === 'object';
}

/**
 * Checks whether a value is an array (works across realms, uses `Array.isArray`).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is an array
 * @example
 * isArray([1, 2]); // true
 * isArray('ab'); // false
 */
export function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

/**
 * Checks whether a value is callable (functions, arrow functions, classes, async and generator functions).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a function
 * @example
 * isFunction(Math.max); // true
 * isFunction({}); // false
 */
export function isFunction(value: unknown): value is AnyFunction {
	return typeof value === 'function';
}

/**
 * Checks whether a value is a primitive string (boxed `String` objects are not strings here).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a string
 * @example
 * isString('hello'); // true
 * isString(new String('hello')); // false
 */
export function isString(value: unknown): value is string {
	return typeof value === 'string';
}

/**
 * Checks whether a value is a primitive number. `NaN` and `±Infinity` ARE numbers for this guard
 * (use {@link isFiniteNumber} to exclude them).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a number
 * @example
 * isNumber(42); // true
 * isNumber(NaN); // true
 * isNumber('42'); // false
 */
export function isNumber(value: unknown): value is number {
	return typeof value === 'number';
}

/**
 * Checks whether a value is a primitive boolean.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is `true` or `false`
 * @example
 * isBoolean(false); // true
 * isBoolean(0); // false
 */
export function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

/**
 * Checks whether a value is `undefined`.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is `undefined`
 * @example
 * isUndefined(undefined); // true
 * isUndefined(null); // false
 */
export function isUndefined(value: unknown): value is undefined {
	return value === undefined;
}

/**
 * Checks whether a value is `null`.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is `null`
 * @example
 * isNull(null); // true
 * isNull(undefined); // false
 */
export function isNull(value: unknown): value is null {
	return value === null;
}

/**
 * Checks whether a value is a symbol.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a symbol
 * @example
 * isSymbol(Symbol.iterator); // true
 * isSymbol('symbol'); // false
 */
export function isSymbol(value: unknown): value is symbol {
	return typeof value === 'symbol';
}

/**
 * Checks whether a value is a bigint.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a bigint
 * @example
 * isBigInt(10n); // true
 * isBigInt(10); // false
 */
export function isBigInt(value: unknown): value is bigint {
	return typeof value === 'bigint';
}

/**
 * Checks whether a value is promise-like: a native `Promise` OR any thenable
 * (an object or function with a callable `then` property), which is what `await` accepts.
 * Note that the `then` property is read, so getters on it will run.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a promise or thenable
 * @example
 * isPromise(Promise.resolve(1)); // true
 * isPromise({ then: function () {} }); // true
 * isPromise({ then: 1 }); // false
 */
export function isPromise(value: unknown): value is PromiseLike<unknown> {
	if (value instanceof Promise) return true;
	if (!isObject(value) && !isFunction(value)) return false;
	return typeof (value as { then?: unknown }).then === 'function';
}

/**
 * Checks whether a value is a genuine `RegExp` (it has the internal regexp slots).
 * Uses a brand check, so regexps from other realms (iframes, `vm` contexts) and subclass instances are recognised,
 * while objects that only inherit from `RegExp.prototype`, proxies, or objects faking `Symbol.toStringTag` are rejected.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a regular expression
 * @example
 * isRegExp(/a/g); // true
 * isRegExp('/a/'); // false
 */
export function isRegExp(value: unknown): value is RegExp {
	return hasBrand(value, checkRegExp);
}

/**
 * Checks whether a value is an `Error` (including subclasses such as `TypeError`).
 * Uses `instanceof`, falling back to `Object.prototype.toString` (`'[object Error]'`) so errors from other realms are recognised.
 * There is no brand-check method for errors, so an object faking `Symbol.toStringTag = 'Error'` will pass the fallback.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is an error
 * @example
 * isError(new TypeError('x')); // true
 * isError({ message: 'x' }); // false
 */
export function isError(value: unknown): value is Error {
	return value instanceof Error || (isObject(value) && getTag(value) === '[object Error]');
}

/**
 * Checks whether a value is a `Date` instance. It does NOT check validity: `new Date('nope')` is still a `Date`
 * (check `Number.isNaN(date.getTime())` for that).
 * Uses a brand check: cross-realm dates and subclass instances are recognised; objects that merely inherit from
 * `Date.prototype` (whose methods would throw) and proxies are rejected.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a Date
 * @example
 * isDate(new Date()); // true
 * isDate(new Date('invalid')); // true
 * isDate(Date.now()); // false
 */
export function isDate(value: unknown): value is Date {
	return hasBrand(value, checkDate);
}

/**
 * Checks whether a value is a genuine `Map` (brand check: cross-realm and subclass instances pass; objects that merely
 * inherit from `Map.prototype`, and proxies, fail).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a Map
 * @example
 * isMap(new Map()); // true
 * isMap(new WeakMap()); // false
 */
export function isMap(value: unknown): value is Map<unknown, unknown> {
	return hasBrand(value, checkMap);
}

/**
 * Checks whether a value is a genuine `Set` (brand check: cross-realm and subclass instances pass; objects that merely
 * inherit from `Set.prototype`, and proxies, fail).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a Set
 * @example
 * isSet(new Set()); // true
 * isSet([]); // false
 */
export function isSet(value: unknown): value is Set<unknown> {
	return hasBrand(value, checkSet);
}

/**
 * Checks whether a value is a genuine `WeakMap` (brand check: cross-realm and subclass instances pass; objects that
 * merely inherit from `WeakMap.prototype`, and proxies, fail).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a WeakMap
 * @example
 * isWeakMap(new WeakMap()); // true
 * isWeakMap(new Map()); // false
 */
export function isWeakMap(value: unknown): value is WeakMap<object, unknown> {
	return hasBrand(value, checkWeakMap);
}

/**
 * Checks whether a value is a genuine `WeakSet` (brand check: cross-realm and subclass instances pass; objects that
 * merely inherit from `WeakSet.prototype`, and proxies, fail).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a WeakSet
 * @example
 * isWeakSet(new WeakSet()); // true
 * isWeakSet(new Set()); // false
 */
export function isWeakSet(value: unknown): value is WeakSet<object> {
	return hasBrand(value, checkWeakSet);
}

/**
 * Checks whether a value is `null` or `undefined`.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is nullish
 * @example
 * isNil(null); // true
 * isNil(undefined); // true
 * isNil(0); // false
 */
export function isNil(value: unknown): value is null | undefined {
	return value === null || value === undefined;
}

/**
 * Checks whether a value is neither `null` nor `undefined`, narrowing `T` to `NonNullable<T>`.
 * Handy as an array filter: `list.filter(isDefined)`.
 * @template T - The type of the value
 * @param {T} value - The value to check
 * @returns {boolean} Whether the value is not nullish
 * @example
 * [1, null, 2, undefined].filter(isDefined); // [1, 2] typed as number[]
 */
export function isDefined<T>(value: T): value is NonNullable<T> {
	return value !== null && value !== undefined;
}

/**
 * Checks whether a value is a plain object: an object whose prototype is exactly `Object.prototype` or `null`
 * (object literals, `Object.create(null)`, `JSON.parse` output). Arrays, class instances, dates, maps, etc. are not plain.
 * Plain objects coming from another realm have a different `Object.prototype` and are therefore NOT considered plain.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a plain object
 * @example
 * isPlainObject({ a: 1 }); // true
 * isPlainObject(Object.create(null)); // true
 * isPlainObject(new Date()); // false
 * isPlainObject([]); // false
 */
export function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
	if (!isObject(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || prototype === Object.prototype;
}

/**
 * Checks whether a value is a primitive (`string`, `number`, `bigint`, `boolean`, `symbol`, `null` or `undefined`).
 * Equivalent to `!(isObject(value) || isFunction(value))`.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a primitive
 * @example
 * isPrimitive('a'); // true
 * isPrimitive(null); // true
 * isPrimitive({}); // false
 */
export function isPrimitive(value: unknown): value is Primitive {
	return value === null || (typeof value !== 'object' && typeof value !== 'function');
}

/**
 * Checks whether a value implements the iterable protocol (`value[Symbol.iterator]` is a function).
 * Primitive strings ARE iterable.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is iterable
 * @example
 * isIterable([1]); // true
 * isIterable('abc'); // true
 * isIterable(new Map()); // true
 * isIterable({}); // false
 */
export function isIterable(value: unknown): value is Iterable<unknown> {
	return value != null && typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function';
}

/**
 * Checks whether a value implements the async iterable protocol (`value[Symbol.asyncIterator]` is a function).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is async iterable
 * @example
 * isAsyncIterable((async function* () {})()); // true
 * isAsyncIterable([1]); // false
 */
export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
	return value != null && typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function';
}

/**
 * Checks whether a value is a finite number (excludes `NaN` and `±Infinity`).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a finite number
 * @example
 * isFiniteNumber(1.5); // true
 * isFiniteNumber(Infinity); // false
 * isFiniteNumber('1'); // false
 */
export function isFiniteNumber(value: unknown): value is number {
	return Number.isFinite(value);
}

/**
 * Checks whether a value is an integer number (finite, no fractional part). `-0` and `1e21` count as integers.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is an integer
 * @example
 * isInteger(3); // true
 * isInteger(3.5); // false
 * isInteger(3n); // false (bigints are not numbers)
 */
export function isInteger(value: unknown): value is number {
	return Number.isInteger(value);
}

/**
 * Any built-in typed array (the eleven `TypedArray` constructors of ES2022). `DataView` is not a typed array.
 */
export type TypedArray =
	Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array;

/**
 * A type-guard function, as accepted by {@link isArrayOf} and {@link isRecordOf}.
 * @template T - The type the guard narrows to
 */
export type Guard<T> = (value: unknown) => value is T;

const TYPED_ARRAY_NAMES: ReadonlySet<string> = new Set([
	'Int8Array',
	'Uint8Array',
	'Uint8ClampedArray',
	'Int16Array',
	'Uint16Array',
	'Int32Array',
	'Uint32Array',
	'Float32Array',
	'Float64Array',
	'BigInt64Array',
	'BigUint64Array'
]);

/**
 * `%TypedArray%.prototype[Symbol.toStringTag]` getter: returns the constructor name for genuine typed arrays (of any realm)
 * and `undefined` for everything else, without ever throwing.
 */
const typedArrayTagGetter = (Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Int8Array.prototype), Symbol.toStringTag) as PropertyDescriptor).get as (
	this: unknown
) => string | undefined;

const arrayBufferByteLengthGetter = (Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength') as PropertyDescriptor).get as (this: ArrayBuffer) => number;

/**
 * Brand check for `ArrayBuffer` (throws for non-buffers, including `SharedArrayBuffer`).
 * @param {object} target - The candidate
 * @returns {void}
 */
function checkArrayBuffer(target: object): void {
	arrayBufferByteLengthGetter.call(target as ArrayBuffer);
}

/**
 * Asserts that a value is a function, for the guard factories.
 * @param {unknown} value - The value to check
 * @param {string} name - The parameter name, used in the error message
 * @returns {void}
 * @throws {TypeError} when `value` is not a function
 */
function assertFunction(value: unknown, name: string): void {
	if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
}

/**
 * Builds a short, never-throwing description of an arbitrary value for error messages.
 * @param {unknown} value - The value to describe
 * @returns {string} The description
 */
function describe(value: unknown): string {
	if (typeof value === 'string') return JSON.stringify(value);
	if (typeof value === 'bigint') return `${value}n`;
	if (typeof value === 'symbol' || typeof value === 'function' || value === null || typeof value !== 'object') return String(value);

	try {
		return JSON.stringify(value) ?? getTag(value);
	} catch {
		return getTag(value);
	}
}

/**
 * Checks whether a value is a primitive string with at least one UTF-16 code unit. Whitespace-only strings are
 * NOT empty (trim first if that matters).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a non-empty string
 * @example
 * isNonEmptyString('a'); // true
 * isNonEmptyString(' '); // true
 * isNonEmptyString(''); // false
 * isNonEmptyString(new String('a')); // false
 */
export function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

/**
 * Checks whether a (mutable) array has at least one element, narrowing it to a non-empty tuple `[T, ...T[]]` so that
 * `value[0]` is typed `T` (not `T | undefined` under `noUncheckedIndexedAccess`). `null`/`undefined` give `false`.
 * Sparse arrays count by `length`, like `Array#length`.
 * @template T - The element type
 * @param {T[] | null | undefined} value - The array to check
 * @returns {boolean} Whether the value is a non-empty array
 * @example
 * const list: number[] = [1, 2];
 * if (isNonEmptyArray(list)) list[0].toFixed(); // list: [number, ...number[]]
 */
export function isNonEmptyArray<T>(value: T[] | null | undefined): value is [T, ...T[]];
/**
 * Checks whether a readonly array has at least one element, narrowing it to `readonly [T, ...T[]]`.
 * @template T - The element type
 * @param {ReadonlyArray<T> | null | undefined} value - The array to check
 * @returns {boolean} Whether the value is a non-empty array
 * @example
 * const list: ReadonlyArray<string> = ['a'];
 * if (isNonEmptyArray(list)) list[0].toUpperCase(); // list: readonly [string, ...string[]]
 */
export function isNonEmptyArray<T>(value: ReadonlyArray<T> | null | undefined): value is readonly [T, ...T[]];
/**
 * Checks whether an unknown value is an array with at least one element, narrowing it to `[unknown, ...unknown[]]`.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a non-empty array
 * @example
 * isNonEmptyArray([1]); // true
 * isNonEmptyArray([]); // false
 * isNonEmptyArray('a'); // false
 */
export function isNonEmptyArray(value: unknown): value is [unknown, ...unknown[]];
/**
 * Checks whether a value is an array with at least one element (implementation of the overloads above).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a non-empty array
 * @example
 * isNonEmptyArray([0]); // true
 */
export function isNonEmptyArray(value: unknown): value is [unknown, ...unknown[]] {
	return Array.isArray(value) && value.length > 0;
}

/**
 * Checks whether `key` is an OWN property key of `object` (string, number or symbol; enumerable or not), narrowing
 * `key` to `keyof T`. Inherited keys such as `'toString'` or `'__proto__'` are rejected, which makes it safe to use
 * before indexing with untrusted keys.
 * @template T - The object type
 * @param {T} object - The object whose keys are checked
 * @param {unknown} key - The candidate key
 * @returns {boolean} Whether `key` is an own key of `object`
 * @throws {TypeError} when `object` is `null` or `undefined`
 * @example
 * const colors = { red: '#f00', blue: '#00f' };
 * isKeyOf(colors, 'red'); // true, key: 'red' | 'blue'
 * isKeyOf(colors, 'toString'); // false (inherited)
 * isKeyOf(colors, 42); // false
 */
export function isKeyOf<T extends object>(object: T, key: unknown): key is keyof T {
	if (object === null || object === undefined) throw new TypeError('object must not be null or undefined');
	if (typeof key !== 'string' && typeof key !== 'number' && typeof key !== 'symbol') return false;

	return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Creates a guard that checks membership in a fixed list of values (compared with SameValueZero, like `Array#includes`,
 * so `NaN` matches `NaN` and `0` matches `-0`), narrowing to the union of the list's element types. Pass the list
 * as a literal (or `as const`) to get literal types. The list is copied, so later mutations do not affect the guard.
 * @template T - The readonly tuple of allowed values
 * @param {T} values - The allowed values
 * @returns {(value: unknown) => boolean} A guard narrowing to `T[number]`
 * @throws {TypeError} when `values` is not an array
 * @example
 * const isDirection = isOneOf(['up', 'down']);
 * isDirection('up'); // true, narrows to 'up' | 'down'
 * isDirection('left'); // false
 */
export function isOneOf<const T extends ReadonlyArray<unknown>>(values: T): (value: unknown) => value is T[number] {
	if (!Array.isArray(values)) throw new TypeError('values must be an array');

	const allowed = new Set<unknown>(values);

	return function isOneOfValues(value: unknown): value is T[number] {
		return allowed.has(value);
	};
}

/**
 * Creates a guard that checks `value instanceof constructor` (so it honours `Symbol.hasInstance` and the prototype
 * chain; it does not recognise instances from other realms).
 * @template T - The instance type
 * @param {abstract new (...args: never[]) => T} constructor - The class (or constructor function) to check against
 * @returns {(value: unknown) => boolean} A guard narrowing to `T`
 * @throws {TypeError} when `constructor` cannot be used as the right-hand side of `instanceof`
 * @example
 * class User {}
 * const isUser = isInstanceOf(User);
 * isUser(new User()); // true
 * isUser({}); // false
 */
export function isInstanceOf<T>(constructor: abstract new (...args: never[]) => T): (value: unknown) => value is T {
	assertFunction(constructor, 'constructor');
	if (!isInstanceofTarget(constructor)) throw new TypeError('constructor is not a valid instanceof target');

	return function isInstance(value: unknown): value is T {
		return value instanceof constructor;
	};
}

/**
 * Checks whether a function can be used on the right-hand side of `instanceof` without throwing (arrow functions and
 * methods have no `prototype` object and make `instanceof` throw).
 * @param {unknown} candidate - The function to check
 * @returns {boolean} Whether `x instanceof candidate` is safe to evaluate
 */
function isInstanceofTarget(candidate: unknown): boolean {
	try {
		return typeof ({} instanceof (candidate as unknown as abstract new () => unknown)) === 'boolean';
	} catch {
		return false;
	}
}

/**
 * Creates a guard that checks that a value is an array whose every element passes `guard`. Every index from `0` to
 * `length - 1` is checked, so the holes of a sparse array are tested as `undefined` (unlike `Array#every`, which skips
 * them). The element guard is called with the element only.
 * @template T - The element type
 * @param {Guard<T>} guard - The element guard
 * @returns {(value: unknown) => boolean} A guard narrowing to `T[]`
 * @throws {TypeError} when `guard` is not a function
 * @example
 * const isStringArray = isArrayOf(isString);
 * isStringArray(['a', 'b']); // true
 * isStringArray(['a', 1]); // false
 * isStringArray([]); // true
 */
export function isArrayOf<T>(guard: Guard<T>): (value: unknown) => value is T[] {
	assertFunction(guard, 'guard');

	return function isArrayOfGuarded(value: unknown): value is T[] {
		if (!Array.isArray(value)) return false;

		for (let index = 0; index < value.length; index++) {
			if (!guard(value[index])) return false;
		}

		return true;
	};
}

/**
 * Creates a guard that checks that a value is a plain object (see {@link isPlainObject}) whose own enumerable
 * property values (string AND symbol keys) all pass `guard`. Property values are read, so getters run.
 * The element guard is called with the value only.
 * @template T - The value type
 * @param {Guard<T>} guard - The value guard
 * @returns {(value: unknown) => boolean} A guard narrowing to `Record<PropertyKey, T>`
 * @throws {TypeError} when `guard` is not a function
 * @example
 * const isScores = isRecordOf(isFiniteNumber);
 * isScores({ alice: 3, bob: 5 }); // true
 * isScores({ alice: '3' }); // false
 * isScores(new Map()); // false (not a plain object)
 */
export function isRecordOf<T>(guard: Guard<T>): (value: unknown) => value is Record<PropertyKey, T> {
	assertFunction(guard, 'guard');

	return function isRecordOfGuarded(value: unknown): value is Record<PropertyKey, T> {
		if (!isPlainObject(value)) return false;

		const keys: PropertyKey[] = [...Object.keys(value), ...Object.getOwnPropertySymbols(value)];

		return keys.every(function (key: PropertyKey): boolean {
			return !Object.prototype.propertyIsEnumerable.call(value, key) || guard(value[key]);
		});
	};
}

/**
 * Checks whether a value is one of the eleven built-in typed arrays (`Uint8Array`, `Float64Array`, `BigInt64Array`…),
 * including subclasses and instances from other realms. `DataView`, `ArrayBuffer` and plain arrays are not typed arrays.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a typed array
 * @example
 * isTypedArray(new Uint8Array(2)); // true
 * isTypedArray(new DataView(new ArrayBuffer(2))); // false
 * isTypedArray([1, 2]); // false
 */
export function isTypedArray(value: unknown): value is TypedArray {
	const name = typedArrayTagGetter.call(value);

	return name !== undefined && TYPED_ARRAY_NAMES.has(name);
}

/**
 * Checks whether a value is a genuine `ArrayBuffer` (brand check: cross-realm instances and detached buffers pass;
 * `SharedArrayBuffer`, typed arrays and objects that merely inherit from `ArrayBuffer.prototype` fail).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is an ArrayBuffer
 * @example
 * isArrayBuffer(new ArrayBuffer(8)); // true
 * isArrayBuffer(new Uint8Array(8)); // false
 * isArrayBuffer(new Uint8Array(8).buffer); // true
 */
export function isArrayBuffer(value: unknown): value is ArrayBuffer {
	return hasBrand(value, checkArrayBuffer);
}

/**
 * Error thrown by {@link assert}, {@link assertDefined} and {@link assertNever}.
 * @example
 * try {
 *   assert(false, 'boom');
 * } catch (error) {
 *   error instanceof AssertionError; // true
 * }
 */
export class AssertionError extends Error {
	/**
	 * Creates an assertion error.
	 * @param {string} [message='Assertion failed'] - The error message
	 */
	constructor(message = 'Assertion failed') {
		super(message);
		this.name = 'AssertionError';
	}
}

/**
 * Asserts that a condition is truthy; TypeScript then narrows `condition` (and anything derived from it) after the call.
 * @param {unknown} condition - The condition to check
 * @param {string} [message='Assertion failed'] - The error message
 * @returns {void}
 * @throws {AssertionError} when `condition` is falsy
 * @example
 * function divide(a: number, b: number): number {
 *   assert(b !== 0, 'Division by zero');
 *   return a / b;
 * }
 */
export function assert(condition: unknown, message?: string): asserts condition {
	if (!condition) throw new AssertionError(message);
}

/**
 * Asserts that a value is neither `null` nor `undefined`, narrowing it to `NonNullable<T>` after the call.
 * @template T - The type of the value
 * @param {T} value - The value to check
 * @param {string} [message='Expected value to be defined, received <null|undefined>'] - The error message
 * @returns {void}
 * @throws {AssertionError} when `value` is `null` or `undefined`
 * @example
 * const element: HTMLElement | null = document.getElementById('app');
 * assertDefined(element, '#app is missing');
 * element.focus(); // element: HTMLElement
 */
export function assertDefined<T>(value: T, message?: string): asserts value is NonNullable<T> {
	if (value === null || value === undefined) throw new AssertionError(message ?? `Expected value to be defined, received ${String(value)}`);
}

/**
 * Marks a code path that must be unreachable, typically the `default` branch of an exhaustive `switch`: the call only
 * type-checks when `value` has been narrowed to `never`, so adding a new union member becomes a compile error.
 * At runtime (e.g. with unexpected data) it always throws.
 * @param {never} value - The value that should be impossible
 * @param {string} [message='Unexpected value: <value>'] - The error message
 * @returns {never} Never returns
 * @throws {AssertionError} always
 * @example
 * type Shape = { kind: 'circle'; r: number } | { kind: 'square'; size: number };
 * function area(shape: Shape): number {
 *   switch (shape.kind) {
 *     case 'circle': return Math.PI * shape.r ** 2;
 *     case 'square': return shape.size ** 2;
 *     default: return assertNever(shape);
 *   }
 * }
 */
export function assertNever(value: never, message?: string): never {
	throw new AssertionError(message ?? `Unexpected value: ${describe(value)}`);
}
