import fc from 'fast-check';
import { mapWithConcurrency, retry } from '.';

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
});
