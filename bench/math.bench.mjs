import { average, cumulativeSum, formatBytes, median, normalize, quantile, round, roundToStep, sum, variance, weightedAverage } from '@emiliodominguez/js-helpers/math';

// Deterministic pseudo-random data (no Math.random, so every run measures the same work).
const large = Array.from({ length: 100_000 }, function (_, index) {
	return ((index * 7919) % 10_007) / 7.3 - 500;
});
const medium = large.slice(0, 10_000);
const weights = medium.map(function (_, index) {
	return (index % 13) + 1;
});
const toRound = medium.slice(0, 1000);
const byteCounts = Array.from({ length: 1000 }, function (_, index) {
	return index * index * 1234.5;
});

export default [
	{
		name: 'sum (100k floats)',
		fn: function () {
			return sum(large);
		},
		baseline: function () {
			let total = 0;
			for (let i = 0; i < large.length; i++) total += large[i];
			return total;
		}
	},
	{
		name: 'average (100k floats)',
		fn: function () {
			return average(large);
		}
	},
	{
		name: 'variance (100k floats)',
		fn: function () {
			return variance(large);
		}
	},
	{
		name: 'median (10k floats)',
		fn: function () {
			return median(medium);
		}
	},
	{
		name: 'quantile (10k floats, q = 0.9)',
		fn: function () {
			return quantile(medium, 0.9);
		}
	},
	{
		name: 'cumulativeSum (10k floats)',
		fn: function () {
			return cumulativeSum(medium);
		}
	},
	{
		name: 'weightedAverage (10k floats)',
		fn: function () {
			return weightedAverage(medium, weights);
		}
	},
	{
		name: 'normalize (10k floats)',
		fn: function () {
			return normalize(medium);
		}
	},
	{
		name: 'round (1000 floats, 2 decimals)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < toRound.length; i++) total += round(toRound[i], 2);
			return total;
		},
		baseline: function () {
			let total = 0;
			for (let i = 0; i < toRound.length; i++) total += Math.round(toRound[i] * 100) / 100;
			return total;
		}
	},
	{
		name: 'roundToStep (1000 floats, step 0.25)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < toRound.length; i++) total += roundToStep(toRound[i], 0.25);
			return total;
		}
	},
	{
		name: 'formatBytes (1000 values)',
		fn: function () {
			let length = 0;
			for (let i = 0; i < byteCounts.length; i++) length += formatBytes(byteCounts[i]).length;
			return length;
		}
	}
];
