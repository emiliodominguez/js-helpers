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
 * shiftDecimal(1.005, 2); // => 100.5 // whereas 1.005 * 100 === 100.49999999999999
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
 * nextDown(1); // => 0.9999999999999999
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
 * [3, NaN, 1].sort(compareAscending); // => [1, 3, NaN]
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
 * sum([1, 2, 3, 4]); // => 10
 * sum([0.1, 0.2, 0.3]); // => 0.6 // naive reduce gives 0.6000000000000001
 * sum([1e100, 1, -1e100]); // => 1 // naive reduce gives 0
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
 * round(1.2345, 2); // => 1.23
 * round(1.005, 2); // => 1.01
 * round(-2.5); // => -3
 * round(1234, -2); // => 1200
 * round(1e-7, 2); // => 0
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
 * average([1, 2, 3, 4]); // => 2.5
 * average([]); // => NaN
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
 * factorial(0); // => 1
 * factorial(5); // => 120
 * factorial(171); // => Infinity
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
 * max([1, 5, 3]); // => 5
 * max([]); // => -Infinity
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
 * min([4, 1, 3]); // => 1
 * min([]); // => Infinity
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
 * abs(-10); // => 10
 */
export function abs(number: number): number {
	return Math.abs(number);
}

/**
 * Finds the square root of a number.
 * @param {number} number - The number whose square root is to be found
 * @returns {number} The square root of the given number (`NaN` for negative input)
 * @example
 * sqrt(9); // => 3
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
 * pow(2, 3); // => 8
 */
export function pow(base: number, exponent: number): number {
	return Math.pow(base, exponent);
}

/**
 * Returns the logarithm of a number in the given base.
 * Bases `10`, `2` and `Math.E` use the dedicated (exact for exact powers) `Math.log10`, `Math.log2` and `Math.log`;
 * other bases use `Math.log(number) / Math.log(base)`, snapped to the nearest integer `k` when `base ** k === number`
 * exactly (so exact powers such as `log(81, 3)` give an exact integer instead of `4.000000000000001`).
 * @param {number} number - The number whose logarithm is wanted
 * @param {number} base - The base of the logarithm
 * @returns {number} `log_base(number)`
 * @example
 * log(1000, 10); // => 3 // the plain ratio gives 2.9999999999999996
 * log(16, 2); // => 4
 * log(81, 3); // => 4
 */
export function log(number: number, base: number): number {
	if (base === 10) return Math.log10(number);
	if (base === 2) return Math.log2(number);
	if (base === Math.E) return Math.log(number);
	const ratio = Math.log(number) / Math.log(base);
	const nearest = Math.round(ratio);
	if (Number.isFinite(ratio) && Math.abs(ratio - nearest) <= 1e-9 * Math.max(1, Math.abs(nearest)) && Math.pow(base, nearest) === number) return nearest;
	return ratio;
}

/**
 * Returns the smallest integer greater than or equal to a number.
 * @param {number} number - The number to round up
 * @returns {number} The smallest integer greater than or equal to the number
 * @example
 * ceil(3.14); // => 4
 */
export function ceil(number: number): number {
	return Math.ceil(number);
}

/**
 * Returns the largest integer less than or equal to a number.
 * @param {number} number - The number to round down
 * @returns {number} The largest integer less than or equal to the number
 * @example
 * floor(3.14); // => 3
 */
export function floor(number: number): number {
	return Math.floor(number);
}

/**
 * Mathematical (floored) modulo: the result always has the sign of the `divisor`
 * (so for a positive divisor it lies in `[0, divisor)`), unlike the JavaScript `%` operator (see {@link remainder}).
 * A zero result is always `+0`. Returns `NaN` when `divisor` is `0` or either argument is `NaN`.
 * When the exact result is so close to `divisor` that it rounds to it (e.g. `modulo(-1e-20, 3)`), `0` — the congruent
 * value nearest on the circle — is returned, so the result never equals a finite `divisor`.
 * @param {number} dividend - The number to be divided
 * @param {number} divisor - The number to divide by
 * @returns {number} `dividend mod divisor`
 * @example
 * modulo(7, 3); // => 1
 * modulo(-1, 3); // => 2 // whereas -1 % 3 === -1
 * modulo(1, -3); // => -2
 */
export function modulo(dividend: number, divisor: number): number {
	const rest = dividend % divisor;
	if (rest === 0) return 0;
	if (rest < 0 === divisor < 0) return rest;
	const wrapped = rest + divisor;
	return wrapped === divisor && Number.isFinite(divisor) ? 0 : wrapped;
}

/**
 * Truncated remainder, identical to the JavaScript `%` operator: the result has the sign of the `dividend`.
 * This is what `modulo` returned before it was fixed.
 * @param {number} dividend - The number to be divided
 * @param {number} divisor - The number to divide by
 * @returns {number} `dividend % divisor`
 * @example
 * remainder(7, 3); // => 1
 * remainder(-1, 3); // => -1
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
 * randomBetween(0, 10, function () { return 0.5; }); // => 5
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
 * randomIntBetween(1.2, 3.8); // 2 or 3: only the integers inside the range
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
 * toRadians(180); // => 3.141592653589793
 */
export function toRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 * @param {number} radians - The angle in radians
 * @returns {number} The angle in degrees
 * @example
 * toDegrees(Math.PI); // => 180
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
 * clamp(15, 0, 10); // => 10
 * clamp(-5, 0, 10); // => 0
 * clamp(5, 0, 10); // => 5
 */
export function clamp(value: number, minimum: number, maximum: number): number {
	if (!(minimum <= maximum)) throw new RangeError(`clamp: minimum (${minimum}) must not be greater than maximum (${maximum})`);
	return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Linear interpolation between `start` and `end`. `t = 0` gives exactly `start`, `t = 1` exactly `end`
 * (even when the other endpoint is infinite), and `start === end` gives exactly `start` for every finite `t`;
 * `t` outside `[0, 1]` extrapolates.
 * @param {number} start - Value at `t = 0`
 * @param {number} end - Value at `t = 1`
 * @param {number} t - Interpolation factor
 * @returns {number} `start + (end - start) * t`
 * @example
 * lerp(0, 10, 0.5); // => 5
 * lerp(10, 20, 0.25); // => 12.5
 */
export function lerp(start: number, end: number, t: number): number {
	if (t === 0) return start;
	if (t === 1) return end;
	if (start === end && Number.isFinite(t)) return start;
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
 * inverseLerp(0, 10, 5); // => 0.5
 * inverseLerp(10, 20, 12.5); // => 0.25
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
 * mapRange(5, 0, 10, 0, 100); // => 50
 * mapRange(0.5, 0, 1, 10, 20); // => 15
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
 * inRange(3, 2, 4); // => true
 * inRange(4, 2, 4); // => false
 * inRange(-3, -2, -6); // => true // bounds swapped to [-6, -2)
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
 * product([2, 3, 4]); // => 24
 * product([]); // => 1
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
 * median([3, 1, 2]); // => 2
 * median([4, 1, 3, 2]); // => 2.5
 * median([]); // => NaN
 */
export function median(numbers: ReadonlyArray<number>): number {
	const length = numbers.length;
	if (length === 0) return NaN;
	const sorted = Array.from(numbers).sort(compareAscending);
	if (Number.isNaN(sorted[length - 1])) return NaN;
	const middle = length >> 1;
	if (length % 2 === 1) return sorted[middle];
	const low = sorted[middle - 1];
	const high = sorted[middle];
	const total = low + high;
	// `(low + high) / 2` is correctly rounded (and exact for equal values, even subnormal); halve first only on overflow.
	return Number.isFinite(total) ? total / 2 : low / 2 + high / 2;
}

/**
 * Finds the most frequent value(s) of an array of numbers.
 * Values are compared with SameValueZero (`0` and `-0` are the same value, `NaN` equals `NaN`).
 * @param {ReadonlyArray<number>} numbers - The numbers
 * @returns {number[]} Every value with the highest occurrence count, in ascending order (`NaN` last); `[]` for an empty array
 * @example
 * mode([1, 2, 2, 3]); // => [2]
 * mode([3, 1, 3, 1, 2]); // => [1, 3]
 * mode([]); // => []
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
 * @returns {number} The variance; `NaN` for an empty array, for a sample of fewer than 2 values, or if an element is not finite;
 * `Infinity` when every element is finite but the variance overflows (e.g. `variance([1e308, -1e308])`)
 * @example
 * variance([2, 4, 4, 4, 5, 5, 7, 9]); // => 4
 * variance([1, 2, 3, 4], { sample: true }); // => 1.6666666666666667
 * variance([]); // => NaN
 */
export function variance(numbers: ReadonlyArray<number>, options: VarianceOptions = {}): number {
	const sample = options.sample === true;
	let count = 0;
	let mean = 0;
	let squaredDistance = 0;
	let allFinite = true;
	for (const value of numbers) {
		count++;
		if (!Number.isFinite(value)) allFinite = false;
		const delta = value - mean;
		mean += delta / count;
		squaredDistance += delta * (value - mean);
	}
	const divisor = sample ? count - 1 : count;
	if (divisor <= 0 || !allFinite) return NaN;
	// With finite inputs the intermediate deltas can only overflow when the true variance is astronomically large,
	// which Welford's update turns into `-Infinity` or `NaN`: report the overflow as `Infinity`.
	if (!(squaredDistance >= 0 && squaredDistance < Infinity)) return Infinity;
	return squaredDistance / divisor;
}

/**
 * Computes the standard deviation (square root of {@link variance}) of an array of numbers.
 * Population by default; pass `{ sample: true }` for the sample standard deviation.
 * @param {ReadonlyArray<number>} numbers - The numbers
 * @param {VarianceOptions} [options={}] - `sample`: compute the sample statistic instead of the population one
 * @returns {number} The standard deviation; `NaN` when the variance is undefined (see {@link variance})
 * @example
 * standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]); // => 2
 * standardDeviation([1]); // => 0
 * standardDeviation([1], { sample: true }); // => NaN
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
 * gcd(12, 18); // => 6
 * gcd(-4, 6); // => 2
 * gcd(0, 5); // => 5
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
 * lcm(4, 6); // => 12
 * lcm(-3, 5); // => 15
 * lcm(0, 5); // => 0
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
 * isPrime(7); // => true
 * isPrime(9); // => false
 * isPrime(1); // => false
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
 * isEven(4); // => true
 * isEven(3); // => false
 * isEven(2.5); // => false
 */
export function isEven(number: number): boolean {
	return Number.isInteger(number) && number % 2 === 0;
}

/**
 * Checks whether a number is an odd integer. Non-integers (including `NaN` and `±Infinity`) are neither even nor odd.
 * @param {number} number - The number to test
 * @returns {boolean} `true` if the number is an odd integer
 * @example
 * isOdd(3); // => true
 * isOdd(-3); // => true
 * isOdd(4); // => false
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
 * percentage(25, 200); // => 12.5
 * percentage(3, 0); // => NaN
 */
export function percentage(value: number, total: number): number {
	if (total === 0) return NaN;
	return (value / total) * 100;
}

/**
 * Options accepted by {@link approximatelyEqual}.
 */
export interface ApproximatelyEqualOptions {
	/**
	 * Maximum allowed difference relative to the larger magnitude of the two values. Must be `>= 0`.
	 * @default 1e-9
	 */
	relative?: number;
	/**
	 * Minimum absolute tolerance, useful for comparisons near zero. Must be `>= 0`.
	 * @default 0
	 */
	absolute?: number;
}

/**
 * Options accepted by {@link formatBytes}.
 */
export interface FormatBytesOptions {
	/**
	 * Maximum number of decimal places (trailing zeros are dropped). Non-negative integer.
	 * @default 1
	 */
	decimals?: number;
	/**
	 * `1000` for SI units (`kB`, `MB`, …) or `1024` for IEC binary units (`KiB`, `MiB`, …).
	 * @default 1000
	 */
	base?: 1000 | 1024;
}

const SI_BYTE_UNITS: ReadonlyArray<string> = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
const IEC_BYTE_UNITS: ReadonlyArray<string> = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

/**
 * Interpolates between two sorted values `low <= high`, monotonically in `t` and never leaving `[low, high]`.
 * @param {number} low - Value at `t = 0`
 * @param {number} high - Value at `t = 1` (must be `>= low`)
 * @param {number} t - Factor in `[0, 1)`
 * @returns {number} The interpolated value
 * @example
 * interpolateSorted(1, 3, 0.5); // => 2
 */
function interpolateSorted(low: number, high: number, t: number): number {
	if (t === 0 || low === high) return low;
	const span = high - low;
	if (!Number.isFinite(span)) return (1 - t) * low + t * high;
	return Math.min(low + t * span, high);
}

/**
 * Counts the decimal places in the shortest decimal representation of a finite number.
 * @param {number} value - A finite number
 * @returns {number} The number of digits after the decimal point (`0` for integers)
 * @example
 * decimalPlaces(0.25); // => 2
 * decimalPlaces(1e-7); // => 7
 */
function decimalPlaces(value: number): number {
	const [mantissa, exponent = '0'] = String(Math.abs(value)).split('e');
	const fraction = mantissa.split('.')[1] ?? '';
	return Math.max(0, fraction.length - Number(exponent));
}

/**
 * Computes the `q`-quantile of an array of numbers by linear interpolation between closest ranks
 * (R type 7, the default of R, NumPy and Excel's `PERCENTILE.INC`): with the values sorted ascending,
 * `h = (n - 1) * q` and the result interpolates between the values at ranks `floor(h)` and `ceil(h)`.
 * The input is not mutated.
 * @param {ReadonlyArray<number>} numbers - The numbers
 * @param {number} q - The quantile to compute, in `[0, 1]` (`0` gives the minimum, `0.5` the median, `1` the maximum)
 * @returns {number} The quantile, or `NaN` if the array is empty or contains `NaN`
 * @throws {RangeError} when `q` is not in `[0, 1]` (including `NaN`)
 * @example
 * quantile([1, 2, 3, 4], 0.5); // => 2.5
 * quantile([1, 2, 3, 4], 0.25); // => 1.75
 * quantile([7, 1, 3], 1); // => 7
 * quantile([], 0.5); // => NaN
 */
export function quantile(numbers: ReadonlyArray<number>, q: number): number {
	if (!(q >= 0 && q <= 1)) throw new RangeError(`quantile: q must be in [0, 1], received ${q}`);
	const length = numbers.length;
	if (length === 0) return NaN;
	const sorted = Array.from(numbers).sort(compareAscending);
	if (Number.isNaN(sorted[length - 1])) return NaN;
	const position = (length - 1) * q;
	const lowerIndex = Math.floor(position);
	if (lowerIndex === length - 1) return sorted[lowerIndex];
	return interpolateSorted(sorted[lowerIndex], sorted[lowerIndex + 1], position - lowerIndex);
}

/**
 * Computes the `p`-th percentile of an array of numbers: `quantile(numbers, p / 100)`
 * (linear interpolation, same semantics as Excel's `PERCENTILE.INC`).
 * @param {ReadonlyArray<number>} numbers - The numbers
 * @param {number} p - The percentile to compute, in `[0, 100]`
 * @returns {number} The percentile, or `NaN` if the array is empty or contains `NaN`
 * @throws {RangeError} when `p` is not in `[0, 100]` (including `NaN`)
 * @example
 * percentile([1, 2, 3, 4], 50); // => 2.5
 * percentile([15, 20, 35, 40, 50], 40); // => 29
 */
export function percentile(numbers: ReadonlyArray<number>, p: number): number {
	if (!(p >= 0 && p <= 100)) throw new RangeError(`percentile: p must be in [0, 100], received ${p}`);
	return quantile(numbers, p / 100);
}

/**
 * Computes the running totals of a sequence of numbers using the same compensated (Neumaier) summation as {@link sum},
 * so the last element is exactly `sum(numbers)` and rounding errors do not accumulate along the sequence.
 * @param {Iterable<number>} numbers - The numbers to accumulate
 * @returns {number[]} A new array of the same length whose `i`-th element is the sum of the first `i + 1` numbers
 * @example
 * cumulativeSum([1, 2, 3, 4]); // => [1, 3, 6, 10]
 * cumulativeSum([1e100, 1, -1e100]); // => [1e100, 1e100, 1] // naive running sums end with 0
 * cumulativeSum([]); // => []
 */
export function cumulativeSum(numbers: Iterable<number>): number[] {
	const result: number[] = [];
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
		result.push(Number.isFinite(total) ? total + compensation : total);
	}
	return result;
}

/**
 * Checks whether two numbers are close to each other, with the semantics of Python's `math.isclose`:
 * `|a - b| <= max(relative * max(|a|, |b|), absolute)`.
 * `NaN` is never close to anything (not even itself), and an infinity is only close to itself.
 * Note that with the default `absolute = 0`, no non-zero number is close to `0`; pass an `absolute` tolerance for that.
 * @param {number} a - First number
 * @param {number} b - Second number
 * @param {ApproximatelyEqualOptions} [options={}] - `relative` (default `1e-9`) and `absolute` (default `0`) tolerances
 * @returns {boolean} `true` if the numbers are within tolerance of each other
 * @throws {RangeError} when a tolerance is negative or `NaN`
 * @example
 * approximatelyEqual(0.1 + 0.2, 0.3); // => true
 * approximatelyEqual(1, 1.1); // => false
 * approximatelyEqual(1, 1.1, { relative: 0.1 }); // => true
 * approximatelyEqual(1e-12, 0); // => false
 * approximatelyEqual(1e-12, 0, { absolute: 1e-9 }); // => true
 */
export function approximatelyEqual(a: number, b: number, options: ApproximatelyEqualOptions = {}): boolean {
	const { relative = 1e-9, absolute = 0 } = options;
	if (!(relative >= 0) || !(absolute >= 0)) {
		throw new RangeError(`approximatelyEqual: tolerances must be non-negative, received relative ${relative} and absolute ${absolute}`);
	}
	if (a === b) return true;
	if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
	const difference = Math.abs(a - b);
	return difference <= Math.abs(relative * a) || difference <= Math.abs(relative * b) || difference <= absolute;
}

/**
 * Computes the weighted arithmetic mean `Σ(value × weight) / Σ(weight)`, using the compensated {@link sum}.
 * Weights are rescaled by the largest one first, so only their ratios matter and very large or tiny (subnormal) weights neither overflow nor underflow.
 * @param {ReadonlyArray<number>} values - The values to average
 * @param {ReadonlyArray<number>} weights - One finite, non-negative weight per value
 * @returns {number} The weighted mean, or `NaN` when the total weight is `0` (including empty arrays)
 * @throws {RangeError} when `values` and `weights` have different lengths, or a weight is negative, `NaN` or infinite
 * @example
 * weightedAverage([80, 90], [1, 3]); // => 87.5
 * weightedAverage([10, 20], [1, 1]); // => 15
 * weightedAverage([10, 20], [0, 0]); // => NaN
 */
export function weightedAverage(values: ReadonlyArray<number>, weights: ReadonlyArray<number>): number {
	if (values.length !== weights.length) {
		throw new RangeError(`weightedAverage: values and weights must have the same length, received ${values.length} and ${weights.length}`);
	}
	let largestWeight = 0;
	for (let i = 0; i < weights.length; i++) {
		const weight = weights[i];
		if (!(weight >= 0 && weight < Infinity)) throw new RangeError(`weightedAverage: weights must be finite and non-negative, received ${weight} at index ${i}`);
		if (weight > largestWeight) largestWeight = weight;
	}
	if (largestWeight === 0) return NaN;
	// Rescaling the weights into [0, 1] keeps the products and the total weight from overflowing or underflowing.
	const scaledWeights = weights.map(function (weight) {
		return weight / largestWeight;
	});
	const products = values.map(function (value, index) {
		return value * scaledWeights[index];
	});
	return sum(products) / sum(scaledWeights);
}

/**
 * Min–max normalization: linearly rescales the numbers so the smallest becomes `0` and the largest `1`.
 * Order is preserved (`a <= b` implies `normalize(a) <= normalize(b)`) and every result lies in `[0, 1]`.
 * When all numbers are equal, every result is `0`.
 * @param {ReadonlyArray<number>} numbers - The finite numbers to rescale
 * @returns {number[]} A new array of the same length with values in `[0, 1]`
 * @throws {RangeError} when an element is not finite (`NaN` or `±Infinity`)
 * @example
 * normalize([10, 20, 15]); // => [0, 1, 0.5]
 * normalize([5, 5]); // => [0, 0]
 * normalize([]); // => []
 */
export function normalize(numbers: ReadonlyArray<number>): number[] {
	for (const value of numbers) {
		if (!Number.isFinite(value)) throw new RangeError(`normalize: elements must be finite, received ${value}`);
	}
	const low = min(numbers);
	const high = max(numbers);
	if (low === high)
		return numbers.map(function () {
			return 0;
		});
	const range = high - low;
	// When the range overflows, work on halved values (exact for normal doubles) to keep it finite.
	const scale = Number.isFinite(range) ? 1 : 0.5;
	const scaledRange = high * scale - low * scale;
	return numbers.map(function (value) {
		return (value * scale - low * scale) / scaledRange;
	});
}

/**
 * Formats a byte count as a human-readable string, using SI units (`kB`, `MB`, …, powers of `1000`) by default,
 * or IEC binary units (`KiB`, `MiB`, …, powers of `1024`) with `{ base: 1024 }`.
 * The value is rounded with {@link round} to at most `decimals` places (trailing zeros are dropped), and moves up to the
 * next unit when rounding reaches the base (`999_999` → `'1 MB'`, not `'1000 kB'`). Negative values keep their sign.
 * Values beyond the largest unit (`YB` / `YiB`) are expressed in that unit.
 * @param {number} bytes - The number of bytes (may be negative or fractional)
 * @param {FormatBytesOptions} [options={}] - `decimals` (default `1`) and `base` (`1000` (default) or `1024`)
 * @returns {string} The formatted size, e.g. `'1.5 kB'`
 * @throws {RangeError} when `bytes` is not finite, `decimals` is not a non-negative integer, or `base` is not `1000` or `1024`
 * @example
 * formatBytes(0); // => '0 B'
 * formatBytes(1500); // => '1.5 kB'
 * formatBytes(1536, { base: 1024 }); // => '1.5 KiB'
 * formatBytes(1234567, { decimals: 2 }); // => '1.23 MB'
 * formatBytes(-2048, { base: 1024 }); // => '-2 KiB'
 */
export function formatBytes(bytes: number, options: FormatBytesOptions = {}): string {
	const { decimals = 1, base = 1000 } = options;
	if (!Number.isFinite(bytes)) throw new RangeError(`formatBytes: bytes must be finite, received ${bytes}`);
	if (!Number.isInteger(decimals) || decimals < 0) throw new RangeError(`formatBytes: decimals must be a non-negative integer, received ${decimals}`);
	if (base !== 1000 && base !== 1024) throw new RangeError(`formatBytes: base must be 1000 or 1024, received ${base}`);

	const units = base === 1024 ? IEC_BYTE_UNITS : SI_BYTE_UNITS;
	const magnitude = Math.abs(bytes);
	let exponent = 0;
	while (exponent < units.length - 1 && magnitude >= Math.pow(base, exponent + 1)) exponent++;
	let value = round(bytes / Math.pow(base, exponent), decimals);
	if (Math.abs(value) >= base && exponent < units.length - 1) {
		exponent++;
		value = round(bytes / Math.pow(base, exponent), decimals);
	}
	// `+ 0` turns `-0` into `0` so tiny negative values do not print as "-0".
	return `${value + 0} ${units[exponent]}`;
}

/**
 * Converts an integer to its English ordinal string (`1st`, `2nd`, `3rd`, `4th`, `11th`, `12th`, `13th`, `21st`, `112th`, …).
 * Negative integers keep their minus sign and take the suffix of their absolute value (`-1` → `'-1st'`, `-12` → `'-12th'`);
 * `-0` is treated as `0` (`'0th'`). Every integer is written out in full digits, even above `1e21` (no exponent notation).
 * @param {number} n - An integer
 * @returns {string} The number followed by its ordinal suffix
 * @throws {RangeError} when `n` is not an integer (including `NaN` and `±Infinity`)
 * @example
 * ordinal(1); // => '1st'
 * ordinal(22); // => '22nd'
 * ordinal(13); // => '13th'
 * ordinal(112); // => '112th'
 * ordinal(-3); // => '-3rd'
 */
export function ordinal(n: number): string {
	if (!Number.isInteger(n)) throw new RangeError(`ordinal: argument must be an integer, received ${n}`);
	const digits = BigInt(n).toString();
	const lastTwo = Number(digits.slice(-2).replace('-', ''));
	const last = lastTwo % 10;
	let suffix = 'th';
	if (lastTwo < 11 || lastTwo > 13) {
		if (last === 1) suffix = 'st';
		else if (last === 2) suffix = 'nd';
		else if (last === 3) suffix = 'rd';
	}
	return `${digits}${suffix}`;
}

/**
 * Computes the real `n`-th root of a number. Odd roots of negative numbers are negative (`nthRoot(-8, 3) === -2`),
 * even roots of negative numbers are `NaN`. Uses `Math.sqrt` / `Math.cbrt` for `n = 2` / `n = 3`, and otherwise snaps the
 * result to an integer `k` when `k ** n === |value|` exactly (so `nthRoot(16, 4) === 2`, not `1.9999999999999998`).
 * @param {number} value - The radicand
 * @param {number} n - The degree of the root, a positive integer
 * @returns {number} The real `n`-th root of `value`, or `NaN` when it does not exist
 * @throws {RangeError} when `n` is not a positive integer
 * @example
 * nthRoot(27, 3); // => 3
 * nthRoot(-32, 5); // => -2
 * nthRoot(16, 4); // => 2
 * nthRoot(-16, 4); // => NaN
 */
export function nthRoot(value: number, n: number): number {
	if (!Number.isInteger(n) || n < 1) throw new RangeError(`nthRoot: n must be a positive integer, received ${n}`);
	if (n === 1) return value;
	if (n === 2) return Math.sqrt(value);
	if (n === 3) return Math.cbrt(value);
	if (value === 0) return value;
	if (value < 0 && n % 2 === 0) return NaN;
	const magnitude = Math.abs(value);
	let root = Math.pow(magnitude, 1 / n);
	const nearest = Math.round(root);
	if (Math.pow(nearest, n) === magnitude) root = nearest;
	return value < 0 ? -root : root;
}

/**
 * Rounds a number to the nearest multiple of `step` (e.g. snapping to quarters with `step = 0.25`).
 * Like {@link round}, the computation works on decimal representations, so `roundToStep(0.3, 0.1) === 0.3`
 * (not `0.30000000000000004`), and ties are rounded half away from zero (`roundToStep(0.35, 0.1) === 0.4`).
 * Non-finite `value`s are returned as-is, as are values more than `2 ** 53` steps away from zero (already as close to a
 * multiple of `step` as their precision allows).
 * @param {number} value - The number to round
 * @param {number} step - The positive, finite step size
 * @returns {number} The multiple of `step` nearest to `value`
 * @throws {RangeError} when `step` is not a finite number greater than `0`
 * @example
 * roundToStep(1.13, 0.25); // => 1.25
 * roundToStep(7, 5); // => 5
 * roundToStep(-7.5, 5); // => -10
 * roundToStep(0.3, 0.1); // => 0.3
 */
export function roundToStep(value: number, step: number): number {
	if (!(step > 0 && step < Infinity)) throw new RangeError(`roundToStep: step must be a finite number greater than 0, received ${step}`);
	if (!Number.isFinite(value)) return value;
	// Work on the magnitude and restore the sign at the end, exactly like `round` (ties away from zero, `-0` preserved).
	const negative = value < 0 || Object.is(value, -0);
	const magnitude = Math.abs(value);
	const stepDecimals = decimalPlaces(step);
	const shift = Math.max(decimalPlaces(magnitude), stepDecimals);
	const scaledValue = shiftDecimal(magnitude, shift);
	const scaledStep = shiftDecimal(step, shift);
	// Dividing the decimal-shifted integers avoids binary-fraction artefacts such as 0.35 / 0.1 === 3.4999999999999996.
	const quotient = Number.isFinite(scaledValue) && Number.isFinite(scaledStep) ? scaledValue / scaledStep : magnitude / step;
	// Beyond 2 ** 53 steps, every double is already (within its own precision) a multiple of `step`.
	if (!(quotient < 2 ** 53)) return value;
	const rounded = round(Math.round(quotient) * step, stepDecimals);
	return negative ? -rounded : rounded;
}
