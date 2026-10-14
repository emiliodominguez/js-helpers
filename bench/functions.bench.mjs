import { debounce, defaultMemoizeKey, memoize, memoizeLast, pipe, throttle } from '@emiliodominguez/js-helpers/functions';
import { memoize as memoizeDecorator } from '@emiliodominguez/js-helpers/decorators';

/**
 * A cheap function to memoize, so the benchmarks measure the wrapper rather than the work.
 * @param {number} a - First operand
 * @param {number} [b=0] - Second operand
 * @returns {number} The sum
 */
function add(a, b = 0) {
	return a + b;
}

const memoAdd = memoize(add);
const keys = Array.from({ length: 100 }, function (_, index) {
	return index;
});
const words = keys.map(function (n) {
	return `word-${n}`;
});
const points = keys.map(function (n) {
	return { x: n, y: n * 2 };
});
const memoPoint = memoize(function (point) {
	return point.x + point.y;
});
const memoWord = memoize(function (word) {
	return word.length;
});
const lastAdd = memoizeLast(add);
const piped = pipe(
	add,
	function (n) {
		return n * 2;
	},
	function (n) {
		return n - 1;
	}
);
const debounced = debounce(add, 1000);
const throttled = throttle(add, 1000);

// Standard (TC39) decorator call shape: `memoize(method, context)` returns the replacement method.
const memoMethod = memoizeDecorator(add, { kind: 'method', name: 'add' });
const instance = {};

// Warm the caches so the benchmarks measure hits.
for (const n of keys) {
	memoAdd(n);
	memoAdd(n, n);
	memoPoint(points[n]);
	memoWord(words[n]);
	memoMethod.call(instance, n, n);
}

export default [
	{
		name: 'memoize hit (1 number arg, 100 keys)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < 100; i++) total += memoAdd(keys[i]);
			return total;
		},
		baseline: function () {
			let total = 0;
			for (let i = 0; i < 100; i++) total += add(keys[i]);
			return total;
		}
	},
	{
		name: 'memoize hit (1 string arg, 100 keys)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < 100; i++) total += memoWord(words[i]);
			return total;
		}
	},
	{
		name: 'memoize hit (2 number args, 100 keys)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < 100; i++) total += memoAdd(keys[i], keys[i]);
			return total;
		}
	},
	{
		name: 'memoize hit (1 object arg, 100 keys)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < 100; i++) total += memoPoint(points[i]);
			return total;
		}
	},
	{
		name: 'defaultMemoizeKey (2 args: string, number)',
		fn: function () {
			let key;
			for (let i = 0; i < 100; i++) key = defaultMemoizeKey(words[i], i);
			return key;
		}
	},
	{
		name: '@memoize method hit (2 number args)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < 100; i++) total += memoMethod.call(instance, keys[i], keys[i]);
			return total;
		}
	},
	{
		name: 'memoizeLast hit (2 args)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < 100; i++) total += lastAdd(1, 2);
			return total;
		}
	},
	{
		name: 'pipe (3 functions)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < 100; i++) total += piped(i, 1);
			return total;
		}
	},
	{
		name: 'debounce call (pending burst)',
		fn: function () {
			for (let i = 0; i < 100; i++) debounced(i, 1);
			return debounced.pending();
		}
	},
	{
		name: 'throttle call (inside window)',
		fn: function () {
			let result;
			for (let i = 0; i < 100; i++) result = throttled(i, 1);
			return result;
		}
	}
];
