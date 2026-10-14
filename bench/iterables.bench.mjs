import { chunk, filter, map, reduce, take, toArray, unique, windowed, zip } from '@emiliodominguez/js-helpers/iterables';

const numbers = Array.from({ length: 10_000 }, function (_, index) {
	return (index * 7919) % 10_007;
});
const labels = numbers.map(String);
const repeated = numbers.map(function (n) {
	return n % 500;
});

export default [
	{
		name: 'map → filter → take → toArray (10k)',
		fn: function () {
			const doubled = map(numbers, function (n) {
				return n * 2;
			});
			const multiples = filter(doubled, function (n) {
				return n % 3 === 0;
			});
			return toArray(take(multiples, 2000));
		},
		baseline: function () {
			return numbers
				.map(function (n) {
					return n * 2;
				})
				.filter(function (n) {
					return n % 3 === 0;
				})
				.slice(0, 2000);
		}
	},
	{
		name: 'unique (10k numbers, 500 distinct)',
		fn: function () {
			return toArray(unique(repeated));
		},
		baseline: function () {
			return Array.from(new Set(repeated));
		}
	},
	{
		name: 'zip (10k × 2)',
		fn: function () {
			return toArray(zip(numbers, labels));
		}
	},
	{
		name: 'chunk (10k, size 100)',
		fn: function () {
			return toArray(chunk(numbers, 100));
		}
	},
	{
		name: 'windowed (10k, size 3)',
		fn: function () {
			return toArray(windowed(numbers, 3));
		}
	},
	{
		name: 'reduce (10k)',
		fn: function () {
			return reduce(
				numbers,
				function (total, n) {
					return total + n;
				},
				0
			);
		},
		baseline: function () {
			return numbers.reduce(function (total, n) {
				return total + n;
			}, 0);
		}
	}
];
