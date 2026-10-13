import * as helpers from '.';

function constant(value: number) {
	return function () {
		return value;
	};
}

const ALMOST_ONE = 1 - 2 ** -53;

describe('Math helpers', function () {
	describe('sum', function () {
		it('should calculate the sum of an array of numbers', function () {
			expect(helpers.sum([1, 2, 3, 4])).toBe(10);
			expect(helpers.sum([-1, -2, -3, -4])).toBe(-10);
			expect(helpers.sum([0, 0, 0, 0])).toBe(0);
		});

		it('should return 0 for an empty array', function () {
			expect(helpers.sum([])).toBe(0);
		});

		it('should compensate floating-point rounding errors', function () {
			expect(helpers.sum([0.1, 0.2, 0.3])).toBe(0.6);
			expect(helpers.sum([1e100, 1, -1e100])).toBe(1);
			expect(helpers.sum([1, 1e100, 1, -1e100])).toBe(2);
			expect(helpers.sum(new Array(10).fill(0.1))).toBe(1);
		});

		it('should be order-independent for typical inputs', function () {
			expect(helpers.sum([0.3, 0.2, 0.1])).toBe(helpers.sum([0.1, 0.2, 0.3]));
		});

		it('should propagate non-finite values', function () {
			expect(helpers.sum([1, Infinity])).toBe(Infinity);
			expect(helpers.sum([-Infinity, 1])).toBe(-Infinity);
			expect(helpers.sum([Infinity, -Infinity])).toBeNaN();
			expect(helpers.sum([1, NaN])).toBeNaN();
			expect(helpers.sum([Number.MAX_VALUE, Number.MAX_VALUE])).toBe(Infinity);
		});

		it('should accept readonly arrays and not mutate them', function () {
			const input: ReadonlyArray<number> = Object.freeze([1, 2, 3]);
			expect(helpers.sum(input)).toBe(6);
		});
	});

	describe('round', function () {
		it('should round a number to a specified number of decimal places', function () {
			expect(helpers.round(1.2345, 2)).toBe(1.23);
			expect(helpers.round(1.2355, 2)).toBe(1.24);
			expect(helpers.round(-1.2345, 2)).toBe(-1.23);
		});

		it('should default to 0 decimals', function () {
			expect(helpers.round(1.4)).toBe(1);
			expect(helpers.round(1.5)).toBe(2);
		});

		it('should round decimal representations correctly', function () {
			expect(helpers.round(1.005, 2)).toBe(1.01);
			expect(helpers.round(1.255, 2)).toBe(1.26);
			expect(helpers.round(8.345, 2)).toBe(8.35);
		});

		it('should round half away from zero (symmetric for negatives)', function () {
			expect(helpers.round(2.5)).toBe(3);
			expect(helpers.round(-2.5)).toBe(-3);
			expect(helpers.round(-0.5)).toBe(-1);
			expect(helpers.round(-1.235, 2)).toBe(-1.24);
			expect(helpers.round(1.235, 2)).toBe(1.24);
		});

		it('should handle numbers whose string form is exponential', function () {
			expect(helpers.round(1e-7, 2)).toBe(0);
			expect(helpers.round(1.5e-7, 7)).toBe(2e-7);
			expect(helpers.round(1e21, 2)).toBe(1e21);
			expect(helpers.round(1.23456e25, 2)).toBe(1.23456e25);
			expect(helpers.round(Number.MAX_VALUE, 2)).toBe(Number.MAX_VALUE);
			expect(helpers.round(Number.MIN_VALUE, 2)).toBe(0);
		});

		it('should be the identity when the number already has fewer decimals than requested', function () {
			expect(helpers.round(1.5, 400)).toBe(1.5);
			expect(helpers.round(-1.5, 400)).toBe(-1.5);
		});

		it('should support negative decimals', function () {
			expect(helpers.round(1234, -2)).toBe(1200);
			expect(helpers.round(1250, -2)).toBe(1300);
			expect(helpers.round(-1250, -2)).toBe(-1300);
			expect(helpers.round(5, -400)).toBe(0);
		});

		it('should preserve the sign of zero', function () {
			expect(helpers.round(0, 2)).toBe(0);
			expect(helpers.round(-0, 2)).toBe(-0);
			expect(helpers.round(-0.001, 2)).toBe(-0);
		});

		it('should return non-finite input as-is', function () {
			expect(helpers.round(NaN, 2)).toBeNaN();
			expect(helpers.round(Infinity, 2)).toBe(Infinity);
			expect(helpers.round(-Infinity)).toBe(-Infinity);
		});

		it('should throw a RangeError for non-integer decimals', function () {
			expect(function () {
				helpers.round(1, 1.5);
			}).toThrow(RangeError);
			expect(function () {
				helpers.round(1, NaN);
			}).toThrow(RangeError);
			expect(function () {
				helpers.round(1, Infinity);
			}).toThrow(RangeError);
		});
	});

	describe('average', function () {
		it('should calculate the average of an array of numbers', function () {
			expect(helpers.average([1, 2, 3, 4])).toBe(2.5);
			expect(helpers.average([-1, -2, -3, -4])).toBe(-2.5);
			expect(helpers.average([0, 0, 0, 0])).toBe(0);
		});

		it('should use compensated summation', function () {
			expect(helpers.average([1e100, 1, -1e100, 3])).toBe(1);
		});

		it('should return NaN for an empty array', function () {
			expect(helpers.average([])).toBeNaN();
		});
	});

	describe('factorial', function () {
		it('should calculate the factorial of a number', function () {
			expect(helpers.factorial(0)).toBe(1);
			expect(helpers.factorial(1)).toBe(1);
			expect(helpers.factorial(2)).toBe(2);
			expect(helpers.factorial(3)).toBe(6);
			expect(helpers.factorial(4)).toBe(24);
			expect(helpers.factorial(10)).toBe(3628800);
		});

		it('should return Infinity above 170', function () {
			expect(Number.isFinite(helpers.factorial(170))).toBe(true);
			expect(helpers.factorial(171)).toBe(Infinity);
			expect(helpers.factorial(1e9)).toBe(Infinity);
		});

		it('should throw a RangeError for negative or non-integer input instead of overflowing the stack', function () {
			for (const value of [-1, 1.5, NaN, Infinity, -Infinity]) {
				expect(function () {
					helpers.factorial(value);
				}).toThrow(RangeError);
			}
		});
	});

	describe('max', function () {
		it('should return the maximum value in an array of numbers', function () {
			expect(helpers.max([1, 2, 3, 4, 5])).toBe(5);
			expect(helpers.max([-3, -1, -2])).toBe(-1);
		});

		it('should follow Math.max semantics', function () {
			expect(helpers.max([])).toBe(-Infinity);
			expect(helpers.max([1, NaN, 3])).toBeNaN();
			expect(helpers.max([-0, 0])).toBe(0);
			expect(helpers.max([0, -0])).toBe(0);
			expect(helpers.max([-0])).toBe(-0);
			expect(helpers.max([-Infinity, Infinity])).toBe(Infinity);
		});

		it('should work on very large arrays', function () {
			const numbers = Array.from({ length: 200_000 }, function (_, i) {
				return i;
			});
			expect(helpers.max(numbers)).toBe(199_999);
		});
	});

	describe('min', function () {
		it('should return the minimum value in an array of numbers', function () {
			expect(helpers.min([1, 2, 3, 4, 5])).toBe(1);
			expect(helpers.min([-3, -1, -2])).toBe(-3);
		});

		it('should follow Math.min semantics', function () {
			expect(helpers.min([])).toBe(Infinity);
			expect(helpers.min([1, NaN, 3])).toBeNaN();
			expect(helpers.min([0, -0])).toBe(-0);
			expect(helpers.min([-0, 0])).toBe(-0);
			expect(helpers.min([0])).toBe(0);
		});

		it('should work on very large arrays', function () {
			const numbers = Array.from({ length: 200_000 }, function (_, i) {
				return 200_000 - i;
			});
			expect(helpers.min(numbers)).toBe(1);
		});
	});

	describe('abs', function () {
		it('should return the absolute value of a number', function () {
			expect(helpers.abs(-10)).toBe(10);
			expect(helpers.abs(10)).toBe(10);
			expect(helpers.abs(NaN)).toBeNaN();
		});
	});

	describe('sqrt', function () {
		it('should return the square root of a number', function () {
			expect(helpers.sqrt(9)).toBe(3);
			expect(helpers.sqrt(-1)).toBeNaN();
		});
	});

	describe('pow', function () {
		it('should return the value of a number raised to an exponent', function () {
			expect(helpers.pow(2, 3)).toBe(8);
			expect(helpers.pow(2, -1)).toBe(0.5);
		});
	});

	describe('log', function () {
		it('should return the logarithm of a number with the specified base', function () {
			expect(helpers.log(16, 2)).toBe(4);
			expect(helpers.log(100, 10)).toBe(2);
			expect(helpers.log(81, 3)).toBeCloseTo(4, 12);
		});

		it('should be exact for powers of 10, 2 and e', function () {
			expect(helpers.log(1000, 10)).toBe(3);
			expect(helpers.log(1e-3, 10)).toBe(-3);
			expect(helpers.log(2 ** 50, 2)).toBe(50);
			expect(helpers.log(Math.E, Math.E)).toBe(1);
		});

		it('should handle edge values', function () {
			expect(helpers.log(0, 10)).toBe(-Infinity);
			expect(helpers.log(-1, 10)).toBeNaN();
		});
	});

	describe('ceil', function () {
		it('should return the smallest integer greater than or equal to a number', function () {
			expect(helpers.ceil(3.14)).toBe(4);
			expect(helpers.ceil(-2.9)).toBe(-2);
		});
	});

	describe('floor', function () {
		it('should return the largest integer less than or equal to a number', function () {
			expect(helpers.floor(3.14)).toBe(3);
			expect(helpers.floor(-2.9)).toBe(-3);
		});
	});

	describe('modulo', function () {
		it('should return the modulo for positive operands', function () {
			expect(helpers.modulo(7, 3)).toBe(1);
			expect(helpers.modulo(10, 4)).toBe(2);
			expect(helpers.modulo(5.5, 2)).toBe(1.5);
		});

		it('should return a result with the sign of the divisor', function () {
			expect(helpers.modulo(-1, 3)).toBe(2);
			expect(helpers.modulo(-7, 3)).toBe(2);
			expect(helpers.modulo(1, -3)).toBe(-2);
			expect(helpers.modulo(-1, -3)).toBe(-1);
			expect(helpers.modulo(-5.5, 2)).toBe(0.5);
		});

		it('should return +0 for exact multiples', function () {
			expect(helpers.modulo(-3, 3)).toBe(0);
			expect(helpers.modulo(6, -3)).toBe(0);
		});

		it('should return NaN for a zero divisor or NaN operands', function () {
			expect(helpers.modulo(5, 0)).toBeNaN();
			expect(helpers.modulo(NaN, 3)).toBeNaN();
			expect(helpers.modulo(3, NaN)).toBeNaN();
			expect(helpers.modulo(Infinity, 3)).toBeNaN();
		});
	});

	describe('remainder', function () {
		it('should behave like the % operator', function () {
			expect(helpers.remainder(7, 3)).toBe(1);
			expect(helpers.remainder(-1, 3)).toBe(-1);
			expect(helpers.remainder(1, -3)).toBe(1);
			expect(helpers.remainder(5, 0)).toBeNaN();
		});
	});

	describe('randomBetween', function () {
		it('should generate a random number between two specified numbers', function () {
			for (let i = 0; i < 100; i++) {
				const value = helpers.randomBetween(1, 10);
				expect(value).toBeGreaterThanOrEqual(1);
				expect(value).toBeLessThan(10);
			}
		});

		it('should use the provided generator', function () {
			expect(helpers.randomBetween(0, 10, constant(0))).toBe(0);
			expect(helpers.randomBetween(0, 10, constant(0.5))).toBe(5);
			expect(helpers.randomBetween(-10, 10, constant(0.25))).toBe(-5);
		});

		it('should never return max, even when rounding would', function () {
			expect(helpers.randomBetween(1, 2, constant(ALMOST_ONE))).toBeLessThan(2);
			expect(helpers.randomBetween(-2, -1, constant(ALMOST_ONE))).toBeLessThan(-1);
			expect(helpers.randomBetween(-1, 0, constant(1))).toBeLessThan(0);
		});

		it('should return min when min === max', function () {
			expect(helpers.randomBetween(3, 3)).toBe(3);
		});

		it('should handle spans that overflow', function () {
			const value = helpers.randomBetween(-Number.MAX_VALUE, Number.MAX_VALUE, constant(0.5));
			expect(Number.isFinite(value)).toBe(true);
			expect(value).toBe(0);
		});

		it('should throw a RangeError for invalid bounds', function () {
			expect(function () {
				helpers.randomBetween(10, 1);
			}).toThrow(RangeError);
			expect(function () {
				helpers.randomBetween(0, Infinity);
			}).toThrow(RangeError);
			expect(function () {
				helpers.randomBetween(NaN, 1);
			}).toThrow(RangeError);
		});
	});

	describe('randomIntBetween', function () {
		it('should return a random integer between `min` and `max`, inclusive', function () {
			for (let i = 0; i < 100; i++) {
				const value = helpers.randomIntBetween(1, 10);
				expect(Number.isInteger(value)).toBe(true);
				expect(value).toBeGreaterThanOrEqual(1);
				expect(value).toBeLessThanOrEqual(10);
			}
		});

		it('should include both bounds', function () {
			expect(helpers.randomIntBetween(1, 6, constant(0))).toBe(1);
			expect(helpers.randomIntBetween(1, 6, constant(ALMOST_ONE))).toBe(6);
			expect(helpers.randomIntBetween(1, 6, constant(1))).toBe(6);
		});

		it('should narrow non-integer bounds to the integers inside them', function () {
			expect(helpers.randomIntBetween(1.2, 3.8, constant(0))).toBe(2);
			expect(helpers.randomIntBetween(1.2, 3.8, constant(ALMOST_ONE))).toBe(3);
			expect(helpers.randomIntBetween(-0.5, 0.5, constant(0))).toBe(0);
			expect(Object.is(helpers.randomIntBetween(-0.5, 0.5, constant(0)), 0)).toBe(true);
		});

		it('should return the single integer when min === max', function () {
			expect(helpers.randomIntBetween(4, 4)).toBe(4);
		});

		it('should throw a RangeError when no integer exists in range', function () {
			expect(function () {
				helpers.randomIntBetween(1.2, 1.8);
			}).toThrow(RangeError);
			expect(function () {
				helpers.randomIntBetween(5, 1);
			}).toThrow(RangeError);
			expect(function () {
				helpers.randomIntBetween(0, Infinity);
			}).toThrow(RangeError);
		});
	});

	describe('toRadians', function () {
		it('should convert degrees to radians', function () {
			expect(helpers.toRadians(90)).toBeCloseTo(Math.PI / 2, 12);
			expect(helpers.toRadians(180)).toBe(Math.PI);
		});
	});

	describe('toDegrees', function () {
		it('should convert radians to degrees', function () {
			expect(helpers.toDegrees(Math.PI / 2)).toBeCloseTo(90, 12);
			expect(helpers.toDegrees(Math.PI)).toBe(180);
		});
	});

	describe('clamp', function () {
		it('should clamp values into the range', function () {
			expect(helpers.clamp(15, 0, 10)).toBe(10);
			expect(helpers.clamp(-5, 0, 10)).toBe(0);
			expect(helpers.clamp(5, 0, 10)).toBe(5);
			expect(helpers.clamp(5, 5, 5)).toBe(5);
			expect(helpers.clamp(Infinity, 0, 10)).toBe(10);
		});

		it('should keep NaN values', function () {
			expect(helpers.clamp(NaN, 0, 10)).toBeNaN();
		});

		it('should throw a RangeError when min > max or a bound is NaN', function () {
			expect(function () {
				helpers.clamp(1, 10, 0);
			}).toThrow(RangeError);
			expect(function () {
				helpers.clamp(1, NaN, 0);
			}).toThrow(RangeError);
		});
	});

	describe('lerp', function () {
		it('should interpolate linearly', function () {
			expect(helpers.lerp(0, 10, 0.5)).toBe(5);
			expect(helpers.lerp(10, 20, 0.25)).toBe(12.5);
			expect(helpers.lerp(10, 20, 0)).toBe(10);
			expect(helpers.lerp(10, 20, 1)).toBe(20);
		});

		it('should extrapolate outside [0, 1]', function () {
			expect(helpers.lerp(0, 10, 2)).toBe(20);
			expect(helpers.lerp(0, 10, -1)).toBe(-10);
		});
	});

	describe('inverseLerp', function () {
		it('should return the interpolation factor', function () {
			expect(helpers.inverseLerp(0, 10, 5)).toBe(0.5);
			expect(helpers.inverseLerp(10, 20, 12.5)).toBe(0.25);
			expect(helpers.inverseLerp(10, 20, 30)).toBe(2);
		});

		it('should return 0 for a degenerate range', function () {
			expect(helpers.inverseLerp(5, 5, 7)).toBe(0);
		});
	});

	describe('mapRange', function () {
		it('should map values between ranges', function () {
			expect(helpers.mapRange(5, 0, 10, 0, 100)).toBe(50);
			expect(helpers.mapRange(0.5, 0, 1, 10, 20)).toBe(15);
			expect(helpers.mapRange(0, 0, 10, 100, 0)).toBe(100);
			expect(helpers.mapRange(20, 0, 10, 0, 1)).toBe(2);
		});

		it('should return outMin for a degenerate input range', function () {
			expect(helpers.mapRange(3, 1, 1, 10, 20)).toBe(10);
		});
	});

	describe('inRange', function () {
		it('should check the half-open range [start, end)', function () {
			expect(helpers.inRange(3, 2, 4)).toBe(true);
			expect(helpers.inRange(2, 2, 4)).toBe(true);
			expect(helpers.inRange(4, 2, 4)).toBe(false);
			expect(helpers.inRange(1, 2, 4)).toBe(false);
			expect(helpers.inRange(2, 2, 2)).toBe(false);
			expect(helpers.inRange(NaN, 0, 4)).toBe(false);
		});

		it('should swap the bounds when start > end', function () {
			expect(helpers.inRange(-3, -2, -6)).toBe(true);
			expect(helpers.inRange(3, 4, 2)).toBe(true);
			expect(helpers.inRange(4, 4, 2)).toBe(false);
			expect(helpers.inRange(2, 4, 2)).toBe(true);
		});
	});

	describe('product', function () {
		it('should multiply all numbers', function () {
			expect(helpers.product([2, 3, 4])).toBe(24);
			expect(helpers.product([-2, 3])).toBe(-6);
			expect(helpers.product([5, 0])).toBe(0);
		});

		it('should return 1 for an empty array', function () {
			expect(helpers.product([])).toBe(1);
		});
	});

	describe('median', function () {
		it('should return the middle value for odd lengths', function () {
			expect(helpers.median([3, 1, 2])).toBe(2);
			expect(helpers.median([7])).toBe(7);
		});

		it('should return the mean of the middle values for even lengths', function () {
			expect(helpers.median([4, 1, 3, 2])).toBe(2.5);
			expect(helpers.median([Number.MAX_VALUE, Number.MAX_VALUE])).toBe(Number.MAX_VALUE);
		});

		it('should sort numerically, not lexicographically', function () {
			expect(helpers.median([10, 9, 100])).toBe(10);
		});

		it('should return NaN for empty input or input containing NaN', function () {
			expect(helpers.median([])).toBeNaN();
			expect(helpers.median([1, NaN, 2])).toBeNaN();
			expect(helpers.median([NaN, NaN, 1])).toBeNaN();
		});

		it('should not mutate the input', function () {
			const input = [3, 1, 2];
			helpers.median(input);
			expect(input).toEqual([3, 1, 2]);
		});
	});

	describe('mode', function () {
		it('should return the most frequent value', function () {
			expect(helpers.mode([1, 2, 2, 3])).toEqual([2]);
		});

		it('should return all most frequent values in ascending order', function () {
			expect(helpers.mode([3, 1, 3, 1, 2])).toEqual([1, 3]);
			expect(helpers.mode([10, 9, 100])).toEqual([9, 10, 100]);
		});

		it('should treat NaN as a value and sort it last', function () {
			expect(helpers.mode([NaN, 1, NaN, 1])).toEqual([1, NaN]);
			expect(helpers.mode([NaN, NaN, 1])).toEqual([NaN]);
			expect(helpers.mode([NaN, 2, NaN, 2, NaN, 2])).toEqual([2, NaN]);
		});

		it('should return an empty array for empty input', function () {
			expect(helpers.mode([])).toEqual([]);
		});
	});

	describe('variance', function () {
		it('should compute the population variance by default', function () {
			expect(helpers.variance([2, 4, 4, 4, 5, 5, 7, 9])).toBe(4);
			expect(helpers.variance([5])).toBe(0);
		});

		it('should compute the sample variance', function () {
			expect(helpers.variance([1, 2, 3, 4], { sample: true })).toBeCloseTo(5 / 3, 12);
			expect(helpers.variance([1, 2, 3, 4], { sample: false })).toBe(1.25);
		});

		it('should be numerically stable for large offsets', function () {
			expect(helpers.variance([1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16])).toBe(22.5);
		});

		it('should return NaN when undefined', function () {
			expect(helpers.variance([])).toBeNaN();
			expect(helpers.variance([1], { sample: true })).toBeNaN();
			expect(helpers.variance([1, Infinity])).toBeNaN();
			expect(helpers.variance([1, NaN])).toBeNaN();
		});
	});

	describe('standardDeviation', function () {
		it('should compute the population standard deviation by default', function () {
			expect(helpers.standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
			expect(helpers.standardDeviation([1])).toBe(0);
		});

		it('should compute the sample standard deviation', function () {
			expect(helpers.standardDeviation([1, 2, 3, 4], { sample: true })).toBeCloseTo(Math.sqrt(5 / 3), 12);
		});

		it('should return NaN when undefined', function () {
			expect(helpers.standardDeviation([])).toBeNaN();
			expect(helpers.standardDeviation([1], { sample: true })).toBeNaN();
		});
	});

	describe('gcd', function () {
		it('should compute the greatest common divisor', function () {
			expect(helpers.gcd(12, 18)).toBe(6);
			expect(helpers.gcd(17, 5)).toBe(1);
			expect(helpers.gcd(0, 5)).toBe(5);
			expect(helpers.gcd(5, 0)).toBe(5);
			expect(helpers.gcd(0, 0)).toBe(0);
		});

		it('should always return a non-negative result', function () {
			expect(helpers.gcd(-4, 6)).toBe(2);
			expect(helpers.gcd(-4, -6)).toBe(2);
			expect(Object.is(helpers.gcd(-0, 0), 0)).toBe(true);
		});

		it('should throw a RangeError for non-integers', function () {
			for (const [a, b] of [
				[1.5, 2],
				[2, NaN],
				[Infinity, 2]
			]) {
				expect(function () {
					helpers.gcd(a, b);
				}).toThrow(RangeError);
			}
		});
	});

	describe('lcm', function () {
		it('should compute the least common multiple', function () {
			expect(helpers.lcm(4, 6)).toBe(12);
			expect(helpers.lcm(-3, 5)).toBe(15);
			expect(helpers.lcm(-3, -5)).toBe(15);
			expect(helpers.lcm(7, 7)).toBe(7);
		});

		it('should return 0 when an argument is 0', function () {
			expect(helpers.lcm(0, 5)).toBe(0);
			expect(helpers.lcm(5, 0)).toBe(0);
			expect(helpers.lcm(0, 0)).toBe(0);
		});

		it('should throw a RangeError for non-integers', function () {
			expect(function () {
				helpers.lcm(1.5, 2);
			}).toThrow(RangeError);
		});
	});

	describe('isPrime', function () {
		it('should detect primes', function () {
			expect([2, 3, 5, 7, 11, 13, 25, 29, 49, 97, 7919].map(helpers.isPrime)).toEqual([true, true, true, true, true, true, false, true, false, true, true]);
			expect(helpers.isPrime(2_147_483_647)).toBe(true);
			expect(helpers.isPrime(1_000_000_007 * 3)).toBe(false);
		});

		it('should return false for non-primes, non-integers, negatives, 0 and 1', function () {
			for (const value of [0, 1, -7, 4, 9, 2.5, NaN, Infinity, 2 ** 53 + 2]) {
				expect(helpers.isPrime(value)).toBe(false);
			}
		});
	});

	describe('isEven / isOdd', function () {
		it('should classify integers', function () {
			expect(helpers.isEven(4)).toBe(true);
			expect(helpers.isEven(0)).toBe(true);
			expect(helpers.isEven(-2)).toBe(true);
			expect(helpers.isEven(3)).toBe(false);
			expect(helpers.isOdd(3)).toBe(true);
			expect(helpers.isOdd(-3)).toBe(true);
			expect(helpers.isOdd(4)).toBe(false);
			expect(helpers.isOdd(0)).toBe(false);
		});

		it('should return false for non-integers', function () {
			for (const value of [2.5, NaN, Infinity, -Infinity]) {
				expect(helpers.isEven(value)).toBe(false);
				expect(helpers.isOdd(value)).toBe(false);
			}
		});
	});

	describe('percentage', function () {
		it('should compute the percentage of a total', function () {
			expect(helpers.percentage(25, 200)).toBe(12.5);
			expect(helpers.percentage(50, 50)).toBe(100);
			expect(helpers.percentage(-1, 4)).toBe(-25);
			expect(helpers.percentage(0, 4)).toBe(0);
		});

		it('should return NaN when the total is 0', function () {
			expect(helpers.percentage(3, 0)).toBeNaN();
			expect(helpers.percentage(0, 0)).toBeNaN();
		});
	});
});
