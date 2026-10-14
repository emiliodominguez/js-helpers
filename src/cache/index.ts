import { isFunction } from '../guards/index.js';

/**
 * Why an entry left an {@link LRUCache}, as reported to `onEvict`:
 * - `'capacity'` — the least-recently-used live entry was dropped to make room for a new key;
 * - `'expired'` — the entry's TTL had elapsed when it was found (by a lookup, `set`, `delete`, `prune`, `clear` or a capacity eviction);
 * - `'deleted'` — removed with `delete(key)`;
 * - `'cleared'` — removed by `clear()`;
 * - `'replaced'` — `set(key, value)` overwrote a live entry with a different value (`Object.is`).
 */
export type LRUEvictionReason = 'capacity' | 'expired' | 'deleted' | 'cleared' | 'replaced';

/**
 * Options accepted by {@link createLRUCache}.
 * @template K - The key type
 * @template V - The value type
 */
export interface LRUCacheOptions<K, V> {
	/** Maximum number of entries (an integer `>= 1`, or `Infinity` for an unbounded, TTL-only cache). */
	max: number;
	/** Default time-to-live of an entry in milliseconds (`> 0`; `Infinity`, the default, means entries never expire). */
	ttl?: number;
	/** Clock used for expiry, in milliseconds. Defaults to `Date.now`. Inject a fake clock for deterministic tests. */
	now?: () => number;
	/** Called after an entry has been removed (the cache is already in its new state, so the callback may use it). */
	onEvict?: (key: K, value: V, reason: LRUEvictionReason) => void;
	/** When `true`, a successful `get` restarts the entry's TTL (sliding expiry). `peek`/`has` never do. Defaults to `false`. */
	updateAgeOnGet?: boolean;
}

/**
 * Per-entry options accepted by {@link LRUCache.set}.
 */
export interface LRUCacheSetOptions {
	/** Time-to-live of this entry in milliseconds, overriding the cache's default `ttl` (`> 0`, or `Infinity` for no expiry). */
	ttl?: number;
}

/**
 * A least-recently-used cache with optional per-entry expiry, as returned by {@link createLRUCache}.
 * Structurally compatible with `MemoizeCache` (from the `functions` module), so it can back `memoize`.
 * @template K - The key type
 * @template V - The value type
 */
export interface LRUCache<K, V> extends Iterable<[K, V]> {
	/**
	 * Number of stored entries. Expired entries are removed lazily, so this may still count entries whose TTL has elapsed but that no
	 * operation has touched yet; call `prune()` first for an exact live count. Never exceeds `max`.
	 */
	readonly size: number;
	/** Returns the value of a live entry and marks it most-recently used (restarting its TTL with `updateAgeOnGet`); `undefined` otherwise. */
	get(key: K): V | undefined;
	/** Returns the value of a live entry without changing its recency or TTL; `undefined` otherwise. */
	peek(key: K): V | undefined;
	/** Whether `key` holds a live (unexpired) entry. Does not change recency. */
	has(key: K): boolean;
	/** Stores `value` as the most-recently-used entry (evicting the least-recently-used one when full) and returns the cache. */
	set(key: K, value: V, options?: LRUCacheSetOptions): LRUCache<K, V>;
	/** Removes `key`; returns `true` when a live entry was removed. */
	delete(key: K): boolean;
	/** Removes every entry. */
	clear(): void;
	/** Removes every expired entry and returns how many were removed. */
	prune(): number;
	/** Live keys, from most- to least-recently used (a snapshot taken when called). */
	keys(): IterableIterator<K>;
	/** Live values, from most- to least-recently used (a snapshot taken when called). */
	values(): IterableIterator<V>;
	/** Live `[key, value]` pairs, from most- to least-recently used (a snapshot taken when called). */
	entries(): IterableIterator<[K, V]>;
	/** Same as `entries()`. */
	[Symbol.iterator](): IterableIterator<[K, V]>;
}

/**
 * A stored entry: its value, its own TTL (for `updateAgeOnGet`) and the instant it expires (`Infinity` for never).
 * @template V - The value type
 */
interface Entry<V> {
	value: V;
	ttl: number;
	expiresAt: number;
}

/**
 * Throws a `RangeError` unless `ttl` is `undefined` or a number `> 0` (`Infinity` included).
 * @param {number | undefined} ttl - The TTL to validate
 * @returns {void}
 * @throws {RangeError} when `ttl` is not a positive number
 */
function assertTTL(ttl: number | undefined): void {
	if (ttl !== undefined && !(typeof ttl === 'number' && ttl > 0)) {
		throw new RangeError(`createLRUCache: ttl must be a positive number of milliseconds (or Infinity), got ${String(ttl)}`);
	}
}

/**
 * Creates a least-recently-used cache backed by a single `Map` (whose insertion order tracks recency), so `get`, `set`, `peek`, `has` and
 * `delete` are O(1).
 *
 * Semantics:
 * - Recency: `get` and `set` make an entry most-recently used; `peek`, `has` and iteration do not.
 * - Expiry: an entry expires once `now() >= setTime + ttl`. Expired entries behave as absent everywhere, but are removed lazily: by any
 *   operation that looks the key up (`get`, `peek`, `has`, `set`, `delete`), by `prune()`, by `clear()`, or when they are the
 *   least-recently-used entry at a capacity eviction. Until then they count towards `size` and `max`.
 * - `onEvict(key, value, reason)` fires once per removed entry (see {@link LRUEvictionReason}), never for misses. Overwriting a live entry
 *   reports the old value as `'replaced'` unless it is the very same value (`Object.is`), so a resource is never disposed while still stored.
 *   It is called after the cache has been updated; an exception it throws propagates to the caller, but the cache stays consistent.
 * - For a TTL-only cache use `max: Infinity` (see the second example).
 * Type arguments: pass them explicitly for standalone use (`createLRUCache<string, User>(...)`), or let them be inferred from a contextual
 * type or `onEvict`. When nothing determines them they default to `unknown`, so a bare `createLRUCache({ max })` works standalone and
 * slots straight into `memoize(fn, { cache: ... })`.
 * @template K - The key type (defaults to `unknown`)
 * @template V - The value type (defaults to `unknown`)
 * @param {LRUCacheOptions<K, V>} options - `max` (required), and optional `ttl`, `now`, `onEvict`, `updateAgeOnGet`
 * @returns {LRUCache<K, V>} A new, empty cache
 * @throws {TypeError} when `options` is not an object, or `now`/`onEvict` is provided but not a function
 * @throws {RangeError} when `max` is not an integer `>= 1` (or `Infinity`), or `ttl` (here or in `set`) is not a number `> 0`
 * @example
 * const cache = createLRUCache<string, number>({ max: 2 });
 * cache.set('a', 1).set('b', 2);
 * cache.get('a'); // 1 ('a' is now the most recently used)
 * cache.set('c', 3); // evicts 'b'
 * [...cache.keys()]; // ['c', 'a']
 * @example
 * // TTL-only cache: unbounded size, entries expire after one minute (5 s for 'otp')
 * const sessions = createLRUCache<string, string>({ max: Infinity, ttl: 60_000 });
 * sessions.set('otp', '123456', { ttl: 5_000 });
 * setInterval(function () { sessions.prune(); }, 60_000); // optional: reclaim memory of untouched expired entries
 * @example
 * // Bounded memoization
 * const slowSquare = memoize(function (n: number): number { return n * n; }, { cache: createLRUCache({ max: 100 }) });
 */
export function createLRUCache<K = unknown, V = unknown>(options: LRUCacheOptions<K, V>): LRUCache<K, V> {
	if (typeof options !== 'object' || options === null) throw new TypeError('createLRUCache: options must be an object');

	const { max, ttl: defaultTTL = Infinity, now = Date.now, onEvict, updateAgeOnGet = false } = options;

	if (!(max === Infinity || (Number.isInteger(max) && max >= 1))) {
		throw new RangeError(`createLRUCache: max must be an integer >= 1 (or Infinity), got ${String(max)}`);
	}
	assertTTL(defaultTTL);
	if (!isFunction(now)) throw new TypeError('createLRUCache: now must be a function');
	if (onEvict !== undefined && !isFunction(onEvict)) throw new TypeError('createLRUCache: onEvict must be a function');

	// Oldest (least-recently used) first; bumping is delete + re-set.
	const store = new Map<K, Entry<V>>();

	/**
	 * Reports a removal to `onEvict`, if any.
	 * @param {K} key - The removed key
	 * @param {V} value - The removed value
	 * @param {LRUEvictionReason} reason - Why it was removed
	 * @returns {void}
	 */
	function notify(key: K, value: V, reason: LRUEvictionReason): void {
		if (onEvict) onEvict(key, value, reason);
	}

	/**
	 * Looks `key` up, removing it (and reporting `'expired'`) when it has expired at `time`.
	 * @param {K} key - The key to look up
	 * @param {number} [time=now()] - The current time
	 * @returns {Entry<V> | undefined} The live entry, or `undefined`
	 */
	function lookup(key: K, time: number = now()): Entry<V> | undefined {
		const entry = store.get(key);

		if (entry !== undefined && time >= entry.expiresAt) {
			store.delete(key);
			notify(key, entry.value, 'expired');
			return undefined;
		}

		return entry;
	}

	/**
	 * Snapshots the live entries from most- to least-recently used.
	 * @returns {Array<[K, V]>} The live entries
	 */
	function liveEntries(): Array<[K, V]> {
		const time = now();
		const result: Array<[K, V]> = [];

		for (const [key, entry] of store) {
			if (time < entry.expiresAt) result.push([key, entry.value]);
		}

		return result.reverse();
	}

	const cache: LRUCache<K, V> = {
		get size(): number {
			return store.size;
		},
		get(key: K): V | undefined {
			const time = now();
			const entry = lookup(key, time);
			if (entry === undefined) return undefined;

			store.delete(key);
			store.set(key, entry);
			if (updateAgeOnGet) entry.expiresAt = time + entry.ttl;

			return entry.value;
		},
		peek(key: K): V | undefined {
			return lookup(key)?.value;
		},
		has(key: K): boolean {
			return lookup(key) !== undefined;
		},
		set(key: K, value: V, setOptions?: LRUCacheSetOptions): LRUCache<K, V> {
			const ttl = setOptions?.ttl ?? defaultTTL;
			assertTTL(ttl);

			const time = now();
			const previous = store.get(key);
			let evicted: [K, Entry<V>] | undefined;

			store.delete(key);
			store.set(key, { value, ttl, expiresAt: time + ttl });

			if (previous === undefined && store.size > max) {
				// Map iteration starts at the least-recently-used entry, which is never the key just added (size > max >= 1).
				evicted = store.entries().next().value as [K, Entry<V>];
				store.delete(evicted[0]);
			}

			if (previous !== undefined) {
				if (time >= previous.expiresAt) notify(key, previous.value, 'expired');
				else if (!Object.is(previous.value, value)) notify(key, previous.value, 'replaced');
			} else if (evicted !== undefined) {
				notify(evicted[0], evicted[1].value, time >= evicted[1].expiresAt ? 'expired' : 'capacity');
			}

			return cache;
		},
		delete(key: K): boolean {
			const entry = lookup(key);
			if (entry === undefined) return false;

			store.delete(key);
			notify(key, entry.value, 'deleted');

			return true;
		},
		clear(): void {
			const time = now();
			const removed = [...store];
			store.clear();

			for (const [key, entry] of removed) notify(key, entry.value, time >= entry.expiresAt ? 'expired' : 'cleared');
		},
		prune(): number {
			const time = now();
			const expired = [...store].filter(function ([, entry]): boolean {
				return time >= entry.expiresAt;
			});

			for (const [key] of expired) store.delete(key);
			for (const [key, entry] of expired) notify(key, entry.value, 'expired');

			return expired.length;
		},
		keys(): IterableIterator<K> {
			return liveEntries()
				.map(function ([key]): K {
					return key;
				})
				.values();
		},
		values(): IterableIterator<V> {
			return liveEntries()
				.map(function ([, value]): V {
					return value;
				})
				.values();
		},
		entries(): IterableIterator<[K, V]> {
			return liveEntries().values();
		},
		[Symbol.iterator](): IterableIterator<[K, V]> {
			return liveEntries().values();
		}
	};

	return cache;
}
