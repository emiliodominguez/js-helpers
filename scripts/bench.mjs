// Micro-benchmark runner. Runs every `bench/*.bench.mjs` (or the ones named on the command line) against the BUILT
// package, so run `yarn build` first. Each bench file default-exports an array of cases:
//   { name: string, fn: () => unknown, baseline?: () => unknown, competitors?: Record<string, () => unknown> }
// Functions returning a promise are measured as async: every call is awaited before the next one.
// `baseline` is an optional reference implementation (e.g. the naive approach) reported side by side.
// `competitors` maps library names (es-toolkit, lodash-es, date-fns, ...) to equivalent calls; each is reported as a ratio.
// Pass --json to print machine-readable results instead (one object per case).
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
 * Builds a fresh timing loop for one function. Every case gets its own compiled loop (`new Function`), so V8 cannot
 * share one call site's type feedback across cases: a single shared loop goes megamorphic after a few cases and
 * skews every later measurement.
 * @returns {(fn: () => unknown, iterations: number) => number} Runs `fn` `iterations` times, returns elapsed ms
 */
function createSyncLoop() {
	return new Function(
		'now',
		'record',
		'return function (fn, iterations) { const start = now(); let last; for (let i = 0; i < iterations; i++) last = fn(); record(last); return now() - start; };'
	)(performance.now.bind(performance), function (value) {
		sink = value;
	});
}

/**
 * Builds a fresh timing loop for one async function (each call is awaited before the next one starts).
 * @returns {(fn: () => Promise<unknown>, iterations: number) => Promise<number>} Elapsed ms for `iterations` awaited calls
 */
function createAsyncLoop() {
	return new Function(
		'now',
		'record',
		'return async function (fn, iterations) { const start = now(); let last; for (let i = 0; i < iterations; i++) last = await fn(); record(last); return now() - start; };'
	)(performance.now.bind(performance), function (value) {
		sink = value;
	});
}

/**
 * Measures how many times per second `fn` runs, as the median of several timed samples. Functions that return a
 * promise on their first call are measured as async (each call awaited).
 * @param {() => unknown} fn - The function to measure
 * @returns {Promise<number>} Operations per second
 */
async function measure(fn) {
	const isAsync = typeof fn()?.then === 'function';
	const loop = isAsync ? createAsyncLoop() : createSyncLoop();
	let iterations = 1;

	// Calibrate: grow the batch until one sample takes a measurable amount of time (also warms up the JIT).
	while ((await loop(fn, iterations)) < TARGET_MS / SAMPLES) iterations *= 2;

	const rates = [];
	for (let sample = 0; sample < SAMPLES; sample++) rates.push(iterations / ((await loop(fn, iterations)) / 1000));

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

const args = process.argv.slice(2);
const json = args.includes('--json');
const only = args.filter(function (arg) {
	return !arg.startsWith('--');
});
const results = [];
const files = readdirSync(new URL('../bench/', import.meta.url))
	.filter(function (file) {
		return file.endsWith('.bench.mjs') && (only.length === 0 || only.includes(file.replace('.bench.mjs', '')));
	})
	.sort();

for (const file of files) {
	const { default: cases } = await import(pathToFileURL(new URL(`../bench/${file}`, import.meta.url).pathname).href);
	if (!json) console.log(`\n${file.replace('.bench.mjs', '')}`);

	for (const benchCase of cases) {
		const rate = await measure(benchCase.fn);
		const result = { module: file.replace('.bench.mjs', ''), name: benchCase.name, rate, others: {} };
		let line = `  ${benchCase.name.padEnd(48)} ${formatRate(rate).padStart(16)}`;
		const others = Object.assign(benchCase.baseline ? { baseline: benchCase.baseline } : {}, benchCase.competitors ?? {});

		for (const [label, fn] of Object.entries(others)) {
			const otherRate = await measure(fn);
			result.others[label] = otherRate;
			line += `   ${label} ×${(rate / otherRate).toFixed(2)}`;
		}

		results.push(result);
		if (!json) console.log(line);
	}
}

if (json) console.log(JSON.stringify(results, null, '\t'));
if (sink === Symbol.for('never')) console.log(sink);
