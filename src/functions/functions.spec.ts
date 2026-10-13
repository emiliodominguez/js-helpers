import * as helpers from '.';

describe('Functions helpers', function () {
	afterEach(function () {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('bind', function () {
		it('should bind a function to a specified this value', function () {
			const testObject = { name: 'John Doe' };

			function fn(this: { name: string }, suffix = ''): string {
				return this.name + suffix;
			}

			const boundFn = helpers.bind(fn, testObject);

			expect(boundFn()).toBe('John Doe');
			expect(boundFn('!')).toBe('John Doe!');
		});

		it('should ignore the call-site this', function () {
			const target = { v: 1 };
			const other = {
				v: 2,
				get: helpers.bind(function (this: { v: number }) {
					return this.v;
				}, target)
			};
			expect(other.get()).toBe(1);
		});

		it('should throw a TypeError for non-functions', function () {
			expect(function () {
				helpers.bind(42 as any, {});
			}).toThrow(TypeError);
		});
	});

	describe('partial', function () {
		it('should partially apply arguments to a function', function () {
			function add(a: number, b: number): number {
				return a + b;
			}

			const partiallyAppliedAdd = helpers.partial(add, 1);
			expect(partiallyAppliedAdd(2)).toEqual(3);
		});

		it('should partially apply a function multiple times', function () {
			function add(a: number, b: number, c: number): number {
				return a + b + c;
			}

			const partiallyAppliedAdd1 = helpers.partial(add, 1);
			const partiallyAppliedAdd2 = helpers.partial(partiallyAppliedAdd1, 2);
			expect(partiallyAppliedAdd2(3)).toEqual(6);
		});

		it('should work with no pre-applied arguments and preserve this', function () {
			const obj = {
				base: 10,
				add: helpers.partial(
					function (this: { base: number }, a: number, b: number): number {
						return this.base + a + b;
					} as (a: number, b: number) => number,
					1
				)
			};
			expect(obj.add(2)).toBe(13);
			expect(helpers.partial(Math.max)(1, 3, 2)).toBe(3);
		});

		it('should throw a TypeError for non-functions', function () {
			expect(function () {
				helpers.partial(null as any);
			}).toThrow(TypeError);
		});
	});

	describe('curry', function () {
		function add3(a: number, b: number, c: number): number {
			return a + b + c;
		}

		it('should curry a function', function () {
			const curriedFn = helpers.curry(add3);
			expect(curriedFn(1)(2)(3)).toBe(6);
			expect(curriedFn(1, 2)(3)).toBe(6);
			expect(curriedFn(1)(2, 3)).toBe(6);
			expect(curriedFn(1, 2, 3)).toBe(6);
		});

		it('should allow reusing intermediate steps', function () {
			const add1 = helpers.curry(add3)(1);
			expect(add1(2)(3)).toBe(6);
			expect(add1(10, 20)).toBe(31);
		});

		it('should invoke a zero-arity function on the first call', function () {
			const fn = jest.fn(function () {
				return 'done';
			});
			expect(helpers.curry(fn as () => string)()).toBe('done');
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should return the same step when called with no arguments', function () {
			const curried: any = helpers.curry(add3);
			expect(curried()(1)()(2, 3)).toBe(6);
		});

		it('should honour an explicit arity for rest and default parameters', function () {
			function sum(...nums: number[]): number {
				return nums.reduce(function (a, b) {
					return a + b;
				}, 0);
			}

			expect(sum.length).toBe(0);
			expect(helpers.curry<[number, number, number], number>(sum, 3)(1)(2)(3)).toBe(6);

			function withDefault(a: number, b = 5): number {
				return a + b;
			}

			expect(helpers.curry(withDefault)(1)).toBe(6);
			expect(helpers.curry<[number, number], number>(withDefault, 2)(1)(2)).toBe(3);
		});

		it('should forward extra arguments of the final call', function () {
			const fn = jest.fn(function (a: number, b: number) {
				return a + b;
			});
			(helpers.curry(fn) as any)(1)(2, 3);
			expect(fn).toHaveBeenCalledWith(1, 2, 3);
		});

		it('should preserve this of the final call', function () {
			const obj = {
				factor: 3,
				mul: helpers.curry(function (this: { factor: number }, a: number, b: number): number {
					return this.factor * a * b;
				} as (a: number, b: number) => number)
			};
			expect(obj.mul(2, 5)).toBe(30);
		});

		it('should throw a RangeError for invalid arity', function () {
			expect(function () {
				helpers.curry(add3, -1);
			}).toThrow(RangeError);
			expect(function () {
				helpers.curry(add3, 1.5);
			}).toThrow(RangeError);
			expect(function () {
				helpers.curry(add3, NaN);
			}).toThrow(RangeError);
		});

		it('should throw a TypeError for non-functions', function () {
			expect(function () {
				helpers.curry('nope' as any);
			}).toThrow(TypeError);
		});
	});

	describe('compose', function () {
		function add(a: number, b: number): number {
			return a + b;
		}

		function square(x: number): number {
			return x * x;
		}

		function toStr(x: number): string {
			return `#${x}`;
		}

		it('should compose multiple functions into a single function', function () {
			const composedFn = helpers.compose(square, add);
			expect(composedFn(1, 2)).toBe(9);
		});

		it('should apply functions from right to left', function () {
			const fn = helpers.compose(toStr, square, add);
			const result: string = fn(1, 2);
			expect(result).toBe('#9');
		});

		it('should return the identity for zero functions (previously threw a TypeError)', function () {
			expect(helpers.compose()(5)).toBe(5);
			const obj = { a: 1 };
			expect(helpers.compose()(obj)).toBe(obj);
		});

		it('should return an equivalent function for a single function', function () {
			expect(helpers.compose(add)(2, 3)).toBe(5);
		});

		it('should support many functions via the generic overload', function () {
			function inc(x: number): number {
				return x + 1;
			}

			const fns = [inc, inc, inc, inc, inc, inc, inc, inc];
			expect(helpers.compose<number>(...fns)(0)).toBe(8);
			expect(helpers.compose(inc, inc, inc, inc, inc, inc)(0)).toBe(6);
			expect(helpers.compose(inc, inc, inc, inc, inc)(0)).toBe(5);
			expect(helpers.compose(inc, inc, inc, inc)(0)).toBe(4);
		});

		it('should forward this to every function', function () {
			const seen: unknown[] = [];

			function record(this: unknown, x: number): number {
				seen.push(this);
				return x;
			}

			const obj = { run: helpers.compose(record, record) };
			obj.run(1);
			expect(seen).toEqual([obj, obj]);
		});

		it('should throw a TypeError for non-function arguments', function () {
			expect(function () {
				helpers.compose(square, 1 as any);
			}).toThrow(TypeError);
		});
	});

	describe('pipe', function () {
		function inc(x: number): number {
			return x + 1;
		}

		function double(x: number): number {
			return x * 2;
		}

		it('should apply functions from left to right', function () {
			expect(helpers.pipe(double, inc)(3)).toBe(7);
			expect(helpers.compose(double, inc)(3)).toBe(8);
		});

		it('should support all typed arities', function () {
			expect(helpers.pipe(inc)(0)).toBe(1);
			expect(helpers.pipe(inc, inc, inc)(0)).toBe(3);
			expect(helpers.pipe(inc, inc, inc, inc)(0)).toBe(4);
			expect(helpers.pipe(inc, inc, inc, inc, inc)(0)).toBe(5);
			expect(helpers.pipe(inc, inc, inc, inc, inc, inc)(0)).toBe(6);
			expect(helpers.pipe<number>(inc, inc, inc, inc, inc, inc, inc)(0)).toBe(7);
			expect(helpers.compose(inc, inc, inc)(0)).toBe(3);
		});

		it('should be the identity for zero functions', function () {
			expect(helpers.pipe()('x')).toBe('x');
		});

		it('should pass every argument to the first function', function () {
			expect(
				helpers.pipe(
					function (a: string, b: string) {
						return a + b;
					},
					String.prototype.toUpperCase.call.bind(String.prototype.toUpperCase) as (s: string) => string
				)('a', 'b')
			).toBe('AB');
		});
	});

	describe('memoize', function () {
		it('should memoize a function', function () {
			const fn = jest.fn(function (a: number, b: number): number {
				return a + b;
			});
			const memoizedFn = helpers.memoize(fn);
			expect(memoizedFn(1, 2)).toBe(3);
			expect(memoizedFn(1, 2)).toBe(3);
			expect(fn).toHaveBeenCalledTimes(1);
			expect(memoizedFn(2, 1)).toBe(3);
			expect(fn).toHaveBeenCalledTimes(2);
		});

		it.each([0, '', false, null, undefined, NaN])('should cache the falsy result %p (previously recomputed)', function (value) {
			const fn = jest.fn(function () {
				return value;
			});
			const memoized = helpers.memoize(fn as (x: number) => unknown);
			expect(memoized(1)).toBe(value);
			expect(memoized(1)).toBe(value);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should distinguish 1 and "1", undefined and null, and handle NaN', function () {
			const fn = jest.fn(function (x: unknown) {
				return typeof x;
			});
			const memoized = helpers.memoize(fn);
			expect(memoized(1)).toBe('number');
			expect(memoized('1')).toBe('string');
			expect(memoized(undefined)).toBe('undefined');
			expect(memoized(null)).toBe('object');
			expect(memoized(NaN)).toBe('number');
			expect(memoized(NaN)).toBe('number');
			expect(fn).toHaveBeenCalledTimes(5);
			expect(memoized.cache.size).toBe(5);
		});

		it('should not confuse a single "[...]" string argument with an argument list', function () {
			const fn = jest.fn(function (...args: unknown[]) {
				return args.length;
			});
			const memoized = helpers.memoize(fn);
			expect(memoized('a', 'b')).toBe(2);
			expect(memoized('["a","b"]')).toBe(1);
		});

		it('should serialise object arguments structurally', function () {
			const fn = jest.fn(function (o: { a: number }) {
				return o.a;
			});
			const memoized = helpers.memoize(fn);
			expect(memoized({ a: 1 })).toBe(1);
			expect(memoized({ a: 1 })).toBe(1);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should expose the cache and clear()', function () {
			const fn = jest.fn(function (x: number) {
				return x * 2;
			});
			const memoized = helpers.memoize(fn);
			memoized(2);
			expect(memoized.cache.get(2)).toBe(4);
			memoized.clear();
			expect(memoized.cache.size).toBe(0);
			memoized(2);
			expect(fn).toHaveBeenCalledTimes(2);
		});

		it('should use a custom resolver and cache', function () {
			const cache = new Map<unknown, number>();
			const fn = jest.fn(function (a: number, _b: number) {
				return a;
			});
			const memoized = helpers.memoize(fn, {
				cache,
				resolver: function (a: number) {
					return a;
				}
			});
			expect(memoized(1, 2)).toBe(1);
			expect(memoized(1, 3)).toBe(1);
			expect(fn).toHaveBeenCalledTimes(1);
			expect(memoized.cache).toBe(cache);
		});

		it('should preserve this', function () {
			const obj = {
				base: 5,
				get: helpers.memoize(function (this: { base: number }, x: number): number {
					return this.base + x;
				})
			};
			expect(obj.get(1)).toBe(6);
		});

		it('should throw a TypeError for non-functions', function () {
			expect(function () {
				helpers.memoize({} as any);
			}).toThrow(TypeError);
			expect(function () {
				helpers.memoize(helpers.identity, { resolver: 1 as any });
			}).toThrow(TypeError);
		});
	});

	describe('defaultMemoizeKey', function () {
		it('should use a single primitive as is', function () {
			const sym = Symbol('s');
			expect(helpers.defaultMemoizeKey(1)).toBe(1);
			expect(helpers.defaultMemoizeKey('a')).toBe('a');
			expect(helpers.defaultMemoizeKey(sym)).toBe(sym);
			expect(helpers.defaultMemoizeKey(undefined)).toBeUndefined();
			expect(helpers.defaultMemoizeKey(null)).toBeNull();
			expect(helpers.defaultMemoizeKey(10n)).toBe(10n);
		});

		it('should serialise everything else', function () {
			expect(helpers.defaultMemoizeKey()).toBe('[]');
			expect(helpers.defaultMemoizeKey('a', 2)).toBe('["a",2]');
			expect(helpers.defaultMemoizeKey({ a: 1 })).toBe('[{"a":1}]');
			expect(helpers.defaultMemoizeKey('[x')).toBe('["[x"]');
			expect(helpers.defaultMemoizeKey(1n, 2)).toBe('["1n",2]');
		});

		it('should throw a TypeError on circular structures', function () {
			const circular: Record<string, unknown> = {};
			circular.self = circular;
			expect(function () {
				helpers.defaultMemoizeKey(circular);
			}).toThrow(TypeError);
		});
	});

	describe('throttle', function () {
		it('should throttle a function', function () {
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
		});

		it('should work when the clock reads 0 (previously every call went through)', function () {
			jest.useFakeTimers({ now: 0 });

			const fn = jest.fn();
			const throttled = helpers.throttle(fn, 100);
			throttled();
			throttled();
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should return the latest result and preserve this', function () {
			jest.useFakeTimers();

			const obj = {
				n: 0,
				tick: helpers.throttle(function (this: { n: number }, by: number): number {
					this.n += by;
					return this.n;
				}, 50)
			};
			expect(obj.tick(2)).toBe(2);
			expect(obj.tick(5)).toBe(2);
			expect(obj.n).toBe(2);
		});

		it('should invoke on the trailing edge with the latest args', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const throttled = helpers.throttle(fn, 100, { trailing: true });

			throttled(1);
			throttled(2);
			throttled(3);
			expect(fn.mock.calls).toEqual([[1]]);

			jest.advanceTimersByTime(100);
			expect(fn.mock.calls).toEqual([[1], [3]]);

			// A new window started with the trailing call.
			throttled(4);
			expect(fn).toHaveBeenCalledTimes(2);
			jest.advanceTimersByTime(100);
			expect(fn.mock.calls).toEqual([[1], [3], [4]]);

			jest.advanceTimersByTime(500);
			throttled(5);
			expect(fn.mock.calls).toEqual([[1], [3], [4], [5]]);
		});

		it('should support trailing-only mode', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const throttled = helpers.throttle(fn, 100, { leading: false, trailing: true });
			const ctx = { throttled };

			ctx.throttled(1);
			ctx.throttled(2);
			expect(fn).not.toHaveBeenCalled();

			jest.advanceTimersByTime(100);
			expect(fn.mock.calls).toEqual([[2]]);
			expect(fn.mock.contexts[0]).toBe(ctx);
		});

		it('should drop a late pending call when a new window starts', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const throttled = helpers.throttle(fn, 100, { trailing: true });
			throttled(1);
			throttled(2);
			// Simulate a delayed timer: move the clock without running timers.
			jest.setSystemTime(Date.now() + 150);
			throttled(3);
			expect(fn.mock.calls).toEqual([[1], [3]]);
			jest.runAllTimers();
			expect(fn.mock.calls).toEqual([[1], [3]]);
		});

		it('should cancel pending calls and reset the window', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const throttled = helpers.throttle(fn, 100, { trailing: true });
			throttled(1);
			throttled(2);
			throttled.cancel();
			jest.advanceTimersByTime(200);
			expect(fn.mock.calls).toEqual([[1]]);

			throttled(3);
			throttled.cancel();
			throttled(4);
			expect(fn.mock.calls).toEqual([[1], [3], [4]]);
			throttled.cancel();
		});

		it('should always invoke with a zero wait', function () {
			const fn = jest.fn();
			const throttled = helpers.throttle(fn, 0);
			throttled();
			throttled();
			expect(fn).toHaveBeenCalledTimes(2);
		});

		it('should validate its arguments', function () {
			expect(function () {
				helpers.throttle(helpers.noop, -1);
			}).toThrow(RangeError);
			expect(function () {
				helpers.throttle(helpers.noop, NaN);
			}).toThrow(RangeError);
			expect(function () {
				helpers.throttle(helpers.noop, Infinity);
			}).toThrow(RangeError);
			expect(function () {
				helpers.throttle(helpers.noop, 10, { leading: false });
			}).toThrow(TypeError);
			expect(function () {
				helpers.throttle(undefined as any, 10);
			}).toThrow(TypeError);
		});
	});

	describe('debounce', function () {
		it('should debounce a function', function () {
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
		});

		it('should call the latest invocation of the debounced function', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const debouncedFn = helpers.debounce(fn, 1000);

			debouncedFn(1);
			debouncedFn(2);
			debouncedFn(3);

			jest.advanceTimersByTime(1000);
			expect(fn).toHaveBeenCalledWith(3);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should restart the quiet period on every call', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const debounced = helpers.debounce(fn, 100);
			debounced(1);
			jest.advanceTimersByTime(60);
			debounced(2);
			jest.advanceTimersByTime(60);
			expect(fn).not.toHaveBeenCalled();
			jest.advanceTimersByTime(40);
			expect(fn.mock.calls).toEqual([[2]]);
		});

		it('should preserve this of the latest call', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const debounced = helpers.debounce(fn, 10);
			const a = { debounced };
			const b = { debounced };
			a.debounced();
			b.debounced();
			jest.advanceTimersByTime(10);
			expect(fn.mock.contexts).toEqual([b]);
		});

		it('should support leading invocation', function () {
			jest.useFakeTimers();

			const fn = jest.fn(function (x: number) {
				return x * 10;
			});
			const debounced = helpers.debounce(fn, 100, { leading: true });
			expect(debounced(1)).toBe(10);
			expect(debounced(2)).toBe(10);
			jest.advanceTimersByTime(100);
			expect(fn.mock.calls).toEqual([[1], [2]]);

			jest.advanceTimersByTime(100);
			expect(debounced(3)).toBe(30);
		});

		it('should not invoke on the trailing edge after a single leading call', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const debounced = helpers.debounce(fn, 100, { leading: true });
			debounced(1);
			expect(debounced.pending()).toBe(false);
			jest.advanceTimersByTime(200);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should support leading-only mode', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const debounced = helpers.debounce(fn, 100, { leading: true, trailing: false });
			debounced(1);
			debounced(2);
			expect(debounced.pending()).toBe(false);
			jest.advanceTimersByTime(100);
			expect(fn.mock.calls).toEqual([[1]]);
		});

		it('should honour maxWait during continuous calls', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const debounced = helpers.debounce(fn, 100, { maxWait: 250 });

			for (let t = 0; t < 600; t += 50) {
				debounced(t);
				jest.advanceTimersByTime(50);
			}

			expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
			jest.advanceTimersByTime(100);
			expect(fn.mock.calls[fn.mock.calls.length - 1]).toEqual([550]);
		});

		it('should invoke at maxWait when calls keep coming exactly at that boundary', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const debounced = helpers.debounce(fn, 100, { maxWait: 100 });
			debounced(1);
			jest.advanceTimersByTime(99);
			debounced(2);
			jest.setSystemTime(Date.now() + 1);
			debounced(3);
			expect(fn.mock.calls).toEqual([[3]]);
		});

		it('should clamp maxWait to at least wait', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const debounced = helpers.debounce(fn, 100, { maxWait: 10 });
			debounced(1);
			jest.advanceTimersByTime(50);
			expect(fn).not.toHaveBeenCalled();
			jest.advanceTimersByTime(50);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should cancel a pending call', function () {
			jest.useFakeTimers();

			const fn = jest.fn();
			const debounced = helpers.debounce(fn, 100);
			debounced();
			expect(debounced.pending()).toBe(true);
			debounced.cancel();
			expect(debounced.pending()).toBe(false);
			jest.advanceTimersByTime(200);
			expect(fn).not.toHaveBeenCalled();
			debounced.cancel();
		});

		it('should flush a pending call immediately and return its result', function () {
			jest.useFakeTimers();

			const fn = jest.fn(function (x: number) {
				return x + 1;
			});
			const debounced = helpers.debounce(fn, 100);
			expect(debounced.flush()).toBeUndefined();
			debounced(1);
			expect(debounced.flush()).toBe(2);
			expect(debounced.pending()).toBe(false);
			expect(debounced.flush()).toBe(2);
			jest.advanceTimersByTime(200);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should not invoke on flush when only the leading call happened', function () {
			jest.useFakeTimers();

			const fn = jest.fn(function () {
				return 'r';
			});
			const debounced = helpers.debounce(fn, 100, { leading: true });
			debounced();
			expect(debounced.flush()).toBe('r');
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should treat a clock going backwards as a new burst', function () {
			jest.useFakeTimers({ now: 1000 });

			const fn = jest.fn();
			const debounced = helpers.debounce(fn, 100, { leading: true });
			debounced(1);
			jest.setSystemTime(500);
			debounced(2);
			expect(fn.mock.calls).toEqual([[1]]);
			jest.advanceTimersByTime(100);
			expect(fn.mock.calls).toEqual([[1], [2]]);
		});

		it('should validate its arguments', function () {
			expect(function () {
				helpers.debounce(helpers.noop, -5);
			}).toThrow(RangeError);
			expect(function () {
				helpers.debounce(helpers.noop, 5, { maxWait: NaN });
			}).toThrow(RangeError);
			expect(function () {
				helpers.debounce(helpers.noop, 5, { trailing: false });
			}).toThrow(TypeError);
			expect(function () {
				helpers.debounce('x' as any, 5);
			}).toThrow(TypeError);
		});
	});

	describe('once', function () {
		it('should invoke the function only once and cache the result', function () {
			const fn = jest.fn(function (x: number) {
				return x * 2;
			});
			const onced = helpers.once(fn);
			expect(onced(2)).toBe(4);
			expect(onced(5)).toBe(4);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should preserve this', function () {
			const obj = {
				v: 7,
				get: helpers.once(function (this: { v: number }) {
					return this.v;
				})
			};
			expect(obj.get()).toBe(7);
		});

		it('should rethrow the first error on later calls', function () {
			const error = new Error('boom');
			const fn = jest.fn(function () {
				throw error;
			});
			const onced = helpers.once(fn);
			expect(onced).toThrow(error);
			expect(onced).toThrow(error);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should throw a TypeError for non-functions', function () {
			expect(function () {
				helpers.once(1 as any);
			}).toThrow(TypeError);
		});
	});

	describe('before', function () {
		it('should invoke the function while called fewer than n times', function () {
			const fn = jest.fn(function (x: number) {
				return x * 2;
			});
			const limited = helpers.before(3, fn);
			expect([limited(1), limited(2), limited(3), limited(4)]).toEqual([2, 4, 4, 4]);
			expect(fn).toHaveBeenCalledTimes(2);
		});

		it('should never invoke for n <= 1', function () {
			const fn = jest.fn();
			helpers.before(0, fn)();
			helpers.before(1, fn)();
			expect(fn).not.toHaveBeenCalled();
		});

		it('should validate its arguments', function () {
			expect(function () {
				helpers.before(-1, helpers.noop);
			}).toThrow(RangeError);
			expect(function () {
				helpers.before(1, null as any);
			}).toThrow(TypeError);
		});
	});

	describe('after', function () {
		it('should invoke the function from the n-th call on', function () {
			const fn = jest.fn(function () {
				return 'ok';
			});
			const done = helpers.after(2, fn);
			expect(done()).toBeUndefined();
			expect(done()).toBe('ok');
			expect(done()).toBe('ok');
			expect(fn).toHaveBeenCalledTimes(2);
		});

		it('should invoke immediately for n = 0 and preserve this', function () {
			const obj = {
				v: 1,
				f: helpers.after(0, function (this: { v: number }) {
					return this.v;
				})
			};
			expect(obj.f()).toBe(1);
		});

		it('should validate its arguments', function () {
			expect(function () {
				helpers.after(1.5, helpers.noop);
			}).toThrow(RangeError);
			expect(function () {
				helpers.after(1, {} as any);
			}).toThrow(TypeError);
		});
	});

	describe('negate', function () {
		it('should negate a predicate', function () {
			const isOdd = helpers.negate(function (n: number) {
				return n % 2 === 0;
			});
			expect([1, 2, 3, 4].filter(isOdd)).toEqual([1, 3]);
		});

		it('should coerce truthy/falsy results to booleans and preserve this', function () {
			const obj = {
				items: ['a'],
				isMissing: helpers.negate(function (this: { items: string[] }, x: string) {
					return this.items.indexOf(x) + 1;
				})
			};
			expect(obj.isMissing('a')).toBe(false);
			expect(obj.isMissing('b')).toBe(true);
		});

		it('should throw a TypeError for non-functions', function () {
			expect(function () {
				helpers.negate(true as any);
			}).toThrow(TypeError);
		});
	});

	describe('identity', function () {
		it('should return its argument', function () {
			const obj = {};
			expect(helpers.identity(obj)).toBe(obj);
			expect(helpers.identity(NaN)).toBeNaN();
			expect([1, 0, 2, '', 3].filter(helpers.identity)).toEqual([1, 2, 3]);
		});
	});

	describe('noop', function () {
		it('should return undefined', function () {
			expect(helpers.noop()).toBeUndefined();
			expect(helpers.noop(1, 2, 3)).toBeUndefined();
		});
	});
});
