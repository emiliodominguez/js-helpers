/**
 * Calculates the sum of an array of numbers
 * @param {number[]} numbers - The array of numbers to calculate the sum of
 * @returns {number} The sum of the array of numbers
 */
export function sum(numbers: number[]): number {
	return numbers.reduce((a, b) => a + b, 0);
}

/**
 * Rounds a number to a specified number of decimal places
 * @param {number} number - The number to round
 * @param {number} decimals - The number of decimal places to round to
 * @returns {number} The rounded number
 */
export function round(number: number, decimals: number): number {
	return Number(Math.round((number + 'e' + decimals) as unknown as number) + 'e-' + decimals);
}

/**
 * Calculates the average of an array of numbers
 * @param {number[]} numbers - The array of numbers to calculate the average of
 * @returns {number} The average of the array of numbers
 */
export function average(numbers: number[]): number {
	return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Calculates the factorial of a number
 * @param {number} number - The number to calculate the factorial of
 * @returns {number} The factorial of the number
 */
export function factorial(number: number): number {
	if (number === 0) return 1;

	return number * factorial(number - 1);
}

/**
 * Finds the maximum value in an array of numbers
 * @param {number[]} numbers - The array of numbers
 * @returns {number} The maximum value found in the array
 */
export function max(numbers: number[]): number {
	return Math.max(...numbers);
}

/**
 * Finds the minimum value in an array of numbers
 * @param {number[]} numbers - The array of numbers
 * @returns {number} The minimum value found in the array
 */
export function min(numbers: number[]): number {
	return Math.min(...numbers);
}

/**
 * Finds the absolute value of a number
 * @param {number} number - The number whose absolute value is to be found
 * @returns {number} The absolute value of the given number
 */
export function abs(number: number): number {
	return Math.abs(number);
}

/**
 * Finds the square root of a number
 * @param {number} number - The number whose square root is to be found
 * @returns {number} The square root of the given number
 */
export function sqrt(number: number): number {
	return Math.sqrt(number);
}

/**
 * Finds the value of a number raised to an exponent
 * @param {number} base - The base number
 * @param {number} exponent - The exponent to raise the base to
 * @returns {number} The value of the base raised to the exponent
 */
export function pow(base: number, exponent: number): number {
	return Math.pow(base, exponent);
}

/**
 * Returns the logarithm of a number with the specified base
 * @param {number} number - The number for which to get the logarithm
 * @param {number} base - The base of the logarithm
 * @returns {number} The logarithm of the number with the specified base
 */
export function log(number: number, base: number): number {
	return Math.log(number) / Math.log(base);
}

/**
 * Returns the smallest integer greater than or equal to a number
 * @param {number} number - The number to round up
 * @returns {number} The smallest integer greater than or equal to the number
 */
export function ceil(number: number): number {
	return Math.ceil(number);
}

/**
 * Returns the largest integer less than or equal to a number
 * @param {number} number - The number to round down
 * @returns {number} The largest integer less than or equal to the number
 */
export function floor(number: number): number {
	return Math.floor(number);
}

/**
 * Returns the remainder of dividing `dividend` by `divisor`
 * @param {number} dividend - The number to be divided
 * @param {number} divisor - The number to divide by
 * @returns {number} The remainder of the division of `dividend` by `divisor`
 */
export function modulo(dividend: number, divisor: number): number {
	return dividend % divisor;
}

/**
 * Generates a random number between two specified numbers
 * @param {number} minimum - The minimum number of the range
 * @param {number} maximum - The maximum number of the range
 * @returns {number} The generated random number
 */
export function randomBetween(minimum: number, maximum: number): number {
	return Math.random() * (maximum - minimum) + minimum;
}

/**
 * Returns a random integer between `minimum` and `maximum`, inclusive
 * @param {number} minimum - The minimum value for the random integer
 * @param {number} maximum - The maximum value for the random integer
 * @returns {number} A random integer between `min` and `max`, inclusive
 */
export function randomIntBetween(minimum: number, maximum: number): number {
	return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

/**
 * Converts degrees to radians
 * @param {number} degrees - The number of degrees to convert to radians
 * @returns {number} The equivalent number in radians
 */
export function toRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees
 * @param {number} radians - The value in radians to be converted to degrees
 * @returns {number} The equivalent degrees value of the given radians
 */
export function toDegrees(radians: number): number {
	return (radians * 180) / Math.PI;
}
