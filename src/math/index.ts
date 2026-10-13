import type { RandomGenerator } from '../utils/index.js';

/**
 * Options accepted by {@link variance} and {@link standardDeviation}.
 */
export interface VarianceOptions {
	/**
	 * When `true`, computes the sample (Bessel-corrected, divides by `n - 1`) statistic instead of the population one (divides by `n`).
	 * @default false
	 */
	sample?: boolean;
}

/**
 * Multiplies a number by `10 ** exponent` without going through floating-point multiplication,
 * by editing the exponent of its decimal string representation. Works for numbers whose `String()` is already exponential.
 * @param {number} value - The number to shift
 * @param {number} exponent - The power of ten to shift by (may be negative)
 * @returns {number} `value * 10 ** exponent`, computed on the decimal representation
 * @example
 * shiftDecimal(1.005, 2); // 100.5 (whereas 1.005 * 100 === 100.49999999999999)
 */
function shiftDecimal(value: number, exponent: number): number {
	const [mantissa, currentExponent = '0'] = String(value).split('e');
	return Number(`${mantissa}e${Number(currentExponent) + exponent}`);
}

/**
 * Returns the largest double strictly smaller than `value` (for finite `value`).
 * @param {number} value - A finite number
 * @returns {number} The previous representable double
 * @example
 * nextDown(1); // 0.9999999999999999
 */
function nextDown(value: number): number {
	if (value === 0) return -Number.MIN_VALUE;
	const view = new DataView(new ArrayBuffer(8));
	view.setFloat64(0, value);
	const bits = view.getBigUint64(0);
	view.setBigUint64(0, value > 0 ? bits - BigInt(1) : bits + BigInt(1));
	return view.getFloat64(0);
}

/**
 * Comparator sorting numbers in ascending order, with `NaN` placed last.
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} A negative number if `a` sorts first, positive if `b` sorts first, `0` otherwise
 * @example
 * [3, NaN, 1].sort(compareAscending); // [1, 3, NaN]
 */
function compareAscending(a: number, b: number): number {
	if (Number.isNaN(a)) return Number.isNaN(b) ? 0 : 1;
	if (Number.isNaN(b)) return -1;
	return a - b;
}

/**
 * Throws a `RangeError` unless every given value is an integer.
 * @param {string} name - Name of the calling function, used in the error message
 * @param {number} a - First value to check
 * @param {number} b - Second value to check
 * @returns {void}
 * @throws {RangeError} when `a` or `b` is not an integer
 * @example
 * assertIntegers('gcd', 4, 6); // ok
 * assertIntegers('gcd', 4, 1.5); // throws RangeError
 */
function assertIntegers(name: string, a: number, b: number): void {
	if (!Number.isInteger(a) || !Number.isInteger(b)) {
		throw new RangeError(`${name}: arguments must be integers, received ${a} and ${b}`);
	}
}

/**
 * Calculates the sum of an array of numbers using Neumaier (improved Kahan–Babuška) compensated summation,
 * which keeps the rounding error independent of the number of elements and makes the result
 * (practically) independent of their order.
 *
 * If any intermediate sum is non-finite (an `Infinity` or `NaN` element, or overflow), the plain
 * floating-point result (`Infinity`, `-Infinity` or `NaN`) is returned.
 * @param {ReadonlyArray<number>} numbers - The numbers to add up
 * @returns {number} The sum (`0` for an empty array)
 * @example
 * sum([1, 2, 3, 4]); // 10
 * sum([0.1, 0.2, 0.3]); // 0.6 (naive reduce gives 0.6000000000000001)
 * sum([1e100, 1, -1e100]); // 1 (naive reduce gives 0)
 */
export function sum(numbers: ReadonlyArray<number>): number {
	let total = 0;
	let compensation = 0;
	for (const value of numbers) {
		const next = total + value;
		if (Math.abs(total) >= Math.abs(value)) {
			compensation += total - next + value;
		} else {
			compensation += value - next + total;
		}
		total = next;
	}
	if (!Number.isFinite(total)) return total;
	return total + compensation;
}

/**
 * Rounds a number to a given number of decimal places, using its decimal representation so that
 * values like `1.005` round as written (`round(1.005, 2) === 1.01`).
 *
 * Ties are rounded half **away from zero** (symmetrically): `round(2.5) === 3`, `round(-2.5) === -3`,
 * `round(-1.235, 2) === -1.24`. Note that this differs from `Math.round`, which rounds negative halves towards `+Infinity`.
 *
 * Negative `decimals` round to tens, hundreds, etc. Non-finite input (`NaN`, `±Infinity`) is returned as-is.
 * @param {number} number - The number to round
 * @param {number} [decimals=0] - The number of decimal places to keep (integer, may be negative)
 * @returns {number} The rounded number
 * @throws {RangeError} when `decimals` is not an integer
 * @example
 * round(1.2345, 2); // 1.23
 * round(1.005, 2); // 1.01
 * round(-2.5); // -3
 * round(1234, -2); // 1200
 * round(1e-7, 2); // 0
 */
export function round(number: number, decimals = 0): number {
	if (!Number.isInteger(decimals)) {
		throw new RangeError(`round: decimals must be an integer, received ${decimals}`);
	}
	if (!Number.isFinite(number)) return number;

	const negative = number < 0 || Object.is(number, -0);
	const magnitude = Math.abs(number);
	const shifted = shiftDecimal(magnitude, decimals);
	// The number already has fewer fractional digits than requested: rounding is the identity.
	if (!Number.isFinite(shifted)) return number;

	const rounded = shiftDecimal(Math.round(shifted), -decimals);
	return negative ? -rounded : rounded;
}

/**
 * Calculates the arithmetic mean of an array of numbers (using the compensated {@link sum}).
 * @param {ReadonlyArray<number>} numbers - The numbers to average
 * @returns {number} The mean, or `NaN` for an empty array
 * @example
 * average([1, 2, 3, 4]); // 2.5
 * average([]); // NaN
 */
export function average(numbers: ReadonlyArray<number>): number {
	return sum(numbers) / numbers.length;
}

/**
 * Calculates the factorial of a non-negative integer, iteratively.
 * Results above `170!` exceed `Number.MAX_VALUE`, so `Infinity` is returned for `number > 170`.
 * @param {number} number - A non-negative integer
 * @returns {number} `number!` (`Infinity` when `number > 170`)
 * @throws {RangeError} when `number` is negative or not an integer
 * @example
 * factorial(0); // 1
 * factorial(5); // 120
 * factorial(171); // Infinity
 */
export function factorial(number: number): number {
	if (!Number.isInteger(number) || number < 0) {
		throw new RangeError(`factorial: argument must be a non-negative integer, received ${number}`);
	}
	if (number > 170) return Infinity;
	let result = 1;
	for (let i = 2; i <= number; i++) result *= i;
	return result;
}

/**
 * Finds the maximum value in an array of numbers, with the same semantics as `Math.max`
 * (`-Infinity` for an empty array, `NaN` if any element is `NaN`, `0` preferred over `-0`),
 * but without spreading the array, so it works on arrays of any length.
 * @param {ReadonlyArray<number>} numbers - The numbers to search
 * @returns {number} The largest value
 * @example
 * max([1, 5, 3]); // 5
 * max([]); // -Infinity
 */
export function max(numbers: ReadonlyArray<number>): number {
	let result = -Infinity;
	for (const value of numbers) {
		if (Number.isNaN(value)) return NaN;
		if (value > result || (value === 0 && result === 0 && Object.is(result, -0))) result = value;
	}
	return result;
}

/**
 * Finds the minimum value in an array of numbers, with the same semantics as `Math.min`
 * (`Infinity` for an empty array, `NaN` if any element is `NaN`, `-0` preferred over `0`),
 * but without spreading the array, so it works on arrays of any length.
 * @param {ReadonlyArray<number>} numbers - The numbers to search
 * @returns {number} The smallest value
 * @example
 * min([4, 1, 3]); // 1
 * min([]); // Infinity
 */
export function min(numbers: ReadonlyArray<number>): number {
	let result = Infinity;
	for (const value of numbers) {
		if (Number.isNaN(value)) return NaN;
		if (value < result || (value === 0 && result === 0 && Object.is(value, -0))) result = value;
	}
	return result;
}

/**
 * Finds the absolute value of a number.
 * @param {number} number - The number whose absolute value is to be found
 * @returns {number} The absolute value of the given number
 * @example
 * abs(-10); // 10
 */
export function abs(number: number): number {
	return Math.abs(number);
}

/**
 * Finds the square root of a number.
 * @param {number} number - The number whose square root is to be found
 * @returns {number} The square root of the given number (`NaN` for negative input)
 * @example
 * sqrt(9); // 3
 */
export function sqrt(number: number): number {
	return Math.sqrt(number);
}

/**
 * Raises a base to an exponent.
 * @param {number} base - The base number
 * @param {number} exponent - The exponent to raise the base to
 * @returns {number} `base ** exponent`
 * @example
 * pow(2, 3); // 8
 */
export function pow(base: number, exponent: number): number {
	return Math.pow(base, exponent);
}

/**
 * Returns the logarithm of a number in the given base.
 * Bases `10`, `2` and `Math.E` use the dedicated (exact for exact powers) `Math.log10`, `Math.log2` and `Math.log`;
 * other bases use `Math.log(number) / Math.log(base)`.
 * @param {number} number - The number whose logarithm is wanted
 * @param {number} base - The base of the logarithm
 * @returns {number} `log_base(number)`
 * @example
 * log(1000, 10); // 3 (the plain ratio gives 2.9999999999999996)
 * log(16, 2); // 4
 * log(81, 3); // 4
 */
export function log(number: number, base: number): number {
	if (base === 10) return Math.log10(number);
	if (base === 2) return Math.log2(number);
	if (base === Math.E) return Math.log(number);
	return Math.log(number) / Math.log(base);
}

/**
 * Returns the smallest integer greater than or equal to a number.
 * @param {number} number - The number to round up
 * @returns {number} The smallest integer greater than or equal to the number
 * @example
 * ceil(3.14); // 4
 */
export function ceil(number: number): number {
	return Math.ceil(number);
}

/**
 * Returns the largest integer less than or equal to a number.
 * @param {number} number - The number to round down
 * @returns {number} The largest integer less than or equal to the number
 * @example
 * floor(3.14); // 3
 */
export function floor(number: number): number {
	return Math.floor(number);
}

/**
 * Mathematical (floored) modulo: the result always has the sign of the `divisor`
 * (so for a positive divisor it lies in `[0, divisor)`), unlike the JavaScript `%` operator (see {@link remainder}).
 * A zero result is always `+0`. Returns `NaN` when `divisor` is `0` or either argument is `NaN`.
 * @param {number} dividend - The number to be divided
 * @param {number} divisor - The number to divide by
 * @returns {number} `dividend mod divisor`
 * @example
 * modulo(7, 3); // 1
 * modulo(-1, 3); // 2 (whereas -1 % 3 === -1)
 * modulo(1, -3); // -2
 */
export function modulo(dividend: number, divisor: number): number {
	const rest = dividend % divisor;
	if (rest === 0) return 0;
	return rest < 0 !== divisor < 0 ? rest + divisor : rest;
}

/**
 * Truncated remainder, identical to the JavaScript `%` operator: the result has the sign of the `dividend`.
 * This is what `modulo` returned before it was fixed.
 * @param {number} dividend - The number to be divided
 * @param {number} divisor - The number to divide by
 * @returns {number} `dividend % divisor`
 * @example
 * remainder(7, 3); // 1
 * remainder(-1, 3); // -1
 */
export function remainder(dividend: number, divisor: number): number {
	return dividend % divisor;
}

/**
 * Generates a random floating-point number in the half-open range `[minimum, maximum)`.
 * When `minimum === maximum`, `minimum` is returned.
 * @param {number} minimum - Inclusive lower bound
 * @param {number} maximum - Exclusive upper bound
 * @param {RandomGenerator} [random=Math.random] - Source of uniform numbers in `[0, 1)`
 * @returns {number} A random number `n` with `minimum <= n < maximum`
 * @throws {RangeError} when a bound is not finite or `minimum > maximum`
 * @example
 * randomBetween(1, 10); // e.g. 4.7181…
 * randomBetween(0, 10, function () { return 0.5; }); // 5
 */
export function randomBetween(minimum: number, maximum: number, random: RandomGenerator = Math.random): number {
	if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
		throw new RangeError(`randomBetween: bounds must be finite, received ${minimum} and ${maximum}`);
	}
	if (minimum > maximum) throw new RangeError(`randomBetween: minimum (${minimum}) must not be greater than maximum (${maximum})`);
	if (minimum === maximum) return minimum;

	const r = random();
	const span = maximum - minimum;
	const value = Number.isFinite(span) ? minimum + r * span : minimum * (1 - r) + maximum * r;
	// Floating-point rounding can land exactly on `maximum`; keep the range half-open.
	return Math.min(Math.max(value, minimum), nextDown(maximum));
}

/**
 * Returns a random integer between `minimum` and `maximum`, both inclusive.
 * Non-integer bounds are narrowed to the integers inside them (`ceil(minimum)` .. `floor(maximum)`).
 * @param {number} minimum - Inclusive lower bound
 * @param {number} maximum - Inclusive upper bound
 * @param {RandomGenerator} [random=Math.random] - Source of uniform numbers in `[0, 1)`
 * @returns {number} A random integer `n` with `ceil(minimum) <= n <= floor(maximum)`
 * @throws {RangeError} when a bound is not finite, or no integer lies in `[minimum, maximum]` (including `minimum > maximum`)
 * @example
 * randomIntBetween(1, 6); // e.g. 4
 * randomIntBetween(1.2, 3.8); // 2 or 3
 */
export function randomIntBetween(minimum: number, maximum: number, random: RandomGenerator = Math.random): number {
	if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
		throw new RangeError(`randomIntBetween: bounds must be finite, received ${minimum} and ${maximum}`);
	}
	const low = Math.ceil(minimum);
	const high = Math.floor(maximum);
	if (low > high) throw new RangeError(`randomIntBetween: no integer exists in [${minimum}, ${maximum}]`);
	return Math.min(high, low + Math.floor(random() * (high - low + 1))) + 0;
}

/**
 * Converts degrees to radians.
 * @param {number} degrees - The angle in degrees
 * @returns {number} The angle in radians
 * @example
 * toRadians(180); // 3.141592653589793
 */
export function toRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 * @param {number} radians - The angle in radians
 * @returns {number} The angle in degrees
 * @example
 * toDegrees(Math.PI); // 180
 */
export function toDegrees(radians: number): number {
	return (radians * 180) / Math.PI;
}

/**
 * Restricts a value to the inclusive range `[minimum, maximum]`. `NaN` values stay `NaN`.
 * @param {number} value - The value to clamp
 * @param {number} minimum - Lower bound
 * @param {number} maximum - Upper bound
 * @returns {number} `minimum` if `value < minimum`, `maximum` if `value > maximum`, otherwise `value`
 * @throws {RangeError} when `minimum > maximum` or a bound is `NaN`
 * @example
 * clamp(15, 0, 10); // 10
 * clamp(-5, 0, 10); // 0
 * clamp(5, 0, 10); // 5
 */
export function clamp(value: number, minimum: number, maximum: number): number {
	if (!(minimum <= maximum)) throw new RangeError(`clamp: minimum (${minimum}) must not be greater than maximum (${maximum})`);
	return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Linear interpolation between `start` and `end`. `t = 0` gives exactly `start`, `t = 1` exactly `end`;
 * `t` outside `[0, 1]` extrapolates.
 * @param {number} start - Value at `t = 0`
 * @param {number} end - Value at `t = 1`
 * @param {number} t - Interpolation factor
 * @returns {number} `start + (end - start) * t`
 * @example
 * lerp(0, 10, 0.5); // 5
 * lerp(10, 20, 0.25); // 12.5
 */
export function lerp(start: number, end: number, t: number): number {
	return (1 - t) * start + t * end;
}

/**
 * Inverse of {@link lerp}: the factor `t` for which `lerp(start, end, t) === value`.
 * Returns `0` when `start === end` (the range is degenerate). The result is not clamped.
 * @param {number} start - Value mapped to `0`
 * @param {number} end - Value mapped to `1`
 * @param {number} value - The value to locate
 * @returns {number} `(value - start) / (end - start)`, or `0` when `start === end`
 * @example
 * inverseLerp(0, 10, 5); // 0.5
 * inverseLerp(10, 20, 12.5); // 0.25
 */
export function inverseLerp(start: number, end: number, value: number): number {
	if (start === end) return 0;
	return (value - start) / (end - start);
}

/**
 * Linearly maps a value from the range `[inMin, inMax]` to `[outMin, outMax]` (not clamped).
 * When `inMin === inMax`, `outMin` is returned.
 * @param {number} value - The value to map
 * @param {number} inMin - Start of the input range
 * @param {number} inMax - End of the input range
 * @param {number} outMin - Start of the output range
 * @param {number} outMax - End of the output range
 * @returns {number} The mapped value
 * @example
 * mapRange(5, 0, 10, 0, 100); // 50
 * mapRange(0.5, 0, 1, 10, 20); // 15
 */
export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
	return lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
}

/**
 * Checks whether a value lies in the half-open range `[start, end)`.
 * Like lodash's `inRange`, the bounds are swapped when `start > end`, so the range is always `[min(start, end), max(start, end))`.
 * @param {number} value - The value to check
 * @param {number} start - Inclusive bound
 * @param {number} end - Exclusive bound
 * @returns {boolean} `true` if the value is in range
 * @example
 * inRange(3, 2, 4); // true
 * inRange(4, 2, 4); // false
 * inRange(-3, -2, -6); // true (bounds swapped to [-6, -2))
 */
export function inRange(value: number, start: number, end: number): boolean {
	const low = Math.min(start, end);
	const high = Math.max(start, end);
	return value >= low && value < high;
}

/**
 * Multiplies all numbers of an array together.
 * @param {ReadonlyArray<number>} numbers - The numbers to multiply
 * @returns {number} The product (`1` for an empty array)
 * @example
 * product([2, 3, 4]); // 24
 * product([]); // 1
 */
export function product(numbers: ReadonlyArray<number>): number {
	let result = 1;
	for (const value of numbers) result *= value;
	return result;
}

/**
 * Finds the median of an array of numbers (the mean of the two middle values for even lengths).
 * The input is not mutated.
 * @param {ReadonlyArray<number>} numbers - The numbers
 * @returns {number} The median, or `NaN` if the array is empty or contains `NaN`
 * @example
 * median([3, 1, 2]); // 2
 * median([4, 1, 3, 2]); // 2.5
 * median([]); // NaN
 */
export function median(numbers: ReadonlyArray<number>): number {
	const length = numbers.length;
	if (length === 0) return NaN;
	const sorted = Array.from(numbers).sort(compareAscending);
	if (Number.isNaN(sorted[length - 1])) return NaN;
	const middle = length >> 1;
	return length % 2 === 1 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2;
}

/**
 * Finds the most frequent value(s) of an array of numbers.
 * Values are compared with SameValueZero (`0` and `-0` are the same value, `NaN` equals `NaN`).
 * @param {ReadonlyArray<number>} numbers - The numbers
 * @returns {number[]} Every value with the highest occurrence count, in ascending order (`NaN` last); `[]` for an empty array
 * @example
 * mode([1, 2, 2, 3]); // [2]
 * mode([3, 1, 3, 1, 2]); // [1, 3]
 * mode([]); // []
 */
export function mode(numbers: ReadonlyArray<number>): number[] {
	const counts = new Map<number, number>();
	let highest = 0;
	for (const value of numbers) {
		const count = (counts.get(value) ?? 0) + 1;
		counts.set(value, count);
		if (count > highest) highest = count;
	}
	const result: number[] = [];
	for (const [value, count] of counts) {
		if (count === highest) result.push(value);
	}
	return result.sort(compareAscending);
}

/**
 * Computes the variance of an array of numbers using Welford's numerically stable online algorithm.
 * By default the population variance (divide by `n`) is returned; pass `{ sample: true }` for the
 * sample variance (divide by `n - 1`).
 * @param {ReadonlyArray<number>} numbers - The numbers
 * @param {VarianceOptions} [options={}] - `sample`: compute the sample variance instead of the population one
 * @returns {number} The variance; `NaN` for an empty array, for a sample of fewer than 2 values, or if an element is not finite
 * @example
 * variance([2, 4, 4, 4, 5, 5, 7, 9]); // 4
 * variance([1, 2, 3, 4], { sample: true }); // 1.6666666666666667
 * variance([]); // NaN
 */
export function variance(numbers: ReadonlyArray<number>, options: VarianceOptions = {}): number {
	const sample = options.sample === true;
	let count = 0;
	let mean = 0;
	let squaredDistance = 0;
	for (const value of numbers) {
		count++;
		const delta = value - mean;
		mean += delta / count;
		squaredDistance += delta * (value - mean);
	}
	const divisor = sample ? count - 1 : count;
	if (divisor <= 0) return NaN;
	return squaredDistance / divisor;
}

/**
 * Computes the standard deviation (square root of {@link variance}) of an array of numbers.
 * Population by default; pass `{ sample: true }` for the sample standard deviation.
 * @param {ReadonlyArray<number>} numbers - The numbers
 * @param {VarianceOptions} [options={}] - `sample`: compute the sample statistic instead of the population one
 * @returns {number} The standard deviation; `NaN` when the variance is undefined (see {@link variance})
 * @example
 * standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]); // 2
 * standardDeviation([1]); // 0
 * standardDeviation([1], { sample: true }); // NaN
 */
export function standardDeviation(numbers: ReadonlyArray<number>, options: VarianceOptions = {}): number {
	return Math.sqrt(variance(numbers, options));
}

/**
 * Greatest common divisor of two integers (Euclid's algorithm). The result is never negative,
 * and `gcd(0, 0) === 0`.
 * @param {number} a - First integer
 * @param {number} b - Second integer
 * @returns {number} The greatest common divisor of `a` and `b`
 * @throws {RangeError} when `a` or `b` is not an integer
 * @example
 * gcd(12, 18); // 6
 * gcd(-4, 6); // 2
 * gcd(0, 5); // 5
 */
export function gcd(a: number, b: number): number {
	assertIntegers('gcd', a, b);
	let x = Math.abs(a);
	let y = Math.abs(b);
	while (y !== 0) {
		const rest = x % y;
		x = y;
		y = rest;
	}
	return x;
}

/**
 * Least common multiple of two integers. The result is never negative, and is `0` if either argument is `0`.
 * @param {number} a - First integer
 * @param {number} b - Second integer
 * @returns {number} The least common multiple of `a` and `b`
 * @throws {RangeError} when `a` or `b` is not an integer
 * @example
 * lcm(4, 6); // 12
 * lcm(-3, 5); // 15
 * lcm(0, 5); // 0
 */
export function lcm(a: number, b: number): number {
	assertIntegers('lcm', a, b);
	if (a === 0 || b === 0) return 0;
	return Math.abs((a / gcd(a, b)) * b);
}

/**
 * Checks whether a number is a prime, using 6k ± 1 trial division.
 * Returns `false` for non-integers, negatives, `0` and `1`.
 * @param {number} number - The number to test
 * @returns {boolean} `true` if the number is prime
 * @example
 * isPrime(7); // true
 * isPrime(9); // false
 * isPrime(1); // false
 */
export function isPrime(number: number): boolean {
	if (!Number.isInteger(number) || number < 2) return false;
	if (number < 4) return true;
	if (number % 2 === 0 || number % 3 === 0) return false;
	for (let i = 5; i * i <= number; i += 6) {
		if (number % i === 0 || number % (i + 2) === 0) return false;
	}
	return true;
}

/**
 * Checks whether a number is an even integer. Non-integers (including `NaN` and `±Infinity`) are neither even nor odd.
 * @param {number} number - The number to test
 * @returns {boolean} `true` if the number is an even integer
 * @example
 * isEven(4); // true
 * isEven(3); // false
 * isEven(2.5); // false
 */
export function isEven(number: number): boolean {
	return Number.isInteger(number) && number % 2 === 0;
}

/**
 * Checks whether a number is an odd integer. Non-integers (including `NaN` and `±Infinity`) are neither even nor odd.
 * @param {number} number - The number to test
 * @returns {boolean} `true` if the number is an odd integer
 * @example
 * isOdd(3); // true
 * isOdd(-3); // true
 * isOdd(4); // false
 */
export function isOdd(number: number): boolean {
	return Number.isInteger(number) && Math.abs(number % 2) === 1;
}

/**
 * Expresses `value` as a percentage of `total` (`value / total * 100`).
 * When `total` is `0` the percentage is undefined and `NaN` is returned (rather than `±Infinity`).
 * @param {number} value - The part
 * @param {number} total - The whole
 * @returns {number} The percentage, or `NaN` when `total` is `0`
 * @example
 * percentage(25, 200); // 12.5
 * percentage(3, 0); // NaN
 */
export function percentage(value: number, total: number): number {
	if (total === 0) return NaN;
	return (value / total) * 100;
}
