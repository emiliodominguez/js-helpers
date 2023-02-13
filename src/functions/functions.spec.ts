/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable func-style */
import * as helpers from '.';

describe('Functions helpers', () => {
	describe('bind', () => {
		it('should bind a function to a specified this value', () => {
			const testObject = { name: 'John Doe' };

			// eslint-disable-next-line require-jsdoc
			function fn(): string {
				// @ts-ignore
				return this.name;
			}

			const boundFn = helpers.bind(fn, testObject);

			expect(boundFn()).toBe('John Doe');
		});
	});

	describe('curry', () => {
		it('should curry a function', () => {
			const fn = (a: number, b: number, c: number): number => a + b + c;
			const curriedFn = helpers.curry(fn);
			expect(curriedFn(1)(2)(3)).toBe(6);
			expect(curriedFn(1, 2)(3)).toBe(6);
			expect(curriedFn(1)(2, 3)).toBe(6);
			expect(curriedFn(1, 2, 3)).toBe(6);
		});
	});

	describe('compose', () => {
		it('should compose multiple functions into a single function', () => {
			const add = (a: number, b: number): number => a + b;
			const square = (x: number) => x * x;
			const composedFn = helpers.compose(square, add);
			expect(composedFn(1, 2)).toBe(9);
		});
	});

	describe('memoize', () => {
		it('should memoize a function', () => {
			const fn = jest.fn((a: number, b: number): number => a + b);
			const memoizedFn = helpers.memoize(fn);
			expect(memoizedFn(1, 2)).toBe(3);
			expect(memoizedFn(1, 2)).toBe(3);
			expect(fn).toHaveBeenCalledTimes(1);
		});
	});

	describe('throttle', () => {
		it('should throttle a function', () => {
			jest.useFakeTimers();

			const fn = jest.fn();
			const throttledFn = helpers.throttle(fn, 1000);

			throttledFn();
			throttledFn();
			throttledFn();

			expect(fn).toHaveBeenCalledTimes(1);
			jest.advanceTimersByTime(1000);

			throttledFn();
			throttledFn();

			expect(fn).toHaveBeenCalledTimes(2);

			jest.clearAllTimers();
		});
	});

	describe('debounce', () => {
		it('should debounce a function', () => {
			jest.useFakeTimers();

			const fn = jest.fn();
			const debouncedFn = helpers.debounce(fn, 1000);

			debouncedFn();
			debouncedFn();
			debouncedFn();

			expect(fn).toHaveBeenCalledTimes(0);

			jest.advanceTimersByTime(900);
			expect(fn).toHaveBeenCalledTimes(0);

			jest.advanceTimersByTime(200);
			expect(fn).toHaveBeenCalledTimes(1);

			jest.clearAllTimers();
		});

		it('should call the latest invocation of the debounced function', () => {
			jest.useFakeTimers();

			const fn = jest.fn();
			const debouncedFn = helpers.debounce(fn, 1000);

			debouncedFn(1);
			debouncedFn(2);
			debouncedFn(3);

			jest.advanceTimersByTime(1000);
			expect(fn).toHaveBeenCalledWith(3);

			jest.clearAllTimers();
		});
	});

	describe('partial', () => {
		it('should partially apply arguments to a function', () => {
			const add = (a: number, b: number): number => a + b;
			const partiallyAppliedAdd = helpers.partial(add, 1);
			expect(partiallyAppliedAdd(2)).toEqual(3);
		});

		it('should partially apply a function multiple times', () => {
			const add = (a: number, b: number, c: number): number => a + b + c;
			const partiallyAppliedAdd1 = helpers.partial(add, 1);
			const partiallyAppliedAdd2 = helpers.partial(partiallyAppliedAdd1, 2);
			expect(partiallyAppliedAdd2(3)).toEqual(6);
		});
	});
});
