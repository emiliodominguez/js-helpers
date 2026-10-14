import * as helpers from '.';

/**
 * Generator that yields the given values once (a one-shot iterable).
 */
function* once<T>(...values: T[]): Generator<T> {
	yield* values;
}

/**
 * Deterministic random generator cycling through the given values.
 */
function sequence(...values: number[]): () => number {
	let i = 0;
	return function () {
		const value = values[i % values.length];
		i++;
		return value;
	};
}

describe('Arrays helpers', function () {
	describe('contains', function () {
		it('should return true if the value is in the array', function () {
			expect(helpers.contains([1, 2, 3], 2)).toBe(true);
		});

		it('should return false if the value is not in the array', function () {
			expect(helpers.contains([1, 2, 3], 4)).toBe(false);
			expect(helpers.contains([], 4)).toBe(false);
		});

		it('should find NaN and treat -0 as 0 (SameValueZero)', function () {
			expect(helpers.contains([1, NaN], NaN)).toBe(true);
			expect(helpers.contains([-0], 0)).toBe(true);
		});

		it('should use reference equality for objects and accept readonly arrays', function () {
			const obj = { a: 1 };
			const array: ReadonlyArray<{ a: number }> = [obj];
			expect(helpers.contains(array, obj)).toBe(true);
			expect(helpers.contains(array, { a: 1 })).toBe(false);
		});
	});

	describe('first', function () {
		it('should return the first item in the array', function () {
			expect(helpers.first([1, 2, 3])).toBe(1);
		});

		it('should return undefined for an empty array', function () {
			const result: number | undefined = helpers.first<number>([]);
			expect(result).toBeUndefined();
		});
	});

	describe('last', function () {
		it('should return the last item in the array', function () {
			expect(helpers.last([1, 2, 3])).toBe(3);
		});

		it('should return undefined for an empty array', function () {
			const result: string | undefined = helpers.last<string>([]);
			expect(result).toBeUndefined();
		});
	});

	describe('flatten', function () {
		it('should flatten a nested array into a single-dimensional array', function () {
			const array = [
				[1, 2],
				[3, 4]
			];
			expect(helpers.flatten(array)).toEqual([1, 2, 3, 4]);
		});

		it('should handle mixed items and flatten exactly one level', function () {
			expect(helpers.flatten<number | number[]>([1, [2, [3]], 4])).toEqual([1, 2, [3], 4]);
			const typed: number[] = helpers.flatten([1, [2, 3]]);
			expect(typed).toEqual([1, 2, 3]);
		});

		it('should return an empty array for empty inputs', function () {
			expect(helpers.flatten([])).toEqual([]);
			expect(helpers.flatten([[], []])).toEqual([]);
		});

		it('should skip holes like Array.prototype.flat', function () {
			const inner = new Array<number>(3);
			inner[1] = 2;
			const outer = new Array<number | number[]>(3);
			outer[0] = 1;
			outer[2] = inner;
			expect(helpers.flatten(outer)).toEqual([1, 2]);
			expect(helpers.flatten(outer)).toEqual(outer.flat());
		});

		it('should not mutate the input', function () {
			const array = [[1], [2]];
			helpers.flatten(array);
			expect(array).toEqual([[1], [2]]);
		});
	});

	describe('flattenDeep', function () {
		it('should flatten arbitrarily nested arrays', function () {
			const result: number[] = helpers.flattenDeep([1, [2, [3, [4, [5]]]], 6]);
			expect(result).toEqual([1, 2, 3, 4, 5, 6]);
		});

		it('should handle empty arrays at any level', function () {
			expect(helpers.flattenDeep([])).toEqual([]);
			expect(helpers.flattenDeep([[], [[]], [[[]]]])).toEqual([]);
		});

		it('should keep non-array values, including strings and objects, intact', function () {
			const obj = { a: [1] };
			expect(helpers.flattenDeep(['ab', [obj, ['c']]])).toEqual(['ab', obj, 'c']);
		});

		it('should not overflow the stack on deep nesting', function () {
			let nested: unknown[] = [42];
			for (let i = 0; i < 100_000; i++) nested = [nested];
			expect(helpers.flattenDeep(nested)).toEqual([42]);
		});

		it('should allow the same array to appear several times when not circular', function () {
			const shared = [1, 2];
			expect(helpers.flattenDeep([shared, [shared]])).toEqual([1, 2, 1, 2]);
		});

		it('should skip holes', function () {
			const sparse = new Array<number>(2);
			sparse[1] = 7;
			expect(helpers.flattenDeep([sparse, [sparse]])).toEqual([7, 7]);
		});

		it('should throw a TypeError on circular arrays', function () {
			const circular: unknown[] = [1];
			circular.push([2, circular]);
			expect(function () {
				helpers.flattenDeep(circular);
			}).toThrow(TypeError);
		});
	});

	describe('removeDuplicates', function () {
		it('should keep the original -0 instead of the +0 a Set hands back', function () {
			expect(Object.is(helpers.removeDuplicates([-0, 0])[0], -0)).toBe(true);
			expect(Object.is(helpers.union([-0], [1])[0], -0)).toBe(true);
			expect(Object.is(helpers.union([1], [-0])[1], -0)).toBe(true);
			expect(Object.is(helpers.symmetricDifference([-0], [1])[0], -0)).toBe(true);
			expect(Object.is(helpers.symmetricDifference([1], [-0])[1], -0)).toBe(true);
		});

		it('should remove duplicates from an array', function () {
			expect(helpers.removeDuplicates([1, 2, 2, 3, 4, 4])).toEqual([1, 2, 3, 4]);
		});

		it('should keep first-occurrence order and handle NaN and strings', function () {
			expect(helpers.removeDuplicates([3, NaN, 1, 3, NaN])).toEqual([3, NaN, 1]);
			expect(helpers.removeDuplicates('hello')).toEqual(['h', 'e', 'l', 'o']);
			expect(helpers.removeDuplicates([])).toEqual([]);
		});
	});

	describe('union', function () {
		it('should return the union of two arrays', function () {
			expect(helpers.union([1, 2, 3], [3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
		});

		it('should deduplicate within each input and preserve first-appearance order', function () {
			expect(helpers.union([2, 1, 2], [3, 1, 3])).toEqual([2, 1, 3]);
			expect(helpers.union([], [])).toEqual([]);
		});

		it('should work with one-shot iterables', function () {
			expect(helpers.union(once('a', 'b'), once('b', 'c'))).toEqual(['a', 'b', 'c']);
		});
	});

	describe('intersection', function () {
		it('should return the intersection of two arrays', function () {
			expect(helpers.intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
		});

		it('should return unique values ordered as in the first input', function () {
			expect(helpers.intersection([3, 2, 3, 2, 1], [1, 2, 3, 3])).toEqual([3, 2, 1]);
			expect(helpers.intersection([NaN], [NaN])).toEqual([NaN]);
		});

		it('should return an empty array when there is no overlap', function () {
			expect(helpers.intersection([1], [2])).toEqual([]);
			expect(helpers.intersection([], [1])).toEqual([]);
		});

		it('should work with one-shot iterables', function () {
			expect(helpers.intersection(once(1, 2, 3), once(3, 2))).toEqual([2, 3]);
		});
	});

	describe('difference', function () {
		it('should return the difference of two arrays', function () {
			expect(helpers.difference([1, 2, 3], [2, 3, 4])).toEqual([1]);
		});

		it('should return unique values of the first input', function () {
			expect(helpers.difference([1, 5, 1, 5, 2], [2])).toEqual([1, 5]);
			expect(helpers.difference([1, 2], [])).toEqual([1, 2]);
			expect(helpers.difference([], [1])).toEqual([]);
		});

		it('should work with one-shot iterables', function () {
			expect(helpers.difference(once(1, 2, 3), once(2))).toEqual([1, 3]);
		});
	});

	describe('symmetricDifference', function () {
		it('should return values present in exactly one input', function () {
			expect(helpers.symmetricDifference([1, 2, 3], [3, 4])).toEqual([1, 2, 4]);
		});

		it('should deduplicate and handle empty inputs', function () {
			expect(helpers.symmetricDifference([1, 1, 2], [2, 3, 3])).toEqual([1, 3]);
			expect(helpers.symmetricDifference([], [1])).toEqual([1]);
			expect(helpers.symmetricDifference([1, 2], [2, 1])).toEqual([]);
		});
	});

	describe('isSubset', function () {
		it('should detect subsets regardless of order and duplicates', function () {
			expect(helpers.isSubset([1, 2, 2], [3, 2, 1])).toBe(true);
			expect(helpers.isSubset([1, 4], [1, 2, 3])).toBe(false);
		});

		it('should treat the empty set as a subset of anything', function () {
			expect(helpers.isSubset([], [])).toBe(true);
			expect(helpers.isSubset([], [1])).toBe(true);
			expect(helpers.isSubset([1], [])).toBe(false);
		});

		it('should use SameValueZero', function () {
			expect(helpers.isSubset([NaN, -0], [0, NaN])).toBe(true);
		});
	});

	describe('chunk', function () {
		it('should split an array into chunks of the given size', function () {
			expect(helpers.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
			expect(helpers.chunk([1, 2, 3, 4], 2)).toEqual([
				[1, 2],
				[3, 4]
			]);
		});

		it('should handle sizes larger than the array and empty arrays', function () {
			expect(helpers.chunk([1, 2], 10)).toEqual([[1, 2]]);
			expect(helpers.chunk([], 3)).toEqual([]);
			expect(helpers.chunk([1, 2], 1)).toEqual([[1], [2]]);
		});

		it.each([0, -1, 1.5, NaN, Infinity])('should throw a RangeError for size %p', function (size) {
			expect(function () {
				helpers.chunk([1, 2, 3], size);
			}).toThrow(RangeError);
		});
	});

	describe('compact', function () {
		it('should remove every falsy value', function () {
			const input = [0, -0, 1, false, true, '', 'a', null, undefined, NaN, 0n, 1n, [], {}];
			expect(helpers.compact(input)).toEqual([1, true, 'a', 1n, [], {}]);
		});

		it('should narrow the element type', function () {
			const input: Array<string | null | undefined | false> = ['a', null, 'b', undefined, false];
			const result: string[] = helpers.compact(input);
			expect(result).toEqual(['a', 'b']);
			expect(helpers.compact([])).toEqual([]);
		});
	});

	describe('range', function () {
		it('should count from 0 with a single argument', function () {
			expect(helpers.range(5)).toEqual([0, 1, 2, 3, 4]);
			expect(helpers.range(0)).toEqual([]);
			expect(helpers.range(-3)).toEqual([]);
		});

		it('should support start, end and step', function () {
			expect(helpers.range(2, 5)).toEqual([2, 3, 4]);
			expect(helpers.range(2, 8, 2)).toEqual([2, 4, 6]);
			expect(helpers.range(2, 9, 2)).toEqual([2, 4, 6, 8]);
			expect(helpers.range(-2, 2)).toEqual([-2, -1, 0, 1]);
		});

		it('should support negative steps', function () {
			expect(helpers.range(5, 0, -1)).toEqual([5, 4, 3, 2, 1]);
			expect(helpers.range(5, 0, -2)).toEqual([5, 3, 1]);
			expect(helpers.range(0, -3, -1)).toEqual([0, -1, -2]);
		});

		it('should be empty when the step points away from the end', function () {
			expect(helpers.range(0, 5, -1)).toEqual([]);
			expect(helpers.range(5, 0)).toEqual([]);
			expect(helpers.range(3, 3)).toEqual([]);
		});

		it('should use the step when the end is undefined', function () {
			expect(helpers.range(5, undefined, 2)).toEqual([0, 2, 4]);
		});

		it('should compute fractional steps without accumulating errors', function () {
			const values = helpers.range(0, 1, 0.1);
			expect(values).toHaveLength(10);
			expect(values[9]).toBeCloseTo(0.9, 12);
		});

		it('regression: never includes a value equal to the exclusive end because of float rounding', function () {
			// (2.1 - 0) / 0.3 is 7.000000000000001: the count used to be rounded up to 8, so 2.1 itself was produced.
			expect(helpers.range(0, 2.1, 0.3)).toHaveLength(7);
			expect(helpers.range(0, 1.1, 0.1)).toHaveLength(11);
			expect(helpers.range(0, 1.1, 0.1)[10]).toBeCloseTo(1, 12);
			expect(helpers.range(2.1, 0, -0.3)).toHaveLength(7);
			for (const value of helpers.range(0, 2.1, 0.3)) expect(value).toBeLessThan(2.1);
		});

		it('regression: does not add a value just below the end when the step divides the span up to rounding', function () {
			// 3 * 0.3 is 0.8999999999999999 < 0.9; the mathematically intended range has 3 items.
			expect(helpers.range(0, 0.9, 0.3)).toEqual([0, 0.3, 0.6]);
			expect(helpers.range(1e6 + 0.1, 1e6 + 0.4, 0.1)).toHaveLength(3);
		});

		it('keeps the end exclusive even when large magnitudes round values onto it', function () {
			const values = helpers.range(1e16, 1e16 + 4);
			expect(values.length).toBeLessThan(4);
			for (const value of values) expect(value).toBeLessThan(1e16 + 4);
		});

		it('should throw a RangeError for a zero step', function () {
			expect(function () {
				helpers.range(0, 5, 0);
			}).toThrow(RangeError);
		});

		it.each([
			[NaN, undefined, undefined],
			[Infinity, undefined, undefined],
			[0, Infinity, 1],
			[0, 5, NaN],
			[0, 5, -Infinity]
		])('should throw a RangeError for non-finite arguments (%p, %p, %p)', function (start, end, step) {
			expect(function () {
				helpers.range(start, end, step);
			}).toThrow(RangeError);
		});

		it('should throw a RangeError when the result would be too large', function () {
			expect(function () {
				helpers.range(0, 2 ** 40);
			}).toThrow(RangeError);
		});
	});

	describe('zip', function () {
		it('should zip arrays into typed tuples', function () {
			const result: Array<[number, string, boolean]> = helpers.zip([1, 2], ['a', 'b'], [true, false]);
			expect(result).toEqual([
				[1, 'a', true],
				[2, 'b', false]
			]);
		});

		it('should truncate to the shortest array', function () {
			expect(helpers.zip([1, 2, 3], ['a'])).toEqual([[1, 'a']]);
			expect(helpers.zip([1, 2, 3], [])).toEqual([]);
		});

		it('should handle zero and one arrays', function () {
			expect(helpers.zip()).toEqual([]);
			expect(helpers.zip([1, 2])).toEqual([[1], [2]]);
		});

		it('should accept readonly arrays', function () {
			const a: ReadonlyArray<number> = [1];
			const b = ['x'] as const;
			const result: Array<[number, 'x']> = helpers.zip(a, b);
			expect(result).toEqual([[1, 'x']]);
		});
	});

	describe('groupBy', function () {
		it('should group items by key, preserving order', function () {
			const result = helpers.groupBy([1, 2, 3, 4, 5], function (n) {
				return n % 2 === 0 ? 'even' : 'odd';
			});
			expect(result).toEqual({ odd: [1, 3, 5], even: [2, 4] });
			const odd: number[] | undefined = result.odd;
			expect(odd).toEqual([1, 3, 5]);
		});

		it('should pass the index and support symbol and number keys', function () {
			const sym = Symbol('s');
			const result = helpers.groupBy(['a', 'b', 'c'], function (_value, index) {
				return index === 0 ? sym : index;
			});
			expect(result[sym]).toEqual(['a']);
			expect(result[1]).toEqual(['b']);
			expect(result[2]).toEqual(['c']);
		});

		it('should return an empty object for an empty array', function () {
			expect(helpers.groupBy([], String)).toEqual({});
		});

		it('should be safe against prototype pollution', function () {
			const result = helpers.groupBy(['__proto__', 'constructor', '__proto__'], function (s) {
				return s;
			});
			expect(Object.getPrototypeOf(result)).toBeNull();
			expect(result['__proto__']).toEqual(['__proto__', '__proto__']);
			expect(result['constructor']).toEqual(['constructor']);
			expect(Object.keys(result)).toEqual(['__proto__', 'constructor']);
			expect(({} as any).constructor).toBe(Object);
		});
	});

	describe('keyBy', function () {
		it('should index items by key, last one wins', function () {
			const items = [
				{ id: 'a', v: 1 },
				{ id: 'b', v: 2 },
				{ id: 'a', v: 3 }
			];
			const result = helpers.keyBy(items, function (o) {
				return o.id;
			});
			expect(result).toEqual({ a: { id: 'a', v: 3 }, b: { id: 'b', v: 2 } });
		});

		it('should pass the index and be safe against prototype pollution', function () {
			const result = helpers.keyBy([{ polluted: true }], function (_o, index) {
				return index === 0 ? '__proto__' : 'other';
			});
			expect(Object.getPrototypeOf(result)).toBeNull();
			expect(Object.keys(result)).toEqual(['__proto__']);
			expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
		});
	});

	describe('countBy', function () {
		it('should count items per key', function () {
			const result = helpers.countBy(['one', 'two', 'three'], function (s) {
				return s.length;
			});
			expect(result).toEqual({ 3: 2, 5: 1 });
			expect(helpers.countBy([], String)).toEqual({});
		});

		it('should pass the index and be safe against prototype pollution', function () {
			const result = helpers.countBy(['x', 'y', 'z'], function (_s, index) {
				return index < 2 ? '__proto__' : 'hasOwnProperty';
			});
			expect(Object.getPrototypeOf(result)).toBeNull();
			expect(result['__proto__']).toBe(2);
			expect(result['hasOwnProperty']).toBe(1);
		});
	});

	describe('partition', function () {
		it('should split items according to the predicate, preserving order', function () {
			const [even, odd] = helpers.partition([1, 2, 3, 4, 5], function (n) {
				return n % 2 === 0;
			});
			expect(even).toEqual([2, 4]);
			expect(odd).toEqual([1, 3, 5]);
		});

		it('should narrow with a type-guard predicate', function () {
			const [numbers, strings] = helpers.partition([1, 'a', 2, 'b'], function (value): value is number {
				return typeof value === 'number';
			});
			const n: number[] = numbers;
			const s: string[] = strings;
			expect(n).toEqual([1, 2]);
			expect(s).toEqual(['a', 'b']);
		});

		it('should pass the index and handle empty arrays', function () {
			expect(
				helpers.partition(['a', 'b', 'c'], function (_value, index) {
					return index === 1;
				})
			).toEqual([['b'], ['a', 'c']]);
			expect(helpers.partition([], Boolean)).toEqual([[], []]);
		});
	});

	describe('uniqueBy', function () {
		it('should keep the first item for each key', function () {
			const items = [
				{ id: 1, v: 'a' },
				{ id: 1, v: 'b' },
				{ id: 2, v: 'c' }
			];
			expect(
				helpers.uniqueBy(items, function (o) {
					return o.id;
				})
			).toEqual([
				{ id: 1, v: 'a' },
				{ id: 2, v: 'c' }
			]);
		});

		it('should compare keys with SameValueZero and pass the index', function () {
			expect(helpers.uniqueBy([NaN, 1, NaN], Number)).toEqual([NaN, 1]);
			expect(
				helpers.uniqueBy(['a', 'b', 'c'], function (_value, index) {
					return index % 2;
				})
			).toEqual(['a', 'b']);
			expect(helpers.uniqueBy([], String)).toEqual([]);
		});
	});

	describe('sortBy', function () {
		it('should sort by numeric keys ascending by default without mutating', function () {
			const input = [{ n: 3 }, { n: 1 }, { n: 2 }];
			const result = helpers.sortBy(input, function (o) {
				return o.n;
			});
			expect(result).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
			expect(input).toEqual([{ n: 3 }, { n: 1 }, { n: 2 }]);
			expect(result).not.toBe(input);
		});

		it('should sort descending', function () {
			expect(helpers.sortBy([1, 3, 2], Number, 'desc')).toEqual([3, 2, 1]);
		});

		it('should be stable in both directions', function () {
			const input = [
				{ k: 1, id: 'a' },
				{ k: 0, id: 'b' },
				{ k: 1, id: 'c' },
				{ k: 0, id: 'd' }
			];
			function key(o: { k: number }) {
				return o.k;
			}
			function ids(list: Array<{ id: string }>) {
				return list.map(function (o) {
					return o.id;
				});
			}
			expect(ids(helpers.sortBy(input, key))).toEqual(['b', 'd', 'a', 'c']);
			expect(ids(helpers.sortBy(input, key, 'desc'))).toEqual(['a', 'c', 'b', 'd']);
		});

		it('should compare strings by code units, not locale', function () {
			expect(helpers.sortBy(['b', 'a', 'B', 'é', 'e'], String)).toEqual(['B', 'a', 'b', 'e', 'é']);
		});

		it('should sort by Date and bigint keys', function () {
			const dates = [new Date(2020, 1, 1), new Date(2010, 1, 1), new Date(2015, 1, 1)];
			expect(
				helpers.sortBy(dates, function (d) {
					return d;
				})
			).toEqual([dates[1], dates[2], dates[0]]);
			expect(
				helpers.sortBy([3n, 1n, 2n], function (n) {
					return n;
				})
			).toEqual([1n, 2n, 3n]);
		});

		it('should compare mixed numbers and bigints numerically and put numbers before strings', function () {
			const input: Array<number | bigint | string> = ['a', 2n, 1.5, 'B', 1];
			const result = helpers.sortBy(input, function (v) {
				return v;
			});
			expect(result).toEqual([1, 1.5, 2n, 'B', 'a']);
			expect(
				helpers.sortBy(
					input,
					function (v) {
						return v;
					},
					'desc'
				)
			).toEqual(['a', 'B', 2n, 1.5, 1]);
		});

		it('should put NaN keys and invalid dates last in both directions, stably', function () {
			const input = [NaN, 2, NaN, 1];
			const keys = [10, 2, 20, 1];
			function selector(_value: number, index: number) {
				return Number.isNaN(input[index]) ? NaN : keys[index];
			}
			expect(helpers.sortBy(input, selector)).toEqual([1, 2, NaN, NaN]);
			expect(helpers.sortBy(input, selector, 'desc')).toEqual([2, 1, NaN, NaN]);
			const invalid = new Date(NaN);
			const valid = new Date(0);
			expect(
				helpers.sortBy([invalid, valid], function (d) {
					return d;
				})
			).toEqual([valid, invalid]);
		});

		it('should call the selector once per item', function () {
			const selector = jest.fn(function (n: number) {
				return n;
			});
			helpers.sortBy([5, 4, 3, 2, 1], selector);
			expect(selector).toHaveBeenCalledTimes(5);
		});

		it('should throw a RangeError for an invalid order', function () {
			expect(function () {
				helpers.sortBy([1], Number, 'DESC' as any);
			}).toThrow(RangeError);
		});
	});

	describe('shuffle', function () {
		it('should return a permutation without mutating the input', function () {
			const input = [1, 2, 3, 4, 5];
			const result = helpers.shuffle(input);
			expect(input).toEqual([1, 2, 3, 4, 5]);
			expect(result).not.toBe(input);
			expect([...result].sort()).toEqual(input);
		});

		it('should be deterministic with an injected generator', function () {
			// random() = 0 always swaps position i with 0: [1,2,3,4] -> [4,2,3,1] -> [3,2,4,1] -> [2,3,4,1]
			expect(helpers.shuffle([1, 2, 3, 4], sequence(0))).toEqual([2, 3, 4, 1]);
			// random() close to 1 always picks j = i, i.e. the identity permutation
			expect(helpers.shuffle([1, 2, 3, 4], sequence(0.999999))).toEqual([1, 2, 3, 4]);
		});

		it('should handle empty and single-item arrays without calling random', function () {
			const random = jest.fn(Math.random);
			expect(helpers.shuffle([], random)).toEqual([]);
			expect(helpers.shuffle(['x'], random)).toEqual(['x']);
			expect(random).not.toHaveBeenCalled();
		});

		it.each([1, -0.1, NaN, 2])('should throw a RangeError when random() returns %p', function (value) {
			expect(function () {
				helpers.shuffle([1, 2, 3], sequence(value));
			}).toThrow(RangeError);
		});
	});

	describe('sample', function () {
		it('should pick the item selected by the generator', function () {
			expect(helpers.sample(['a', 'b', 'c'], sequence(0))).toBe('a');
			expect(helpers.sample(['a', 'b', 'c'], sequence(0.5))).toBe('b');
			expect(helpers.sample(['a', 'b', 'c'], sequence(0.99))).toBe('c');
		});

		it('should use Math.random by default', function () {
			expect(['a', 'b']).toContain(helpers.sample(['a', 'b']));
		});

		it('should return undefined for an empty array', function () {
			const random = jest.fn(Math.random);
			expect(helpers.sample([], random)).toBeUndefined();
			expect(random).not.toHaveBeenCalled();
		});

		it('should throw a RangeError when random() is out of range', function () {
			expect(function () {
				helpers.sample([1], sequence(1));
			}).toThrow(RangeError);
		});
	});

	describe('take', function () {
		it('should take the first n items', function () {
			expect(helpers.take([1, 2, 3], 2)).toEqual([1, 2]);
			expect(helpers.take([1, 2, 3], 0)).toEqual([]);
			expect(helpers.take([1, 2, 3], 10)).toEqual([1, 2, 3]);
			expect(helpers.take([], 1)).toEqual([]);
		});

		it.each([-1, 1.5, NaN, Infinity])('should throw a RangeError for n = %p', function (n) {
			expect(function () {
				helpers.take([1, 2, 3], n);
			}).toThrow(RangeError);
		});
	});

	describe('drop', function () {
		it('should drop the first n items', function () {
			expect(helpers.drop([1, 2, 3], 2)).toEqual([3]);
			expect(helpers.drop([1, 2, 3], 0)).toEqual([1, 2, 3]);
			expect(helpers.drop([1, 2, 3], 10)).toEqual([]);
		});

		it.each([-1, 0.5, NaN, -Infinity])('should throw a RangeError for n = %p', function (n) {
			expect(function () {
				helpers.drop([1, 2, 3], n);
			}).toThrow(RangeError);
		});
	});

	describe('unzip', function () {
		it('splits tuples into one array per position (inverse of zip)', function () {
			const pairs: Array<[number, string]> = [
				[1, 'a'],
				[2, 'b']
			];
			const result = helpers.unzip(pairs);
			const typed: [number[], string[]] | [] = result;
			expect(typed).toEqual([
				[1, 2],
				['a', 'b']
			]);
			expect(helpers.unzip(helpers.zip([1, 2, 3], [true, false, true]))).toEqual([
				[1, 2, 3],
				[true, false, true]
			]);
		});

		it('truncates to the shortest tuple, like zip', function () {
			expect(
				helpers.unzip([
					[1, 2, 3],
					[4, 5],
					[6, 7, 8]
				])
			).toEqual([
				[1, 4, 6],
				[2, 5, 7]
			]);
			expect(helpers.unzip([[1], []])).toEqual([]);
		});

		it('returns [] for an empty input (arity unknown)', function () {
			const [xs = [], ys = []] = helpers.unzip<[number, string]>([]);
			expect(xs).toEqual([]);
			expect(ys).toEqual([]);
			expect(helpers.unzip([])).toEqual([]);
		});
	});

	describe('windowed / pairwise', function () {
		it('returns full sliding windows', function () {
			expect(helpers.windowed([1, 2, 3, 4], 2)).toEqual([
				[1, 2],
				[2, 3],
				[3, 4]
			]);
			expect(helpers.windowed([1, 2, 3, 4, 5], 2, 2)).toEqual([
				[1, 2],
				[3, 4]
			]);
			expect(helpers.windowed([1, 2, 3, 4, 5], 3, 2)).toEqual([
				[1, 2, 3],
				[3, 4, 5]
			]);
			expect(helpers.windowed([1, 2, 3], 1, 5)).toEqual([[1]]);
			expect(helpers.windowed([1, 2], 3)).toEqual([]);
			expect(helpers.windowed([], 1)).toEqual([]);
		});

		it('returns fresh windows', function () {
			const input = [1, 2, 3];
			const [window] = helpers.windowed(input, 3);
			window.push(4);
			expect(input).toEqual([1, 2, 3]);
		});

		it.each([
			[0, 1],
			[-1, 1],
			[1.5, 1],
			[NaN, 1],
			[Infinity, 1],
			[2, 0],
			[2, -2],
			[2, 0.5],
			[2, Infinity]
		])('throws a RangeError for size %p and step %p', function (size, step) {
			expect(function () {
				helpers.windowed([1, 2, 3], size, step);
			}).toThrow(RangeError);
		});

		it('pairwise returns adjacent pairs', function () {
			const pairs: Array<[string, string]> = helpers.pairwise(['a', 'b', 'c']);
			expect(pairs).toEqual([
				['a', 'b'],
				['b', 'c']
			]);
			expect(helpers.pairwise([1])).toEqual([]);
			expect(helpers.pairwise([])).toEqual([]);
		});
	});

	describe('minBy / maxBy', function () {
		const items = [
			{ id: 'a', n: 3 },
			{ id: 'b', n: 1 },
			{ id: 'c', n: 7 },
			{ id: 'd', n: 1 },
			{ id: 'e', n: 7 }
		];

		function byN(item: { n: number }): number {
			return item.n;
		}

		it('returns the first item with the extreme key', function () {
			expect(helpers.minBy(items, byN)?.id).toBe('b');
			expect(helpers.maxBy(items, byN)?.id).toBe('c');
		});

		it('returns undefined for empty arrays or when every key is NaN', function () {
			expect(helpers.minBy([], byN)).toBeUndefined();
			expect(helpers.maxBy([], byN)).toBeUndefined();
			expect(helpers.minBy([NaN, NaN], Number)).toBeUndefined();
			expect(
				helpers.maxBy([new Date(NaN)], function (d) {
					return d;
				})
			).toBeUndefined();
		});

		it('ignores NaN keys and invalid dates', function () {
			expect(helpers.minBy([NaN, 2, NaN, 1], Number)).toBe(1);
			expect(helpers.maxBy([NaN, 2, 1], Number)).toBe(2);
			const dates = [new Date(NaN), new Date(5), new Date(1)];
			expect(
				helpers.minBy(dates, function (d) {
					return d;
				})
			).toBe(dates[2]);
			expect(
				helpers.maxBy(dates, function (d) {
					return d;
				})
			).toBe(dates[1]);
		});

		it('uses the sortBy ordering (bigints, strings by code unit, numbers before strings)', function () {
			expect(helpers.maxBy(['b', 'a', 'B'], String)).toBe('b');
			expect(helpers.minBy(['b', 'a', 'B'], String)).toBe('B');
			expect(
				helpers.maxBy([1n, 3, 2n], function (v) {
					return v;
				})
			).toBe(3);
			expect(
				helpers.minBy<number | string>(['a', 5], function (v) {
					return v;
				})
			).toBe(5);
			expect(
				helpers.maxBy<number | string>([5, 'a'], function (v) {
					return v;
				})
			).toBe('a');
		});

		it('calls the selector once per item with its index', function () {
			const selector = jest.fn(function (value: number) {
				return value;
			});
			helpers.minBy([3, 1, 2], selector);
			expect(selector.mock.calls).toEqual([
				[3, 0],
				[1, 1],
				[2, 2]
			]);
		});
	});

	describe('sumBy', function () {
		it('sums the selected numbers with compensated summation', function () {
			expect(
				helpers.sumBy([{ p: 0.1 }, { p: 0.2 }, { p: 0.3 }], function (o) {
					return o.p;
				})
			).toBe(0.6);
			expect(helpers.sumBy([1e100, 1, -1e100], Number)).toBe(1);
			expect(
				helpers.sumBy(['a', 'bb'], function (s, i) {
					return s.length * 10 + i;
				})
			).toBe(31);
		});

		it('returns 0 for an empty array and propagates NaN/Infinity', function () {
			expect(helpers.sumBy([], Number)).toBe(0);
			expect(helpers.sumBy([1, NaN], Number)).toBeNaN();
			expect(helpers.sumBy([1, Infinity], Number)).toBe(Infinity);
		});
	});

	describe('move / insertAt / removeAt', function () {
		it('move relocates an item without mutating the input', function () {
			const input = ['a', 'b', 'c', 'd'];
			expect(helpers.move(input, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
			expect(helpers.move(input, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
			expect(helpers.move(input, -1, 0)).toEqual(['d', 'a', 'b', 'c']);
			expect(helpers.move(input, 0, -1)).toEqual(['b', 'c', 'd', 'a']);
			expect(helpers.move(input, 1, 1)).toEqual(input);
			expect(helpers.move(input, 1, 1)).not.toBe(input);
			expect(input).toEqual(['a', 'b', 'c', 'd']);
		});

		it.each([
			[4, 0],
			[0, 4],
			[-5, 0],
			[0, -5],
			[0.5, 0],
			[0, NaN]
		])('move throws a RangeError for from %p and to %p', function (from, to) {
			expect(function () {
				helpers.move(['a', 'b', 'c', 'd'], from, to);
			}).toThrow(RangeError);
		});

		it('move throws for any index of an empty array', function () {
			expect(function () {
				helpers.move([], 0, 0);
			}).toThrow('move: `from` must be a valid index, but the array is empty, got 0');
		});

		it('insertAt inserts items before the index (negative indices count from the end)', function () {
			const input = [1, 2, 3];
			expect(helpers.insertAt(input, 0, 9)).toEqual([9, 1, 2, 3]);
			expect(helpers.insertAt(input, 1, 9, 8)).toEqual([1, 9, 8, 2, 3]);
			expect(helpers.insertAt(input, 3, 9)).toEqual([1, 2, 3, 9]);
			expect(helpers.insertAt(input, -1, 9)).toEqual([1, 2, 9, 3]);
			expect(helpers.insertAt(input, -3, 9)).toEqual([9, 1, 2, 3]);
			expect(helpers.insertAt(input, 2)).toEqual([1, 2, 3]);
			expect(helpers.insertAt([], 0, 'x')).toEqual(['x']);
			expect(helpers.insertAt([[1]], 1, [2])).toEqual([[1], [2]]);
			expect(input).toEqual([1, 2, 3]);
		});

		it.each([4, -4, 1.5, NaN, Infinity])('insertAt throws a RangeError for index %p', function (index) {
			expect(function () {
				helpers.insertAt([1, 2, 3], index, 0);
			}).toThrow(RangeError);
		});

		it('removeAt removes count items from the index', function () {
			const input = [1, 2, 3, 4];
			expect(helpers.removeAt(input, 1)).toEqual([1, 3, 4]);
			expect(helpers.removeAt(input, 1, 2)).toEqual([1, 4]);
			expect(helpers.removeAt(input, -2, 2)).toEqual([1, 2]);
			expect(helpers.removeAt(input, -1)).toEqual([1, 2, 3]);
			expect(helpers.removeAt(input, 2, 0)).toEqual([1, 2, 3, 4]);
			expect(helpers.removeAt(input, 1, 100)).toEqual([1]);
			expect(input).toEqual([1, 2, 3, 4]);
		});

		it.each([
			[4, 1],
			[-5, 1],
			[0.5, 1],
			[0, -1],
			[0, 1.5],
			[0, Infinity]
		])('removeAt throws a RangeError for index %p and count %p', function (index, count) {
			expect(function () {
				helpers.removeAt([1, 2, 3, 4], index, count);
			}).toThrow(RangeError);
		});
	});

	describe('sortedIndex / binarySearch', function () {
		it('sortedIndex returns the lowest insertion index', function () {
			expect(helpers.sortedIndex([10, 20, 20, 30], 20)).toBe(1);
			expect(helpers.sortedIndex([10, 20, 30], 5)).toBe(0);
			expect(helpers.sortedIndex([10, 20, 30], 25)).toBe(2);
			expect(helpers.sortedIndex([10, 20, 30], 99)).toBe(3);
			expect(helpers.sortedIndex([], 1)).toBe(0);
			expect(helpers.sortedIndex(['B', 'a', 'c'], 'b')).toBe(2);
			expect(helpers.sortedIndex([1n, 5n, 9n], 6n)).toBe(2);
		});

		it('sortedIndex accepts a comparator', function () {
			const people = [{ age: 20 }, { age: 30 }, { age: 30 }, { age: 40 }];
			function compare(a: { age: number }, b: { age: number }): number {
				return a.age - b.age;
			}
			expect(helpers.sortedIndex(people, { age: 30 }, compare)).toBe(1);
			expect(
				helpers.sortedIndex([3, 2, 1], 2, function (a, b) {
					return b - a;
				})
			).toBe(1);
		});

		it('binarySearch finds the lowest matching index or -1', function () {
			expect(helpers.binarySearch([1, 3, 5, 7], 5)).toBe(2);
			expect(helpers.binarySearch([1, 3, 5, 7], 1)).toBe(0);
			expect(helpers.binarySearch([1, 3, 5, 7], 7)).toBe(3);
			expect(helpers.binarySearch([1, 3, 5, 7], 4)).toBe(-1);
			expect(helpers.binarySearch([1, 3, 5, 7], 8)).toBe(-1);
			expect(helpers.binarySearch([], 8)).toBe(-1);
			expect(helpers.binarySearch([1, 2, 2, 2, 3], 2)).toBe(1);
			expect(helpers.binarySearch(['a', 'b'], 'b')).toBe(1);
		});

		it('binarySearch accepts a comparator', function () {
			function caseInsensitive(a: string, b: string): number {
				const x = a.toLowerCase();
				const y = b.toLowerCase();
				return x < y ? -1 : x > y ? 1 : 0;
			}
			expect(helpers.binarySearch(['a', 'B', 'c'], 'b', caseInsensitive)).toBe(1);
			expect(helpers.binarySearch(['a', 'B', 'c'], 'd', caseInsensitive)).toBe(-1);
		});

		it('rejects NaN with the default comparator', function () {
			expect(function () {
				helpers.sortedIndex([1, 2], NaN);
			}).toThrow(RangeError);
			expect(function () {
				helpers.binarySearch([1, 2], NaN);
			}).toThrow(RangeError);
		});
	});

	describe('cartesianProduct', function () {
		it('combines every item of each array, last array fastest', function () {
			const result = helpers.cartesianProduct([1, 2], ['a', 'b'], [true]);
			const typed: Array<[number, string, boolean]> = result;
			expect(typed).toEqual([
				[1, 'a', true],
				[1, 'b', true],
				[2, 'a', true],
				[2, 'b', true]
			]);
		});

		it('handles empty arrays and no arguments', function () {
			expect(helpers.cartesianProduct([1, 2], [])).toEqual([]);
			expect(helpers.cartesianProduct()).toEqual([[]]);
			expect(helpers.cartesianProduct([1, 2])).toEqual([[1], [2]]);
		});

		it('throws a RangeError when the product is too large', function () {
			const big = { length: 2 ** 20 } as unknown as number[];
			expect(function () {
				helpers.cartesianProduct(big, big);
			}).toThrow(RangeError);
		});
	});

	describe('intersperse', function () {
		it('inserts the separator between items', function () {
			const result: Array<number | string> = helpers.intersperse([1, 2, 3], ',');
			expect(result).toEqual([1, ',', 2, ',', 3]);
			expect(helpers.intersperse(['a'], 0)).toEqual(['a']);
			expect(helpers.intersperse([], 0)).toEqual([]);
		});
	});

	describe('differenceBy / intersectionBy', function () {
		function id(o: { id: number }): number {
			return o.id;
		}

		it('differenceBy keeps the first item of a per key absent from b', function () {
			expect(helpers.differenceBy([{ id: 1 }, { id: 2 }, { id: 1, v: 'dup' }], [{ id: 2 }], id)).toEqual([{ id: 1 }]);
			expect(helpers.differenceBy([1.2, 2.5, 3.1, 3.9], [2.1], Math.floor)).toEqual([1.2, 3.1]);
			expect(helpers.differenceBy([], [1], Number)).toEqual([]);
		});

		it('intersectionBy keeps the first item of a per key present in b', function () {
			expect(helpers.intersectionBy([{ id: 1 }, { id: 2, v: 'first' }, { id: 2 }], [{ id: 2 }, { id: 3 }], id)).toEqual([{ id: 2, v: 'first' }]);
			expect(helpers.intersectionBy([1.2, 2.5], [], Math.floor)).toEqual([]);
		});

		it('accepts different item types and iterables, and uses SameValueZero', function () {
			const users = [{ id: 1 }, { id: 2 }];
			function key(item: { id: number } | number): number {
				return typeof item === 'number' ? item : item.id;
			}
			expect(helpers.differenceBy<{ id: number }, number>(users, once(2), key)).toEqual([{ id: 1 }]);
			expect(helpers.intersectionBy<{ id: number }, number>(once(...users), [2], key)).toEqual([{ id: 2 }]);
			expect(helpers.intersectionBy([NaN], [NaN], Number)).toEqual([NaN]);
		});
	});

	describe('argument validation', function () {
		it('rejects non-function callbacks with a TypeError, even for empty input', function () {
			const callbacks: Array<[string, () => unknown]> = [
				[
					'groupBy: `keyFn`',
					function () {
						return helpers.groupBy([], undefined as any);
					}
				],
				[
					'keyBy: `keyFn`',
					function () {
						return helpers.keyBy([], undefined as any);
					}
				],
				[
					'countBy: `keyFn`',
					function () {
						return helpers.countBy([], undefined as any);
					}
				],
				[
					'partition: `predicate`',
					function () {
						return helpers.partition([], undefined as any);
					}
				],
				[
					'uniqueBy: `keyFn`',
					function () {
						return helpers.uniqueBy([], undefined as any);
					}
				],
				[
					'sortBy: `selector`',
					function () {
						return helpers.sortBy([], undefined as any);
					}
				],
				[
					'minBy: `selector`',
					function () {
						return helpers.minBy([], undefined as any);
					}
				],
				[
					'maxBy: `selector`',
					function () {
						return helpers.maxBy([], undefined as any);
					}
				],
				[
					'sumBy: `selector`',
					function () {
						return helpers.sumBy([], undefined as any);
					}
				],
				[
					'differenceBy: `keyFn`',
					function () {
						return helpers.differenceBy([], [], undefined as any);
					}
				],
				[
					'intersectionBy: `keyFn`',
					function () {
						return helpers.intersectionBy([], [], undefined as any);
					}
				],
				[
					'sortedIndex: `compare`',
					function () {
						return helpers.sortedIndex([], 1, 'x' as any);
					}
				],
				[
					'binarySearch: `compare`',
					function () {
						return helpers.binarySearch([], 1, null as any);
					}
				],
				[
					'shuffle: `random`',
					function () {
						return helpers.shuffle([1, 2], 0.5 as any);
					}
				],
				[
					'sample: `random`',
					function () {
						return helpers.sample([1], 0.5 as any);
					}
				]
			];
			for (const [prefix, call] of callbacks) {
				expect(call).toThrow(TypeError);
				expect(call).toThrow(`${prefix} must be a function`);
			}
		});

		it('rejects non-number counts with a TypeError and invalid numbers with a RangeError', function () {
			expect(function () {
				helpers.chunk([1], '2' as any);
			}).toThrow(new TypeError('chunk: `size` must be an integer >= 1, got string'));
			expect(function () {
				helpers.chunk([1], 0);
			}).toThrow(new RangeError('chunk: `size` must be an integer >= 1, got 0'));
			expect(function () {
				helpers.insertAt([1], null as any);
			}).toThrow(TypeError);
			expect(function () {
				helpers.insertAt([1], 5);
			}).toThrow(new RangeError('insertAt: `index` must be an integer in [-1, 1], got 5'));
		});

		it('validates every argument of range by name', function () {
			expect(function () {
				helpers.range(NaN);
			}).toThrow(new RangeError('range: `start` must be a finite number, got NaN'));
			expect(function () {
				helpers.range(0, Infinity);
			}).toThrow(new RangeError('range: `end` must be a finite number, got Infinity'));
			expect(function () {
				helpers.range(0, null as any);
			}).toThrow(TypeError);
			expect(function () {
				helpers.range(0, 5, 0);
			}).toThrow(new RangeError('range: `step` must be a finite number other than 0, got 0'));
		});
	});
});
