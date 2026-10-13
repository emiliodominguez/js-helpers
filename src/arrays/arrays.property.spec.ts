// The conventions mandate the default import; fast-check's members are also named exports, which this rule flags.
import fc from 'fast-check';
import * as helpers from '.';

/** Small integers so that duplicates and overlaps between inputs are frequent. */
const smallInt = fc.integer({ min: -8, max: 8 });
const smallInts = fc.array(smallInt, { maxLength: 30 });

/** Arbitrarily nested arrays of integers. */
const { tree } = fc.letrec<{ tree: unknown }>(function (tie) {
	return {
		tree: fc.oneof({ depthSize: 'small', withCrossShrink: true }, fc.integer(), fc.array(tie('tree'), { maxLength: 4 }))
	};
});
const nestedArray = fc.array(tree, { maxLength: 6 });

/** A generator of floats in [0, 1) driven by fast-check, so failing cases shrink and replay. */
const randomStream = fc.infiniteStream(fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }));

/**
 * Wraps a fast-check stream into a `random()`-compatible function.
 */
function fromStream(stream: Iterator<number>): () => number {
	return function () {
		return stream.next().value;
	};
}

/**
 * Seeded PRNG (mulberry32) returning floats in [0, 1).
 */
function seeded(seed: number): () => number {
	let state = seed >>> 0;
	return function () {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Naive O(n²) reference implementation of deduplication. */
function naiveUnique<T>(values: T[]): T[] {
	return values.filter(function (value, index) {
		return values.indexOf(value) === index;
	});
}

function sortedNumbers(values: number[]): number[] {
	return [...values].sort(function (a, b) {
		return a - b;
	});
}

describe('arrays (property-based)', function () {
	it('contains agrees with a SameValueZero reference', function () {
		fc.assert(
			fc.property(fc.array(fc.oneof(smallInt, fc.constant(NaN))), fc.oneof(smallInt, fc.constant(NaN)), function (array, value) {
				const expected = array.some(function (item) {
					return item === value || (Number.isNaN(item) && Number.isNaN(value));
				});
				expect(helpers.contains(array, value)).toBe(expected);
			})
		);
	});

	it('first and last agree with direct indexing', function () {
		fc.assert(
			fc.property(smallInts, function (array) {
				expect(helpers.first(array)).toBe(array[0]);
				expect(helpers.last(array)).toBe(array.at(-1));
			})
		);
	});

	it('removeDuplicates is idempotent, preserves membership and matches the naive reference', function () {
		fc.assert(
			fc.property(smallInts, function (array) {
				const unique = helpers.removeDuplicates(array);
				expect(helpers.removeDuplicates(unique)).toEqual(unique);
				expect(unique).toEqual(naiveUnique(array));
				expect(new Set(unique).size).toBe(unique.length);
				for (const value of array) expect(unique).toContain(value);
			})
		);
	});

	it('union, intersection and difference match naive references', function () {
		fc.assert(
			fc.property(smallInts, smallInts, function (a, b) {
				expect(helpers.union(a, b)).toEqual(naiveUnique([...a, ...b]));
				expect(helpers.intersection(a, b)).toEqual(
					naiveUnique(a).filter(function (value) {
						return b.includes(value);
					})
				);
				expect(helpers.difference(a, b)).toEqual(
					naiveUnique(a).filter(function (value) {
						return !b.includes(value);
					})
				);
			})
		);
	});

	it('set operations satisfy the set-algebra laws', function () {
		fc.assert(
			fc.property(smallInts, smallInts, function (a, b) {
				const union = helpers.union(a, b);
				const inter = helpers.intersection(a, b);
				const diff = helpers.difference(a, b);
				const symDiff = helpers.symmetricDifference(a, b);

				// Commutativity (as sets).
				expect(sortedNumbers(union)).toEqual(sortedNumbers(helpers.union(b, a)));
				expect(sortedNumbers(inter)).toEqual(sortedNumbers(helpers.intersection(b, a)));
				expect(sortedNumbers(symDiff)).toEqual(sortedNumbers(helpers.symmetricDifference(b, a)));

				// Bounds and disjointness.
				expect(helpers.isSubset(inter, a) && helpers.isSubset(inter, b)).toBe(true);
				expect(helpers.isSubset(a, union) && helpers.isSubset(b, union)).toBe(true);
				expect(helpers.intersection(diff, b)).toEqual([]);

				// Partition of the union: |A ∪ B| = |A − B| + |A ∩ B| + |B − A|.
				expect(union.length).toBe(diff.length + inter.length + helpers.difference(b, a).length);

				// Symmetric difference = (A ∪ B) − (A ∩ B), in order (A − B) ++ (B − A).
				expect(sortedNumbers(symDiff)).toEqual(sortedNumbers(helpers.difference(union, inter)));
				expect(symDiff).toEqual([...diff, ...helpers.difference(b, a)]);

				// Every result is duplicate-free.
				for (const result of [union, inter, diff, symDiff]) expect(new Set(result).size).toBe(result.length);
			})
		);
	});

	it('isSubset holds exactly when the difference is empty', function () {
		fc.assert(
			fc.property(smallInts, smallInts, function (a, b) {
				expect(helpers.isSubset(a, b)).toBe(helpers.difference(a, b).length === 0);
				expect(helpers.isSubset(a, a)).toBe(true);
			})
		);
	});

	it('chunk round-trips through flat and respects the size bounds', function () {
		fc.assert(
			fc.property(fc.array(fc.integer(), { maxLength: 50 }), fc.integer({ min: 1, max: 12 }), function (array, size) {
				const chunks = helpers.chunk(array, size);
				expect(chunks.flat()).toEqual(array);
				expect(chunks.length).toBe(Math.ceil(array.length / size));
				chunks.forEach(function (part, index) {
					expect(part.length).toBeGreaterThan(0);
					if (index < chunks.length - 1) expect(part.length).toBe(size);
					else expect(part.length).toBeLessThanOrEqual(size);
				});
			})
		);
	});

	it('flatten and flattenDeep agree with Array.prototype.flat', function () {
		fc.assert(
			fc.property(nestedArray, function (array) {
				expect(helpers.flatten(array)).toEqual(array.flat());
				expect(helpers.flattenDeep(array)).toEqual(array.flat(Infinity));
			})
		);
	});

	it('flattenDeep is idempotent and yields no arrays', function () {
		fc.assert(
			fc.property(nestedArray, function (array) {
				const flat = helpers.flattenDeep(array);
				expect(helpers.flattenDeep(flat)).toEqual(flat);
				expect(flat.some(Array.isArray)).toBe(false);
			})
		);
	});

	it('compact removes exactly the falsy values', function () {
		const falsy = fc.constantFrom<unknown>(false, null, undefined, 0, -0, NaN, '', 0n);
		fc.assert(
			fc.property(fc.array(fc.oneof(falsy, fc.anything())), function (array) {
				const result = helpers.compact(array);
				expect(result.every(Boolean)).toBe(true);
				expect(result).toEqual(array.filter(Boolean));
				expect(helpers.compact(result)).toEqual(result);
			})
		);
	});

	it('range has length max(0, ceil((end - start) / step)) and evenly spaced values', function () {
		const step = fc.integer({ min: -10, max: 10 }).filter(function (n) {
			return n !== 0;
		});
		fc.assert(
			fc.property(fc.integer({ min: -100, max: 100 }), fc.integer({ min: -100, max: 100 }), step, function (start, end, s) {
				const values = helpers.range(start, end, s);
				expect(values.length).toBe(Math.max(0, Math.ceil((end - start) / s)));
				values.forEach(function (value, index) {
					expect(value).toBe(start + index * s);
					expect(s > 0 ? value < end : value > end).toBe(true);
				});
			})
		);
	});

	it('range with one argument equals range(0, end)', function () {
		fc.assert(
			fc.property(fc.integer({ min: -50, max: 200 }), function (end) {
				expect(helpers.range(end)).toEqual(helpers.range(0, end, 1));
			})
		);
	});

	it('zip truncates to the shortest input and keeps elements aligned', function () {
		fc.assert(
			fc.property(smallInts, fc.array(fc.string(), { maxLength: 30 }), fc.array(fc.boolean(), { maxLength: 30 }), function (a, b, c) {
				const zipped = helpers.zip(a, b, c);
				expect(zipped.length).toBe(Math.min(a.length, b.length, c.length));
				zipped.forEach(function (tuple, index) {
					expect(tuple).toEqual([a[index], b[index], c[index]]);
				});
			})
		);
	});

	it('partition splits into the filter and its complement, preserving relative order', function () {
		fc.assert(
			fc.property(smallInts, smallInt, function (array, pivot) {
				function predicate(value: number): boolean {
					return value < pivot;
				}
				const [pass, fail] = helpers.partition(array, predicate);
				expect(pass).toEqual(array.filter(predicate));
				expect(fail).toEqual(
					array.filter(function (value) {
						return !predicate(value);
					})
				);
				expect(sortedNumbers([...pass, ...fail])).toEqual(sortedNumbers(array));
			})
		);
	});

	it('groupBy, countBy and keyBy are consistent with filtering by key', function () {
		const keys = ['a', 'b', '__proto__', 'constructor', 'toString'];
		fc.assert(
			fc.property(fc.array(fc.record({ key: fc.constantFrom(...keys), value: fc.integer() }), { maxLength: 30 }), function (items) {
				function keyOf(item: { key: string }): string {
					return item.key;
				}
				const groups = helpers.groupBy(items, keyOf);
				const counts = helpers.countBy(items, keyOf);
				const index = helpers.keyBy(items, keyOf);
				const present = naiveUnique(items.map(keyOf));

				expect(Object.keys(groups).sort()).toEqual([...present].sort());
				let total = 0;
				for (const key of present) {
					const expected = items.filter(function (item) {
						return item.key === key;
					});
					expect(groups[key]).toEqual(expected);
					expect(counts[key]).toBe(expected.length);
					expect(index[key]).toBe(expected[expected.length - 1]);
					total += expected.length;
				}
				expect(total).toBe(items.length);
				// No pollution of the global prototype.
				expect(Object.getPrototypeOf({})).toBe(Object.prototype);
				expect(({} as any).a).toBeUndefined();
			})
		);
	});

	it('uniqueBy keeps exactly the first item of each key', function () {
		fc.assert(
			fc.property(fc.array(fc.record({ key: smallInt, id: fc.nat() }), { maxLength: 30 }), function (items) {
				function keyOf(item: { key: number }): number {
					return item.key;
				}
				const unique = helpers.uniqueBy(items, keyOf);
				expect(unique.map(keyOf)).toEqual(naiveUnique(items.map(keyOf)));
				for (const item of unique) {
					expect(
						items.find(function (candidate) {
							return candidate.key === item.key;
						})
					).toBe(item);
				}
				expect(helpers.uniqueBy(items.map(keyOf), Number)).toEqual(helpers.removeDuplicates(items.map(keyOf)));
			})
		);
	});

	it('sortBy returns a sorted, stable permutation and does not mutate its input', function () {
		fc.assert(
			fc.property(fc.array(smallInt, { maxLength: 40 }), fc.constantFrom<'asc' | 'desc'>('asc', 'desc'), function (keys, order) {
				const items = keys.map(function (key, id) {
					return { key, id };
				});
				const snapshot = items.slice();
				const sorted = helpers.sortBy(
					items,
					function (item) {
						return item.key;
					},
					order
				);
				expect(items).toEqual(snapshot);
				expect(
					sorted
						.map(function (item) {
							return item.id;
						})
						.sort(function (a, b) {
							return a - b;
						})
				).toEqual(
					items.map(function (item) {
						return item.id;
					})
				);
				for (let i = 1; i < sorted.length; i++) {
					const previous = sorted[i - 1];
					const current = sorted[i];
					if (previous.key === current.key) expect(previous.id).toBeLessThan(current.id);
					else expect(order === 'asc' ? previous.key < current.key : previous.key > current.key).toBe(true);
				}
			})
		);
	});

	it('sortBy on strings matches a code-unit reference sort', function () {
		fc.assert(
			fc.property(fc.array(fc.string({ unit: 'binary', maxLength: 4 }), { maxLength: 30 }), function (strings) {
				const expected = [...strings].sort(function (a, b) {
					return a < b ? -1 : a > b ? 1 : 0;
				});
				expect(helpers.sortBy(strings, String)).toEqual(expected);
			})
		);
	});

	it('shuffle returns a permutation of its input without mutating it', function () {
		fc.assert(
			fc.property(fc.array(fc.integer(), { maxLength: 40 }), randomStream, function (array, stream) {
				const snapshot = array.slice();
				const shuffled = helpers.shuffle(array, fromStream(stream));
				expect(array).toEqual(snapshot);
				expect(sortedNumbers(shuffled)).toEqual(sortedNumbers(array));
			})
		);
	});

	it('shuffle and sample are deterministic for a given generator', function () {
		fc.assert(
			fc.property(fc.array(fc.integer(), { maxLength: 40 }), fc.integer(), function (array, seed) {
				expect(helpers.shuffle(array, seeded(seed))).toEqual(helpers.shuffle(array, seeded(seed)));
				const picked = helpers.sample(array, seeded(seed));
				expect(picked).toBe(helpers.sample(array, seeded(seed)));
				if (array.length > 0) expect(array).toContain(picked);
				else expect(picked).toBeUndefined();
			})
		);
	});

	it('take(n) ++ drop(n) reconstructs the input', function () {
		fc.assert(
			fc.property(smallInts, fc.nat({ max: 40 }), function (array, n) {
				const head = helpers.take(array, n);
				const tail = helpers.drop(array, n);
				expect([...head, ...tail]).toEqual(array);
				expect(head.length).toBe(Math.min(n, array.length));
			})
		);
	});
});
