import { createLRUCache } from '@emiliodominguez/js-helpers/cache';

const SIZE = 1000;
const keys = Array.from({ length: SIZE }, function (_, index) {
	return `key-${index}`;
});
const full = createLRUCache({ max: SIZE });
const withTTL = createLRUCache({ max: SIZE, ttl: 60_000 });
for (const key of keys) {
	full.set(key, key.length);
	withTTL.set(key, key.length);
}
const small = createLRUCache({ max: SIZE / 2 });
const map = new Map(
	keys.map(function (key) {
		return [key, key.length];
	})
);

export default [
	{
		name: 'get hit (1k keys)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < SIZE; i++) total += full.get(keys[i]);
			return total;
		},
		baseline: function () {
			let total = 0;
			for (let i = 0; i < SIZE; i++) total += map.get(keys[i]);
			return total;
		}
	},
	{
		name: 'get hit with ttl (1k keys)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < SIZE; i++) total += withTTL.get(keys[i]);
			return total;
		}
	},
	{
		name: 'get same key repeatedly',
		fn: function () {
			let total = 0;
			for (let i = 0; i < SIZE; i++) total += full.get(keys[7]);
			return total;
		}
	},
	{
		name: 'peek/has (1k keys)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < SIZE; i++) if (full.has(keys[i])) total += full.peek(keys[i]);
			return total;
		}
	},
	{
		name: 'set overwrite (1k keys)',
		fn: function () {
			for (let i = 0; i < SIZE; i++) full.set(keys[i], i);
			return full.size;
		}
	},
	{
		name: 'set with eviction (1k keys, max 500)',
		fn: function () {
			for (let i = 0; i < SIZE; i++) small.set(keys[i], i);
			return small.size;
		}
	},
	{
		name: 'iterate entries (1k)',
		fn: function () {
			let count = 0;
			for (const entry of full) count += entry[1];
			return count;
		}
	}
];
