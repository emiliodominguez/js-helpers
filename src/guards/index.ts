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
 * Cross-realm fallback used by the built-in guards: the value must report the expected tag AND survive a
 * brand check (a built-in method that throws when the receiver lacks the right internal slot).
 * The brand check makes objects that merely fake `Symbol.toStringTag` fail.
 * @param {unknown} value - The value to check
 * @param {string} tag - The expected `Object.prototype.toString` tag
 * @param {(target: object) => void} brandCheck - A function that throws when `target` is not a real instance
 * @returns {boolean} Whether the value is a genuine (possibly cross-realm) instance
 */
function hasBrand(value: unknown, tag: string, brandCheck: (target: object) => void): boolean {
	if (typeof value !== 'object' || value === null || getTag(value) !== tag) return false;

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
 * Checks whether a value is a `RegExp`.
 * Uses `instanceof`, falling back to a tag + brand check so regexps from other realms (iframes, `vm` contexts) are recognised
 * while objects that only fake `Symbol.toStringTag` are rejected.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a regular expression
 * @example
 * isRegExp(/a/g); // true
 * isRegExp('/a/'); // false
 */
export function isRegExp(value: unknown): value is RegExp {
	return value instanceof RegExp || hasBrand(value, '[object RegExp]', checkRegExp);
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
 * Cross-realm dates are recognised via a tag + brand check.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a Date
 * @example
 * isDate(new Date()); // true
 * isDate(new Date('invalid')); // true
 * isDate(Date.now()); // false
 */
export function isDate(value: unknown): value is Date {
	return value instanceof Date || hasBrand(value, '[object Date]', checkDate);
}

/**
 * Checks whether a value is a `Map` (cross-realm maps are recognised via a tag + brand check).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a Map
 * @example
 * isMap(new Map()); // true
 * isMap(new WeakMap()); // false
 */
export function isMap(value: unknown): value is Map<unknown, unknown> {
	return value instanceof Map || hasBrand(value, '[object Map]', checkMap);
}

/**
 * Checks whether a value is a `Set` (cross-realm sets are recognised via a tag + brand check).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a Set
 * @example
 * isSet(new Set()); // true
 * isSet([]); // false
 */
export function isSet(value: unknown): value is Set<unknown> {
	return value instanceof Set || hasBrand(value, '[object Set]', checkSet);
}

/**
 * Checks whether a value is a `WeakMap` (cross-realm weak maps are recognised via a tag + brand check).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a WeakMap
 * @example
 * isWeakMap(new WeakMap()); // true
 * isWeakMap(new Map()); // false
 */
export function isWeakMap(value: unknown): value is WeakMap<object, unknown> {
	return value instanceof WeakMap || hasBrand(value, '[object WeakMap]', checkWeakMap);
}

/**
 * Checks whether a value is a `WeakSet` (cross-realm weak sets are recognised via a tag + brand check).
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is a WeakSet
 * @example
 * isWeakSet(new WeakSet()); // true
 * isWeakSet(new Set()); // false
 */
export function isWeakSet(value: unknown): value is WeakSet<object> {
	return value instanceof WeakSet || hasBrand(value, '[object WeakSet]', checkWeakSet);
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
