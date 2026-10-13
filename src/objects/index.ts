import { isDate, isError, isFunction, isMap, isObject, isPlainObject, isPromise, isRegExp, isSet, isWeakMap, isWeakSet } from '../guards/index.js';
import type { AnyFunction, DeepReadonly, NestedKeyOf, PathValue, Primitive, UnionToIntersection } from '../utils/index.js';

// Backward compatibility: these type guards MOVED to the `guards` module (where they are real type predicates).
// They are re-exported here so existing `objects` imports keep working; prefer importing them from `guards`.
export {
	isObject,
	isArray,
	isFunction,
	isString,
	isNumber,
	isBoolean,
	isUndefined,
	isNull,
	isSymbol,
	isPromise,
	isRegExp,
	isError,
	isMap,
	isSet,
	isWeakMap,
	isWeakSet
} from '../guards/index.js';

// ---------------------------------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The empty object type `{}` (spelled so that it passes the `ban-types` lint rule).
 */
type EmptyObject = Record<never, never>;

/**
 * Flattens an intersection of object types into a single object type (purely cosmetic, improves editor tooltips).
 */
export type Simplify<T> = { [K in keyof T]: T[K] };

/**
 * The keys of `T` that are declared optional.
 */
export type OptionalKeysOf<T> = { [K in keyof T]-?: EmptyObject extends Pick<T, K> ? K : never }[keyof T];

/**
 * The type produced by spreading `B` over `A` (`{ ...a, ...b }`): keys of `B` override keys of `A`.
 * When a key is optional in `B` but present in `A`, the result is `A[K] | B[K]` (B may or may not provide it).
 * @example
 * type M = Merge<{ a: number; b: string }, { b: boolean; c?: number }>; // { a: number; b: boolean; c?: number }
 */
export type Merge<A, B> = Simplify<
	{ [K in keyof A as K extends keyof B ? never : K]: A[K] } & { [K in keyof B as K extends keyof A ? (K extends OptionalKeysOf<B> ? never : K) : K]: B[K] } & {
		[K in keyof A as K extends OptionalKeysOf<B> ? K : never]: A[K] | B[K & keyof B];
	}
>;

/**
 * Left-to-right {@link Merge} of a target with a tuple of sources (later sources win).
 * For non-tuple arrays of sources (unknown length) every source key becomes optional.
 * @example
 * type M = MergeAll<{ a: 1 }, [{ b: 2 }, { a: 'x' }]>; // { a: 'x'; b: 2 }
 */
export type MergeAll<T, S extends readonly unknown[]> = S extends readonly [infer Head, ...infer Tail]
	? MergeAll<Merge<T, Head>, Tail>
	: S extends readonly []
		? T
		: Merge<T, Partial<UnionToIntersection<S[number]>>>;

/**
 * Values that {@link deepMerge} never merges recursively (they replace the previous value instead).
 */
type NonMergeable =
	| Primitive
	| AnyFunction
	| ReadonlyArray<unknown>
	| Date
	| RegExp
	| Map<unknown, unknown>
	| Set<unknown>
	| WeakMap<object, unknown>
	| WeakSet<object>
	| PromiseLike<unknown>
	| Error
	| ArrayBuffer
	| ArrayBufferView;

/**
 * Whether `T` is a (non-union) object type that {@link deepMerge} merges recursively.
 */
type IsMergeable<T> = [T] extends [NonMergeable] ? false : [T] extends [object] ? true : false;

/**
 * Result of merging the value `B` over the value `A` in {@link DeepMerge}.
 */
type DeepMergeValue<A, B> = IsMergeable<A> extends true ? (IsMergeable<B> extends true ? DeepMerge<A, B> : B) : B;

/**
 * The type produced by {@link deepMerge}: like {@link Merge}, but keys holding objects on both sides are merged recursively.
 * @example
 * type M = DeepMerge<{ a: { x: number; y: string } }, { a: { x: boolean } }>; // { a: { x: boolean; y: string } }
 */
export type DeepMerge<A, B> = Simplify<
	{ [K in keyof A as K extends keyof B ? never : K]: A[K] } & {
		[K in keyof B as K extends keyof A ? (K extends OptionalKeysOf<B> ? never : K) : K]: K extends keyof A ? DeepMergeValue<A[K], B[K]> : B[K];
	} & { [K in keyof A as K extends OptionalKeysOf<B> ? K : never]: A[K] | DeepMergeValue<A[K], Exclude<B[K & keyof B], undefined>> }
>;

/**
 * Left-to-right {@link DeepMerge} of a target with a tuple of sources (later sources win).
 */
export type DeepMergeAll<T, S extends readonly unknown[]> = S extends readonly [infer Head, ...infer Tail]
	? DeepMergeAll<DeepMerge<T, Head>, Tail>
	: S extends readonly []
		? T
		: DeepMerge<T, Partial<UnionToIntersection<S[number]>>>;

/**
 * The type produced by {@link invert}: values become keys and keys become (string) values.
 * @example
 * type I = Invert<{ a: 'x'; b: 'y' }>; // { x: 'a'; y: 'b' }
 */
export type Invert<T> = { -readonly [K in keyof T as T[K] & PropertyKey]: K extends number ? `${K}` : K };

// ---------------------------------------------------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------------------------------------------------

/** Keys that must never be written through a user-controlled path or merged from a source (prototype pollution). */
const UNSAFE_KEYS: ReadonlySet<PropertyKey> = new Set<PropertyKey>(['__proto__', 'constructor', 'prototype']);

/**
 * Whether `object` has an own property named `key`.
 * @param {object} object - The object to inspect
 * @param {PropertyKey} key - The key to look for
 * @returns {boolean} Whether the property is an own property
 */
function hasOwn(object: object, key: PropertyKey): boolean {
	return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Own enumerable keys of an object, string keys first (in `Object.keys` order) followed by symbol keys.
 * @param {object} object - The object to inspect
 * @returns {PropertyKey[]} The own enumerable string and symbol keys
 */
function ownEnumerableKeys(object: object): PropertyKey[] {
	const keys: PropertyKey[] = Object.keys(object);
	for (const symbol of Object.getOwnPropertySymbols(object)) {
		if (Object.prototype.propertyIsEnumerable.call(object, symbol)) keys.push(symbol);
	}
	return keys;
}

/**
 * Defines an own, enumerable, writable, configurable data property. Unlike assignment it never triggers
 * setters (notably `Object.prototype.__proto__`), so a `'__proto__'` key becomes a harmless own property.
 * @param {object} object - The object to write to
 * @param {PropertyKey} key - The property key
 * @param {unknown} value - The value to store
 * @returns {void}
 */
function defineValue(object: object, key: PropertyKey, value: unknown): void {
	Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true });
}

/**
 * Reads a property of an object without type complaints.
 * @param {object} object - The object to read from
 * @param {PropertyKey} key - The key to read
 * @returns {unknown} The property value
 */
function read(object: object, key: PropertyKey): unknown {
	return (object as Record<PropertyKey, unknown>)[key];
}

/**
 * Returns `Object.prototype.toString` tag of a value.
 * @param {unknown} value - The value to inspect
 * @returns {string} The tag, e.g. `'[object Uint8Array]'`
 */
function getTag(value: unknown): string {
	return Object.prototype.toString.call(value);
}

/**
 * Gives `copy` the same prototype as `original` when they differ (keeps subclasses of built-ins and cross-realm prototypes).
 * @template T
 * @param {T} copy - The freshly created object
 * @param {object} original - The object it was copied from
 * @returns {T} `copy`
 */
function adoptPrototype<T extends object>(copy: T, original: object): T {
	const prototype = Object.getPrototypeOf(original);
	if (Object.getPrototypeOf(copy) !== prototype) Object.setPrototypeOf(copy, prototype);
	return copy;
}

/**
 * Copies an `ArrayBuffer`, a typed array or a `DataView` (the underlying bytes are duplicated).
 * @param {ArrayBuffer | ArrayBufferView} value - The buffer or view to copy
 * @returns {ArrayBuffer | ArrayBufferView} An independent copy with the same prototype
 */
function copyBinary(value: ArrayBuffer | ArrayBufferView): ArrayBuffer | ArrayBufferView {
	if (!ArrayBuffer.isView(value)) return adoptPrototype(value.slice(0), value);

	const bytes = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
	const name = getTag(value).slice(8, -1);
	if (name === 'DataView') return adoptPrototype(new DataView(bytes), value);

	const TypedArray = (globalThis as unknown as Record<string, new (buffer: ArrayBufferLike) => ArrayBufferView>)[name];
	return adoptPrototype(new TypedArray(bytes), value);
}

/**
 * Whether a value is an `ArrayBuffer` (incl. `SharedArrayBuffer`) or an `ArrayBuffer` view.
 * @param {unknown} value - The value to check
 * @returns {boolean} Whether the value is binary data
 */
function isBinary(value: unknown): value is ArrayBuffer | ArrayBufferView {
	if (ArrayBuffer.isView(value)) return true;
	const tag = getTag(value);
	return isObject(value) && (tag === '[object ArrayBuffer]' || tag === '[object SharedArrayBuffer]');
}

/**
 * Values that cannot be meaningfully copied and are therefore returned by reference by the clone functions.
 * @param {object} value - The value to check
 * @returns {boolean} Whether the value is a WeakMap, WeakSet or promise-like
 */
function isUncloneable(value: object): boolean {
	return isWeakMap(value) || isWeakSet(value) || isPromise(value);
}

/** `valueOf` implementations that brand-check boxed primitives (they throw for anything else). */
const BOXED_VALUE_OF: ReadonlyMap<string, (this: unknown) => unknown> = new Map<string, (this: unknown) => unknown>([
	['[object Number]', Number.prototype.valueOf],
	['[object String]', String.prototype.valueOf],
	['[object Boolean]', Boolean.prototype.valueOf],
	['[object BigInt]', BigInt.prototype.valueOf],
	['[object Symbol]', Symbol.prototype.valueOf]
]);

/**
 * Unwraps a boxed primitive (`new Number(1)`, `Object('a')`, `Object(1n)`, ...).
 * @param {object} value - The object to inspect
 * @returns {[boolean, unknown]} `[true, primitive]` for genuine boxed primitives, `[false, undefined]` otherwise
 */
function unbox(value: object): [boolean, unknown] {
	const valueOf = BOXED_VALUE_OF.get(getTag(value));
	if (valueOf === undefined) return [false, undefined];
	try {
		return [true, valueOf.call(value)];
	} catch {
		return [false, undefined];
	}
}

/**
 * Creates a fresh `RegExp` with the same source, flags and `lastIndex`.
 * @param {RegExp} value - The regexp to copy
 * @returns {RegExp} The copy
 */
function copyRegExp(value: RegExp): RegExp {
	const copy = new RegExp(value.source, value.flags);
	copy.lastIndex = value.lastIndex;
	return adoptPrototype(copy, value);
}

// ---------------------------------------------------------------------------------------------------------------------
// Shallow helpers
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Shallowly merges one or more source objects into a NEW object, left to right (later keys win, like `{ ...target, ...a, ...b }`).
 * Inputs are never mutated. Own enumerable string and symbol keys are copied; a `'__proto__'` key becomes a plain own property
 * (no prototype change). `null`/`undefined` sources are ignored.
 * @template T - The target type
 * @template S - The tuple of source types
 * @param {T} target - The base object
 * @param {...S} sources - The objects whose properties override the base, in order
 * @returns {MergeAll<T, S>} A new object with the merged properties
 * @example
 * merge({ a: 1, b: 2 }, { b: 'x' }, { c: true }); // { a: 1, b: 'x', c: true }
 */
export function merge<T extends object, S extends object[]>(target: T, ...sources: S): MergeAll<T, S> {
	const result: object = {};

	for (const source of [target, ...sources]) {
		if (source == null) continue;
		for (const key of ownEnumerableKeys(source)) defineValue(result, key, read(source, key));
	}

	return result as MergeAll<T, S>;
}

/**
 * Creates a shallow copy of a value.
 * - Primitives and functions are returned as-is.
 * - Arrays stay arrays (holes preserved); class instances keep their prototype and own enumerable (string and symbol) properties.
 * - `Date`, `RegExp` (incl. `lastIndex`), `Map`, `Set`, `ArrayBuffer`, typed arrays/`DataView` and boxed primitives get a new instance with the same contents.
 * - Errors keep `message`, `stack` and other own (even non-enumerable) properties.
 * - `WeakMap`, `WeakSet` and promises cannot be copied and are returned by reference.
 * @template T - The type of the value
 * @param {T} value - The value to copy
 * @returns {T} The shallow copy
 * @example
 * clone([1, 2]); // [1, 2] (a new array)
 * clone(new Map([['a', 1]])); // a new Map with the same entries
 */
export function clone<T>(value: T): T {
	if (!isObject(value)) return value;
	if (isUncloneable(value)) return value;

	const [isBoxed, primitive] = unbox(value);
	if (isBoxed) return adoptPrototype(Object(primitive), value) as T;
	if (isDate(value)) return adoptPrototype(new Date(value.getTime()), value) as T;
	if (isRegExp(value)) return copyRegExp(value) as T;
	if (isMap(value)) return adoptPrototype(new Map(value), value) as T;
	if (isSet(value)) return adoptPrototype(new Set(value), value) as T;
	if (isBinary(value)) return copyBinary(value) as T;
	if (isError(value)) return Object.create(Object.getPrototypeOf(value), Object.getOwnPropertyDescriptors(value)) as T;

	const copy: object = Array.isArray(value) ? adoptPrototype(new Array(value.length), value) : Object.create(Object.getPrototypeOf(value));
	for (const key of ownEnumerableKeys(value)) defineValue(copy, key, read(value, key));
	return copy as T;
}

/**
 * Determines whether an object has an OWN property with the given key (inherited properties such as `toString` do not count).
 * Acts as a type guard: on success `object` is narrowed to `T & Record<K, unknown>`.
 * @template T - The object type
 * @template K - The key type
 * @param {T} object - The object to check
 * @param {K} property - The property key to look for
 * @returns {boolean} Whether the object has that own property
 * @example
 * hasProperty({ a: 1 }, 'a'); // true
 * hasProperty({}, 'toString'); // false (inherited)
 */
export function hasProperty<T extends object, K extends PropertyKey>(object: T, property: K): object is T & Record<K, unknown> {
	return hasOwn(object, property);
}

/**
 * Gets the value of a property of an object.
 * @template T - The object type
 * @template K - The key type
 * @param {T} object - The object to read from
 * @param {K} property - The property key
 * @returns {T[K]} The property value
 * @example
 * getProperty({ a: 1 }, 'a'); // 1
 */
export function getProperty<T, K extends keyof T>(object: T, property: K): T[K] {
	return object[property];
}

/**
 * Sets the value of a property of an object. MUTATES `object` (plain assignment, so setters run).
 * @template T - The object type
 * @template K - The key type
 * @template V - The value type
 * @param {T} object - The object to modify
 * @param {K} property - The property key
 * @param {V} value - The value to assign
 * @returns {void}
 * @example
 * const target = {};
 * setProperty(target, 'a', 1); // target is now { a: 1 }
 */
export function setProperty<T extends object, K extends PropertyKey, V>(object: T, property: K, value: V): void {
	(object as Record<K, V>)[property] = value;
}

/**
 * Deletes a property from an object. MUTATES `object`.
 * @template T - The object type
 * @template K - The key type
 * @param {T} object - The object to modify
 * @param {K} property - The property key to delete
 * @returns {void}
 * @example
 * const target = { a: 1, b: 2 };
 * deleteProperty(target, 'a'); // target is now { b: 2 }
 */
export function deleteProperty<T, K extends keyof T>(object: T, property: K): void {
	delete object[property];
}

/**
 * Gets the names of ALL own string-keyed properties of an object (`Object.getOwnPropertyNames`), including NON-enumerable ones
 * (e.g. arrays include `'length'`). Symbol keys and inherited properties are not included.
 * @template T - The object type
 * @param {T} object - The object to inspect
 * @returns {Array<keyof T>} The own property names
 * @example
 * getPropertyNames({ a: 1, b: 2 }); // ['a', 'b']
 * getPropertyNames([1]); // ['0', 'length']
 */
export function getPropertyNames<T>(object: T): Array<keyof T> {
	return Object.getOwnPropertyNames(object) as Array<keyof T>;
}

/**
 * Determines whether a value is empty:
 * - `null`/`undefined` → `true`;
 * - strings and arrays → `length === 0`;
 * - `Map`/`Set` → `size === 0`;
 * - other objects (and functions) → no own enumerable string or symbol keys;
 * - other primitives (numbers, booleans, bigints, symbols) → `true` (they have no keys).
 * @template T - The type of the value
 * @param {T} value - The value to check
 * @returns {boolean} Whether the value is empty
 * @example
 * isEmpty({}); // true
 * isEmpty([]); // true
 * isEmpty(new Map([[1, 1]])); // false
 * isEmpty('a'); // false
 */
export function isEmpty<T>(value: T): boolean {
	if (value == null) return true;
	if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
	if (isMap(value) || isSet(value)) return value.size === 0;
	if (isObject(value) || isFunction(value)) return ownEnumerableKeys(value).length === 0;
	return true;
}

/**
 * Creates a new object with only the given keys. A key is copied when it exists on the object (own OR inherited, e.g. class getters);
 * missing keys are skipped. The input is not mutated.
 * @template T - The object type
 * @template K - The picked keys
 * @param {T} object - The source object
 * @param {ReadonlyArray<K>} keys - The keys to keep
 * @returns {Pick<T, K>} A new object with only those keys
 * @example
 * pick({ a: 1, b: 2, c: 3 }, ['a', 'c']); // { a: 1, c: 3 }
 */
export function pick<T extends object, K extends keyof T>(object: T, keys: ReadonlyArray<K>): Pick<T, K> {
	const result = {} as Pick<T, K>;
	for (const key of keys) {
		if (key in object) defineValue(result, key, object[key]);
	}
	return result;
}

/**
 * Creates a new object with every own enumerable (string and symbol) property except the given keys. The input is not mutated.
 * @template T - The object type
 * @template K - The omitted keys
 * @param {T} object - The source object
 * @param {ReadonlyArray<K>} keys - The keys to drop
 * @returns {Omit<T, K>} A new object without those keys
 * @example
 * omit({ a: 1, b: 2, c: 3 }, ['b']); // { a: 1, c: 3 }
 */
export function omit<T extends object, K extends keyof T>(object: T, keys: ReadonlyArray<K>): Omit<T, K> {
	const excluded = new Set<PropertyKey>(keys);
	const result = {} as Omit<T, K>;
	for (const key of ownEnumerableKeys(object)) {
		if (!excluded.has(key)) defineValue(result, key, read(object, key));
	}
	return result;
}

/**
 * Creates a new object with the same own enumerable (string and symbol) keys, whose values are the results of `fn`.
 * @template T - The object type
 * @template R - The mapped value type
 * @param {T} object - The source object
 * @param {(value: T[keyof T], key: keyof T, object: T) => R} fn - Maps each value (receives the value, its key and the object)
 * @returns {{ [K in keyof T]: R }} A new object with mapped values
 * @example
 * mapValues({ a: 1, b: 2 }, function (n) { return n * 10; }); // { a: 10, b: 20 }
 */
export function mapValues<T extends object, R>(object: T, fn: (value: T[keyof T], key: keyof T, object: T) => R): { [K in keyof T]: R } {
	const result = {} as { [K in keyof T]: R };
	for (const key of ownEnumerableKeys(object)) {
		defineValue(result, key, fn(read(object, key) as T[keyof T], key as keyof T, object));
	}
	return result;
}

/**
 * Creates a new object with the same values, whose keys are the results of `fn`. When two keys map to the same new key, the last one wins.
 * @template T - The object type
 * @template K - The new key type
 * @param {T} object - The source object
 * @param {(value: T[keyof T], key: keyof T, object: T) => K} fn - Computes the new key (receives the value, its key and the object)
 * @returns {Record<K, T[keyof T]>} A new object with mapped keys
 * @example
 * mapKeys({ a: 1, b: 2 }, function (_v, k) { return String(k).toUpperCase(); }); // { A: 1, B: 2 }
 */
export function mapKeys<T extends object, K extends PropertyKey>(object: T, fn: (value: T[keyof T], key: keyof T, object: T) => K): Record<K, T[keyof T]> {
	const result = {} as Record<K, T[keyof T]>;
	for (const key of ownEnumerableKeys(object)) {
		const value = read(object, key) as T[keyof T];
		defineValue(result, fn(value, key as keyof T, object), value);
	}
	return result;
}

/**
 * Creates a new object whose keys are the values of `object` and whose values are the (string) keys.
 * Only own enumerable string keys are considered. When several keys share a value, the last one wins.
 * @template T - The object type
 * @param {T} object - The object to invert
 * @returns {Invert<T>} The inverted object
 * @throws {TypeError} when a value is not a string, number or symbol
 * @example
 * invert({ a: 'x', b: 'y' }); // { x: 'a', y: 'b' }
 */
export function invert<T extends Record<PropertyKey, PropertyKey>>(object: T): Invert<T> {
	const result = {} as Invert<T>;
	for (const key of Object.keys(object)) {
		const value: unknown = object[key];
		if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'symbol') {
			throw new TypeError(`invert: value of key "${key}" must be a string, number or symbol, got ${typeof value}`);
		}
		defineValue(result, value, key);
	}
	return result;
}

// ---------------------------------------------------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Splits a dot-separated path and validates its segments for writing.
 * @param {string} path - The path, e.g. `'a.b.0.c'`
 * @returns {string[]} The segments
 * @throws {RangeError} when a segment is empty (e.g. `''`, `'a..b'`, `'a.'`)
 * @throws {TypeError} when a segment is `__proto__`, `constructor` or `prototype`
 */
function parseWritablePath(path: string): string[] {
	const segments = path.split('.');
	for (const segment of segments) {
		if (segment === '') throw new RangeError(`Invalid path "${path}": empty path segment`);
		if (UNSAFE_KEYS.has(segment)) throw new TypeError(`Invalid path "${path}": unsafe path segment "${segment}"`);
	}
	return segments;
}

/**
 * Safely reads a nested value through a dot-separated path (array elements are addressed with numeric segments: `'list.0.id'`).
 * Never throws for missing intermediates: if any step is `null`/`undefined` the result is `undefined`.
 * When `defaultValue` is provided, it is returned whenever the resolved value is `undefined`.
 * @template T - The object type
 * @template P - The path (inferred from the literal, checked against the object's shape)
 * @param {T} target - The object to read from
 * @param {P} keys - The dot-separated path
 * @returns {PathValue<T, P>} The value found at the path (or `undefined`)
 * @example
 * getFromObjectByKeys({ a: { b: [{ id: 1 }] } }, 'a.b.0.id'); // 1
 * getFromObjectByKeys({ a: {} as { x?: { y: number } } }, 'a.x.y'); // undefined
 */
export function getFromObjectByKeys<T extends object, P extends NestedKeyOf<T>>(target: T, keys: P): PathValue<T, P>;
/**
 * Safely reads a nested value through a dot-separated path, returning `defaultValue` when the resolved value is `undefined`.
 * @template T - The object type
 * @template P - The path (inferred from the literal, checked against the object's shape)
 * @template D - The default value type
 * @param {T} target - The object to read from
 * @param {P} keys - The dot-separated path
 * @param {D} defaultValue - The value returned when the path resolves to `undefined`
 * @returns {Exclude<PathValue<T, P>, undefined> | D} The value found at the path, or `defaultValue`
 * @example
 * getFromObjectByKeys({ a: {} as { x?: number } }, 'a.x', 0); // 0
 */
export function getFromObjectByKeys<T extends object, P extends NestedKeyOf<T>, D>(target: T, keys: P, defaultValue: D): Exclude<PathValue<T, P>, undefined> | D;
/**
 * Implementation of {@link getFromObjectByKeys}.
 * @param {object} target - The object to read from
 * @param {string} keys - The dot-separated path
 * @param {unknown} [defaultValue] - The fallback value
 * @returns {unknown} The resolved value
 */
export function getFromObjectByKeys(target: object, keys: string, defaultValue?: unknown): unknown {
	let current: unknown = target;
	for (const segment of keys.split('.')) {
		if (current == null) return defaultValue;
		current = (current as Record<string, unknown>)[segment];
	}
	return current === undefined ? defaultValue : current;
}

/**
 * Sets a nested value through a dot-separated path. MUTATES `target` and returns it.
 * Missing (or `null`/`undefined`) intermediates are created: an array when the next segment is a non-negative integer (`'list.0'`),
 * a plain object otherwise.
 * @template T - The object type
 * @param {T} target - The object to modify
 * @param {string} path - The dot-separated path, e.g. `'a.b.0.c'`
 * @param {unknown} value - The value to store
 * @returns {T} `target`
 * @throws {RangeError} when the path has an empty segment (`''`, `'a..b'`, `'a.'`)
 * @throws {TypeError} when a segment is `__proto__`, `constructor` or `prototype` (prototype pollution guard)
 * @throws {TypeError} when an existing intermediate value is a primitive (it would have to be overwritten)
 * @example
 * setInObjectByKeys({}, 'a.list.0.id', 7); // { a: { list: [{ id: 7 }] } }
 */
export function setInObjectByKeys<T extends object>(target: T, path: string, value: unknown): T {
	const segments = parseWritablePath(path);
	let current = target as Record<string, unknown>;

	for (let index = 0; index < segments.length - 1; index++) {
		const segment = segments[index];
		let next = current[segment];

		if (next == null) {
			next = /^\d+$/.test(segments[index + 1]) ? [] : {};
			current[segment] = next;
		} else if (!isObject(next) && !isFunction(next)) {
			throw new TypeError(`Cannot set "${path}": "${segments.slice(0, index + 1).join('.')}" is a ${typeof next}, not an object`);
		}

		current = next as Record<string, unknown>;
	}

	current[segments[segments.length - 1]] = value;
	return target;
}

// ---------------------------------------------------------------------------------------------------------------------
// Deep helpers
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Recursive worker of {@link deepClone}.
 * @param {unknown} value - The value to copy
 * @param {WeakMap<object, unknown>} seen - Already-copied objects (handles shared and circular references)
 * @returns {unknown} The deep copy
 */
function deepCloneWith(value: unknown, seen: WeakMap<object, unknown>): unknown {
	if (!isObject(value)) return value;
	if (seen.has(value)) return seen.get(value);
	if (isUncloneable(value)) return value;

	const [isBoxed, primitive] = unbox(value);
	if (isBoxed) return adoptPrototype(Object(primitive), value);
	if (isDate(value)) return adoptPrototype(new Date(value.getTime()), value);
	if (isRegExp(value)) return copyRegExp(value);
	if (isBinary(value)) return copyBinary(value);

	if (isMap(value)) {
		const copy = adoptPrototype(new Map<unknown, unknown>(), value);
		seen.set(value, copy);
		value.forEach(function (entryValue, entryKey) {
			copy.set(deepCloneWith(entryKey, seen), deepCloneWith(entryValue, seen));
		});
		return copy;
	}

	if (isSet(value)) {
		const copy = adoptPrototype(new Set<unknown>(), value);
		seen.set(value, copy);
		value.forEach(function (member) {
			copy.add(deepCloneWith(member, seen));
		});
		return copy;
	}

	if (isError(value)) {
		const copy: object = Object.create(Object.getPrototypeOf(value));
		seen.set(value, copy);
		for (const key of Reflect.ownKeys(value)) {
			const descriptor = Object.getOwnPropertyDescriptor(value, key) as PropertyDescriptor;
			if ('value' in descriptor) descriptor.value = deepCloneWith(descriptor.value, seen);
			Object.defineProperty(copy, key, descriptor);
		}
		return copy;
	}

	const copy: object = Array.isArray(value) ? adoptPrototype(new Array(value.length), value) : Object.create(Object.getPrototypeOf(value));
	seen.set(value, copy);
	for (const key of ownEnumerableKeys(value)) defineValue(copy, key, deepCloneWith(read(value, key), seen));
	return copy;
}

/**
 * Creates a deep copy of a value without using `structuredClone`.
 * - Primitives are returned as-is; functions are copied BY REFERENCE.
 * - Arrays, plain objects and class instances are copied recursively (prototype preserved; own enumerable string AND symbol keys copied,
 *   getters are read and stored as data properties).
 * - `Date`, `RegExp` (incl. `lastIndex`), `Map` (keys and values cloned), `Set`, `ArrayBuffer`, typed arrays, `DataView` and boxed primitives get new instances.
 * - Errors keep their prototype and all own properties (`message`, `stack`, `cause`, ...).
 * - `WeakMap`, `WeakSet` and promises cannot be copied and are returned by reference.
 * - Shared and CIRCULAR references are preserved (the copy has the same reference graph).
 * - Extra own properties attached to built-ins (Date, Map, Set, RegExp, typed arrays) are not copied.
 * Very deeply nested inputs (thousands of levels) can exceed the call stack (`RangeError`).
 * @template T - The type of the value
 * @param {T} value - The value to copy
 * @returns {T} An independent deep copy
 * @example
 * const original = { a: [1, { b: 2 }], when: new Date(0) };
 * const copy = deepClone(original);
 * copy.a !== original.a; // true
 * isEqual(copy, original); // true
 */
export function deepClone<T>(value: T): T {
	return deepCloneWith(value, new WeakMap()) as T;
}

/**
 * Recursively merges the own enumerable keys of `source` into the (freshly created, owned) object `result`.
 * @param {object} result - The object being built (mutated)
 * @param {object} source - The plain object to merge in
 * @param {Set<object>} ancestors - Source objects currently being merged (cycle detection)
 * @returns {object} `result`
 * @throws {TypeError} when `source` contains a circular reference
 */
function deepMergeInto(result: object, source: object, ancestors: Set<object>): object {
	if (ancestors.has(source)) throw new TypeError('deepMerge: cannot merge objects with circular references');
	ancestors.add(source);

	for (const key of ownEnumerableKeys(source)) {
		if (UNSAFE_KEYS.has(key)) continue;
		const sourceValue = read(source, key);

		if (isPlainObject(sourceValue)) {
			const current = hasOwn(result, key) ? read(result, key) : undefined;
			const base = isPlainObject(current) ? current : Object.create(Object.getPrototypeOf(sourceValue));
			defineValue(result, key, deepMergeInto(base, sourceValue, ancestors));
		} else {
			defineValue(result, key, sourceValue);
		}
	}

	ancestors.delete(source);
	return result;
}

/**
 * Deeply merges plain objects into a NEW object, left to right (later sources win). Inputs are never mutated.
 * - Only PLAIN objects are merged recursively (every merged plain object in the result is a fresh object).
 * - Arrays, dates, maps, class instances and all other values REPLACE the previous value and are assigned by reference.
 * - A key present in a source always wins, even when its value is `undefined`.
 * - Keys `__proto__`, `constructor` and `prototype` are ignored everywhere (prototype pollution guard).
 * - `null`/`undefined` sources are skipped.
 * @template T - The target type
 * @template S - The tuple of source types
 * @param {T} target - The base plain object
 * @param {...S} sources - Plain objects merged over the base, in order
 * @returns {DeepMergeAll<T, S>} A new, deeply merged object
 * @throws {TypeError} when the target or a source is not a plain object
 * @throws {TypeError} when an input contains a circular reference through plain objects
 * @example
 * deepMerge({ a: { x: 1, y: 2 }, list: [1, 2] }, { a: { y: 3 }, list: [9] }); // { a: { x: 1, y: 3 }, list: [9] }
 */
export function deepMerge<T extends object, S extends object[]>(target: T, ...sources: S): DeepMergeAll<T, S> {
	if (!isPlainObject(target)) throw new TypeError('deepMerge: target must be a plain object');

	const ancestors = new Set<object>();
	const result = deepMergeInto(Object.create(Object.getPrototypeOf(target)), target, ancestors);

	for (const source of sources) {
		if (source == null) continue;
		if (!isPlainObject(source)) throw new TypeError('deepMerge: every source must be a plain object');
		deepMergeInto(result, source, ancestors);
	}

	return result as DeepMergeAll<T, S>;
}

/**
 * SameValueZero comparison (like `===` but `NaN` equals `NaN`).
 * @param {unknown} a - First value
 * @param {unknown} b - Second value
 * @returns {boolean} Whether the values are SameValueZero-equal
 */
function sameValueZero(a: unknown, b: unknown): boolean {
	return a === b || (a !== a && b !== b);
}

/**
 * Pairs of objects currently being compared by {@link isEqual} (used to detect cycles).
 */
interface ComparisonStack {
	left: object[];
	right: object[];
}

/**
 * Compares two `Map`s: same size and every entry of `a` matches a distinct entry of `b` (keys and values deeply equal).
 * Primitive keys are looked up directly (O(1)); only object keys need the O(n²) pairwise matching.
 * @param {Map<unknown, unknown>} a - First map
 * @param {Map<unknown, unknown>} b - Second map
 * @param {ComparisonStack} stack - Cycle detection stack
 * @returns {boolean} Whether the maps are deeply equal
 */
function mapsEqual(a: Map<unknown, unknown>, b: Map<unknown, unknown>, stack: ComparisonStack): boolean {
	if (a.size !== b.size) return false;
	const objectEntriesB = Array.from(b).filter(function ([key]) {
		return isObject(key);
	});
	const matched = new Array<boolean>(objectEntriesB.length).fill(false);

	for (const [keyA, valueA] of a) {
		if (!isObject(keyA)) {
			if (!b.has(keyA) || !equalWith(valueA, b.get(keyA), stack)) return false;
			continue;
		}
		const index = objectEntriesB.findIndex(function ([keyB, valueB], candidate) {
			return !matched[candidate] && equalWith(keyA, keyB, stack) && equalWith(valueA, valueB, stack);
		});
		if (index === -1) return false;
		matched[index] = true;
	}
	return true;
}

/**
 * Compares two `Set`s: same size and every member of `a` matches a distinct, deeply equal member of `b`.
 * Primitive members are looked up directly (O(1)); only object members need the O(n²) pairwise matching.
 * @param {Set<unknown>} a - First set
 * @param {Set<unknown>} b - Second set
 * @param {ComparisonStack} stack - Cycle detection stack
 * @returns {boolean} Whether the sets are deeply equal
 */
function setsEqual(a: Set<unknown>, b: Set<unknown>, stack: ComparisonStack): boolean {
	if (a.size !== b.size) return false;
	const objectMembersB = Array.from(b).filter(isObject);
	const matched = new Array<boolean>(objectMembersB.length).fill(false);

	for (const memberA of a) {
		if (!isObject(memberA)) {
			if (!b.has(memberA)) return false;
			continue;
		}
		const index = objectMembersB.findIndex(function (memberB, candidate) {
			return !matched[candidate] && equalWith(memberA, memberB, stack);
		});
		if (index === -1) return false;
		matched[index] = true;
	}
	return true;
}

/**
 * Compares the bytes of two buffers / the elements of two typed arrays.
 * @param {ArrayBuffer | ArrayBufferView} a - First buffer or view
 * @param {ArrayBuffer | ArrayBufferView} b - Second buffer or view (same tag as `a`)
 * @returns {boolean} Whether the contents are equal
 */
function binaryEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean {
	let left: ArrayLike<unknown>;
	let right: ArrayLike<unknown>;

	if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b)) {
		left = new Uint8Array(a as ArrayBuffer);
		right = new Uint8Array(b as ArrayBuffer);
	} else if (getTag(a) === '[object DataView]') {
		left = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
		right = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
	} else {
		left = a as unknown as ArrayLike<unknown>;
		right = b as unknown as ArrayLike<unknown>;
	}

	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index++) {
		if (!sameValueZero(left[index], right[index])) return false;
	}
	return true;
}

/**
 * Compares the own enumerable (string and symbol) properties of two objects.
 * @param {object} a - First object
 * @param {object} b - Second object
 * @param {ComparisonStack} stack - Cycle detection stack
 * @returns {boolean} Whether both have the same keys with deeply equal values
 */
function propertiesEqual(a: object, b: object, stack: ComparisonStack): boolean {
	const keysA = ownEnumerableKeys(a);
	const keysB = ownEnumerableKeys(b);
	if (keysA.length !== keysB.length) return false;

	for (const key of keysA) {
		if (!Object.prototype.propertyIsEnumerable.call(b, key)) return false;
		if (!equalWith(read(a, key), read(b, key), stack)) return false;
	}
	return true;
}

/**
 * Compares two objects of the same prototype and tag according to their kind.
 * @param {object} a - First object
 * @param {object} b - Second object
 * @param {ComparisonStack} stack - Cycle detection stack
 * @returns {boolean} Whether they are deeply equal
 */
function objectsEqual(a: object, b: object, stack: ComparisonStack): boolean {
	if (isUncloneable(a)) return false;
	if (isDate(a)) return sameValueZero(a.getTime(), (b as Date).getTime());
	if (isRegExp(a)) return a.source === (b as RegExp).source && a.flags === (b as RegExp).flags;
	if (isMap(a)) return mapsEqual(a, b as Map<unknown, unknown>, stack);
	if (isSet(a)) return setsEqual(a, b as Set<unknown>, stack);
	if (isBinary(a)) return binaryEqual(a, b as ArrayBuffer | ArrayBufferView);
	const [isBoxedA, primitiveA] = unbox(a);
	if (isBoxedA) {
		const [isBoxedB, primitiveB] = unbox(b);
		if (!isBoxedB || !sameValueZero(primitiveA, primitiveB)) return false;
	}
	if (isError(a) && (a.name !== (b as Error).name || a.message !== (b as Error).message)) return false;
	if (Array.isArray(a) && a.length !== (b as unknown[]).length) return false;
	return propertiesEqual(a, b, stack);
}

/**
 * Recursive worker of {@link isEqual}.
 * @param {unknown} a - First value
 * @param {unknown} b - Second value
 * @param {ComparisonStack} stack - Pairs currently being compared (cycle detection)
 * @returns {boolean} Whether the values are deeply equal
 */
function equalWith(a: unknown, b: unknown, stack: ComparisonStack): boolean {
	if (sameValueZero(a, b)) return true;
	if (!isObject(a) || !isObject(b)) return false;
	if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

	if (getTag(a) !== getTag(b)) return false;

	for (let index = stack.left.length - 1; index >= 0; index--) {
		if (stack.left[index] === a && stack.right[index] === b) return true;
	}

	stack.left.push(a);
	stack.right.push(b);
	const result = objectsEqual(a, b, stack);
	stack.left.pop();
	stack.right.pop();
	return result;
}

/**
 * Deep structural equality.
 * - Primitives use SameValueZero: `NaN` equals `NaN` and `+0` equals `-0`. Functions are compared by reference.
 * - Objects must have the SAME prototype (so `{}` and `Object.create(null)`, or two different classes, are never equal) and the same kind.
 * - Arrays and objects: same own enumerable string AND symbol keys with deeply equal values (holes are not equal to `undefined`).
 * - `Date`: same time value (two invalid dates are equal). `RegExp`: same `source` and `flags` (`lastIndex` ignored).
 * - `Map`/`Set`: same size and a one-to-one matching of deeply equal entries/members. Primitive keys/members are matched in O(1);
 *   object keys/members are matched pairwise, which is O(n²) in the worst case.
 * - Typed arrays (element-wise), `DataView`/`ArrayBuffer` (byte-wise), boxed primitives (by value), errors (`name` + `message` + own enumerable props).
 * - `WeakMap`, `WeakSet` and promises are only equal to themselves.
 * - Circular structures are supported (pairs already under comparison are assumed equal).
 * @param {unknown} a - First value
 * @param {unknown} b - Second value
 * @returns {boolean} Whether the values are deeply equal
 * @example
 * isEqual({ a: [1, { b: NaN }] }, { a: [1, { b: NaN }] }); // true
 * isEqual(new Set([1, 2]), new Set([2, 1])); // true
 * isEqual([1], { 0: 1 }); // false
 */
export function isEqual(a: unknown, b: unknown): boolean {
	return equalWith(a, b, { left: [], right: [] });
}

/**
 * Recursively freezes an object and every object reachable through its own (string and symbol) data properties,
 * as well as `Map` keys/values and `Set` members. Circular references are handled.
 * Functions and prototypes are NOT frozen; getters are not invoked. Typed arrays/`DataView`s cannot be frozen and are skipped,
 * and `Map`/`Set` instances are frozen as objects but their contents remain mutable at runtime (the type is read-only).
 * MUTATES (freezes) the input and returns it.
 * @template T - The type of the value
 * @param {T} object - The value to freeze
 * @returns {DeepReadonly<T>} The same value, typed as deeply read-only
 * @example
 * const config = deepFreeze({ server: { port: 80 } });
 * Object.isFrozen(config.server); // true
 */
export function deepFreeze<T>(object: T): DeepReadonly<T> {
	const visited = new WeakSet<object>();
	const pending: unknown[] = [object];

	while (pending.length > 0) {
		const value = pending.pop();
		if (!isObject(value) || visited.has(value) || ArrayBuffer.isView(value)) continue;
		visited.add(value);

		if (isMap(value)) {
			value.forEach(function (entryValue, entryKey) {
				pending.push(entryKey, entryValue);
			});
		} else if (isSet(value)) {
			value.forEach(function (member) {
				pending.push(member);
			});
		}

		for (const key of Reflect.ownKeys(value)) {
			const descriptor = Object.getOwnPropertyDescriptor(value, key) as PropertyDescriptor;
			if ('value' in descriptor) pending.push(descriptor.value);
		}

		Object.freeze(value);
	}

	return object as DeepReadonly<T>;
}
