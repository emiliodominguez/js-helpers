import { createRandom, randomBytes, randomGaussian, randomId, weightedRandom } from '@emiliodominguez/js-helpers/random';

const rng = createRandom('bench');
const items = Array.from({ length: 100 }, function (_, index) {
	return index;
});
const weights = items.map(function (index) {
	return (index % 7) + 1;
});

export default [
	{
		name: 'createRandom (seed string)',
		fn: function () {
			return createRandom('a reasonably long seed string');
		}
	},
	{
		name: 'rng() (1000 floats)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < 1000; i++) total += rng();
			return total;
		},
		baseline: function () {
			let total = 0;
			for (let i = 0; i < 1000; i++) total += Math.random();
			return total;
		}
	},
	{
		name: 'rng.int(1, 100) (1000 draws)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < 1000; i++) total += rng.int(1, 100);
			return total;
		}
	},
	{
		name: 'rng.float(-5, 5) (1000 draws)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < 1000; i++) total += rng.float(-5, 5);
			return total;
		}
	},
	{
		name: 'rng.shuffle (100 items)',
		fn: function () {
			return rng.shuffle(items);
		}
	},
	{
		name: 'weightedRandom (100 items)',
		fn: function () {
			return weightedRandom(items, weights, rng);
		}
	},
	{
		name: 'randomGaussian (1000 draws)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < 1000; i++) total += randomGaussian(0, 1, rng);
			return total;
		}
	},
	{
		name: 'randomId() (21 chars, 64-char alphabet)',
		fn: function () {
			return randomId();
		}
	},
	{
		name: 'randomId(16, digits)',
		fn: function () {
			return randomId(16, '0123456789');
		}
	},
	{
		name: 'randomId(1000)',
		fn: function () {
			return randomId(1000);
		}
	},
	{
		name: 'randomBytes(32)',
		fn: function () {
			return randomBytes(32);
		}
	}
];
