import { AbortError, createDeferred, mapWithConcurrency, retry, sleep, TimeoutError, withTimeout } from '.';
import type { AbortSignalLike } from '../utils/index.js';

/**
 * A promise state probe that does not depend on timers.
 */
async function stateOf(promise: Promise<unknown>): Promise<'pending' | 'fulfilled' | 'rejected'> {
	const marker = {};
	try {
		const winner = await Promise.race([promise, Promise.resolve(marker)]);
		return winner === marker ? 'pending' : 'fulfilled';
	} catch {
		return 'rejected';
	}
}

describe('Async helpers', function () {
	afterEach(function () {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('AbortError / TimeoutError', function () {
		it('should be proper Error subclasses with names and default messages', function () {
			const abort = new AbortError();
			const timeout = new TimeoutError('late');
			expect(abort).toBeInstanceOf(Error);
			expect(abort).toBeInstanceOf(AbortError);
			expect(abort.name).toBe('AbortError');
			expect(abort.message).toBe('The operation was aborted.');
			expect(timeout).toBeInstanceOf(TimeoutError);
			expect(timeout.name).toBe('TimeoutError');
			expect(timeout.message).toBe('late');
			expect(new TimeoutError().message).toBe('The operation timed out.');
		});
	});

	describe('createDeferred', function () {
		it('should resolve from the outside', async function () {
			const deferred = createDeferred<number>();
			expect(await stateOf(deferred.promise)).toBe('pending');
			deferred.resolve(42);
			await expect(deferred.promise).resolves.toBe(42);
		});

		it('should reject from the outside and ignore later settlements', async function () {
			const deferred = createDeferred<number>();
			const error = new Error('nope');
			deferred.reject(error);
			deferred.resolve(1);
			await expect(deferred.promise).rejects.toBe(error);
		});

		it('should adopt thenables', async function () {
			const deferred = createDeferred<string>();
			deferred.resolve(Promise.resolve('inner'));
			await expect(deferred.promise).resolves.toBe('inner');
		});
	});

	describe('sleep', function () {
		it('should resolve after the delay', async function () {
			jest.useFakeTimers();

			const promise = sleep(100);
			await jest.advanceTimersByTimeAsync(99);
			expect(await stateOf(promise)).toBe('pending');
			await jest.advanceTimersByTimeAsync(1);
			await expect(promise).resolves.toBeUndefined();
		});

		it('should resolve with real timers and a zero delay', async function () {
			await expect(sleep(0)).resolves.toBeUndefined();
		});

		it('should reject immediately with the reason of an already aborted signal', async function () {
			const controller = new AbortController();
			controller.abort(new Error('stop'));
			await expect(sleep(1000, { signal: controller.signal })).rejects.toThrow('stop');
		});

		it('should reject with the reason and clear the timer when aborted during the wait', async function () {
			jest.useFakeTimers();

			const controller = new AbortController();
			const promise = sleep(1000, { signal: controller.signal });
			expect(jest.getTimerCount()).toBe(1);
			controller.abort();
			await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
			expect(jest.getTimerCount()).toBe(0);
		});

		it('should use an AbortError when the signal has no reason', async function () {
			let listener: (() => void) | undefined;
			const signal = {
				aborted: false,
				addEventListener: jest.fn(function (_type: 'abort', fn: () => void) {
					listener = fn;
				}),
				removeEventListener: jest.fn()
			};
			const promise = sleep(1000, { signal });
			signal.aborted = true;
			(listener as () => void)();
			await expect(promise).rejects.toBeInstanceOf(AbortError);

			const preAborted: AbortSignalLike = { aborted: true, addEventListener: jest.fn(), removeEventListener: jest.fn() };
			await expect(sleep(1, { signal: preAborted })).rejects.toBeInstanceOf(AbortError);
		});

		it('should remove the abort listener once resolved', async function () {
			jest.useFakeTimers();

			const signal = { aborted: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
			const promise = sleep(10, { signal });
			await jest.advanceTimersByTimeAsync(10);
			await promise;
			expect(signal.removeEventListener).toHaveBeenCalledWith('abort', signal.addEventListener.mock.calls[0][1]);
		});

		it.each([-1, NaN, Infinity, 2 ** 31])('should reject with a RangeError for ms = %p', async function (ms) {
			await expect(sleep(ms)).rejects.toThrow(RangeError);
		});
	});

	describe('withTimeout', function () {
		it('should resolve with the value when the promise settles in time and clear the timer', async function () {
			jest.useFakeTimers();

			const deferred = createDeferred<string>();
			const promise = withTimeout(deferred.promise, 100);
			deferred.resolve('ok');
			await expect(promise).resolves.toBe('ok');
			expect(jest.getTimerCount()).toBe(0);
		});

		it('should forward rejections and clear the timer', async function () {
			jest.useFakeTimers();

			const error = new Error('fail');
			const promise = withTimeout(Promise.reject(error), 100);
			await expect(promise).rejects.toBe(error);
			expect(jest.getTimerCount()).toBe(0);
		});

		it('should reject with a TimeoutError when too slow', async function () {
			jest.useFakeTimers();

			const promise = withTimeout(new Promise(function () {}), 100);
			const assertion = expect(promise).rejects.toThrow(new TimeoutError('Operation timed out after 100 ms'));
			await jest.advanceTimersByTimeAsync(100);
			await assertion;
		});

		it('should use the custom message', async function () {
			jest.useFakeTimers();

			const promise = withTimeout(new Promise(function () {}), 5, 'too slow');
			const assertion = expect(promise).rejects.toMatchObject({ name: 'TimeoutError', message: 'too slow' });
			await jest.advanceTimersByTimeAsync(5);
			await assertion;
		});

		it('should accept plain values', async function () {
			await expect(withTimeout(7, 10)).resolves.toBe(7);
		});

		it('should reject with a RangeError for invalid ms', async function () {
			await expect(withTimeout(Promise.resolve(1), -1)).rejects.toThrow(RangeError);
		});
	});

	describe('retry', function () {
		it('should resolve on the first success without retrying', async function () {
			const fn = jest.fn(async function (attempt: number) {
				return attempt;
			});
			await expect(retry(fn)).resolves.toBe(1);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should retry until success and pass the attempt number', async function () {
			const fn = jest.fn(function (attempt: number) {
				if (attempt < 3) throw new Error(`fail ${attempt}`);
				return 'done';
			});
			const onRetry = jest.fn();
			await expect(retry(fn, { onRetry })).resolves.toBe('done');
			expect(fn.mock.calls).toEqual([[1], [2], [3]]);
			expect(onRetry.mock.calls).toEqual([
				[new Error('fail 1'), 1],
				[new Error('fail 2'), 2]
			]);
		});

		it('should rethrow the last error once retries are exhausted', async function () {
			const fn = jest.fn(async function (attempt: number) {
				throw new Error(`fail ${attempt}`);
			});
			await expect(retry(fn, { retries: 2 })).rejects.toThrow('fail 3');
			expect(fn).toHaveBeenCalledTimes(3);
		});

		it('should not retry with retries = 0', async function () {
			const fn = jest.fn(async function () {
				throw new Error('x');
			});
			await expect(retry(fn, { retries: 0 })).rejects.toThrow('x');
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should stop when shouldRetry returns false', async function () {
			const fn = jest.fn(async function (attempt: number) {
				throw new Error(attempt === 1 ? 'retryable' : 'fatal');
			});
			const shouldRetry = jest.fn(function (error: unknown) {
				return (error as Error).message === 'retryable';
			});
			await expect(retry(fn, { retries: 10, shouldRetry })).rejects.toThrow('fatal');
			expect(fn).toHaveBeenCalledTimes(2);
			expect(shouldRetry).toHaveBeenLastCalledWith(new Error('fatal'), 2);
		});

		it('should wait with exponential backoff capped by maxDelay', async function () {
			jest.useFakeTimers();

			const times: number[] = [];
			const start = Date.now();
			const fn = jest.fn(async function (attempt: number) {
				times.push(Date.now() - start);
				if (attempt <= 4) throw new Error('again');
				return 'ok';
			});
			const promise = retry(fn, { retries: 4, delay: 100, factor: 2, maxDelay: 300 });
			await jest.advanceTimersByTimeAsync(10_000);
			await expect(promise).resolves.toBe('ok');
			expect(times).toEqual([0, 100, 300, 600, 900]);
		});

		it('should apply full jitter using the random source', async function () {
			jest.useFakeTimers();

			const times: number[] = [];
			const start = Date.now();
			const fn = jest.fn(async function (attempt: number) {
				times.push(Date.now() - start);
				if (attempt <= 2) throw new Error('again');
				return 'ok';
			});
			const promise = retry(fn, { delay: 100, jitter: true }, function () {
				return 0.5;
			});
			await jest.advanceTimersByTimeAsync(1000);
			await expect(promise).resolves.toBe('ok');
			expect(times).toEqual([0, 50, 150]);
		});

		it('should support infinite retries', async function () {
			const fn = jest.fn(function (attempt: number) {
				if (attempt < 20) throw new Error('again');
				return attempt;
			});
			await expect(retry(fn, { retries: Infinity })).resolves.toBe(20);
		});

		it('should reject with the abort reason when aborted before an attempt', async function () {
			const controller = new AbortController();
			controller.abort(new Error('cancelled'));
			const fn = jest.fn();
			await expect(retry(fn, { signal: controller.signal })).rejects.toThrow('cancelled');
			expect(fn).not.toHaveBeenCalled();
		});

		it('should reject with the abort reason when aborted during a delay', async function () {
			jest.useFakeTimers();

			const controller = new AbortController();
			const fn = jest.fn(async function () {
				throw new Error('fail');
			});
			const promise = retry(fn, { delay: 1000, signal: controller.signal });
			const assertion = expect(promise).rejects.toThrow('stop now');
			await jest.advanceTimersByTimeAsync(500);
			controller.abort(new Error('stop now'));
			await assertion;
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should reject with an AbortError when aborted between attempts without a reason', async function () {
			const signal = { aborted: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
			const fn = jest.fn(async function () {
				signal.aborted = true;
				throw new Error('fail');
			});
			await expect(retry(fn, { signal })).rejects.toBeInstanceOf(AbortError);
		});

		it.each([
			[{ retries: -1 }],
			[{ retries: 1.5 }],
			[{ retries: NaN }],
			[{ delay: -1 }],
			[{ delay: Infinity }],
			[{ factor: 0 }],
			[{ factor: NaN }],
			[{ maxDelay: -1 }],
			[{ maxDelay: NaN }]
		])('should reject with a RangeError for %p', async function (options) {
			await expect(retry(jest.fn(), options)).rejects.toThrow(RangeError);
		});

		it('should reject with a TypeError when fn is not a function', async function () {
			await expect(retry(42 as any)).rejects.toThrow(TypeError);
		});
	});

	describe('mapWithConcurrency', function () {
		it('should map items preserving order', async function () {
			const result = await mapWithConcurrency(
				[30, 10, 20],
				async function (n, i) {
					await sleep(n);
					return `${i}:${n}`;
				},
				2
			);
			expect(result).toEqual(['0:30', '1:10', '2:20']);
		});

		it('should accept any iterable and sync mappers', async function () {
			const result = await mapWithConcurrency(new Set(['a', 'b']), function (s) {
				return s.toUpperCase();
			});
			expect(result).toEqual(['A', 'B']);
		});

		it('should resolve with an empty array for empty input', async function () {
			const mapper = jest.fn();
			await expect(mapWithConcurrency([], mapper, 3)).resolves.toEqual([]);
			expect(mapper).not.toHaveBeenCalled();
		});

		it('should never exceed the concurrency limit', async function () {
			let inFlight = 0;
			let maxInFlight = 0;
			const deferreds = Array.from({ length: 6 }, function () {
				return createDeferred<void>();
			});
			const promise = mapWithConcurrency(
				deferreds,
				async function (deferred, i) {
					inFlight++;
					maxInFlight = Math.max(maxInFlight, inFlight);
					await deferred.promise;
					inFlight--;
					return i;
				},
				2
			);

			await Promise.resolve();
			expect(inFlight).toBe(2);
			for (const deferred of deferreds) {
				deferred.resolve();
				await new Promise(setImmediate);
			}
			await expect(promise).resolves.toEqual([0, 1, 2, 3, 4, 5]);
			expect(maxInFlight).toBe(2);
		});

		it('should reject on the first error and stop scheduling new items', async function () {
			const started: number[] = [];
			const promise = mapWithConcurrency(
				[0, 1, 2, 3, 4],
				async function (n) {
					started.push(n);
					await Promise.resolve();
					if (n === 1) throw new Error('bad');
					return n;
				},
				2
			);
			await expect(promise).rejects.toThrow('bad');
			await new Promise(setImmediate);
			expect(started).toEqual([0, 1, 2]);
		});

		it('should reject when the mapper throws synchronously', async function () {
			await expect(
				mapWithConcurrency([1], function () {
					throw new TypeError('sync');
				})
			).rejects.toThrow('sync');
		});

		it.each([0, -1, 1.5, NaN])('should reject with a RangeError for concurrency = %p', async function (concurrency) {
			await expect(mapWithConcurrency([1], jest.fn(), concurrency)).rejects.toThrow(RangeError);
		});

		it('should reject with a TypeError when mapper is not a function', async function () {
			await expect(mapWithConcurrency([1], null as any)).rejects.toThrow(TypeError);
		});
	});
});
