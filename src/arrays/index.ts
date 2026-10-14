import { sum } from '../math/index.js';
import type { RandomGenerator } from '../utils/index.js';

/**
 * Values that are falsy in JavaScript and representable as types.
 * At runtime {@link compact} also removes `-0` and `NaN`, which TypeScript cannot express as literal types.
 */
export type Falsy = false | null | undefined | 0 | 0n | '';

/**
 * Recursively unwraps (possibly readonly) nested arrays down to their non-array element type.
 * @example
 * type R = FlatDeep<number | (number | string[])[]>; // number | string
 */
export type FlatDeep<T> = T extends ReadonlyArray<infer U> ? FlatDeep<U> : T;

/**
 * The tuple of element types produced by {@link zip} for a tuple of input arrays.
 * @example
 * type R = Zipped<[number[], string[]]>; // [number, string]
 */
export type Zipped<T extends ReadonlyArray<ReadonlyArray<unknown>>> = { -readonly [K in keyof T]: T[K] extends ReadonlyArray<infer U> ? U : never };

/**
 * Values accepted as sort keys by {@link sortBy}.
 */
export type SortKey = number | string | bigint | Date;

/**
 * Sort direction accepted by {@link sortBy}.
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Largest length a JavaScript array can have.
 */
const MAX_ARRAY_LENGTH = 2 ** 32 - 1;

/**
 * Throws a `RangeError` unless `value` is an integer `>= min`.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {string} name - Name of the validated parameter
 * @param {number} value - The value to validate
 * @param {number} min - Smallest accepted value
 * @returns {void}
 * @throws {RangeError} when `value` is not an integer or is smaller than `min`
 */
function assertInteger(caller: string, name: string, value: number, min: number): void {
	if (!Number.isInteger(value) || value < min) {
		throw new RangeError(`${caller}: \`${name}\` must be an integer >= ${min}, got ${String(value)}`);
	}
}

/**
 * Draws a uniformly distributed index in `[0, length)` from `random`.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {RandomGenerator} random - Generator returning floats in `[0, 1)`
 * @param {number} length - Exclusive upper bound of the index
 * @returns {number} An integer in `[0, length)`
 * @throws {RangeError} when `random()` returns a value outside `[0, 1)`
 */
function randomIndex(caller: string, random: RandomGenerator, length: number): number {
	const value = random();
	if (!(value >= 0 && value < 1)) {
		throw new RangeError(`${caller}: \`random()\` must return a number in [0, 1), got ${String(value)}`);
	}
	return Math.floor(value * length);
}

/**
 * Type guard telling whether a (possibly nested) element is an array.
 * @template T
 * @param {T | ReadonlyArray<T>} value - The value to inspect
 * @returns {boolean} Whether `value` is an array
 */
function isArray<T>(value: T | ReadonlyArray<T>): value is ReadonlyArray<T> {
	return Array.isArray(value);
}

/**
 * Check if an array contains a value, using SameValueZero equality (so `NaN` is found and `0` matches `-0`).
 * @template T
 * @param {ReadonlyArray<T>} array - The array to be checked
 * @param {T} value - The value to look for
 * @returns {boolean} Whether the value is in the array
 * @example
 * contains([1, 2, 3], 2); // => true
 * contains([NaN], NaN); // => true
 */
export function contains<T>(array: ReadonlyArray<T>, value: T): boolean {
	return array.includes(value);
}

/**
 * Get the first item in an array.
 * @template T
 * @param {ReadonlyArray<T>} array - The array to be processed
 * @returns {T | undefined} The first item, or `undefined` when the array is empty
 * @example
 * first([1, 2, 3]); // => 1
 * first([]); // => undefined
 */
export function first<T>(array: ReadonlyArray<T>): T | undefined {
	return array[0];
}

/**
 * Get the last item in an array.
 * @template T
 * @param {ReadonlyArray<T>} array - The array to be processed
 * @returns {T | undefined} The last item, or `undefined` when the array is empty
 * @example
 * last([1, 2, 3]); // => 3
 * last([]); // => undefined
 */
export function last<T>(array: ReadonlyArray<T>): T | undefined {
	return array[array.length - 1];
}

/**
 * Flatten an array by exactly one level, like `Array.prototype.flat()` (holes in sparse arrays are skipped).
 * @template T
 * @param {ReadonlyArray<T | ReadonlyArray<T>>} array - The array to be flattened
 * @returns {T[]} A new, one-level-flattened array
 * @example
 * flatten([[1, 2], 3, [4]]); // => [1, 2, 3, 4]
 * flatten([[1, [2]]]); // => [1, [2]]
 */
export function flatten<T>(array: ReadonlyArray<T | ReadonlyArray<T>>): T[] {
	const result: T[] = [];
	for (let i = 0; i < array.length; i++) {
		if (!(i in array)) continue;
		const value = array[i];
		if (isArray(value)) {
			for (let j = 0; j < value.length; j++) {
				if (j in value) result.push(value[j]);
			}
		} else {
			result.push(value);
		}
	}
	return result;
}

/**
 * Recursively flatten nested arrays of any depth, like `Array.prototype.flat(Infinity)` (holes are skipped).
 * The implementation is iterative, so very deep nesting cannot overflow the call stack.
 * @template T
 * @param {ReadonlyArray<T>} array - The array to be flattened
 * @returns {Array<FlatDeep<T>>} A new array containing every non-array leaf, in depth-first order
 * @throws {TypeError} when the array contains itself (directly or through nested arrays)
 * @example
 * flattenDeep([1, [2, [3, [4]]]]); // => [1, 2, 3, 4]
 */
export function flattenDeep<T>(array: ReadonlyArray<T>): Array<FlatDeep<T>> {
	const result: Array<FlatDeep<T>> = [];
	const stack: Array<ReadonlyArray<unknown>> = [array];
	const positions: number[] = [0];
	const ancestors = new Set<ReadonlyArray<unknown>>(stack);
	while (stack.length > 0) {
		const top = stack.length - 1;
		const current = stack[top];
		const index = positions[top];
		if (index >= current.length) {
			stack.pop();
			positions.pop();
			ancestors.delete(current);
			continue;
		}
		positions[top] = index + 1;
		if (!(index in current)) continue;
		const value: unknown = current[index];
		if (Array.isArray(value)) {
			if (ancestors.has(value)) throw new TypeError('flattenDeep: cannot flatten a circular array');
			ancestors.add(value);
			stack.push(value);
			positions.push(0);
		} else {
			result.push(value as FlatDeep<T>);
		}
	}
	return result;
}

/**
 * Appends to `result` every value of `values` not yet in `seen`, recording it in `seen`. The original value is kept, so `-0` stays
 * `-0` (a `Set` would hand back `+0`).
 * @template T
 * @param {Iterable<T>} values - The values to scan
 * @param {Set<T>} seen - The values already emitted (mutated)
 * @param {T[]} result - The output array (mutated)
 * @returns {T[]} `result`
 * @example
 * appendUnseen([1, 1, 2], new Set(), []); // => [1, 2]
 */
function appendUnseen<T>(values: Iterable<T>, seen: Set<T>, result: T[]): T[] {
	for (const value of values) {
		if (!seen.has(value)) {
			seen.add(value);
			result.push(value);
		}
	}
	return result;
}

/**
 * Remove duplicates from an iterable (SameValueZero equality), keeping the first occurrence of each value.
 * @template T
 * @param {Iterable<T>} iterable - The iterable to be processed
 * @returns {T[]} A new array with duplicates removed, in first-appearance order
 * @example
 * removeDuplicates([1, 2, 2, 3, 1]); // => [1, 2, 3]
 */
export function removeDuplicates<T>(iterable: Iterable<T>): T[] {
	return appendUnseen(iterable, new Set<T>(), []);
}

/**
 * Get the union of two iterables: every distinct value from `a`, then every distinct value of `b` not already in `a`.
 * Uses SameValueZero equality.
 * @template T
 * @param {Iterable<T>} a - The first iterable
 * @param {Iterable<T>} b - The second iterable
 * @returns {T[]} The unique values of both iterables, in first-appearance order
 * @example
 * union([1, 2, 3], [3, 4, 5]); // => [1, 2, 3, 4, 5]
 */
export function union<T>(a: Iterable<T>, b: Iterable<T>): T[] {
	const seen = new Set<T>();
	return appendUnseen(b, seen, appendUnseen(a, seen, []));
}

/**
 * Get the intersection of two iterables: the distinct values of `a` that also appear in `b`.
 * Uses SameValueZero equality.
 * @template T
 * @param {Iterable<T>} a - The first iterable (defines the output order)
 * @param {Iterable<T>} b - The second iterable
 * @returns {T[]} The unique common values, in order of first appearance in `a`
 * @example
 * intersection([1, 2, 3], [2, 3, 4]); // => [2, 3]
 */
export function intersection<T>(a: Iterable<T>, b: Iterable<T>): T[] {
	const remaining = new Set<T>(b);
	const result: T[] = [];
	for (const value of a) {
		// Deleting on first match both tests membership and guarantees uniqueness.
		if (remaining.delete(value)) result.push(value);
	}
	return result;
}

/**
 * Get the difference of two iterables: the distinct values of `a` that do not appear in `b`.
 * Uses SameValueZero equality.
 * @template T
 * @param {Iterable<T>} a - The iterable to take values from (defines the output order)
 * @param {Iterable<T>} b - The iterable of values to exclude
 * @returns {T[]} The unique values of `a` missing from `b`, in first-appearance order
 * @example
 * difference([1, 2, 3, 1], [2, 3, 4]); // => [1]
 */
export function difference<T>(a: Iterable<T>, b: Iterable<T>): T[] {
	const excluded = new Set<T>(b);
	const result: T[] = [];
	for (const value of a) {
		if (!excluded.has(value)) {
			// Excluding the value once emitted guarantees uniqueness without a second Set.
			excluded.add(value);
			result.push(value);
		}
	}
	return result;
}

/**
 * Get the symmetric difference of two iterables: the distinct values that appear in exactly one of them.
 * Uses SameValueZero equality.
 * @template T
 * @param {Iterable<T>} a - The first iterable
 * @param {Iterable<T>} b - The second iterable
 * @returns {T[]} The values only in `a` (first-appearance order), followed by the values only in `b`
 * @example
 * symmetricDifference([1, 2, 3], [3, 4]); // => [1, 2, 4]
 */
export function symmetricDifference<T>(a: Iterable<T>, b: Iterable<T>): T[] {
	const uniqueA = removeDuplicates(a);
	const uniqueB = removeDuplicates(b);
	const setA = new Set<T>(uniqueA);
	const setB = new Set<T>(uniqueB);
	const result: T[] = [];
	for (const value of uniqueA) {
		if (!setB.has(value)) result.push(value);
	}
	for (const value of uniqueB) {
		if (!setA.has(value)) result.push(value);
	}
	return result;
}

/**
 * Check whether every value of `subset` also appears in `superset` (SameValueZero equality).
 * An empty `subset` is a subset of anything.
 * @template T
 * @param {Iterable<T>} subset - The candidate subset
 * @param {Iterable<T>} superset - The candidate superset
 * @returns {boolean} Whether `subset` ⊆ `superset`
 * @example
 * isSubset([1, 2], [3, 2, 1]); // => true
 * isSubset([1, 4], [1, 2, 3]); // => false
 */
export function isSubset<T>(subset: Iterable<T>, superset: Iterable<T>): boolean {
	const set = new Set<T>(superset);
	for (const value of subset) {
		if (!set.has(value)) return false;
	}
	return true;
}

/**
 * Split an array into consecutive chunks of `size` items; only the last chunk may be shorter.
 * @template T
 * @param {ReadonlyArray<T>} array - The array to split
 * @param {number} size - The maximum length of each chunk (a positive integer)
 * @returns {T[][]} A new array of chunks (empty when the input is empty)
 * @throws {RangeError} when `size` is not a positive integer
 * @example
 * chunk([1, 2, 3, 4, 5], 2); // => [[1, 2], [3, 4], [5]]
 */
export function chunk<T>(array: ReadonlyArray<T>, size: number): T[][] {
	assertInteger('chunk', 'size', size, 1);
	const result: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		result.push(array.slice(i, i + size));
	}
	return result;
}

/**
 * Remove every falsy value (`false`, `null`, `undefined`, `0`, `-0`, `NaN`, `''`, `0n`) from an array.
 * @template T
 * @param {ReadonlyArray<T>} array - The array to compact
 * @returns {Array<Exclude<T, Falsy>>} A new array containing only the truthy values
 * @example
 * compact([0, 1, false, 2, '', 3, null, NaN]); // => [1, 2, 3]
 */
export function compact<T>(array: ReadonlyArray<T>): Array<Exclude<T, Falsy>> {
	return array.filter(function (value): value is Exclude<T, Falsy> {
		return Boolean(value);
	});
}

/**
 * Create an array of numbers progressing from `start` up to, but not including, `end`, with Python `range` semantics.
 * With a single argument, it is the (exclusive) end and the range starts at 0.
 * The result is empty when `step` points away from `end`. Each value is computed as `start + i * step`,
 * so fractional steps do not accumulate rounding errors (but are still subject to floating-point precision).
 * When `(end - start) / step` is an integer up to floating-point rounding (e.g. `range(0, 2.1, 0.3)`), the range has exactly
 * that many items, and no item ever reaches `end` (it is always exclusive, even when rounding errors would land on it).
 * @param {number} start - The first value, or the exclusive end when `end` is omitted
 * @param {number} [end] - The exclusive end of the range
 * @param {number} [step=1] - The increment between values (may be negative, never 0)
 * @returns {number[]} The generated numbers
 * @throws {RangeError} when an argument is not finite, `step` is 0, or the result would exceed the maximum array length
 * @example
 * range(5); // => [0, 1, 2, 3, 4]
 * range(2, 8, 2); // => [2, 4, 6]
 * range(5, 0, -2); // => [5, 3, 1]
 * range(0, 5, -1); // => []
 * range(0, 2.1, 0.3); // => [0, 0.3, 0.6, 0.8999999999999999, 1.2, 1.5, 1.7999999999999998] // 7 items, 2.1 excluded
 */
export function range(start: number, end?: number, step = 1): number[] {
	const from = end === undefined ? 0 : start;
	const to = end === undefined ? start : end;
	if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(step)) {
		throw new RangeError(`range: arguments must be finite numbers, got (${String(start)}, ${String(end)}, ${String(step)})`);
	}
	if (step === 0) throw new RangeError('range: `step` must not be 0');
	const ratio = (to - from) / step;
	const nearest = Math.round(ratio);
	// `ratio` carries rounding errors (`2.1 / 0.3` is `7.000000000000001`); when it is an integer up to those errors,
	// the range is meant to stop exactly one step before `end`, so the count must not be rounded up.
	const tolerance = 4 * Number.EPSILON * ((Math.abs(from) + Math.abs(to)) / Math.abs(step) + Math.abs(ratio));
	let length = Math.max(0, Math.abs(ratio - nearest) <= tolerance ? nearest : Math.ceil(ratio));
	if (length > MAX_ARRAY_LENGTH) throw new RangeError(`range: the range would contain ${length} items, more than an array can hold`);
	// Safety net for huge magnitudes, where `start + i * step` rounds onto (or past) `end`: the end stays exclusive.
	while (length > 0 && (from + (length - 1) * step - to) * step >= 0) length--;
	const result: number[] = new Array<number>(length);
	for (let i = 0; i < length; i++) result[i] = from + i * step;
	return result;
}

/**
 * Combine arrays element-wise into tuples, truncating to the length of the shortest array.
 * @template T
 * @param {...ReadonlyArray<unknown>} arrays - The arrays to zip
 * @returns {Array<Zipped<T>>} A new array of tuples; empty when called without arrays
 * @example
 * zip([1, 2, 3], ['a', 'b']); // => [[1, 'a'], [2, 'b']] // typed as [number, string][]
 */
export function zip<T extends Array<ReadonlyArray<unknown>>>(...arrays: T): Array<Zipped<T>> {
	if (arrays.length === 0) return [];
	let length = Infinity;
	for (const array of arrays) length = Math.min(length, array.length);
	const result: Array<Zipped<T>> = [];
	for (let i = 0; i < length; i++) {
		const tuple: unknown[] = [];
		for (const array of arrays) tuple.push(array[i]);
		result.push(tuple as Zipped<T>);
	}
	return result;
}

/**
 * Group the items of an array by the key returned by `keyFn`, preserving input order within each group.
 * The result is a null-prototype object, so keys such as `'__proto__'` or `'constructor'` are stored safely
 * (no prototype pollution), but it has no `Object.prototype` methods. Number keys are converted to strings, as in any object.
 * @template T
 * @template K
 * @param {ReadonlyArray<T>} array - The items to group
 * @param {(item: T, index: number) => K} keyFn - Returns the group key of an item
 * @returns {Partial<Record<K, T[]>>} An object mapping each key to the items that produced it
 * @example
 * groupBy([1, 2, 3, 4], function (n) { return n % 2 === 0 ? 'even' : 'odd'; }); // => { odd: [1, 3], even: [2, 4] }
 */
export function groupBy<T, K extends PropertyKey>(array: ReadonlyArray<T>, keyFn: (item: T, index: number) => K): Partial<Record<K, T[]>> {
	const groups = Object.create(null) as Partial<Record<K, T[]>>;
	for (let i = 0; i < array.length; i++) {
		const item = array[i];
		const key = keyFn(item, i);
		const group = groups[key];
		if (group === undefined) groups[key] = [item];
		else group.push(item);
	}
	return groups;
}

/**
 * Index the items of an array by the key returned by `keyFn`; when several items share a key, the last one wins.
 * The result is a null-prototype object (safe for keys such as `'__proto__'`).
 * @template T
 * @template K
 * @param {ReadonlyArray<T>} array - The items to index
 * @param {(item: T, index: number) => K} keyFn - Returns the key of an item
 * @returns {Record<K, T>} An object mapping each key to the last item that produced it
 * @example
 * keyBy([{ id: 'a', v: 1 }, { id: 'a', v: 2 }], function (o) { return o.id; }); // => { a: { id: 'a', v: 2 } }
 */
export function keyBy<T, K extends PropertyKey>(array: ReadonlyArray<T>, keyFn: (item: T, index: number) => K): Record<K, T> {
	const result = Object.create(null) as Record<K, T>;
	for (let i = 0; i < array.length; i++) {
		result[keyFn(array[i], i)] = array[i];
	}
	return result;
}

/**
 * Count the items of an array per key returned by `keyFn`.
 * The result is a null-prototype object (safe for keys such as `'__proto__'`).
 * @template T
 * @template K
 * @param {ReadonlyArray<T>} array - The items to count
 * @param {(item: T, index: number) => K} keyFn - Returns the key of an item
 * @returns {Record<K, number>} An object mapping each key to the number of items that produced it
 * @example
 * countBy(['one', 'two', 'three'], function (s) { return s.length; }); // => { 3: 2, 5: 1 }
 */
export function countBy<T, K extends PropertyKey>(array: ReadonlyArray<T>, keyFn: (item: T, index: number) => K): Record<K, number> {
	const counts = Object.create(null) as Record<K, number>;
	for (let i = 0; i < array.length; i++) {
		const key = keyFn(array[i], i);
		counts[key] = (counts[key] ?? 0) + 1;
	}
	return counts;
}

/**
 * Split an array in two: the items matching a type-guard `predicate`, and the others. Relative order is preserved.
 * @template T
 * @template S
 * @param {ReadonlyArray<T>} array - The items to split
 * @param {(item: T, index: number) => item is S} predicate - Type guard deciding which side an item goes to
 * @returns {[S[], Exclude<T, S>[]]} `[matching, nonMatching]`
 * @example
 * partition([1, 'a', 2], function (v): v is number { return typeof v === 'number'; }); // => [[1, 2], ['a']]
 */
export function partition<T, S extends T>(array: ReadonlyArray<T>, predicate: (item: T, index: number) => item is S): [S[], Exclude<T, S>[]];
/**
 * Split an array in two: the items for which `predicate` returns true, and the others. Relative order is preserved.
 * @template T
 * @param {ReadonlyArray<T>} array - The items to split
 * @param {(item: T, index: number) => boolean} predicate - Decides which side an item goes to
 * @returns {[T[], T[]]} `[matching, nonMatching]`
 * @example
 * partition([1, 2, 3, 4], function (n) { return n % 2 === 0; }); // => [[2, 4], [1, 3]]
 */
export function partition<T>(array: ReadonlyArray<T>, predicate: (item: T, index: number) => boolean): [T[], T[]];
/**
 * Split an array in two: the items for which `predicate` returns true, and the others. Relative order is preserved.
 * @template T
 * @param {ReadonlyArray<T>} array - The items to split
 * @param {(item: T, index: number) => boolean} predicate - Decides which side an item goes to
 * @returns {[T[], T[]]} `[matching, nonMatching]`
 * @example
 * partition([1, 2, 3, 4], function (n) { return n % 2 === 0; }); // => [[2, 4], [1, 3]]
 */
export function partition<T>(array: ReadonlyArray<T>, predicate: (item: T, index: number) => boolean): [T[], T[]] {
	const matching: T[] = [];
	const rest: T[] = [];
	for (let i = 0; i < array.length; i++) {
		if (predicate(array[i], i)) matching.push(array[i]);
		else rest.push(array[i]);
	}
	return [matching, rest];
}

/**
 * Remove items whose key (as returned by `keyFn`, compared with SameValueZero) was already seen, keeping the first occurrence.
 * @template T
 * @param {ReadonlyArray<T>} array - The items to deduplicate
 * @param {(item: T, index: number) => unknown} keyFn - Returns the identity key of an item
 * @returns {T[]} A new array with one item per distinct key, in first-appearance order
 * @example
 * uniqueBy([{ id: 1, v: 'a' }, { id: 1, v: 'b' }, { id: 2, v: 'c' }], function (o) { return o.id; }); // => [{ id: 1, v: 'a' }, { id: 2, v: 'c' }]
 */
export function uniqueBy<T>(array: ReadonlyArray<T>, keyFn: (item: T, index: number) => unknown): T[] {
	const seen = new Set<unknown>();
	const result: T[] = [];
	for (let i = 0; i < array.length; i++) {
		const key = keyFn(array[i], i);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(array[i]);
		}
	}
	return result;
}

/**
 * Converts a sort key to a primitive that can be compared with `<`.
 * @param {SortKey} key - The key returned by a `sortBy` selector
 * @returns {number | string | bigint} The key itself, or the timestamp of a `Date`
 */
function toComparable(key: SortKey): number | string | bigint {
	return key instanceof Date ? key.getTime() : key;
}

/**
 * Total order over non-NaN comparable keys: numbers and bigints are compared numerically and sort before strings;
 * strings are compared by UTF-16 code units.
 * @param {number | string | bigint} a - The first key
 * @param {number | string | bigint} b - The second key
 * @returns {number} A negative number, zero or a positive number, as for `Array.prototype.sort`
 */
function compareKeys(a: number | string | bigint, b: number | string | bigint): number {
	if (typeof a === 'string' || typeof b === 'string') {
		if (typeof a !== 'string') return -1;
		if (typeof b !== 'string') return 1;
		return a < b ? -1 : a > b ? 1 : 0;
	}
	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Return a sorted copy of an array, ordered by the key `selector` returns for each item. The sort is stable
 * (items with equal keys keep their relative order, in both directions) and the selector is called once per item.
 *
 * Ordering rules, chosen to be deterministic and locale-independent:
 * - numbers and bigints compare numerically (and may be mixed); `Date`s compare by timestamp;
 * - strings compare by UTF-16 code units with plain `<` (not `localeCompare`), so `'B' < 'a'`;
 * - numeric keys sort before string keys when both kinds are mixed;
 * - `NaN` keys and invalid `Date`s always go last, whatever the order.
 * @template T
 * @param {ReadonlyArray<T>} array - The items to sort (not mutated)
 * @param {(item: T, index: number) => SortKey} selector - Returns the sort key of an item
 * @param {SortOrder} [order='asc'] - `'asc'` for ascending or `'desc'` for descending keys
 * @returns {T[]} A new sorted array
 * @throws {TypeError} when `order` is neither `'asc'` nor `'desc'`
 * @example
 * sortBy([{ n: 'b' }, { n: 'a' }], function (o) { return o.n; }); // => [{ n: 'a' }, { n: 'b' }]
 * sortBy([1, 3, 2], function (n) { return n; }, 'desc'); // => [3, 2, 1]
 */
export function sortBy<T>(array: ReadonlyArray<T>, selector: (item: T, index: number) => SortKey, order: SortOrder = 'asc'): T[] {
	if (order !== 'asc' && order !== 'desc') throw new TypeError(`sortBy: \`order\` must be 'asc' or 'desc', got ${String(order)}`);
	const direction = order === 'asc' ? 1 : -1;
	const entries = Array.from(array, function (item, index) {
		return { item, index, key: toComparable(selector(item, index)) };
	});
	entries.sort(function (x, y): number {
		const xNaN = Number.isNaN(x.key);
		const yNaN = Number.isNaN(y.key);
		if (xNaN || yNaN) {
			if (xNaN === yNaN) return x.index - y.index;
			return xNaN ? 1 : -1;
		}
		return compareKeys(x.key, y.key) * direction || x.index - y.index;
	});
	return entries.map(function (entry) {
		return entry.item;
	});
}

/**
 * Return a shuffled copy of an array using the Fisher–Yates algorithm (the input is not mutated).
 * @template T
 * @param {ReadonlyArray<T>} array - The items to shuffle
 * @param {RandomGenerator} [random=Math.random] - Generator of floats in `[0, 1)`, injectable for deterministic results
 * @returns {T[]} A new array containing the same items in random order
 * @throws {RangeError} when `random()` returns a value outside `[0, 1)`
 * @example
 * shuffle([1, 2, 3, 4]); // e.g. [3, 1, 4, 2]
 */
export function shuffle<T>(array: ReadonlyArray<T>, random: RandomGenerator = Math.random): T[] {
	const result = Array.from(array);
	for (let i = result.length - 1; i > 0; i--) {
		const j = randomIndex('shuffle', random, i + 1);
		const swap = result[i];
		result[i] = result[j];
		result[j] = swap;
	}
	return result;
}

/**
 * Pick a random item from an array.
 * @template T
 * @param {ReadonlyArray<T>} array - The items to pick from
 * @param {RandomGenerator} [random=Math.random] - Generator of floats in `[0, 1)`, injectable for deterministic results
 * @returns {T | undefined} A random item, or `undefined` when the array is empty (`random` is then not called)
 * @throws {RangeError} when `random()` returns a value outside `[0, 1)`
 * @example
 * sample(['a', 'b', 'c']); // e.g. 'b'
 * sample([]); // => undefined
 */
export function sample<T>(array: ReadonlyArray<T>, random: RandomGenerator = Math.random): T | undefined {
	if (array.length === 0) return undefined;
	return array[randomIndex('sample', random, array.length)];
}

/**
 * Return the first `n` items of an array (or all of them when it is shorter).
 * @template T
 * @param {ReadonlyArray<T>} array - The source array
 * @param {number} n - How many items to take (a non-negative integer)
 * @returns {T[]} A new array with at most `n` items
 * @throws {RangeError} when `n` is negative or not an integer
 * @example
 * take([1, 2, 3], 2); // => [1, 2]
 */
export function take<T>(array: ReadonlyArray<T>, n: number): T[] {
	assertInteger('take', 'n', n, 0);
	return array.slice(0, n);
}

/**
 * Return an array without its first `n` items.
 * @template T
 * @param {ReadonlyArray<T>} array - The source array
 * @param {number} n - How many items to skip (a non-negative integer)
 * @returns {T[]} A new array with the remaining items
 * @throws {RangeError} when `n` is negative or not an integer
 * @example
 * drop([1, 2, 3], 2); // => [3]
 */
export function drop<T>(array: ReadonlyArray<T>, n: number): T[] {
	assertInteger('drop', 'n', n, 0);
	return array.slice(n);
}

/**
 * The tuple of arrays produced by {@link unzip} for an array of tuples of type `T`.
 * @example
 * type R = Unzipped<[number, string]>; // [number[], string[]]
 */
export type Unzipped<T extends ReadonlyArray<unknown>> = { -readonly [K in keyof T]: Array<T[K]> };

/**
 * A comparator, as accepted by `Array.prototype.sort`: negative when `a` sorts before `b`, positive when after, `0` when equivalent.
 */
export type Comparator<T> = (a: T, b: T) => number;

/**
 * Split an array of tuples into one array per tuple position: the inverse of {@link zip}.
 * Like `zip`, the result is truncated to the SHORTEST tuple, so `unzip(zip(a, b))` gives back `[a, b]` for equal-length, non-empty arrays.
 * The number of positions is read from the tuples themselves, so for an EMPTY input it cannot be known and `[]` is returned;
 * the return type says so (`Unzipped<T> | []`) — use destructuring defaults: `const [xs = [], ys = []] = unzip(pairs);`.
 * @template T - The tuple type
 * @param {ReadonlyArray<T>} tuples - The tuples to split
 * @returns {Unzipped<T> | []} One fresh array per tuple position, or `[]` when there are no tuples
 * @example
 * unzip([[1, 'a'], [2, 'b']] as [number, string][]); // => [[1, 2], ['a', 'b']] // typed as [number[], string[]] | []
 * unzip([]); // => []
 */
export function unzip<T extends ReadonlyArray<unknown>>(tuples: ReadonlyArray<T>): Unzipped<T> | [] {
	if (tuples.length === 0) return [];
	let arity = Infinity;
	for (const tuple of tuples) arity = Math.min(arity, tuple.length);
	const result: unknown[][] = [];
	for (let position = 0; position < arity; position++) {
		const column: unknown[] = new Array<unknown>(tuples.length);
		for (let row = 0; row < tuples.length; row++) column[row] = tuples[row][position];
		result.push(column);
	}
	return result as Unzipped<T>;
}

/**
 * Return the sliding windows of `size` consecutive items, starting every `step` items. Only FULL windows are returned,
 * so an array shorter than `size` gives `[]`, and trailing items that do not fill a window are dropped.
 * The number of windows is `max(0, floor((length - size) / step) + 1)`.
 * @template T
 * @param {ReadonlyArray<T>} array - The source array
 * @param {number} size - The length of each window (a positive integer)
 * @param {number} [step=1] - The distance between the starts of two consecutive windows (a positive integer)
 * @returns {T[][]} A new array of windows (each window is a fresh array)
 * @throws {RangeError} when `size` or `step` is not a positive integer
 * @example
 * windowed([1, 2, 3, 4], 2); // => [[1, 2], [2, 3], [3, 4]]
 * windowed([1, 2, 3, 4, 5], 2, 2); // => [[1, 2], [3, 4]]
 * windowed([1, 2], 3); // => []
 */
export function windowed<T>(array: ReadonlyArray<T>, size: number, step = 1): T[][] {
	assertInteger('windowed', 'size', size, 1);
	assertInteger('windowed', 'step', step, 1);
	const result: T[][] = [];
	for (let start = 0; start + size <= array.length; start += step) {
		result.push(array.slice(start, start + size));
	}
	return result;
}

/**
 * Return every pair of adjacent items: `[a[0], a[1]], [a[1], a[2]], ...` (empty for arrays with fewer than 2 items).
 * @template T
 * @param {ReadonlyArray<T>} array - The source array
 * @returns {Array<[T, T]>} A new array of `length - 1` pairs
 * @example
 * pairwise([1, 2, 3]); // => [[1, 2], [2, 3]]
 * pairwise([1]); // => []
 */
export function pairwise<T>(array: ReadonlyArray<T>): Array<[T, T]> {
	const result: Array<[T, T]> = [];
	for (let i = 1; i < array.length; i++) result.push([array[i - 1], array[i]]);
	return result;
}

/**
 * Shared worker of {@link minBy} and {@link maxBy}: the first item whose key is extreme in the given direction.
 * @template T
 * @param {ReadonlyArray<T>} array - The items to inspect
 * @param {(item: T, index: number) => SortKey} selector - Returns the key of an item
 * @param {number} direction - `-1` to find the smallest key, `1` to find the largest
 * @returns {T | undefined} The first item with the extreme key, or `undefined` when there is no non-NaN key
 */
function extremeBy<T>(array: ReadonlyArray<T>, selector: (item: T, index: number) => SortKey, direction: number): T | undefined {
	let best: T | undefined;
	let bestKey: number | string | bigint | undefined;
	for (let i = 0; i < array.length; i++) {
		const key = toComparable(selector(array[i], i));
		if (Number.isNaN(key)) continue;
		// Strict comparison: on ties the first item wins.
		if (bestKey === undefined || compareKeys(key, bestKey) * direction > 0) {
			best = array[i];
			bestKey = key;
		}
	}
	return best;
}

/**
 * Return the item with the SMALLEST key, using the same ordering rules as {@link sortBy}
 * (numbers/bigints numerically and before strings, strings by UTF-16 code units, `Date`s by timestamp).
 * On ties the FIRST such item wins. Items whose key is `NaN` (or an invalid `Date`) are ignored.
 * The selector is called exactly once per item.
 * @template T
 * @param {ReadonlyArray<T>} array - The items to inspect
 * @param {(item: T, index: number) => SortKey} selector - Returns the key of an item
 * @returns {T | undefined} The first item with the smallest key, or `undefined` when the array is empty or every key is `NaN`
 * @example
 * const items = [{ n: 3 }, { n: 1 }, { n: 1 }];
 * minBy(items, function (o) { return o.n; }) === items[1]; // => true // ties keep the first
 * minBy([NaN, 2], function (n) { return n; }); // => 2
 */
export function minBy<T>(array: ReadonlyArray<T>, selector: (item: T, index: number) => SortKey): T | undefined {
	return extremeBy(array, selector, -1);
}

/**
 * Return the item with the LARGEST key, using the same ordering rules as {@link sortBy}
 * (numbers/bigints numerically and before strings, strings by UTF-16 code units, `Date`s by timestamp).
 * On ties the FIRST such item wins. Items whose key is `NaN` (or an invalid `Date`) are ignored.
 * The selector is called exactly once per item.
 * @template T
 * @param {ReadonlyArray<T>} array - The items to inspect
 * @param {(item: T, index: number) => SortKey} selector - Returns the key of an item
 * @returns {T | undefined} The first item with the largest key, or `undefined` when the array is empty or every key is `NaN`
 * @example
 * maxBy([{ n: 3 }, { n: 7 }], function (o) { return o.n; }); // => { n: 7 }
 * maxBy(['b', 'a', 'B'], function (s) { return s; }); // => 'b'
 */
export function maxBy<T>(array: ReadonlyArray<T>, selector: (item: T, index: number) => SortKey): T | undefined {
	return extremeBy(array, selector, 1);
}

/**
 * Add up the numbers returned by `selector` for each item, using compensated (Neumaier) summation like `sum` from the math module,
 * so the rounding error does not grow with the number of items.
 * `NaN`/`Infinity` keys propagate as in plain addition.
 * @template T
 * @param {ReadonlyArray<T>} array - The items to add up
 * @param {(item: T, index: number) => number} selector - Returns the number contributed by an item
 * @returns {number} The total (`0` for an empty array)
 * @example
 * sumBy([{ price: 0.1 }, { price: 0.2 }, { price: 0.3 }], function (o) { return o.price; }); // => 0.6
 */
export function sumBy<T>(array: ReadonlyArray<T>, selector: (item: T, index: number) => number): number {
	return sum(Array.from(array, selector));
}

/**
 * Resolves a possibly negative index (counting from the end, like `Array.prototype.at`) and checks its range.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {string} name - Name of the validated parameter
 * @param {number} index - The index to resolve
 * @param {number} length - The length of the array
 * @param {boolean} allowEnd - Whether `length` itself is a valid (insertion) position
 * @returns {number} The resolved index, in `[0, length)` (or `[0, length]` when `allowEnd`)
 * @throws {RangeError} when `index` is not an integer or is out of range
 */
function resolveIndex(caller: string, name: string, index: number, length: number, allowEnd: boolean): number {
	if (!Number.isInteger(index)) throw new RangeError(`${caller}: \`${name}\` must be an integer, got ${String(index)}`);
	const resolved = index < 0 ? length + index : index;
	const upper = allowEnd ? length : length - 1;
	if (resolved < 0 || resolved > upper) {
		throw new RangeError(`${caller}: \`${name}\` ${index} is out of range for an array of length ${length}`);
	}
	return resolved;
}

/**
 * Return a copy of an array with the item at `from` moved to position `to` (the input is not mutated).
 * `to` is the index the item has in the RESULT. Negative indices count from the end, like `Array.prototype.at`.
 * Equivalent to `copy.splice(to, 0, ...copy.splice(from, 1))` on a copy. Holes of sparse arrays become `undefined`.
 * @template T
 * @param {ReadonlyArray<T>} array - The source array
 * @param {number} from - Index of the item to move, in `[-length, length - 1]`
 * @param {number} to - Index of the item in the result, in `[-length, length - 1]`
 * @returns {T[]} A new array, a permutation of the input
 * @throws {RangeError} when `from` or `to` is not an integer or is out of range (any index is out of range for an empty array)
 * @example
 * move(['a', 'b', 'c', 'd'], 0, 2); // => ['b', 'c', 'a', 'd']
 * move(['a', 'b', 'c'], -1, 0); // => ['c', 'a', 'b']
 */
export function move<T>(array: ReadonlyArray<T>, from: number, to: number): T[] {
	const source = resolveIndex('move', 'from', from, array.length, false);
	const target = resolveIndex('move', 'to', to, array.length, false);
	const result = Array.from(array);
	const [item] = result.splice(source, 1);
	result.splice(target, 0, item);
	return result;
}

/**
 * Return a copy of an array with `items` inserted before position `index` (the input is not mutated).
 * Negative indices count from the end, like `Array.prototype.at` / `splice`: `-1` inserts before the last item;
 * `index === length` appends. Holes of sparse arrays become `undefined`.
 * @template T
 * @param {ReadonlyArray<T>} array - The source array
 * @param {number} index - Insertion position, in `[-length, length]`
 * @param {...T} items - The items to insert (in order)
 * @returns {T[]} A new array of length `array.length + items.length`
 * @throws {RangeError} when `index` is not an integer or is out of range
 * @example
 * insertAt([1, 2, 3], 1, 9, 8); // => [1, 9, 8, 2, 3]
 * insertAt([1, 2, 3], -1, 9); // => [1, 2, 9, 3]
 * insertAt([1, 2, 3], 3, 9); // => [1, 2, 3, 9]
 */
export function insertAt<T>(array: ReadonlyArray<T>, index: number, ...items: T[]): T[] {
	const position = resolveIndex('insertAt', 'index', index, array.length, true);
	const result: T[] = [];
	for (let i = 0; i < position; i++) result.push(array[i]);
	for (const item of items) result.push(item);
	for (let i = position; i < array.length; i++) result.push(array[i]);
	return result;
}

/**
 * Return a copy of an array without the `count` items starting at `index` (the input is not mutated).
 * Negative indices count from the end, like `Array.prototype.at`. Like `splice`, `count` is clamped to the items available
 * (pass `array.length` to remove everything from `index` on). Holes of sparse arrays become `undefined`.
 * @template T
 * @param {ReadonlyArray<T>} array - The source array
 * @param {number} index - Index of the first item to remove, in `[-length, length - 1]`
 * @param {number} [count=1] - How many items to remove (a non-negative integer)
 * @returns {T[]} A new array without the removed items
 * @throws {RangeError} when `index` is not an integer or is out of range (any index is out of range for an empty array)
 * @throws {RangeError} when `count` is not a non-negative integer
 * @example
 * removeAt([1, 2, 3, 4], 1); // => [1, 3, 4]
 * removeAt([1, 2, 3, 4], -2, 2); // => [1, 2]
 */
export function removeAt<T>(array: ReadonlyArray<T>, index: number, count = 1): T[] {
	const position = resolveIndex('removeAt', 'index', index, array.length, false);
	assertInteger('removeAt', 'count', count, 0);
	const result: T[] = [];
	for (let i = 0; i < position; i++) result.push(array[i]);
	for (let i = position + count; i < array.length; i++) result.push(array[i]);
	return result;
}

/**
 * Default comparator of {@link sortedIndex} and {@link binarySearch}: orders numbers, strings or bigints with `<`.
 * @param {unknown} a - The first value
 * @param {unknown} b - The second value
 * @returns {number} `-1`, `0` or `1`
 */
function naturalCompare(a: unknown, b: unknown): number {
	const x = a as number | string | bigint;
	const y = b as number | string | bigint;
	return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Binary search for the lowest index at which `value` could be inserted while keeping `sortedArray` sorted.
 * @template T
 * @param {string} caller - Name of the public function, used in the error message
 * @param {ReadonlyArray<T>} sortedArray - An array sorted according to `compare`
 * @param {T} value - The value to locate
 * @param {Comparator<T> | undefined} compare - The comparator (`undefined` for the natural `<` order)
 * @returns {[number, Comparator<T>]} The lower-bound index and the comparator actually used
 * @throws {RangeError} when `value` is `NaN` and no comparator is given
 */
function lowerBound<T>(caller: string, sortedArray: ReadonlyArray<T>, value: T, compare: Comparator<T> | undefined): [number, Comparator<T>] {
	if (compare === undefined && Number.isNaN(value)) throw new RangeError(`${caller}: cannot locate NaN with the default comparator`);
	const order: Comparator<T> = compare ?? naturalCompare;
	let low = 0;
	let high = sortedArray.length;
	while (low < high) {
		const middle = (low + high) >>> 1;
		if (order(sortedArray[middle], value) < 0) low = middle + 1;
		else high = middle;
	}
	return [low, order];
}

/**
 * Find, by binary search (O(log n)), the LOWEST index at which `value` can be inserted into `sortedArray` keeping it sorted
 * (before any equal items). Without a comparator, numbers, strings or bigints are ordered with `<` (strings by UTF-16 code units).
 * The array must already be sorted in that order (and contain no `NaN`); otherwise the result is unspecified.
 * @template T - A number, string or bigint type
 * @param {ReadonlyArray<T>} sortedArray - An array sorted in ascending `<` order
 * @param {T} value - The value to locate
 * @returns {number} An index in `[0, length]`
 * @throws {RangeError} when `value` is `NaN`
 * @example
 * sortedIndex([10, 20, 20, 30], 20); // => 1
 * sortedIndex([10, 20, 30], 99); // => 3
 */
export function sortedIndex<T extends number | string | bigint>(sortedArray: ReadonlyArray<T>, value: T): number;
/**
 * Find, by binary search (O(log n)), the LOWEST index at which `value` can be inserted into `sortedArray` keeping it sorted
 * according to `compare` (before any items comparing equal). The array must already be sorted by `compare`.
 * @template T
 * @param {ReadonlyArray<T>} sortedArray - An array sorted according to `compare`
 * @param {T} value - The value to locate
 * @param {Comparator<T>} compare - The comparator the array is sorted by
 * @returns {number} An index in `[0, length]`
 * @example
 * sortedIndex([{ n: 1 }, { n: 5 }], { n: 3 }, function (a, b) { return a.n - b.n; }); // => 1
 */
export function sortedIndex<T>(sortedArray: ReadonlyArray<T>, value: T, compare: Comparator<T>): number;
/**
 * Implementation of {@link sortedIndex}.
 * @template T
 * @param {ReadonlyArray<T>} sortedArray - A sorted array
 * @param {T} value - The value to locate
 * @param {Comparator<T>} [compare] - The comparator the array is sorted by
 * @returns {number} The lowest insertion index
 * @throws {RangeError} when `value` is `NaN` and no comparator is given
 * @example
 * sortedIndex([1, 3], 2); // => 1
 */
export function sortedIndex<T>(sortedArray: ReadonlyArray<T>, value: T, compare?: Comparator<T>): number {
	return lowerBound('sortedIndex', sortedArray, value, compare)[0];
}

/**
 * Find the index of `value` in `sortedArray` by binary search (O(log n)); with duplicates, the LOWEST matching index is returned.
 * Without a comparator, numbers, strings or bigints are ordered with `<`. The array must already be sorted in that order.
 * @template T - A number, string or bigint type
 * @param {ReadonlyArray<T>} sortedArray - An array sorted in ascending `<` order
 * @param {T} value - The value to find
 * @returns {number} The index of `value`, or `-1` when it is absent
 * @throws {RangeError} when `value` is `NaN`
 * @example
 * binarySearch([1, 3, 5, 7], 5); // => 2
 * binarySearch([1, 3, 5, 7], 4); // => -1
 */
export function binarySearch<T extends number | string | bigint>(sortedArray: ReadonlyArray<T>, value: T): number;
/**
 * Find the index of an item comparing equal (`compare(item, value) === 0`) to `value` in `sortedArray` by binary search;
 * with several equal items, the LOWEST index is returned. The array must already be sorted by `compare`.
 * @template T
 * @param {ReadonlyArray<T>} sortedArray - An array sorted according to `compare`
 * @param {T} value - The value to find
 * @param {Comparator<T>} compare - The comparator the array is sorted by
 * @returns {number} The index of a matching item, or `-1`
 * @example
 * binarySearch(['b', 'c'], 'B', function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0; }); // => 0
 */
export function binarySearch<T>(sortedArray: ReadonlyArray<T>, value: T, compare: Comparator<T>): number;
/**
 * Implementation of {@link binarySearch}.
 * @template T
 * @param {ReadonlyArray<T>} sortedArray - A sorted array
 * @param {T} value - The value to find
 * @param {Comparator<T>} [compare] - The comparator the array is sorted by
 * @returns {number} The lowest matching index, or `-1`
 * @throws {RangeError} when `value` is `NaN` and no comparator is given
 * @example
 * binarySearch([1, 3], 3); // => 1
 */
export function binarySearch<T>(sortedArray: ReadonlyArray<T>, value: T, compare?: Comparator<T>): number {
	const [index, order] = lowerBound('binarySearch', sortedArray, value, compare);
	return index < sortedArray.length && order(sortedArray[index], value) === 0 ? index : -1;
}

/**
 * Return the cartesian product of the given arrays: every tuple taking one item from each array, in lexicographic order
 * (the LAST array varies fastest). The result has `product of the lengths` tuples: it is empty when any array is empty,
 * and is `[[]]` (one empty tuple) when called without arrays.
 * @template T - The tuple of input array types
 * @param {...ReadonlyArray<unknown>} arrays - The arrays to combine
 * @returns {Array<Zipped<T>>} A new array of fresh tuples
 * @throws {RangeError} when the result would have more items than an array can hold
 * @example
 * cartesianProduct([1, 2], ['a', 'b']); // => [[1, 'a'], [1, 'b'], [2, 'a'], [2, 'b']] // typed as [number, string][]
 */
export function cartesianProduct<T extends Array<ReadonlyArray<unknown>>>(...arrays: T): Array<Zipped<T>> {
	let total = 1;
	for (const array of arrays) total *= array.length;
	if (total > MAX_ARRAY_LENGTH) throw new RangeError(`cartesianProduct: the product would contain ${total} tuples, more than an array can hold`);
	const result: Array<Zipped<T>> = [];
	if (total === 0) return result;
	const positions = new Array<number>(arrays.length).fill(0);
	for (let count = 0; count < total; count++) {
		const tuple: unknown[] = [];
		for (let k = 0; k < arrays.length; k++) tuple.push(arrays[k][positions[k]]);
		result.push(tuple as Zipped<T>);
		// Odometer increment: the last position turns fastest.
		for (let k = arrays.length - 1; k >= 0; k--) {
			positions[k]++;
			if (positions[k] < arrays[k].length) break;
			positions[k] = 0;
		}
	}
	return result;
}

/**
 * Return a copy of an array with `separator` inserted between every two consecutive items.
 * @template T - The item type
 * @template S - The separator type
 * @param {ReadonlyArray<T>} array - The source array
 * @param {S} separator - The value to insert
 * @returns {Array<T | S>} A new array of length `max(0, 2 * length - 1)`
 * @example
 * intersperse([1, 2, 3], 0); // => [1, 0, 2, 0, 3]
 * intersperse(['a'], ','); // => ['a']
 */
export function intersperse<T, S>(array: ReadonlyArray<T>, separator: S): Array<T | S> {
	const result: Array<T | S> = [];
	for (let i = 0; i < array.length; i++) {
		if (i > 0) result.push(separator);
		result.push(array[i]);
	}
	return result;
}

/**
 * Collects the keys `keyFn` returns for every item of an iterable.
 * @template U
 * @param {Iterable<U>} iterable - The items
 * @param {(item: U) => unknown} keyFn - Returns the key of an item
 * @returns {Set<unknown>} The set of keys
 */
function keySet<U>(iterable: Iterable<U>, keyFn: (item: U) => unknown): Set<unknown> {
	const keys = new Set<unknown>();
	for (const item of iterable) keys.add(keyFn(item));
	return keys;
}

/**
 * Like {@link difference}, but items are compared by the key `keyFn` returns (SameValueZero): the items of `a` whose key is
 * not the key of any item of `b`, keeping only the FIRST item of `a` per key. `differenceBy(a, b, identity)` equals `difference(a, b)`.
 * `keyFn` is called once per item of both iterables.
 * @template T - The item type of `a`
 * @template U - The item type of `b`
 * @param {Iterable<T>} a - The items to take from (defines the output order)
 * @param {Iterable<U>} b - The items whose keys are excluded
 * @param {(item: T | U) => unknown} keyFn - Returns the identity key of an item of either iterable
 * @returns {T[]} The items of `a` with a distinct key missing from `b`, in first-appearance order
 * @example
 * differenceBy([{ id: 1 }, { id: 2 }], [{ id: 2 }], function (o) { return o.id; }); // => [{ id: 1 }]
 * differenceBy([1.2, 2.5, 3.1], [2.1], Math.floor); // => [1.2, 3.1]
 */
export function differenceBy<T, U = T>(a: Iterable<T>, b: Iterable<U>, keyFn: (item: T | U) => unknown): T[] {
	const excluded = keySet(b, keyFn);
	const result: T[] = [];
	for (const item of a) {
		const key = keyFn(item);
		if (!excluded.has(key)) {
			excluded.add(key);
			result.push(item);
		}
	}
	return result;
}

/**
 * Like {@link intersection}, but items are compared by the key `keyFn` returns (SameValueZero): the items of `a` whose key is
 * also the key of an item of `b`, keeping only the FIRST item of `a` per key. `intersectionBy(a, b, identity)` equals `intersection(a, b)`.
 * `keyFn` is called once per item of both iterables.
 * @template T - The item type of `a`
 * @template U - The item type of `b`
 * @param {Iterable<T>} a - The items to take from (defines the output order)
 * @param {Iterable<U>} b - The items whose keys are kept
 * @param {(item: T | U) => unknown} keyFn - Returns the identity key of an item of either iterable
 * @returns {T[]} The items of `a` with a distinct key also present in `b`, in first-appearance order
 * @example
 * intersectionBy([{ id: 1 }, { id: 2 }], [{ id: 2 }], function (o) { return o.id; }); // => [{ id: 2 }]
 */
export function intersectionBy<T, U = T>(a: Iterable<T>, b: Iterable<U>, keyFn: (item: T | U) => unknown): T[] {
	const remaining = keySet(b, keyFn);
	const result: T[] = [];
	for (const item of a) {
		if (remaining.delete(keyFn(item))) result.push(item);
	}
	return result;
}
