import fc from 'fast-check';
import { attemptAsync, createLimiter, debounceAsync, mapWithConcurrency, promiseAllObject, retry, sequence } from '.';

/**
 * Yields to the microtask queue `ticks` times (no timers involved).
 */
async function yieldTicks(ticks: number): Promise<void> {
	for (let i = 0; i < ticks; i++) await Promise.resolve();
}

describe('Async helpers (properties)', function () {
	describe('mapWithConcurrency', function () {
		it('equals items.map(f), in order, and never exceeds the concurrency limit', async function () {
			await fc.assert(
				fc.asyncProperty(
					fc.array(fc.record({ value: fc.integer({ min: -100, max: 100 }), ticks: fc.integer({ min: 0, max: 5 }) }), { maxLength: 30 }),
					fc.oneof(fc.integer({ min: 1, max: 8 }), fc.constant(Infinity)),
					async function (items, concurrency) {
						let inFlight = 0;
						let maxInFlight = 0;

						function f(item: { value: number }, index: number): string {
							return `${index}:${item.value * 2}`;
						}

						const result = await mapWithConcurrency(
							items,
							async function (item, index) {
								inFlight++;
								maxInFlight = Math.max(maxInFlight, inFlight);
								await yieldTicks(item.ticks);
								inFlight--;
								return f(item, index);
							},
							concurrency
						);

						expect(result).toEqual(items.map(f));
						expect(maxInFlight).toBeLessThanOrEqual(concurrency);
						expect(maxInFlight).toBe(Math.min(concurrency, items.length));
					}
				)
			);
		});
	});

	describe('retry', function () {
		it('succeeds iff the number of failures is <= retries, calling fn min(failures, retries) + 1 times', async function () {
			await fc.assert(
				fc.asyncProperty(fc.integer({ min: 0, max: 10 }), fc.integer({ min: 0, max: 10 }), async function (failures, retries) {
					let calls = 0;

					async function flaky(attempt: number): Promise<number> {
						calls++;
						if (attempt <= failures) throw new Error(`failure ${attempt}`);
						return attempt;
					}

					const outcome = await retry(flaky, { retries, delay: 0 }).then(
						function (value) {
							return { ok: true, value };
						},
						function (error: Error) {
							return { ok: false, value: error.message };
						}
					);

					if (failures <= retries) {
						expect(outcome).toEqual({ ok: true, value: failures + 1 });
					} else {
						expect(outcome).toEqual({ ok: false, value: `failure ${retries + 1}` });
					}
					expect(calls).toBe(Math.min(failures, retries) + 1);
				})
			);
		});
	});
	describe('attemptAsync', function () {
		it('never rejects and matches a try/catch reference', async function () {
			await fc.assert(
				fc.asyncProperty(fc.integer({ min: -50, max: 50 }), fc.boolean(), async function (x, sync) {
					function task(): Promise<number> | number {
						if (x % 4 === 0) {
							if (sync) throw new Error(`sync ${x}`);
							return Promise.reject(new Error(`async ${x}`));
						}
						return sync ? x : Promise.resolve(x);
					}

					let expected: unknown[];
					try {
						expected = [undefined, await task()];
					} catch (error) {
						expected = [error, undefined];
					}
					expect(await attemptAsync(task)).toEqual(expected);
				})
			);
		});
	});

	describe('createLimiter', function () {
		it('never exceeds the concurrency, starts tasks in FIFO order and resolves every task correctly', async function () {
			await fc.assert(
				fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 30 }), fc.integer({ min: 1, max: 6 }), async function (ticks, concurrency) {
					const limit = createLimiter(concurrency);
					const started: number[] = [];
					let maxActive = 0;

					const results = await Promise.all(
						ticks.map(function (tickCount, i) {
							return limit(async function () {
								started.push(i);
								maxActive = Math.max(maxActive, limit.activeCount);
								await yieldTicks(tickCount);
								return i * 2;
							});
						})
					);

					expect(results).toEqual(
						ticks.map(function (_, i) {
							return i * 2;
						})
					);
					expect(started).toEqual(
						ticks.map(function (_, i) {
							return i;
						})
					);
					expect(maxActive).toBeLessThanOrEqual(concurrency);
					expect(maxActive).toBe(Math.min(concurrency, ticks.length));
				})
			);
		});
	});

	describe('promiseAllObject', function () {
		it('equals awaiting each key separately', async function () {
			await fc.assert(
				fc.asyncProperty(fc.dictionary(fc.string({ maxLength: 5 }), fc.tuple(fc.integer(), fc.boolean())), async function (spec) {
					const input: Record<string, Promise<number> | number> = {};
					Object.keys(spec).forEach(function (key) {
						const [value, async] = spec[key];
						Object.defineProperty(input, key, { value: async ? Promise.resolve(value) : value, enumerable: true });
					});

					const result = await promiseAllObject(input);
					const expected: Record<string, number> = {};
					for (const key of Object.keys(input)) {
						Object.defineProperty(expected, key, { value: await input[key], enumerable: true, writable: true, configurable: true });
					}
					expect(Object.keys(result)).toEqual(Object.keys(input));
					expect(result).toEqual(expected);
				})
			);
		});
	});

	describe('debounceAsync', function () {
		afterEach(function () {
			jest.clearAllTimers();
			jest.useRealTimers();
		});

		it('invokes fn once per burst with the last args, and every caller of a burst gets that result', async function () {
			const wait = 100;

			await fc.assert(
				fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 250 }), { minLength: 1, maxLength: 20 }), async function (gaps) {
					jest.useFakeTimers();

					const spy = jest.fn(async function (i: number) {
						return `burst ending at ${i}`;
					});
					const debounced = debounceAsync(spy, wait);
					const promises: Array<Promise<string>> = [];
					const burstOf: number[] = [];
					const burstEnds: number[] = [];

					for (let i = 0; i < gaps.length; i++) {
						if (i > 0) {
							await jest.advanceTimersByTimeAsync(gaps[i]);
							if (gaps[i] >= wait) burstEnds.push(i - 1);
						}
						burstOf.push(burstEnds.length);
						promises.push(debounced(i));
					}
					await jest.advanceTimersByTimeAsync(wait);
					burstEnds.push(gaps.length - 1);

					const results = await Promise.all(promises);
					expect(
						spy.mock.calls.map(function (call) {
							return call[0];
						})
					).toEqual(burstEnds);
					expect(results).toEqual(
						burstOf.map(function (burst) {
							return `burst ending at ${burstEnds[burst]}`;
						})
					);

					jest.useRealTimers();
				}),
				{ numRuns: 40 }
			);
		});
	});

	describe('sequence', function () {
		it('runs tasks strictly one at a time and in order, returning results in order', async function () {
			await fc.assert(
				fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 4 }), { maxLength: 20 }), async function (ticks) {
					const events: string[] = [];
					let running = 0;
					let maxRunning = 0;

					const results = await sequence(
						ticks.map(function (tickCount, i) {
							return async function () {
								running++;
								maxRunning = Math.max(maxRunning, running);
								events.push(`start ${i}`);
								await yieldTicks(tickCount);
								events.push(`end ${i}`);
								running--;
								return i;
							};
						})
					);

					expect(results).toEqual(
						ticks.map(function (_, i) {
							return i;
						})
					);
					expect(events).toEqual(
						ticks.flatMap(function (_, i) {
							return [`start ${i}`, `end ${i}`];
						})
					);
					expect(maxRunning).toBeLessThanOrEqual(1);
				})
			);
		});
	});
});
