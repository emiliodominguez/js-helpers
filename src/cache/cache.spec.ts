import { memoize, type MemoizeCache } from '../functions/index.js';
import { createLRUCache, type LRUCache, type LRUEvictionReason } from '.';

function fakeClock(start = 0) {
	const clock = {
		time: start,
		now: function (): number {
			return clock.time;
		},
		advance: function (ms: number): void {
			clock.time += ms;
		}
	};
	return clock;
}

function recorder<K, V>() {
	const events: Array<[K, V, LRUEvictionReason]> = [];
	function onEvict(key: K, value: V, reason: LRUEvictionReason): void {
		events.push([key, value, reason]);
	}
	return { events, onEvict };
}

describe('createLRUCache', function () {
	describe('validation', function () {
		it.each([0, -1, 1.5, NaN, -Infinity, '2' as any, undefined as any])('throws RangeError for max = %p', function (max) {
			expect(function () {
				createLRUCache({ max });
			}).toThrow(RangeError);
		});

		it('accepts max = Infinity and integer max >= 1', function () {
			expect(createLRUCache({ max: Infinity }).size).toBe(0);
			expect(createLRUCache({ max: 1 }).size).toBe(0);
		});

		it.each([0, -5, NaN, -Infinity, '10' as any, null as any])('throws RangeError for ttl = %p', function (ttl) {
			expect(function () {
				createLRUCache({ max: 2, ttl });
			}).toThrow(RangeError);
		});

		it('throws RangeError for an invalid per-entry ttl and leaves the cache untouched', function () {
			const cache = createLRUCache<string, number>({ max: 2 });
			cache.set('a', 1);
			expect(function () {
				cache.set('a', 2, { ttl: 0 });
			}).toThrow(RangeError);
			expect(function () {
				cache.set('b', 2, { ttl: NaN });
			}).toThrow(/ttl must be a positive number/);
			expect([...cache]).toEqual([['a', 1]]);
		});

		it('throws TypeError for non-object options or non-function now/onEvict', function () {
			expect(function () {
				createLRUCache(null as any);
			}).toThrow(TypeError);
			expect(function () {
				createLRUCache(5 as any);
			}).toThrow(TypeError);
			expect(function () {
				createLRUCache({ max: 1, now: 5 as any });
			}).toThrow(TypeError);
			expect(function () {
				createLRUCache({ max: 1, onEvict: 'x' as any });
			}).toThrow(TypeError);
		});
	});

	describe('basic operations', function () {
		it('stores, reads and reports size', function () {
			const cache = createLRUCache<string, number>({ max: 3 });
			expect(cache.set('a', 1)).toBe(cache);
			cache.set('b', 2);
			expect(cache.size).toBe(2);
			expect(cache.get('a')).toBe(1);
			expect(cache.peek('b')).toBe(2);
			expect(cache.has('a')).toBe(true);
			expect(cache.has('z')).toBe(false);
			expect(cache.get('z')).toBeUndefined();
			expect(cache.peek('z')).toBeUndefined();
		});

		it('distinguishes a stored undefined via has()', function () {
			const cache = createLRUCache<string, undefined>({ max: 2 });
			cache.set('u', undefined);
			expect(cache.has('u')).toBe(true);
			expect(cache.get('u')).toBeUndefined();
		});

		it('uses SameValueZero keys like Map (NaN, -0, objects by identity, unicode)', function () {
			const cache = createLRUCache<unknown, string>({ max: 10 });
			const obj = {};
			cache.set(NaN, 'nan').set(-0, 'zero').set(obj, 'obj').set('😀', 'emoji');
			expect(cache.get(NaN)).toBe('nan');
			expect(cache.get(0)).toBe('zero');
			expect(cache.get({})).toBeUndefined();
			expect(cache.get(obj)).toBe('obj');
			expect(cache.get('😀')).toBe('emoji');
		});

		it('delete returns whether a live entry was removed', function () {
			const cache = createLRUCache<string, number>({ max: 2 });
			cache.set('a', 1);
			expect(cache.delete('a')).toBe(true);
			expect(cache.delete('a')).toBe(false);
			expect(cache.size).toBe(0);
		});

		it('clear empties the cache', function () {
			const cache = createLRUCache<string, number>({ max: 2 });
			cache.set('a', 1).set('b', 2);
			cache.clear();
			expect(cache.size).toBe(0);
			expect([...cache.keys()]).toEqual([]);
		});
	});

	describe('LRU order', function () {
		it('evicts the least-recently-used entry when full', function () {
			const { events, onEvict } = recorder<string, number>();
			const cache = createLRUCache<string, number>({ max: 2, onEvict });
			cache.set('a', 1).set('b', 2);
			cache.get('a');
			cache.set('c', 3);
			expect([...cache.keys()]).toEqual(['c', 'a']);
			expect(events).toEqual([['b', 2, 'capacity']]);
		});

		it('peek and has do not refresh recency', function () {
			const cache = createLRUCache<string, number>({ max: 2 });
			cache.set('a', 1).set('b', 2);
			cache.peek('a');
			cache.has('a');
			cache.set('c', 3);
			expect(cache.has('a')).toBe(false);
			expect([...cache.keys()]).toEqual(['c', 'b']);
		});

		it('set on an existing key refreshes recency without evicting', function () {
			const cache = createLRUCache<string, number>({ max: 2 });
			cache.set('a', 1).set('b', 2).set('a', 10).set('c', 3);
			expect([...cache.entries()]).toEqual([
				['c', 3],
				['a', 10]
			]);
		});

		it('iterators go from most- to least-recently used and are snapshots', function () {
			const cache = createLRUCache<string, number>({ max: 5 });
			cache.set('a', 1).set('b', 2).set('c', 3);
			cache.get('a');
			expect([...cache.keys()]).toEqual(['a', 'c', 'b']);
			expect([...cache.values()]).toEqual([1, 3, 2]);
			expect([...cache]).toEqual([...cache.entries()]);

			const keys = cache.keys();
			cache.set('d', 4);
			expect([...keys]).toEqual(['a', 'c', 'b']);
		});

		it('max = 1 keeps only the latest key', function () {
			const cache = createLRUCache<number, number>({ max: 1 });
			for (let i = 0; i < 5; i++) cache.set(i, i);
			expect([...cache]).toEqual([[4, 4]]);
		});
	});

	describe('expiry', function () {
		it('expires entries after ttl and evicts them on get', function () {
			const clock = fakeClock();
			const { events, onEvict } = recorder<string, number>();
			const cache = createLRUCache<string, number>({ max: 10, ttl: 100, now: clock.now, onEvict });
			cache.set('a', 1);
			clock.advance(99);
			expect(cache.get('a')).toBe(1);
			clock.advance(1);
			expect(cache.size).toBe(1); // lazily removed
			expect(cache.get('a')).toBeUndefined();
			expect(cache.size).toBe(0);
			expect(events).toEqual([['a', 1, 'expired']]);
			expect(cache.get('a')).toBeUndefined();
			expect(events).toHaveLength(1); // misses never fire onEvict
		});

		it('peek, has and delete treat expired entries as absent and remove them', function () {
			const clock = fakeClock();
			const { events, onEvict } = recorder<string, number>();
			const cache = createLRUCache<string, number>({ max: 10, ttl: 10, now: clock.now, onEvict });
			cache.set('a', 1).set('b', 2).set('c', 3);
			clock.advance(10);
			expect(cache.peek('a')).toBeUndefined();
			expect(cache.has('b')).toBe(false);
			expect(cache.delete('c')).toBe(false);
			expect(cache.size).toBe(0);
			expect(events).toEqual([
				['a', 1, 'expired'],
				['b', 2, 'expired'],
				['c', 3, 'expired']
			]);
		});

		it('supports per-entry ttl overrides, including Infinity', function () {
			const clock = fakeClock();
			const cache = createLRUCache<string, number>({ max: 10, ttl: 100, now: clock.now });
			cache.set('short', 1, { ttl: 10 });
			cache.set('forever', 2, { ttl: Infinity });
			cache.set('default', 3, {});
			clock.advance(50);
			expect(cache.has('short')).toBe(false);
			expect(cache.has('default')).toBe(true);
			clock.advance(1e9);
			expect(cache.has('default')).toBe(false);
			expect(cache.get('forever')).toBe(2);
		});

		it('entries never expire without a ttl', function () {
			const clock = fakeClock();
			const cache = createLRUCache<string, number>({ max: 10, now: clock.now });
			cache.set('a', 1);
			clock.advance(Number.MAX_SAFE_INTEGER);
			expect(cache.get('a')).toBe(1);
		});

		it('defaults to Date.now', function () {
			const spy = jest.spyOn(Date, 'now').mockReturnValue(1000);
			const cache = createLRUCache<string, number>({ max: 10, ttl: 50 });
			cache.set('a', 1);
			spy.mockReturnValue(1049);
			expect(cache.get('a')).toBe(1);
			spy.mockReturnValue(1050);
			expect(cache.get('a')).toBeUndefined();
		});

		it('updateAgeOnGet restarts the ttl on get only', function () {
			const clock = fakeClock();
			const cache = createLRUCache<string, number>({ max: 10, ttl: 100, now: clock.now, updateAgeOnGet: true });
			cache.set('a', 1).set('b', 2).set('c', 3, { ttl: 20 });
			clock.advance(15);
			expect(cache.get('c')).toBe(3); // restarts with its own ttl (20)
			clock.advance(65);
			expect(cache.get('a')).toBe(1);
			expect(cache.peek('b')).toBe(2);
			expect(cache.has('c')).toBe(false); // 80 >= 15 + 20
			clock.advance(80);
			expect(cache.get('a')).toBe(1); // 160 > 100, but its age restarted at 80
			expect(cache.has('b')).toBe(false); // peek does not restart the ttl
			clock.advance(100);
			expect(cache.get('a')).toBeUndefined();
		});

		it('without updateAgeOnGet, get does not extend the ttl', function () {
			const clock = fakeClock();
			const cache = createLRUCache<string, number>({ max: 10, ttl: 100, now: clock.now });
			cache.set('a', 1);
			clock.advance(80);
			cache.get('a');
			clock.advance(20);
			expect(cache.get('a')).toBeUndefined();
		});

		it('iterators skip expired entries without removing them; prune removes them', function () {
			const clock = fakeClock();
			const { events, onEvict } = recorder<string, number>();
			const cache = createLRUCache<string, number>({ max: Infinity, ttl: 100, now: clock.now, onEvict });
			cache.set('a', 1);
			cache.set('b', 2, { ttl: 1000 });
			cache.set('c', 3);
			clock.advance(100);
			expect([...cache.keys()]).toEqual(['b']);
			expect([...cache.values()]).toEqual([2]);
			expect(cache.size).toBe(3);
			expect(cache.prune()).toBe(2);
			expect(cache.size).toBe(1);
			expect(cache.prune()).toBe(0);
			expect(events).toEqual([
				['a', 1, 'expired'],
				['c', 3, 'expired']
			]);
		});

		it('setting over an expired entry reports it as expired, not replaced', function () {
			const clock = fakeClock();
			const { events, onEvict } = recorder<string, number>();
			const cache = createLRUCache<string, number>({ max: 1, ttl: 10, now: clock.now, onEvict });
			cache.set('a', 1);
			clock.advance(10);
			cache.set('a', 2);
			expect(events).toEqual([['a', 1, 'expired']]);
			expect(cache.get('a')).toBe(2);
		});

		it('a capacity eviction of an expired LRU entry is reported as expired', function () {
			const clock = fakeClock();
			const { events, onEvict } = recorder<string, number>();
			const cache = createLRUCache<string, number>({ max: 2, now: clock.now, onEvict });
			cache.set('a', 1, { ttl: 5 }).set('b', 2);
			clock.advance(5);
			cache.set('c', 3);
			expect(events).toEqual([['a', 1, 'expired']]);
			expect([...cache.keys()]).toEqual(['c', 'b']);
		});

		it('clear reports live entries as cleared and expired ones as expired, oldest first', function () {
			const clock = fakeClock();
			const { events, onEvict } = recorder<string, number>();
			const cache = createLRUCache<string, number>({ max: 5, now: clock.now, onEvict });
			cache.set('a', 1, { ttl: 5 }).set('b', 2).set('c', 3);
			clock.advance(5);
			cache.clear();
			expect(events).toEqual([
				['a', 1, 'expired'],
				['b', 2, 'cleared'],
				['c', 3, 'cleared']
			]);
		});
	});

	describe('onEvict', function () {
		it('reports deleted and replaced entries, but not same-value overwrites', function () {
			const { events, onEvict } = recorder<string, object>();
			const cache = createLRUCache<string, object>({ max: 5, onEvict });
			const first = {};
			const second = {};
			cache.set('a', first);
			cache.set('a', first);
			expect(events).toEqual([]);
			cache.set('a', second);
			expect(events).toEqual([['a', first, 'replaced']]);
			cache.delete('a');
			expect(events).toEqual([
				['a', first, 'replaced'],
				['a', second, 'deleted']
			]);
		});

		it('runs after the cache was updated, so it may use the cache', function () {
			const seen: Array<[number, boolean]> = [];
			const cache: LRUCache<string, number> = createLRUCache<string, number>({
				max: 1,
				onEvict: function (key: string): void {
					seen.push([cache.size, cache.has(key)]);
				}
			});
			cache.set('a', 1).set('b', 2);
			expect(seen).toEqual([[1, false]]);
		});

		it('propagates exceptions but leaves the cache consistent', function () {
			const cache = createLRUCache<string, number>({
				max: 1,
				onEvict: function (): void {
					throw new Error('boom');
				}
			});
			cache.set('a', 1);
			expect(function () {
				cache.set('b', 2);
			}).toThrow('boom');
			expect([...cache]).toEqual([['b', 2]]);
		});
	});

	describe('memoize integration', function () {
		it('is structurally a MemoizeCache', function () {
			const cache: MemoizeCache<string, number> = createLRUCache<string, number>({ max: 3 });
			expect(cache.has('x')).toBe(false);
		});

		it('infers usable types for a bare createLRUCache({ max }) inside memoize', function () {
			function square(n: number): number {
				return n * n;
			}
			const memo = memoize(square, { cache: createLRUCache({ max: 100 }) });
			const result: number = memo(4);
			const cache: LRUCache<unknown, unknown> = memo.cache;
			expect(result).toBe(16);
			expect([...cache.keys()]).toEqual([4]);
		});

		it('bounds a memoized function', function () {
			const square = jest.fn(function (n: number): number {
				return n * n;
			});
			const memo = memoize(square, { cache: createLRUCache({ max: 100 }) });
			expect(memo(3)).toBe(9);
			expect(memo(3)).toBe(9);
			expect(square).toHaveBeenCalledTimes(1);
			expect(memo.cache.size).toBe(1);

			for (let i = 0; i < 200; i++) memo(i);
			expect(memo.cache.size).toBe(100);
			memo.clear();
			expect(memo.cache.size).toBe(0);
		});

		it('recomputes after an entry expires', function () {
			const clock = fakeClock();
			const fn = jest.fn(function (s: string): string {
				return s.toUpperCase();
			});
			const memo = memoize(fn, { cache: createLRUCache<unknown, string>({ max: 10, ttl: 1000, now: clock.now }) });
			memo('a');
			clock.advance(999);
			memo('a');
			expect(fn).toHaveBeenCalledTimes(1);
			clock.advance(1);
			expect(memo('a')).toBe('A');
			expect(fn).toHaveBeenCalledTimes(2);
		});
	});
});
