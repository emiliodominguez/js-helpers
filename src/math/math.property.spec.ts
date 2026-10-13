import fc from 'fast-check';
import * as helpers from '.';

const smallInt = fc.integer({ min: -1_000_000, max: 1_000_000 });
const intArray = fc.array(smallInt, { maxLength: 100 });
const finiteDouble = fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true });
const finiteArray = fc.array(finiteDouble, { minLength: 1, maxLength: 50 });
const unit = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true });

function naiveIsPrime(n: number): boolean {
	if (n < 2) return false;
	for (let i = 2; i < n; i++) {
		if (n % i === 0) return false;
	}
	return true;
}

describe('Math helpers (property-based)', function () {
	describe('sum', function () {
		it('should equal the naive reduce on integer arrays', function () {
			fc.assert(
				fc.property(intArray, function (numbers) {
					const reference = numbers.reduce(function (a, b) {
						return a + b;
					}, 0);
					expect(helpers.sum(numbers)).toBe(reference);
				})
			);
		});

		it('should be invariant under permutation of integer arrays', function () {
			fc.assert(
				fc.property(
					intArray.chain(function (numbers) {
						return fc.tuple(fc.constant(numbers), fc.shuffledSubarray(numbers, { minLength: numbers.length, maxLength: numbers.length }));
					}),
					function ([numbers, shuffled]) {
						expect(helpers.sum(shuffled)).toBe(helpers.sum(numbers));
					}
				)
			);
		});
	});

	describe('round', function () {
		const decimals = fc.integer({ min: 0, max: 6 });

		it('should be idempotent (result has at most `decimals` fractional digits)', function () {
			fc.assert(
				fc.property(finiteDouble, decimals, function (x, d) {
					const once = helpers.round(x, d);
					expect(helpers.round(once, d)).toBe(once);
				})
			);
		});

		it('should stay within half a unit of the last kept decimal', function () {
			fc.assert(
				fc.property(finiteDouble, decimals, function (x, d) {
					const tolerance = 0.5 * 10 ** -d + 4 * Number.EPSILON * Math.max(1, Math.abs(x));
					expect(Math.abs(helpers.round(x, d) - x)).toBeLessThanOrEqual(tolerance);
				})
			);
		});

		it('should be symmetric: round(-x, d) === -round(x, d)', function () {
			fc.assert(
				fc.property(finiteDouble, fc.integer({ min: -3, max: 6 }), function (x, d) {
					expect(helpers.round(-x, d)).toBe(-helpers.round(x, d));
				})
			);
		});
	});

	describe('max / min', function () {
		it('should be bounds of the input and contained in it', function () {
			fc.assert(
				fc.property(finiteArray, function (numbers) {
					const largest = helpers.max(numbers);
					const smallest = helpers.min(numbers);
					for (const value of numbers) {
						expect(largest).toBeGreaterThanOrEqual(value);
						expect(smallest).toBeLessThanOrEqual(value);
					}
					expect(numbers).toContain(largest);
					expect(numbers).toContain(smallest);
				})
			);
		});

		it('should agree with Math.max / Math.min', function () {
			fc.assert(
				fc.property(fc.array(fc.double()), function (numbers) {
					expect(helpers.max(numbers)).toBe(Math.max(...numbers));
					expect(helpers.min(numbers)).toBe(Math.min(...numbers));
				})
			);
		});
	});

	describe('factorial', function () {
		it('should satisfy (n + 1)! === (n + 1) * n!', function () {
			fc.assert(
				fc.property(fc.integer({ min: 0, max: 20 }), function (n) {
					expect(helpers.factorial(n + 1)).toBe((n + 1) * helpers.factorial(n));
				})
			);
		});
	});

	describe('modulo', function () {
		const positiveDivisor = fc.integer({ min: 1, max: 1000 });
		const nonZeroDivisor = fc.integer({ min: -1000, max: 1000 }).filter(function (d) {
			return d !== 0;
		});

		it('should return a result in [0, d) for a positive divisor', function () {
			fc.assert(
				fc.property(smallInt, positiveDivisor, function (a, d) {
					const result = helpers.modulo(a, d);
					expect(result).toBeGreaterThanOrEqual(0);
					expect(result).toBeLessThan(d);
				})
			);
		});

		it('should be congruent to the dividend and carry the sign of the divisor', function () {
			fc.assert(
				fc.property(smallInt, nonZeroDivisor, function (a, d) {
					const result = helpers.modulo(a, d);
					expect((a - result) % d === 0).toBe(true);
					expect(Math.abs(result)).toBeLessThan(Math.abs(d));
					expect(result === 0 || Math.sign(result) === Math.sign(d)).toBe(true);
				})
			);
		});
	});

	describe('randomBetween / randomIntBetween', function () {
		it('randomIntBetween should return an integer in [ceil(min), floor(max)]', function () {
			fc.assert(
				fc.property(finiteDouble, fc.double({ min: 0, max: 1000, noNaN: true }), unit, function (start, width, r) {
					const end = start + width;
					fc.pre(Math.ceil(start) <= Math.floor(end));
					const value = helpers.randomIntBetween(start, end, function () {
						return r;
					});
					expect(Number.isInteger(value)).toBe(true);
					expect(value).toBeGreaterThanOrEqual(Math.ceil(start));
					expect(value).toBeLessThanOrEqual(Math.floor(end));
				})
			);
		});

		it('randomBetween should return a number in [min, max)', function () {
			fc.assert(
				fc.property(finiteDouble, finiteDouble, unit, function (a, b, r) {
					fc.pre(a !== b);
					const low = Math.min(a, b);
					const high = Math.max(a, b);
					const value = helpers.randomBetween(low, high, function () {
						return r;
					});
					expect(value).toBeGreaterThanOrEqual(low);
					expect(value).toBeLessThan(high);
				})
			);
		});
	});

	describe('clamp', function () {
		it('should be within bounds and idempotent', function () {
			fc.assert(
				fc.property(finiteDouble, finiteDouble, finiteDouble, function (value, a, b) {
					const low = Math.min(a, b);
					const high = Math.max(a, b);
					const once = helpers.clamp(value, low, high);
					expect(once).toBeGreaterThanOrEqual(low);
					expect(once).toBeLessThanOrEqual(high);
					expect(helpers.clamp(once, low, high)).toBe(once);
					if (value >= low && value <= high) expect(once).toBe(value);
				})
			);
		});
	});

	describe('lerp / inverseLerp', function () {
		it('should hit the endpoints exactly for integers', function () {
			fc.assert(
				fc.property(smallInt, smallInt, function (a, b) {
					expect(helpers.lerp(a, b, 0)).toBe(a);
					expect(helpers.lerp(a, b, 1)).toBe(b);
				})
			);
		});

		it('inverseLerp should invert lerp', function () {
			fc.assert(
				fc.property(smallInt, smallInt, fc.double({ min: 0, max: 1, noNaN: true }), function (a, b, t) {
					fc.pre(a !== b);
					expect(Math.abs(helpers.inverseLerp(a, b, helpers.lerp(a, b, t)) - t)).toBeLessThan(1e-6);
				})
			);
		});
	});

	describe('gcd / lcm', function () {
		const mediumInt = fc.integer({ min: -100_000, max: 100_000 });

		it('gcd should divide both arguments and be commutative', function () {
			fc.assert(
				fc.property(mediumInt, mediumInt, function (a, b) {
					const divisor = helpers.gcd(a, b);
					expect(divisor).toBeGreaterThanOrEqual(0);
					expect(helpers.gcd(b, a)).toBe(divisor);
					if (divisor !== 0) {
						expect(Math.abs(a % divisor)).toBe(0);
						expect(Math.abs(b % divisor)).toBe(0);
					} else {
						expect(a).toBe(0);
						expect(b).toBe(0);
					}
				})
			);
		});

		it('gcd(a, b) * lcm(a, b) should equal |a * b|', function () {
			const tinyInt = fc.integer({ min: -10_000, max: 10_000 });
			fc.assert(
				fc.property(tinyInt, tinyInt, function (a, b) {
					expect(helpers.gcd(a, b) * helpers.lcm(a, b)).toBe(Math.abs(a * b));
				})
			);
		});
	});

	describe('median', function () {
		it('should lie between min and max and not mutate the input', function () {
			fc.assert(
				fc.property(finiteArray, function (numbers) {
					const copy = numbers.slice();
					const middle = helpers.median(numbers);
					expect(middle).toBeGreaterThanOrEqual(helpers.min(numbers));
					expect(middle).toBeLessThanOrEqual(helpers.max(numbers));
					expect(numbers).toEqual(copy);
				})
			);
		});
	});

	describe('mode', function () {
		it('should return sorted values that all occur with the highest frequency', function () {
			fc.assert(
				fc.property(fc.array(fc.integer({ min: -5, max: 5 }), { maxLength: 40 }), function (numbers) {
					const result = helpers.mode(numbers);
					function count(value: number) {
						return numbers.filter(function (n) {
							return n === value;
						}).length;
					}
					const highest = Math.max(0, ...numbers.map(count));
					const expected = Array.from(new Set(numbers))
						.filter(function (value) {
							return count(value) === highest;
						})
						.sort(function (a, b) {
							return a - b;
						});
					expect(result).toEqual(expected);
				})
			);
		});
	});

	describe('variance', function () {
		it('should be non-negative', function () {
			fc.assert(
				fc.property(finiteArray, fc.boolean(), function (numbers, sample) {
					fc.pre(!sample || numbers.length > 1);
					expect(helpers.variance(numbers, { sample })).toBeGreaterThanOrEqual(0);
				})
			);
		});

		it('should be 0 for a constant array', function () {
			fc.assert(
				fc.property(finiteDouble, fc.integer({ min: 1, max: 50 }), function (value, length) {
					expect(helpers.variance(new Array(length).fill(value))).toBe(0);
					expect(helpers.standardDeviation(new Array(length).fill(value))).toBe(0);
				})
			);
		});
	});

	describe('isPrime', function () {
		it('should agree with a naive reference below 10 000', function () {
			fc.assert(
				fc.property(fc.integer({ min: -10, max: 9_999 }), function (n) {
					expect(helpers.isPrime(n)).toBe(naiveIsPrime(n));
				})
			);
		});

		it('should agree with a naive reference on every n < 2000', function () {
			for (let n = 0; n < 2000; n++) {
				expect(helpers.isPrime(n)).toBe(naiveIsPrime(n));
			}
		});
	});

	describe('isEven / isOdd', function () {
		it('should be exclusive for integers', function () {
			fc.assert(
				fc.property(fc.integer(), function (n) {
					expect(helpers.isEven(n) !== helpers.isOdd(n)).toBe(true);
				})
			);
		});

		it('should both be false for non-integers', function () {
			fc.assert(
				fc.property(
					fc.double().filter(function (x) {
						return !Number.isInteger(x);
					}),
					function (x) {
						expect(helpers.isEven(x) || helpers.isOdd(x)).toBe(false);
					}
				)
			);
		});
	});
});
