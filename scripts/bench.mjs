// Micro-benchmark runner. Runs every `bench/*.bench.mjs` (or the ones named on the command line) against the BUILT
// package, so run `yarn build` first. Each bench file default-exports an array of cases:
//   { name: string, fn: () => unknown, baseline?: () => unknown }
// `baseline` is an optional reference implementation (e.g. the naive approach) reported side by side.
// Usage: yarn bench [arrays objects ...]
import { readdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const TARGET_MS = 250;
const SAMPLES = 7;

/**
 * Prevents dead-code elimination of benchmarked results.
 * @type {unknown}
 */
let sink;

/**
 * Measures how many times per second `fn` runs, as the median of several timed samples.
 * @param {() => unknown} fn - The function to measure
 * @returns {number} Operations per second
 */
function measure(fn) {
	let iterations = 1;
	// Calibrate: grow the batch until one sample takes a measurable amount of time (also warms up the JIT).
	for (;;) {
		const start = performance.now();
		for (let i = 0; i < iterations; i++) sink = fn();
		const elapsed = performance.now() - start;
		if (elapsed >= TARGET_MS / SAMPLES) break;
		iterations *= 2;
	}

	const rates = [];
	for (let sample = 0; sample < SAMPLES; sample++) {
		const start = performance.now();
		for (let i = 0; i < iterations; i++) sink = fn();
		rates.push(iterations / ((performance.now() - start) / 1000));
	}

	return rates.sort(function (a, b) {
		return a - b;
	})[Math.floor(SAMPLES / 2)];
}

/**
 * Formats an operations-per-second figure compactly.
 * @param {number} rate - Operations per second
 * @returns {string} The formatted rate
 */
function formatRate(rate) {
	if (rate >= 1e6) return `${(rate / 1e6).toFixed(2)}M ops/s`;
	if (rate >= 1e3) return `${(rate / 1e3).toFixed(1)}k ops/s`;
	return `${rate.toFixed(1)} ops/s`;
}

const only = process.argv.slice(2);
const files = readdirSync(new URL('../bench/', import.meta.url))
	.filter(function (file) {
		return file.endsWith('.bench.mjs') && (only.length === 0 || only.includes(file.replace('.bench.mjs', '')));
	})
	.sort();

for (const file of files) {
	const { default: cases } = await import(pathToFileURL(new URL(`../bench/${file}`, import.meta.url).pathname).href);
	console.log(`\n${file.replace('.bench.mjs', '')}`);

	for (const benchCase of cases) {
		const rate = measure(benchCase.fn);
		let line = `  ${benchCase.name.padEnd(48)} ${formatRate(rate).padStart(16)}`;

		if (benchCase.baseline) {
			const baselineRate = measure(benchCase.baseline);
			line += `   baseline ${formatRate(baselineRate).padStart(16)}   ×${(rate / baselineRate).toFixed(2)}`;
		}

		console.log(line);
	}
}

if (sink === Symbol.for('never')) console.log(sink);
