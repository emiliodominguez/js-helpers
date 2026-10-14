import fc from 'fast-check';
import { attempt, compose, curry, debounce, defaultMemoizeKey, flip, memoize, memoizeLast, negate, once, partial, pipe, times } from '.';

type IntFn = (x: number) => number;

function add1(x: number): number {
	return x + 1;
}

function double(x: number): number {
	return x * 2;
}

function neg(x: number): number {
	return -x;
}

function square(x: number): number {
	return x * x;
}

function sub3(x: number): number {
	return x - 3;
}

const intFn = fc.constantFrom<IntFn>(add1, double, neg, square, sub3);
const smallInt = fc.integer({ min: -1000, max: 1000 });

describe('Functions helpers (properties)', function () {
	describe('compose / pipe', function () {
		it('compose is associative', function () {
			fc.assert(
				fc.property(intFn, intFn, intFn, smallInt, function (f, g, h, x) {
					expect(compose(compose(f, g), h)(x)).toBe(compose(f, compose(g, h))(x));
				})
			);
		});

		it('pipe is associative', function () {
			fc.assert(
				fc.property(intFn, intFn, intFn, smallInt, function (f, g, h, x) {
					expect(pipe(pipe(f, g), h)(x)).toBe(pipe(f, pipe(g, h))(x));
				})
			);
		});

		it('the empty composition is a two-sided identity', function () {
			fc.assert(
				fc.property(intFn, smallInt, function (f, x) {
					expect(compose(compose(), f)(x)).toBe(f(x));
					expect(compose(f, compose())(x)).toBe(f(x));
					expect(pipe(pipe(), f)(x)).toBe(f(x));
					expect(compose()(x)).toBe(x);
				})
			);
		});

		it('compose(...fs) equals pipe(...fs.reverse()) and the naive right fold', function () {
			fc.assert(
				fc.property(fc.array(intFn, { maxLength: 8 }), smallInt, function (fs, x) {
					const expected = fs.reduceRight(function (acc, f) {
						return f(acc);
					}, x);
					expect(compose<number>(...fs)(x)).toBe(expected);
					expect(pipe<number>(...fs.slice().reverse())(x)).toBe(expected);
				})
			);
		});
	});

	describe('curry', function () {
		function f(a: number, b: number, c: number): number {
			return a * 100 + b * 10 - c;
		}

		it('any split of the arguments gives the same result as calling f', function () {
			fc.assert(
				fc.property(smallInt, smallInt, smallInt, fc.integer({ min: 1, max: 3 }), function (a, b, c, split) {
					const curried = curry(f);
					const expected = f(a, b, c);
					expect(curried(a)(b)(c)).toBe(expected);
					expect(curried(a, b)(c)).toBe(expected);
					expect(curried(a)(b, c)).toBe(expected);

					const args = [a, b, c];
					const first = args.slice(0, split);
					const rest = args.slice(split);
					const step = (curried as any)(...first);
					expect(rest.length === 0 ? step : step(...rest)).toBe(expected);
				})
			);
		});
	});

	describe('partial', function () {
		it('partial(f, ...a)(...b) equals f(...a, ...b)', function () {
			function f(...xs: number[]): string {
				return xs.join(',');
			}

			fc.assert(
				fc.property(fc.array(smallInt, { maxLength: 5 }), fc.array(smallInt, { maxLength: 5 }), function (a, b) {
					expect(partial(f, ...a)(...b)).toBe(f(...a, ...b));
				})
			);
		});
	});

	describe('memoize', function () {
		it('returns the same results as f and calls f once per distinct key', function () {
			fc.assert(
				fc.property(fc.array(fc.oneof(smallInt, fc.string({ maxLength: 3 }), fc.constantFrom(null, undefined, NaN, true)), { maxLength: 40 }), function (inputs) {
					const calls: unknown[] = [];
					function f(x: unknown): string {
						calls.push(x);
						return `${typeof x}:${String(x)}`;
					}

					const memoized = memoize(f);
					inputs.forEach(function (x) {
						expect(memoized(x)).toBe(f(x));
						calls.pop();
					});
					expect(calls.length).toBe(new Set(inputs).size);
				})
			);
		});

		it('caches multi-argument calls by structural key', function () {
			fc.assert(
				fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 })), { maxLength: 30 }), function (pairs) {
					const spy = jest.fn(function (a: number, b: number) {
						return a - b;
					});
					const memoized = memoize(spy);
					pairs.forEach(function ([a, b]) {
						expect(memoized(a, b)).toBe(a - b);
					});
					const distinct = new Set(
						pairs.map(function ([a, b]) {
							return `${a}|${b}`;
						})
					);
					expect(spy).toHaveBeenCalledTimes(distinct.size);
				})
			);
		});
	});

	describe('once', function () {
		it('calls f exactly once and always returns the first result', function () {
			fc.assert(
				fc.property(fc.array(smallInt, { minLength: 1, maxLength: 20 }), function (args) {
					const spy = jest.fn(square);
					const onced = once(spy);
					const results = args.map(function (x) {
						return onced(x);
					});
					expect(spy).toHaveBeenCalledTimes(1);
					expect(new Set(results)).toEqual(new Set([square(args[0])]));
				})
			);
		});
	});

	describe('negate', function () {
		it('negate(negate(p))(x) equals Boolean(p(x))', function () {
			const predicates = fc.constantFrom(
				function (x: number) {
					return x > 0;
				},
				function (x: number) {
					return x % 2 === 0;
				},
				function (x: number) {
					return x % 3;
				}
			);

			fc.assert(
				fc.property(predicates, smallInt, function (p, x) {
					expect(negate(negate(p))(x)).toBe(Boolean(p(x)));
					expect(negate(p)(x)).toBe(!p(x));
				})
			);
		});
	});

	describe('debounce', function () {
		afterEach(function () {
			jest.clearAllTimers();
			jest.useRealTimers();
		});

		it('calls fn once per quiet period, with the last args of each burst', function () {
			const wait = 100;

			fc.assert(
				fc.property(fc.array(fc.integer({ min: 0, max: 250 }), { minLength: 1, maxLength: 25 }), function (gaps) {
					jest.useFakeTimers();

					const spy = jest.fn();
					const debounced = debounce(spy, wait);
					const expected: number[] = [];

					gaps.forEach(function (gap, i) {
						if (i > 0) {
							jest.advanceTimersByTime(gap);
							// The previous call ended a burst if the gap was a full quiet period.
							if (gap >= wait) expected.push(i - 1);
						}
						debounced(i);
					});
					jest.advanceTimersByTime(wait);
					expected.push(gaps.length - 1);

					expect(
						spy.mock.calls.map(function (call) {
							return call[0];
						})
					).toEqual(expected);

					jest.useRealTimers();
				}),
				{ numRuns: 50 }
			);
		});
	});
	describe('defaultMemoizeKey', function () {
		it('maps distinct argument lists of primitives to distinct keys', function () {
			const primitive = fc.oneof(
				fc.integer({ min: -3, max: 3 }),
				fc.constantFrom(NaN, Infinity, -Infinity, -0, null, undefined, true, 'NaN', '-0', 'undefined', '1n', '\\1n', 'Infinity', '[1]'),
				fc.bigInt({ min: -3n, max: 3n }),
				fc.string({ maxLength: 3 })
			);

			fc.assert(
				fc.property(fc.array(primitive, { maxLength: 3 }), fc.array(primitive, { maxLength: 3 }), function (a, b) {
					const same =
						a.length === b.length &&
						a.every(function (value, i) {
							return Object.is(value, b[i]);
						});
					expect(Object.is(defaultMemoizeKey(...a), defaultMemoizeKey(...b))).toBe(same);
				})
			);
		});
	});

	describe('attempt', function () {
		it('never throws and matches a try/catch reference', function () {
			function risky(x: number): number {
				if (x % 3 === 0) throw new Error(`bad ${x}`);
				if (x % 5 === 0) throw x;
				return x * 2;
			}

			fc.assert(
				fc.property(smallInt, function (x) {
					let expected: unknown[];
					try {
						expected = [undefined, risky(x)];
					} catch (error) {
						expected = [error, undefined];
					}
					expect(attempt(risky, x)).toEqual(expected);
				})
			);
		});
	});

	describe('times', function () {
		it('returns n results, calling fn with 0..n-1 in order', function () {
			fc.assert(
				fc.property(fc.nat({ max: 200 }), function (n) {
					const seen: number[] = [];
					const result = times(n, function (i) {
						seen.push(i);
						return i * 3;
					});
					expect(result).toHaveLength(n);
					expect(seen).toEqual(
						Array.from({ length: n }, function (_, i) {
							return i;
						})
					);
					expect(result).toEqual(
						seen.map(function (i) {
							return i * 3;
						})
					);
				})
			);
		});
	});

	describe('flip', function () {
		it('flip(flip(f)) behaves like f, and flip(f) reverses the arguments', function () {
			function f(...xs: number[]): string {
				return xs.join(',');
			}

			fc.assert(
				fc.property(fc.array(smallInt, { maxLength: 6 }), function (args) {
					expect(flip(flip(f))(...args)).toBe(f(...args));
					expect(flip(f)(...args)).toBe(f(...args.slice().reverse()));
				})
			);
		});
	});

	describe('memoizeLast', function () {
		it('calls fn exactly when the arguments differ from the previous call', function () {
			fc.assert(
				fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 2 }), fc.constantFrom(NaN, 0, 1)), { maxLength: 40 }), function (calls) {
					const spy = jest.fn(function (a: number, b: number) {
						return a + b;
					});
					const memoized = memoizeLast(spy);
					let expectedCalls = 0;
					let previous: [number, number] | undefined;

					calls.forEach(function (pair) {
						if (previous === undefined || !(Object.is(previous[0], pair[0]) && Object.is(previous[1], pair[1]))) expectedCalls++;
						previous = pair;
						expect(memoized(pair[0], pair[1])).toBe(pair[0] + pair[1]);
					});
					expect(spy).toHaveBeenCalledTimes(expectedCalls);
				})
			);
		});
	});
});
