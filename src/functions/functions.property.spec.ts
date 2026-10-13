import fc from 'fast-check';
import { compose, curry, debounce, memoize, negate, once, partial, pipe } from '.';

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
});
