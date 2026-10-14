import { chunk, groupBy, removeDuplicates, sortBy } from '@emiliodominguez/js-helpers/arrays';

const numbers = Array.from({ length: 10_000 }, function (_, index) {
	return (index * 7919) % 10_007;
});
const users = numbers.map(function (n) {
	return { id: n, team: `team-${n % 20}` };
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
		name: 'chunk (10k, size 100)',
		fn: function () {
			return chunk(numbers, 100);
		}
	}
];
