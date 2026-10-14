import { chunk, countBy, flattenDeep, groupBy, keyBy, removeDuplicates, sortBy, symmetricDifference, uniqueBy } from '@emiliodominguez/js-helpers/arrays';

const numbers = Array.from({ length: 10_000 }, function (_, index) {
	return (index * 7919) % 10_007;
});
const users = numbers.map(function (n) {
	return { id: n, team: `team-${n % 20}`, name: `user-${n}` };
});
const repeated = numbers.map(function (n) {
	return n % 500;
});
const nested = Array.from({ length: 1000 }, function (_, index) {
	return [index, [index + 1, [index + 2, [index + 3]]], index + 4];
});

export default [
	{
		name: 'removeDuplicates (10k numbers)',
		fn: function () {
			return removeDuplicates(numbers);
		},
		baseline: function () {
			return Array.from(new Set(numbers));
		}
	},
	{
		name: 'groupBy (10k objects, 20 groups)',
		fn: function () {
			return groupBy(users, function (user) {
				return user.team;
			});
		}
	},
	{
		name: 'sortBy (10k objects)',
		fn: function () {
			return sortBy(users, function (user) {
				return user.id;
			});
		},
		baseline: function () {
			return users.slice().sort(function (a, b) {
				return a.id - b.id;
			});
		}
	},
	{
		name: 'sortBy (10k objects, string keys)',
		fn: function () {
			return sortBy(users, function (user) {
				return user.name;
			});
		}
	},
	{
		name: 'keyBy (10k objects)',
		fn: function () {
			return keyBy(users, function (user) {
				return user.id;
			});
		}
	},
	{
		name: 'countBy (10k objects, 20 groups)',
		fn: function () {
			return countBy(users, function (user) {
				return user.team;
			});
		}
	},
	{
		name: 'uniqueBy (10k objects, 20 keys)',
		fn: function () {
			return uniqueBy(users, function (user) {
				return user.team;
			});
		}
	},
	{
		name: 'symmetricDifference (10k + 10k numbers)',
		fn: function () {
			return symmetricDifference(numbers, repeated);
		}
	},
	{
		name: 'flattenDeep (1k items, 4 levels)',
		fn: function () {
			return flattenDeep(nested);
		},
		baseline: function () {
			return nested.flat(Infinity);
		}
	},
	{
		name: 'chunk (10k, size 100)',
		fn: function () {
			return chunk(numbers, 100);
		}
	}
];
