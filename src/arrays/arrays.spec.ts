import * as helpers from '.';

describe('Arrays helpers', () => {
	describe('contains', () => {
		it('should return true if the value is in the array', () => {
			const array = [1, 2, 3];
			const value = 2;
			expect(helpers.contains(array, value)).toBe(true);
		});

		it('should return false if the value is not in the array', () => {
			const array = [1, 2, 3];
			const value = 4;
			expect(helpers.contains(array, value)).toBe(false);
		});
	});

	describe('first', () => {
		it('should return the first item in the array', () => {
			const array = [1, 2, 3];
			expect(helpers.first(array)).toBe(1);
		});
	});

	describe('last', () => {
		it('should return the last item in the array', () => {
			const array = [1, 2, 3];
			expect(helpers.last(array)).toBe(3);
		});
	});

	describe('flatten', () => {
		it('should flatten a nested array into a single-dimensional array', () => {
			const array = [
				[1, 2],
				[3, 4]
			];
			expect(helpers.flatten(array)).toEqual([1, 2, 3, 4]);
		});
	});

	describe('removeDuplicates', () => {
		it('should remove duplicates from an array', () => {
			const array = [1, 2, 2, 3, 4, 4];
			expect(helpers.removeDuplicates(array)).toEqual([1, 2, 3, 4]);
		});
	});

	describe('union', () => {
		it('should return the union of two arrays', () => {
			const a = [1, 2, 3];
			const b = [3, 4, 5];
			expect(helpers.union(a, b)).toEqual([1, 2, 3, 4, 5]);
		});
	});

	describe('intersection', () => {
		it('should return the intersection of two arrays', () => {
			const a = [1, 2, 3];
			const b = [2, 3, 4];
			expect(helpers.intersection(a, b)).toEqual([2, 3]);
		});
	});

	describe('difference', () => {
		it('should return the difference of two arrays', () => {
			const a = [1, 2, 3];
			const b = [2, 3, 4];
			expect(helpers.difference(a, b)).toEqual([1]);
		});
	});
});
