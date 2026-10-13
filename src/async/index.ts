import type { AbortSignalLike, RandomGenerator } from '../utils/index.js';

/**
 * Largest delay accepted by `setTimeout` (2^31 - 1 ms, about 24.8 days); larger values fire immediately on most hosts.
 */
const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * Error used to reject operations cancelled through an abort signal that carries no `reason`.
 * @example
 * try { await sleep(1000, { signal }); } catch (error) { if (error instanceof AbortError) { ... } }
 */
export class AbortError extends Error {
	override name = 'AbortError';

	/**
	 * @param {string} [message='The operation was aborted.'] - The error message
	 */
	constructor(message = 'The operation was aborted.') {
		super(message);
	}
}

/**
 * Error used by {@link withTimeout} when the wrapped promise does not settle in time.
 * @example
 * try { await withTimeout(fetchData(), 5000); } catch (error) { if (error instanceof TimeoutError) { ... } }
 */
export class TimeoutError extends Error {
	override name = 'TimeoutError';

	/**
	 * @param {string} [message='The operation timed out.'] - The error message
	 */
	constructor(message = 'The operation timed out.') {
		super(message);
	}
}

/**
 * A promise together with the functions that settle it.
 * @template T - The resolved value type
 */
export interface Deferred<T> {
	/** The pending promise. */
	readonly promise: Promise<T>;
	/** Resolves `promise` (no-op once settled). */
	resolve(value: T | PromiseLike<T>): void;
	/** Rejects `promise` (no-op once settled). */
	reject(reason?: unknown): void;
}

/**
 * Options accepted by {@link sleep}.
 */
export interface SleepOptions {
	/** Aborts the sleep, rejecting with the signal's `reason` (or an {@link AbortError}). */
	signal?: AbortSignalLike;
}

/**
 * Options accepted by {@link retry}.
 */
export interface RetryOptions {
	/** Number of retries after the first attempt (`Infinity` allowed). Defaults to `3`. */
	retries?: number;
	/** Delay in ms before the first retry. Defaults to `0`. */
	delay?: number;
	/** Multiplier applied to the delay after each retry. Defaults to `2`. */
	factor?: number;
	/** Upper bound for a single delay in ms. Defaults to `Infinity`. */
	maxDelay?: number;
	/** When `true`, each delay is drawn uniformly from `[0, delay]` ("full jitter"). Defaults to `false`. */
	jitter?: boolean;
	/** Decides whether the error thrown by attempt number `attempt` (1-based) should be retried. Defaults to always. */
	shouldRetry?(error: unknown, attempt: number): boolean;
	/** Called before waiting for the next retry, with the error of attempt number `attempt` (1-based). */
	onRetry?(error: unknown, attempt: number): void;
	/** Aborts the retry loop between attempts (and during delays), rejecting with the signal's reason. */
	signal?: AbortSignalLike;
}

/**
 * The reason a signal was aborted with, or a fresh {@link AbortError} when it has none.
 * @param {AbortSignalLike} signal - An aborted signal
 * @returns {unknown} The rejection reason
 */
function abortReason(signal: AbortSignalLike): unknown {
	return signal.reason ?? new AbortError();
}

/**
 * Throws a `RangeError` unless `value` is a finite number in `[0, MAX_TIMEOUT]`.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {string} name - Name of the validated parameter
 * @param {number} value - The value to validate
 * @returns {void}
 * @throws {RangeError} when `value` is not a usable timer delay
 */
function assertDelay(caller: string, name: string, value: number): void {
	if (typeof value !== 'number' || !(value >= 0 && value <= MAX_TIMEOUT)) {
		throw new RangeError(`${caller}: \`${name}\` must be a number between 0 and ${MAX_TIMEOUT}, got ${String(value)}`);
	}
}

/**
 * Creates a promise that can be resolved or rejected from the outside.
 * @template T - The resolved value type
 * @returns {Deferred<T>} The promise and its `resolve`/`reject` functions
 * @example
 * const ready = createDeferred<void>();
 * socket.once('open', function () { ready.resolve(); });
 * await ready.promise;
 */
export function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>(function (res, rej) {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

/**
 * Resolves after `ms` milliseconds. If `options.signal` is aborted (before or during the wait), the timer is cleared and the promise
 * rejects with the signal's `reason` (or an {@link AbortError} if it has none).
 * @param {number} ms - Delay in milliseconds (`0` to `2^31 - 1`)
 * @param {SleepOptions} [options] - Optional abort `signal`
 * @returns {Promise<void>} A promise resolving after the delay
 * @throws {RangeError} (as a rejection) when `ms` is negative, `NaN` or larger than `2^31 - 1`
 * @example
 * await sleep(250);
 * const controller = new AbortController();
 * const nap = sleep(10_000, { signal: controller.signal });
 * controller.abort(); // nap rejects
 */
export function sleep(ms: number, options: SleepOptions = {}): Promise<void> {
	return new Promise<void>(function (resolve, reject) {
		assertDelay('sleep', 'ms', ms);

		const { signal } = options;

		if (signal?.aborted) {
			reject(abortReason(signal));
			return;
		}

		/**
		 * Abort listener: clears the timer and rejects.
		 * @returns {void}
		 */
		function onAbort(): void {
			clearTimeout(timer);
			reject(abortReason(signal as AbortSignalLike));
		}

		const timer = setTimeout(function () {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);

		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

/**
 * Races `promise` against a timer: resolves/rejects like `promise` if it settles within `ms` milliseconds, otherwise rejects with a
 * {@link TimeoutError}. The timer is always cleared. Note that the underlying operation is not cancelled.
 * @template T - The resolved value type
 * @param {PromiseLike<T> | T} promise - The promise (or value) to wait for
 * @param {number} ms - The time limit in milliseconds (`0` to `2^31 - 1`)
 * @param {string} [message] - Message of the `TimeoutError` (defaults to `Operation timed out after <ms> ms`)
 * @returns {Promise<T>} A promise settling like `promise`, or rejecting on timeout
 * @throws {TimeoutError} (as a rejection) when `promise` does not settle within `ms` milliseconds
 * @throws {RangeError} (as a rejection) when `ms` is negative, `NaN` or larger than `2^31 - 1`
 * @example
 * const data = await withTimeout(fetch(url), 5000, 'fetch took too long');
 */
export function withTimeout<T>(promise: PromiseLike<T> | T, ms: number, message?: string): Promise<T> {
	return new Promise<T>(function (resolve, reject) {
		assertDelay('withTimeout', 'ms', ms);

		const timer = setTimeout(function () {
			reject(new TimeoutError(message ?? `Operation timed out after ${ms} ms`));
		}, ms);

		Promise.resolve(promise).then(
			function (value) {
				clearTimeout(timer);
				resolve(value);
			},
			function (error: unknown) {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}

/**
 * Calls `fn` until it succeeds, retrying up to `options.retries` times with exponential backoff:
 * the delay before retry `k` (1-based) is `min(delay * factor^(k - 1), maxDelay)`, optionally randomised with full jitter.
 * Resolves with the first successful result; rejects with the last error once retries are exhausted or `shouldRetry` returns `false`.
 * @template T - The resolved value type
 * @param {(attempt: number) => Promise<T> | T} fn - The operation; receives the 1-based attempt number
 * @param {RetryOptions} [options] - `retries` (3), `delay` (0), `factor` (2), `maxDelay` (Infinity), `jitter` (false), `shouldRetry`, `onRetry`, `signal`
 * @param {RandomGenerator} [random=Math.random] - Random source used for jitter
 * @returns {Promise<T>} The first successful result
 * @throws {RangeError} (as a rejection) when `retries` is not a non-negative integer or `Infinity`, `delay` is not a finite number >= 0,
 * `factor` is not a finite number > 0, or `maxDelay` is negative or `NaN`
 * @throws {unknown} (as a rejection) the last error of `fn`, or the abort reason of `signal`
 * @example
 * const user = await retry(function () { return api.getUser(id); }, { retries: 5, delay: 100, maxDelay: 2000, jitter: true });
 */
export async function retry<T>(fn: (attempt: number) => Promise<T> | T, options: RetryOptions = {}, random: RandomGenerator = Math.random): Promise<T> {
	const { retries = 3, delay = 0, factor = 2, maxDelay = Infinity, jitter = false, shouldRetry, onRetry, signal } = options;

	if (typeof fn !== 'function') throw new TypeError('retry: expected a function');
	if (!(retries === Infinity || (Number.isInteger(retries) && retries >= 0))) {
		throw new RangeError(`retry: \`retries\` must be a non-negative integer or Infinity, got ${String(retries)}`);
	}
	if (!(Number.isFinite(delay) && delay >= 0)) throw new RangeError(`retry: \`delay\` must be a finite number >= 0, got ${String(delay)}`);
	if (!(Number.isFinite(factor) && factor > 0)) throw new RangeError(`retry: \`factor\` must be a finite number > 0, got ${String(factor)}`);
	if (!(maxDelay >= 0)) throw new RangeError(`retry: \`maxDelay\` must be a number >= 0, got ${String(maxDelay)}`);

	for (let attempt = 1; ; attempt++) {
		if (signal?.aborted) throw abortReason(signal);

		try {
			return await fn(attempt);
		} catch (error) {
			if (attempt > retries || (shouldRetry !== undefined && !shouldRetry(error, attempt))) throw error;

			onRetry?.(error, attempt);

			const base = Math.min(delay * factor ** (attempt - 1), maxDelay, MAX_TIMEOUT);
			const wait = jitter ? random() * base : base;

			if (wait > 0) await sleep(wait, { signal });
		}
	}
}

/**
 * Maps `items` with an async `mapper`, running at most `concurrency` mappers at the same time, and resolves with the results in input
 * order. Rejects with the first error; once an error occurred no new items are started (mappers already running are not cancelled).
 * @template T - The item type
 * @template R - The mapped value type
 * @param {Iterable<T>} items - The items to map (consumed eagerly)
 * @param {(item: T, index: number) => Promise<R> | R} mapper - The (possibly async) mapping function
 * @param {number} [concurrency=Infinity] - Maximum number of mappers in flight (an integer >= 1, or `Infinity`)
 * @returns {Promise<R[]>} The mapped values, in input order
 * @throws {RangeError} (as a rejection) when `concurrency` is not an integer >= 1 or `Infinity`
 * @throws {unknown} (as a rejection) the first error thrown or rejected by `mapper`
 * @example
 * const pages = await mapWithConcurrency(urls, function (url) { return fetch(url).then(function (r) { return r.text(); }); }, 4);
 */
export async function mapWithConcurrency<T, R>(items: Iterable<T>, mapper: (item: T, index: number) => Promise<R> | R, concurrency = Infinity): Promise<R[]> {
	if (!(concurrency === Infinity || (Number.isInteger(concurrency) && concurrency >= 1))) {
		throw new RangeError(`mapWithConcurrency: \`concurrency\` must be an integer >= 1 or Infinity, got ${String(concurrency)}`);
	}
	if (typeof mapper !== 'function') throw new TypeError('mapWithConcurrency: expected `mapper` to be a function');

	const list = Array.from(items);
	const results = new Array<R>(list.length);
	let next = 0;
	let failed = false;

	/**
	 * Repeatedly takes the next unprocessed item until none is left or a mapper failed.
	 * @returns {Promise<void>} Resolves when this worker is done
	 */
	async function worker(): Promise<void> {
		while (!failed && next < list.length) {
			const index = next++;

			try {
				results[index] = await mapper(list[index], index);
			} catch (error) {
				failed = true;
				throw error;
			}
		}
	}

	const workers: Array<Promise<void>> = [];

	for (let i = 0; i < Math.min(concurrency, list.length); i++) workers.push(worker());

	await Promise.all(workers);

	return results;
}
