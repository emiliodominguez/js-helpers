import * as helpers from '.';

describe('Math helpers', () => {
	describe('sum', () => {
		it('should calculate the sum of an array of numbers', () => {
			expect(helpers.sum([1, 2, 3, 4])).toEqual(10);
			expect(helpers.sum([-1, -2, -3, -4])).toEqual(-10);
			expect(helpers.sum([0, 0, 0, 0])).toEqual(0);
		});
	});

	describe('round', () => {
		it('should round a number to a specified number of decimal places', () => {
			expect(helpers.round(1.2345, 2)).toEqual(1.23);
			expect(helpers.round(1.2355, 2)).toEqual(1.24);
			expect(helpers.round(-1.2345, 2)).toEqual(-1.23);
		});
	});

	describe('average', () => {
		it('should calculate the average of an array of numbers', () => {
			expect(helpers.average([1, 2, 3, 4])).toEqual(2.5);
			expect(helpers.average([-1, -2, -3, -4])).toEqual(-2.5);
			expect(helpers.average([0, 0, 0, 0])).toEqual(0);
		});
	});

	describe('factorial', () => {
		it('should calculate the factorial of a number', () => {
			expect(helpers.factorial(0)).toEqual(1);
			expect(helpers.factorial(1)).toEqual(1);
			expect(helpers.factorial(2)).toEqual(2);
			expect(helpers.factorial(3)).toEqual(6);
			expect(helpers.factorial(4)).toEqual(24);
		});
	});

	describe('max', () => {
		it('should return the maximum value in an array of numbers', () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = helpers.max(numbers);
			expect(result).toEqual(5);
		});
	});

	describe('min', () => {
		it('should return the minimum value in an array of numbers', () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = helpers.min(numbers);
			expect(result).toEqual(1);
		});
	});

	describe('abs', () => {
		it('should return the absolute value of a number', () => {
			const number = -10;
			const result = helpers.abs(number);
			expect(result).toEqual(10);
		});
	});

	describe('sqrt', () => {
		it('should return the square root of a number', () => {
			const number = 9;
			const result = helpers.sqrt(number);
			expect(result).toEqual(3);
		});
	});

	describe('pow', () => {
		it('should return the value of a number raised to an exponent', () => {
			const base = 2;
			const exponent = 3;
			const result = helpers.pow(base, exponent);
			expect(result).toEqual(8);
		});
	});

	describe('log', () => {
		it('should return the logarithm of a number with the specified base', () => {
			expect(helpers.log(16, 2)).toEqual(4);
			expect(helpers.log(100, 10)).toEqual(2);
		});
	});

	describe('ceil', () => {
		it('should return the smallest integer greater than or equal to a number', () => {
			expect(helpers.ceil(3.14)).toEqual(4);
			expect(helpers.ceil(-2.9)).toEqual(-2);
		});
	});

	describe('floor', () => {
		it('should return the largest integer less than or equal to a number', () => {
			expect(helpers.floor(3.14)).toEqual(3);
			expect(helpers.floor(-2.9)).toEqual(-3);
		});
	});

	describe('modulo', () => {
		it('should return the remainder of dividing `dividend` by `divisor`', () => {
			expect(helpers.modulo(7, 3)).toEqual(1);
			expect(helpers.modulo(10, 4)).toEqual(2);
		});
	});

	describe('randomBetween', () => {
		it('should generate a random number between two specified numbers', () => {
			const randomNum = helpers.randomBetween(1, 10);
			expect(randomNum).toBeGreaterThanOrEqual(1);
			expect(randomNum).toBeLessThanOrEqual(10);
		});
	});

	describe('randomIntBetween', () => {
		it('should return a random integer between `minimum` and `maximum`, inclusive', () => {
			const randomInt = helpers.randomIntBetween(1, 10);
			expect(randomInt).toBeGreaterThanOrEqual(1);
			expect(randomInt).toBeLessThanOrEqual(10);
		});
	});

	describe('toRadians', () => {
		it('should convert degrees to radians', () => {
			expect(helpers.toRadians(90)).toBeCloseTo(1.57, 0.5);
			expect(helpers.toRadians(180)).toBeCloseTo(3.14, 0.5);
		});
	});

	describe('toDegrees', () => {
		it('should convert radians to degrees', () => {
			expect(helpers.toDegrees(1.57)).toBeCloseTo(90, 0.5);
			expect(helpers.toDegrees(3.14)).toBeCloseTo(180, 0.5);
		});
	});
});
