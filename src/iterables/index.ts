import { isAsyncIterable, isFunction, isIterable } from '../guards/index.js';

/**
 * The tuple of item types produced by {@link zip} for a tuple of input iterables.
 * @example
 * type R = ZippedValues<[number[], Set<string>]>; // [number, string]
 */
export type ZippedValues<T extends ReadonlyArray<Iterable<unknown>>> = { -readonly [K in keyof T]: T[K] extends Iterable<infer U> ? U : never };

/**
 * Inputs accepted by the async helpers: an async iterable, or a sync iterable whose items may be promises
 * (they are awaited one by one, as with `for await` and `Array.fromAsync`).
 */
export type AwaitableIterable<T> = AsyncIterable<T> | Iterable<T | PromiseLike<T>>;

/**
 * Describes a value's type for error messages.
 * @param {unknown} value - The offending value
 * @returns {string} `'null'` or the `typeof` of the value
 */
function describe(value: unknown): string {
	return value === null ? 'null' : typeof value;
}

/**
 * Throws a `TypeError` unless `value` is a (sync) iterable.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {unknown} value - The value to validate
 * @param {string} [name='iterable'] - Name of the validated parameter
 * @returns {void}
 * @throws {TypeError} when `value` is not iterable
 */
function assertIterable(caller: string, value: unknown, name = 'iterable'): void {
	if (!isIterable(value)) throw new TypeError(`${caller}: \`${name}\` must be iterable, got ${describe(value)}`);
}

/**
 * Throws a `TypeError` unless `value` is an async iterable or a sync iterable.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {unknown} value - The value to validate
 * @returns {void}
 * @throws {TypeError} when `value` is neither async iterable nor iterable
 */
function assertAwaitableIterable(caller: string, value: unknown): void {
	if (!isAsyncIterable(value)) assertIterable(caller, value);
}

/**
 * Throws a `TypeError` unless `value` is a function.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {string} name - Name of the validated parameter
 * @param {unknown} value - The value to validate
 * @returns {void}
 * @throws {TypeError} when `value` is not a function
 */
function assertFunction(caller: string, name: string, value: unknown): void {
	if (!isFunction(value)) throw new TypeError(`${caller}: \`${name}\` must be a function, got ${describe(value)}`);
}

/**
 * Throws a `RangeError` unless `value` is an integer `>= min` (or `Infinity`, when allowed).
 * @param {string} caller - Name of the public function, used in the error message
 * @param {string} name - Name of the validated parameter
 * @param {number} value - The value to validate
 * @param {number} min - Smallest accepted value
 * @param {boolean} [allowInfinity=false] - Whether `Infinity` is accepted
 * @returns {void}
 * @throws {RangeError} when `value` is not an accepted count
 */
function assertCount(caller: string, name: string, value: number, min: number, allowInfinity = false): void {
	if (!(Number.isInteger(value) && value >= min) && !(allowInfinity && value === Infinity)) {
		throw new RangeError(`${caller}: \`${name}\` must be an integer >= ${min}${allowInfinity ? ' or Infinity' : ''}, got ${String(value)}`);
	}
}

/**
 * Adapts an {@link AwaitableIterable} for `for await`: async iterables are returned as is, and sync iterables are wrapped so
 * each item is awaited inside a `for...of` loop, which closes the sync source when an item rejects or iteration stops early
 * (the built-in async-from-sync wrapper of older engines leaves the source open when an item rejects).
 * @template T
 * @param {AwaitableIterable<T>} iterable - An async iterable, or a sync iterable of values and/or promises
 * @returns {AsyncIterable<T>} An async iterable of the (awaited) items
 */
function awaitItems<T>(iterable: AwaitableIterable<T>): AsyncIterable<T> {
	if (isAsyncIterable(iterable)) return iterable;
	return (async function* (): AsyncGenerator<T, void, undefined> {
		for (const value of iterable) yield await value;
	})();
}

// ---------------------------------------------------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Lazily count from `start` by `step`, forever: `start, start + step, start + 2 * step, ...`.
 * Each value is computed as `start + i * step`, so fractional steps do not accumulate rounding errors.
 * The sequence is infinite: bound it with {@link take} or {@link takeWhile}.
 * @param {number} [start=0] - The first value
 * @param {number} [step=1] - The increment between values (may be negative or 0)
 * @returns {IterableIterator<number>} An infinite iterator of numbers
 * @throws {RangeError} when `start` or `step` is not a finite number
 * @example
 * toArray(take(count(), 3)); // [0, 1, 2]
 * toArray(take(count(10, -5), 3)); // [10, 5, 0]
 */
export function count(start = 0, step = 1): IterableIterator<number> {
	if (!Number.isFinite(start) || !Number.isFinite(step)) {
		throw new RangeError(`count: arguments must be finite numbers, got (${String(start)}, ${String(step)})`);
	}
	return (function* (): Generator<number, void, undefined> {
		for (let i = 0; ; i++) yield start + i * step;
	})();
}

/**
 * Lazily yield the same value `times` times (forever by default).
 * @template T
 * @param {T} value - The value to repeat
 * @param {number} [times=Infinity] - How many times to yield it (a non-negative integer or `Infinity`)
 * @returns {IterableIterator<T>} An iterator yielding `value` `times` times
 * @throws {RangeError} when `times` is negative, `NaN` or a non-integer finite number
 * @example
 * toArray(repeatValue('a', 3)); // ['a', 'a', 'a']
 * toArray(take(repeatValue(0), 2)); // [0, 0]
 */
export function repeatValue<T>(value: T, times = Infinity): IterableIterator<T> {
	assertCount('repeatValue', 'times', times, 0, true);
	return (function* (): Generator<T, void, undefined> {
		for (let i = 0; i < times; i++) yield value;
	})();
}

/**
 * Lazily repeat the items of an iterable forever. The first pass is cached, so the source is iterated only once
 * (one-shot iterators such as generators can be cycled). An empty source gives an empty iterator (not an infinite loop).
 * Every item of the first pass is kept in memory, so an infinite source is never repeated and its cache grows without bound.
 * @template T
 * @param {Iterable<T>} iterable - The items to cycle through
 * @returns {IterableIterator<T>} An infinite iterator (or an empty one when the source is empty)
 * @throws {TypeError} when `iterable` is not iterable
 * @example
 * toArray(take(cycle([1, 2]), 5)); // [1, 2, 1, 2, 1]
 * toArray(cycle([])); // []
 */
export function cycle<T>(iterable: Iterable<T>): IterableIterator<T> {
	assertIterable('cycle', iterable);
	return (function* (): Generator<T, void, undefined> {
		const cache: T[] = [];
		for (const value of iterable) {
			cache.push(value);
			yield value;
		}
		if (cache.length === 0) return;
		// Plain loops rather than `yield*`, so `throw()` rethrows its error instead of a TypeError from the array iterator.
		for (;;) for (const value of cache) yield value;
	})();
}

/**
 * Lazily unfold a sequence from a seed: `seed, next(seed), next(next(seed)), ...`, forever.
 * `next` is only called when the following item is actually requested.
 * @template T
 * @param {T} seed - The first item
 * @param {(value: T) => T} next - Computes an item from the previous one
 * @returns {IterableIterator<T>} An infinite iterator
 * @throws {TypeError} when `next` is not a function
 * @example
 * toArray(take(iterate(1, function (n) { return n * 2; }), 5)); // [1, 2, 4, 8, 16]
 */
export function iterate<T>(seed: T, next: (value: T) => T): IterableIterator<T> {
	assertFunction('iterate', 'next', next);
	return (function* (): Generator<T, void, undefined> {
		for (let value = seed; ; value = next(value)) yield value;
	})();
}

// ---------------------------------------------------------------------------------------------------------------------
// Transforms (lazy: nothing is pulled from the source until the result is iterated, and early exits close the source)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Lazily transform each item of an iterable (the lazy counterpart of `Array.prototype.map`).
 * @template T
 * @template U
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => U} fn - Maps an item (and its index) to the output item
 * @returns {IterableIterator<U>} An iterator of the mapped items
 * @throws {TypeError} when `iterable` is not iterable or `fn` is not a function
 * @example
 * toArray(map([1, 2, 3], function (n) { return n * 2; })); // [2, 4, 6]
 */
export function map<T, U>(iterable: Iterable<T>, fn: (value: T, index: number) => U): IterableIterator<U> {
	assertIterable('map', iterable);
	assertFunction('map', 'fn', fn);
	return (function* (): Generator<U, void, undefined> {
		let index = 0;
		for (const value of iterable) yield fn(value, index++);
	})();
}

/**
 * Lazily keep the items matching a type guard, narrowing the item type.
 * @template T
 * @template S
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => value is S} predicate - Type guard deciding which items to keep
 * @returns {IterableIterator<S>} An iterator of the items for which `predicate` returned `true`
 * @throws {TypeError} when `iterable` is not iterable or `predicate` is not a function
 * @example
 * toArray(filter([1, 'a', 2], function (v): v is number { return typeof v === 'number'; })); // [1, 2] typed as number[]
 */
export function filter<T, S extends T>(iterable: Iterable<T>, predicate: (value: T, index: number) => value is S): IterableIterator<S>;
/**
 * Lazily keep the items matching a predicate (the lazy counterpart of `Array.prototype.filter`).
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => boolean} predicate - Decides which items to keep
 * @returns {IterableIterator<T>} An iterator of the items for which `predicate` returned `true`
 * @throws {TypeError} when `iterable` is not iterable or `predicate` is not a function
 * @example
 * toArray(filter([1, 2, 3, 4], function (n) { return n % 2 === 0; })); // [2, 4]
 */
export function filter<T>(iterable: Iterable<T>, predicate: (value: T, index: number) => boolean): IterableIterator<T>;
/**
 * Lazily keep the items matching a predicate (the lazy counterpart of `Array.prototype.filter`).
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => boolean} predicate - Decides which items to keep
 * @returns {IterableIterator<T>} An iterator of the items for which `predicate` returned `true`
 * @throws {TypeError} when `iterable` is not iterable or `predicate` is not a function
 * @example
 * toArray(filter([1, 2, 3, 4], function (n) { return n % 2 === 0; })); // [2, 4]
 */
export function filter<T>(iterable: Iterable<T>, predicate: (value: T, index: number) => boolean): IterableIterator<T> {
	assertIterable('filter', iterable);
	assertFunction('filter', 'predicate', predicate);
	return (function* (): Generator<T, void, undefined> {
		let index = 0;
		for (const value of iterable) if (predicate(value, index++)) yield value;
	})();
}

/**
 * Lazily map each item to an iterable and flatten the results one level. Any iterable may be returned
 * (arrays, sets, generators, ... and strings, which are flattened into their characters).
 * @template T
 * @template U
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => Iterable<U>} fn - Maps an item (and its index) to the iterable of output items
 * @returns {IterableIterator<U>} An iterator of the flattened items
 * @throws {TypeError} when `iterable` is not iterable, `fn` is not a function, or (while iterating) `fn` returns a non-iterable
 * @example
 * toArray(flatMap([1, 2], function (n) { return [n, n * 10]; })); // [1, 10, 2, 20]
 */
export function flatMap<T, U>(iterable: Iterable<T>, fn: (value: T, index: number) => Iterable<U>): IterableIterator<U> {
	assertIterable('flatMap', iterable);
	assertFunction('flatMap', 'fn', fn);
	return (function* (): Generator<U, void, undefined> {
		let index = 0;
		for (const value of iterable) {
			const inner = fn(value, index++);
			assertIterable('flatMap', inner, 'fn(...)');
			// Not `yield*`: `throw()` must close the inner iterator and rethrow, not be forwarded into it.
			for (const item of inner) yield item;
		}
	})();
}

/**
 * Lazily yield the first `n` items of an iterable (or all of them when it is shorter). Exactly `n` items are pulled from
 * the source (none when `n` is 0), which is then closed — so `take` is the way to bound infinite iterators.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {number} n - How many items to take (a non-negative integer, or `Infinity` for all of them)
 * @returns {IterableIterator<T>} An iterator of at most `n` items
 * @throws {TypeError} when `iterable` is not iterable
 * @throws {RangeError} when `n` is negative, `NaN` or a non-integer finite number
 * @example
 * toArray(take(count(), 3)); // [0, 1, 2]
 */
export function take<T>(iterable: Iterable<T>, n: number): IterableIterator<T> {
	assertIterable('take', iterable);
	assertCount('take', 'n', n, 0, true);
	return (function* (): Generator<T, void, undefined> {
		if (n === 0) return;
		let taken = 0;
		for (const value of iterable) {
			yield value;
			if (++taken >= n) return;
		}
	})();
}

/**
 * Lazily skip the first `n` items of an iterable and yield the rest.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {number} n - How many items to skip (a non-negative integer)
 * @returns {IterableIterator<T>} An iterator of the remaining items
 * @throws {TypeError} when `iterable` is not iterable
 * @throws {RangeError} when `n` is negative or not an integer
 * @example
 * toArray(drop([1, 2, 3], 2)); // [3]
 */
export function drop<T>(iterable: Iterable<T>, n: number): IterableIterator<T> {
	assertIterable('drop', iterable);
	assertCount('drop', 'n', n, 0);
	return (function* (): Generator<T, void, undefined> {
		let skipped = 0;
		for (const value of iterable) {
			if (skipped < n) skipped++;
			else yield value;
		}
	})();
}

/**
 * Lazily yield items while `predicate` holds, stopping (and closing the source) at the first item that fails it.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => boolean} predicate - Decides whether to keep going
 * @returns {IterableIterator<T>} An iterator of the leading items that satisfy `predicate`
 * @throws {TypeError} when `iterable` is not iterable or `predicate` is not a function
 * @example
 * toArray(takeWhile(count(1), function (n) { return n < 4; })); // [1, 2, 3]
 */
export function takeWhile<T>(iterable: Iterable<T>, predicate: (value: T, index: number) => boolean): IterableIterator<T> {
	assertIterable('takeWhile', iterable);
	assertFunction('takeWhile', 'predicate', predicate);
	return (function* (): Generator<T, void, undefined> {
		let index = 0;
		for (const value of iterable) {
			if (!predicate(value, index++)) return;
			yield value;
		}
	})();
}

/**
 * Lazily skip items while `predicate` holds, then yield the first failing item and everything after it
 * (`predicate` is no longer called once it has failed).
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => boolean} predicate - Decides whether to keep skipping
 * @returns {IterableIterator<T>} An iterator of the items from the first one failing `predicate`
 * @throws {TypeError} when `iterable` is not iterable or `predicate` is not a function
 * @example
 * toArray(dropWhile([1, 2, 3, 1], function (n) { return n < 2; })); // [2, 3, 1]
 */
export function dropWhile<T>(iterable: Iterable<T>, predicate: (value: T, index: number) => boolean): IterableIterator<T> {
	assertIterable('dropWhile', iterable);
	assertFunction('dropWhile', 'predicate', predicate);
	return (function* (): Generator<T, void, undefined> {
		let dropping = true;
		let index = 0;
		for (const value of iterable) {
			if (dropping && predicate(value, index++)) continue;
			dropping = false;
			yield value;
		}
	})();
}

/**
 * Lazily split an iterable into consecutive chunks of `size` items; only the last chunk may be shorter.
 * Each chunk is a fresh array, yielded as soon as it is full.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {number} size - The maximum length of each chunk (a positive integer)
 * @returns {IterableIterator<T[]>} An iterator of chunks (empty when the source is empty)
 * @throws {TypeError} when `iterable` is not iterable
 * @throws {RangeError} when `size` is not a positive integer
 * @example
 * toArray(chunk([1, 2, 3, 4, 5], 2)); // [[1, 2], [3, 4], [5]]
 */
export function chunk<T>(iterable: Iterable<T>, size: number): IterableIterator<T[]> {
	assertIterable('chunk', iterable);
	assertCount('chunk', 'size', size, 1);
	return (function* (): Generator<T[], void, undefined> {
		let buffer: T[] = [];
		for (const value of iterable) {
			buffer.push(value);
			if (buffer.length === size) {
				const full = buffer;
				buffer = [];
				yield full;
			}
		}
		if (buffer.length > 0) yield buffer;
	})();
}

/**
 * Lazily yield the sliding windows of `size` consecutive items, starting every `step` items. Only FULL windows are
 * yielded (trailing items that do not fill a window are dropped), and items between windows (when `step > size`)
 * are skipped without being buffered. Each window is a fresh array.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {number} size - The length of each window (a positive integer)
 * @param {number} [step=1] - The distance between the starts of two consecutive windows (a positive integer)
 * @returns {IterableIterator<T[]>} An iterator of windows
 * @throws {TypeError} when `iterable` is not iterable
 * @throws {RangeError} when `size` or `step` is not a positive integer
 * @example
 * toArray(windowed([1, 2, 3, 4], 2)); // [[1, 2], [2, 3], [3, 4]]
 * toArray(windowed([1, 2, 3, 4, 5], 2, 2)); // [[1, 2], [3, 4]]
 */
export function windowed<T>(iterable: Iterable<T>, size: number, step = 1): IterableIterator<T[]> {
	assertIterable('windowed', iterable);
	assertCount('windowed', 'size', size, 1);
	assertCount('windowed', 'step', step, 1);
	return (function* (): Generator<T[], void, undefined> {
		let buffer: T[] = [];
		let skip = 0;
		for (const value of iterable) {
			if (skip > 0) {
				skip--;
				continue;
			}
			buffer.push(value);
			if (buffer.length === size) {
				const window = buffer;
				buffer = buffer.slice(step);
				skip = Math.max(0, step - size);
				yield window;
			}
		}
	})();
}

/**
 * Calls `return()` on each iterator except the one at index `skip` (which is exhausted or has thrown).
 * @param {ReadonlyArray<Iterator<unknown>>} iterators - The iterators to close
 * @param {number} skip - Index of an iterator that must not be closed (`-1` for none)
 * @param {boolean} suppress - Whether errors thrown by `return()` are ignored (used when another error is propagating)
 * @returns {void}
 * @throws {unknown} the first error thrown by a `return()` call, unless `suppress` is set
 */
function closeIterators(iterators: ReadonlyArray<Iterator<unknown>>, skip: number, suppress: boolean): void {
	let failure: { error: unknown } | undefined;
	for (let i = 0; i < iterators.length; i++) {
		if (i === skip) continue;
		try {
			iterators[i].return?.();
		} catch (error) {
			failure ??= { error };
		}
	}
	if (failure !== undefined && !suppress) throw failure.error;
}

/**
 * Lazily combine iterables item-wise into tuples, stopping at the end of the SHORTEST one (which may be infinite
 * as long as another one is finite). When one source ends, or iteration stops early, all the other sources are closed.
 * @template T
 * @param {...Iterable<unknown>} iterables - The iterables to zip
 * @returns {IterableIterator<ZippedValues<T>>} An iterator of tuples; empty when called without iterables
 * @throws {TypeError} when an argument is not iterable
 * @example
 * toArray(zip([1, 2, 3], 'ab')); // [[1, 'a'], [2, 'b']] typed as [number, string][]
 * toArray(zip(count(), ['a', 'b'])); // [[0, 'a'], [1, 'b']]
 */
export function zip<T extends Array<Iterable<unknown>>>(...iterables: T): IterableIterator<ZippedValues<T>> {
	for (const iterable of iterables) assertIterable('zip', iterable, 'iterables');
	return (function* (): Generator<ZippedValues<T>, void, undefined> {
		if (iterables.length === 0) return;
		const iterators: Array<Iterator<unknown>> = [];
		// Index of the iterator being advanced: when it ends (or throws), it must not be closed.
		let current = -1;
		let threw = false;
		try {
			for (const iterable of iterables) iterators.push(iterable[Symbol.iterator]());
			for (;;) {
				const tuple: unknown[] = [];
				for (current = 0; current < iterators.length; current++) {
					const result = iterators[current].next();
					if (result.done === true) return;
					tuple.push(result.value);
				}
				current = -1;
				yield tuple as ZippedValues<T>;
			}
		} catch (error) {
			threw = true;
			throw error;
		} finally {
			closeIterators(iterators, current, threw);
		}
	})();
}

/**
 * Lazily pair each item with its zero-based index.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @returns {IterableIterator<[number, T]>} An iterator of `[index, value]` tuples
 * @throws {TypeError} when `iterable` is not iterable
 * @example
 * toArray(enumerate(['a', 'b'])); // [[0, 'a'], [1, 'b']]
 */
export function enumerate<T>(iterable: Iterable<T>): IterableIterator<[number, T]> {
	assertIterable('enumerate', iterable);
	return (function* (): Generator<[number, T], void, undefined> {
		let index = 0;
		for (const value of iterable) yield [index++, value];
	})();
}

/**
 * Lazily drop items whose key (the item itself, or the result of `keyFn`) was already seen, keeping first occurrences.
 * Keys are compared with SameValueZero (so `NaN` equals `NaN` and `0` equals `-0`). Seen keys are kept in memory.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => unknown} [keyFn] - Returns the identity key of an item (defaults to the item itself)
 * @returns {IterableIterator<T>} An iterator of the first item for each distinct key
 * @throws {TypeError} when `iterable` is not iterable or `keyFn` is given but is not a function
 * @example
 * toArray(unique([1, 2, 1, 3, 2])); // [1, 2, 3]
 * toArray(unique(['a', 'B', 'A'], function (s) { return s.toLowerCase(); })); // ['a', 'B']
 */
export function unique<T>(iterable: Iterable<T>, keyFn?: (value: T, index: number) => unknown): IterableIterator<T> {
	assertIterable('unique', iterable);
	if (keyFn !== undefined) assertFunction('unique', 'keyFn', keyFn);
	return (function* (): Generator<T, void, undefined> {
		const seen = new Set<unknown>();
		let index = 0;
		for (const value of iterable) {
			const key = keyFn === undefined ? value : keyFn(value, index);
			index++;
			if (seen.has(key)) continue;
			seen.add(key);
			yield value;
		}
	})();
}

/**
 * Lazily yield the running accumulation of an iterable: the accumulator after each item (the initial value itself is
 * NOT yielded, so the output has as many items as the input, and its last item is what `reduce` would return).
 * @template T
 * @template A
 * @param {Iterable<T>} iterable - The source items
 * @param {(accumulator: A, value: T, index: number) => A} reducer - Combines the accumulator with an item
 * @param {A} initial - The initial accumulator
 * @returns {IterableIterator<A>} An iterator of the successive accumulators
 * @throws {TypeError} when `iterable` is not iterable or `reducer` is not a function
 * @example
 * toArray(scan([1, 2, 3], function (sum, n) { return sum + n; }, 0)); // [1, 3, 6]
 */
export function scan<T, A>(iterable: Iterable<T>, reducer: (accumulator: A, value: T, index: number) => A, initial: A): IterableIterator<A> {
	assertIterable('scan', iterable);
	assertFunction('scan', 'reducer', reducer);
	return (function* (): Generator<A, void, undefined> {
		let accumulator = initial;
		let index = 0;
		for (const value of iterable) {
			accumulator = reducer(accumulator, value, index++);
			yield accumulator;
		}
	})();
}

/**
 * Lazily yield the items of each iterable in turn. Each source is only opened once the previous one is exhausted.
 * @template T
 * @param {...Iterable<T>} iterables - The iterables to chain
 * @returns {IterableIterator<T>} An iterator over all the items, in order
 * @throws {TypeError} when an argument is not iterable
 * @example
 * toArray(concat([1, 2], new Set([3]), 'ab')); // [1, 2, 3, 'a', 'b']
 */
export function concat<T>(...iterables: Array<Iterable<T>>): IterableIterator<T> {
	for (const iterable of iterables) assertIterable('concat', iterable, 'iterables');
	return (function* (): Generator<T, void, undefined> {
		// Not `yield*`: `throw()` must close the current source and rethrow, not be forwarded into it.
		for (const iterable of iterables) for (const value of iterable) yield value;
	})();
}

/**
 * Lazily call `fn` on each item as it passes through, yielding the items unchanged (for logging or debugging).
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => void} fn - Side effect run on each item before it is yielded
 * @returns {IterableIterator<T>} An iterator of the same items
 * @throws {TypeError} when `iterable` is not iterable or `fn` is not a function
 * @example
 * toArray(tap([1, 2], function (n) { seen.push(n); })); // [1, 2], and seen is [1, 2]
 */
export function tap<T>(iterable: Iterable<T>, fn: (value: T, index: number) => void): IterableIterator<T> {
	assertIterable('tap', iterable);
	assertFunction('tap', 'fn', fn);
	return (function* (): Generator<T, void, undefined> {
		let index = 0;
		for (const value of iterable) {
			fn(value, index++);
			yield value;
		}
	})();
}

// ---------------------------------------------------------------------------------------------------------------------
// Consumers (eager: they pull from the source; those that can stop early close it)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Collect the items of an iterable into a new array. Never returns for an infinite iterable: bound it with {@link take}.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @returns {T[]} A new array with every item
 * @throws {TypeError} when `iterable` is not iterable
 * @example
 * toArray(map(new Set([1, 2]), function (n) { return n + 1; })); // [2, 3]
 */
export function toArray<T>(iterable: Iterable<T>): T[] {
	assertIterable('toArray', iterable);
	return Array.from(iterable);
}

/**
 * Reduce the items of an iterable to a single value, starting from `initial`.
 * @template T
 * @template A
 * @param {Iterable<T>} iterable - The source items
 * @param {(accumulator: A, value: T, index: number) => A} reducer - Combines the accumulator with an item
 * @param {A} initial - The initial accumulator
 * @returns {A} The final accumulator (`initial` for an empty iterable)
 * @throws {TypeError} when `iterable` is not iterable or `reducer` is not a function
 * @example
 * reduce([1, 2, 3], function (sum, n) { return sum + n; }, 10); // 16
 */
export function reduce<T, A>(iterable: Iterable<T>, reducer: (accumulator: A, value: T, index: number) => A, initial: A): A;
/**
 * Reduce the items of an iterable to a single value, using the first item as the initial accumulator
 * (the reducer is first called with the second item, at index 1, like `Array.prototype.reduce`).
 * @template T
 * @param {Iterable<T>} iterable - The source items (at least one)
 * @param {(accumulator: T, value: T, index: number) => T} reducer - Combines the accumulator with an item
 * @returns {T} The final accumulator
 * @throws {TypeError} when `iterable` is not iterable, `reducer` is not a function, or the iterable is empty
 * @example
 * reduce([1, 2, 3], function (max, n) { return Math.max(max, n); }); // 3
 */
export function reduce<T>(iterable: Iterable<T>, reducer: (accumulator: T, value: T, index: number) => T): T;
/**
 * Reduce the items of an iterable to a single value, from `initial` or (when omitted) from the first item.
 * @template T
 * @template A
 * @param {Iterable<T>} iterable - The source items
 * @param {(accumulator: A, value: T, index: number) => A} reducer - Combines the accumulator with an item
 * @param {...A} initial - The optional initial accumulator
 * @returns {A} The final accumulator
 * @throws {TypeError} when `iterable` is not iterable, `reducer` is not a function, or the iterable is empty and no initial value is given
 * @example
 * reduce([1, 2, 3], function (sum, n) { return sum + n; }, 0); // 6
 */
export function reduce<T, A>(iterable: Iterable<T>, reducer: (accumulator: A, value: T, index: number) => A, ...initial: [] | [A]): A {
	assertIterable('reduce', iterable);
	assertFunction('reduce', 'reducer', reducer);
	let hasAccumulator = initial.length > 0;
	let accumulator = initial[0] as A;
	let index = 0;
	for (const value of iterable) {
		if (hasAccumulator) {
			accumulator = reducer(accumulator, value, index);
		} else {
			accumulator = value as unknown as A;
			hasAccumulator = true;
		}
		index++;
	}
	if (!hasAccumulator) throw new TypeError('reduce: cannot reduce an empty iterable without an initial value');
	return accumulator;
}

/**
 * Return the first item of an iterable, pulling only that item (the source is then closed).
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @returns {T | undefined} The first item, or `undefined` when the iterable is empty
 * @throws {TypeError} when `iterable` is not iterable
 * @example
 * first(count(5)); // 5
 * first([]); // undefined
 */
export function first<T>(iterable: Iterable<T>): T | undefined {
	assertIterable('first', iterable);
	for (const value of iterable) return value;
	return undefined;
}

/**
 * Return the last item of an iterable (consuming all of it; never returns for an infinite iterable).
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @returns {T | undefined} The last item, or `undefined` when the iterable is empty
 * @throws {TypeError} when `iterable` is not iterable
 * @example
 * last(take(count(), 4)); // 3
 */
export function last<T>(iterable: Iterable<T>): T | undefined {
	assertIterable('last', iterable);
	let result: T | undefined;
	for (const value of iterable) result = value;
	return result;
}

/**
 * Return the first item matching a type guard, narrowing its type; stops pulling (and closes the source) once found.
 * @template T
 * @template S
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => value is S} predicate - Type guard identifying the wanted item
 * @returns {S | undefined} The first matching item, or `undefined` when none matches
 * @throws {TypeError} when `iterable` is not iterable or `predicate` is not a function
 * @example
 * find([1, 'a'], function (v): v is string { return typeof v === 'string'; }); // 'a' typed as string | undefined
 */
export function find<T, S extends T>(iterable: Iterable<T>, predicate: (value: T, index: number) => value is S): S | undefined;
/**
 * Return the first item matching a predicate; stops pulling (and closes the source) once found.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => boolean} predicate - Identifies the wanted item
 * @returns {T | undefined} The first matching item, or `undefined` when none matches
 * @throws {TypeError} when `iterable` is not iterable or `predicate` is not a function
 * @example
 * find(count(1), function (n) { return n % 7 === 0; }); // 7
 */
export function find<T>(iterable: Iterable<T>, predicate: (value: T, index: number) => boolean): T | undefined;
/**
 * Return the first item matching a predicate; stops pulling (and closes the source) once found.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => boolean} predicate - Identifies the wanted item
 * @returns {T | undefined} The first matching item, or `undefined` when none matches
 * @throws {TypeError} when `iterable` is not iterable or `predicate` is not a function
 * @example
 * find([1, 2, 3], function (n) { return n > 1; }); // 2
 */
export function find<T>(iterable: Iterable<T>, predicate: (value: T, index: number) => boolean): T | undefined {
	assertIterable('find', iterable);
	assertFunction('find', 'predicate', predicate);
	let index = 0;
	for (const value of iterable) if (predicate(value, index++)) return value;
	return undefined;
}

/**
 * Tell whether at least one item matches a predicate; stops at (and closes the source on) the first match.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => boolean} predicate - The condition to test
 * @returns {boolean} Whether any item matches (`false` for an empty iterable)
 * @throws {TypeError} when `iterable` is not iterable or `predicate` is not a function
 * @example
 * some(count(), function (n) { return n > 100; }); // true
 */
export function some<T>(iterable: Iterable<T>, predicate: (value: T, index: number) => boolean): boolean {
	assertIterable('some', iterable);
	assertFunction('some', 'predicate', predicate);
	let index = 0;
	for (const value of iterable) if (predicate(value, index++)) return true;
	return false;
}

/**
 * Tell whether every item matches a predicate; stops at (and closes the source on) the first mismatch.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => boolean} predicate - The condition to test
 * @returns {boolean} Whether all items match (`true` for an empty iterable)
 * @throws {TypeError} when `iterable` is not iterable or `predicate` is not a function
 * @example
 * every([2, 4], function (n) { return n % 2 === 0; }); // true
 */
export function every<T>(iterable: Iterable<T>, predicate: (value: T, index: number) => boolean): boolean {
	assertIterable('every', iterable);
	assertFunction('every', 'predicate', predicate);
	let index = 0;
	for (const value of iterable) if (!predicate(value, index++)) return false;
	return true;
}

/**
 * Count the items of an iterable (consuming all of it), or only those matching `predicate` when given.
 * Named `countItems` because {@link count} is the infinite counter source.
 * @template T
 * @param {Iterable<T>} iterable - The source items
 * @param {(value: T, index: number) => boolean} [predicate] - Only items for which it returns `true` are counted
 * @returns {number} The number of (matching) items
 * @throws {TypeError} when `iterable` is not iterable or `predicate` is given but is not a function
 * @example
 * countItems(new Set([1, 2, 3])); // 3
 * countItems([1, 2, 3], function (n) { return n > 1; }); // 2
 */
export function countItems<T>(iterable: Iterable<T>, predicate?: (value: T, index: number) => boolean): number {
	assertIterable('countItems', iterable);
	if (predicate !== undefined) assertFunction('countItems', 'predicate', predicate);
	let total = 0;
	let index = 0;
	for (const value of iterable) if (predicate === undefined || predicate(value, index++)) total++;
	return total;
}

// ---------------------------------------------------------------------------------------------------------------------
// Async (inputs may be async iterables, or sync iterables of values and/or promises; items are processed one at a time)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Lazily transform each item of an async (or sync) iterable with a possibly async function, one item at a time.
 * @template T
 * @template U
 * @param {AwaitableIterable<T>} iterable - The source items
 * @param {(value: T, index: number) => U | PromiseLike<U>} fn - Maps an item (and its index) to the output item
 * @returns {AsyncIterableIterator<U>} An async iterator of the mapped items
 * @throws {TypeError} when `iterable` is neither async iterable nor iterable, or `fn` is not a function
 * @example
 * await toArrayAsync(mapAsync([1, 2], async function (n) { return n * 2; })); // [2, 4]
 */
export function mapAsync<T, U>(iterable: AwaitableIterable<T>, fn: (value: T, index: number) => U | PromiseLike<U>): AsyncIterableIterator<U> {
	assertAwaitableIterable('mapAsync', iterable);
	assertFunction('mapAsync', 'fn', fn);
	return (async function* (): AsyncGenerator<U, void, undefined> {
		let index = 0;
		for await (const value of awaitItems(iterable)) yield await fn(value, index++);
	})();
}

/**
 * Lazily keep the items of an async (or sync) iterable matching a (sync) type guard, narrowing the item type.
 * @template T
 * @template S
 * @param {AwaitableIterable<T>} iterable - The source items
 * @param {(value: T, index: number) => value is S} predicate - Type guard deciding which items to keep
 * @returns {AsyncIterableIterator<S>} An async iterator of the kept items
 * @throws {TypeError} when `iterable` is neither async iterable nor iterable, or `predicate` is not a function
 * @example
 * await toArrayAsync(filterAsync([1, 'a'], function (v): v is number { return typeof v === 'number'; })); // [1]
 */
export function filterAsync<T, S extends T>(iterable: AwaitableIterable<T>, predicate: (value: T, index: number) => value is S): AsyncIterableIterator<S>;
/**
 * Lazily keep the items of an async (or sync) iterable matching a possibly async predicate, one item at a time.
 * @template T
 * @param {AwaitableIterable<T>} iterable - The source items
 * @param {(value: T, index: number) => boolean | PromiseLike<boolean>} predicate - Decides which items to keep
 * @returns {AsyncIterableIterator<T>} An async iterator of the kept items
 * @throws {TypeError} when `iterable` is neither async iterable nor iterable, or `predicate` is not a function
 * @example
 * await toArrayAsync(filterAsync([1, 2, 3], async function (n) { return n > 1; })); // [2, 3]
 */
export function filterAsync<T>(iterable: AwaitableIterable<T>, predicate: (value: T, index: number) => boolean | PromiseLike<boolean>): AsyncIterableIterator<T>;
/**
 * Lazily keep the items of an async (or sync) iterable matching a possibly async predicate, one item at a time.
 * @template T
 * @param {AwaitableIterable<T>} iterable - The source items
 * @param {(value: T, index: number) => boolean | PromiseLike<boolean>} predicate - Decides which items to keep
 * @returns {AsyncIterableIterator<T>} An async iterator of the kept items
 * @throws {TypeError} when `iterable` is neither async iterable nor iterable, or `predicate` is not a function
 * @example
 * await toArrayAsync(filterAsync([1, 2, 3], async function (n) { return n > 1; })); // [2, 3]
 */
export function filterAsync<T>(iterable: AwaitableIterable<T>, predicate: (value: T, index: number) => boolean | PromiseLike<boolean>): AsyncIterableIterator<T> {
	assertAwaitableIterable('filterAsync', iterable);
	assertFunction('filterAsync', 'predicate', predicate);
	return (async function* (): AsyncGenerator<T, void, undefined> {
		let index = 0;
		for await (const value of awaitItems(iterable)) if (await predicate(value, index++)) yield value;
	})();
}

/**
 * Lazily yield the first `n` items of an async (or sync) iterable; exactly `n` items are pulled, then the source is closed.
 * @template T
 * @param {AwaitableIterable<T>} iterable - The source items
 * @param {number} n - How many items to take (a non-negative integer, or `Infinity` for all of them)
 * @returns {AsyncIterableIterator<T>} An async iterator of at most `n` items
 * @throws {TypeError} when `iterable` is neither async iterable nor iterable
 * @throws {RangeError} when `n` is negative, `NaN` or a non-integer finite number
 * @example
 * await toArrayAsync(takeAsync(count(), 2)); // [0, 1]
 */
export function takeAsync<T>(iterable: AwaitableIterable<T>, n: number): AsyncIterableIterator<T> {
	assertAwaitableIterable('takeAsync', iterable);
	assertCount('takeAsync', 'n', n, 0, true);
	return (async function* (): AsyncGenerator<T, void, undefined> {
		if (n === 0) return;
		let taken = 0;
		for await (const value of awaitItems(iterable)) {
			yield value;
			if (++taken >= n) return;
		}
	})();
}

/**
 * Lazily split an async (or sync) iterable into consecutive chunks of `size` items; only the last chunk may be shorter.
 * @template T
 * @param {AwaitableIterable<T>} iterable - The source items
 * @param {number} size - The maximum length of each chunk (a positive integer)
 * @returns {AsyncIterableIterator<T[]>} An async iterator of fresh chunk arrays
 * @throws {TypeError} when `iterable` is neither async iterable nor iterable
 * @throws {RangeError} when `size` is not a positive integer
 * @example
 * await toArrayAsync(chunkAsync([1, 2, 3], 2)); // [[1, 2], [3]]
 */
export function chunkAsync<T>(iterable: AwaitableIterable<T>, size: number): AsyncIterableIterator<T[]> {
	assertAwaitableIterable('chunkAsync', iterable);
	assertCount('chunkAsync', 'size', size, 1);
	return (async function* (): AsyncGenerator<T[], void, undefined> {
		let buffer: T[] = [];
		for await (const value of awaitItems(iterable)) {
			buffer.push(value);
			if (buffer.length === size) {
				const full = buffer;
				buffer = [];
				yield full;
			}
		}
		if (buffer.length > 0) yield buffer;
	})();
}

/**
 * Collect the items of an async (or sync) iterable into a new array, awaiting each item in turn (like `Array.fromAsync`).
 * Argument errors are thrown synchronously; errors from the source reject the returned promise.
 * @template T
 * @param {AwaitableIterable<T>} iterable - The source items
 * @returns {Promise<T[]>} A promise of a new array with every (awaited) item
 * @throws {TypeError} when `iterable` is neither async iterable nor iterable
 * @example
 * await toArrayAsync(mapAsync([1, 2], function (n) { return n + 1; })); // [2, 3]
 * await toArrayAsync([Promise.resolve(1), 2]); // [1, 2]
 */
export function toArrayAsync<T>(iterable: AwaitableIterable<T>): Promise<T[]> {
	assertAwaitableIterable('toArrayAsync', iterable);
	return (async function (): Promise<T[]> {
		const result: T[] = [];
		for await (const value of awaitItems(iterable)) result.push(value);
		return result;
	})();
}
