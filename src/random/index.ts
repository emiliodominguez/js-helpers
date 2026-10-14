import { sample, shuffle } from '../arrays/index.js';
import { randomBetween } from '../math/index.js';
import { assertNumber, describe, draw } from '../utils/assert.js';
import type { RandomGenerator } from '../utils/index.js';

/**
 * Snapshot of a {@link SeededRandom}'s internal 128-bit state: four unsigned 32-bit integers.
 * Obtain it with {@link SeededRandom.state} and pass it to {@link SeededRandom.restore} to replay a stream.
 */
export type SeededRandomState = readonly [number, number, number, number];

/**
 * A deterministic pseudo-random generator created by {@link createRandom}.
 *
 * It is callable like `Math.random` (returns floats in `[0, 1)`), so it can be passed anywhere a {@link RandomGenerator}
 * is accepted, and it also exposes convenience methods that all draw from the same stream.
 *
 * **Not cryptographically secure** — use {@link randomBytes}, {@link randomId} or {@link randomUUID} for secrets.
 */
export interface SeededRandom {
	/** Returns the next float in `[0, 1)` (32 bits of precision) and advances the stream. */
	(): number;
	/**
	 * Returns an unbiased random integer in `[ceil(min), floor(max)]` (both inclusive).
	 * @throws {TypeError} when a bound is not a number
	 * @throws {RangeError} when a bound is not finite, no integer lies in the range, a bound is not a safe integer, or the range spans more than `2 ** 53` values
	 */
	int(min: number, max: number): number;
	/**
	 * Returns a random float in `[min, max)` (`min` when both bounds are equal).
	 * @throws {TypeError} when a bound is not a number
	 * @throws {RangeError} when a bound is not finite or `min > max`
	 */
	float(min: number, max: number): number;
	/**
	 * Returns `true` with the given probability.
	 * @throws {TypeError} when `probability` is not a number
	 * @throws {RangeError} when `probability` is outside `[0, 1]` or NaN
	 */
	bool(probability?: number): boolean;
	/** Returns a random item of `array`, or `undefined` when it is empty (the stream is then not advanced). */
	pick<T>(array: ReadonlyArray<T>): T | undefined;
	/** Returns a shuffled copy of `array` (Fisher–Yates); the input is not mutated. */
	shuffle<T>(array: ReadonlyArray<T>): T[];
	/** Creates an independent child generator seeded from this stream (advances this stream by four draws). */
	fork(): SeededRandom;
	/** Returns a snapshot of the current internal state. */
	state(): SeededRandomState;
	/**
	 * Replaces the internal state (mutates this generator) so the stream continues from `snapshot`.
	 * @throws {TypeError} when `snapshot` is not an array of four unsigned 32-bit integers
	 */
	restore(snapshot: SeededRandomState): void;
}

/**
 * Structural subset of the WebCrypto `Crypto` object, so the module does not depend on the DOM or Node type libraries.
 */
interface CryptoLike {
	getRandomValues(array: Uint8Array): Uint8Array;
	randomUUID?(): string;
}

/**
 * The URL-safe 64-character alphabet used by default by {@link randomId} (`A-Z`, `a-z`, `0-9`, `_` and `-`).
 */
export const URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

/** `2 ** 32`, the number of distinct 32-bit outputs. */
const UINT32_RANGE = 4294967296;

/** Largest byte count a single `crypto.getRandomValues` call accepts (WebCrypto quota). */
const MAX_RANDOM_VALUES_BYTES = 65536;

/**
 * Hashes a string into 128 bits of state (cyrb128 by bryc), using only 32-bit integer math so results are identical on every platform.
 * @param {string} text - The text to hash
 * @returns {number[]} Four unsigned 32-bit integers
 */
function cyrb128(text: string): [number, number, number, number] {
	let h1 = 1779033703;
	let h2 = 3144134277;
	let h3 = 1013904242;
	let h4 = 2773480762;
	for (let i = 0; i < text.length; i++) {
		const k = text.charCodeAt(i);
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
	h1 ^= h2 ^ h3 ^ h4;
	h2 ^= h1;
	h3 ^= h1;
	h4 ^= h1;
	return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * Builds a seeded generator around a mutable sfc32 state.
 * @param {number[]} seedState - Four 32-bit integers used as the initial state (copied)
 * @returns {SeededRandom} The generator
 */
function fromState(seedState: SeededRandomState): SeededRandom {
	let a = seedState[0] | 0;
	let b = seedState[1] | 0;
	let c = seedState[2] | 0;
	let d = seedState[3] | 0;

	/**
	 * Advances the sfc32 state (Small Fast Chaotic, 32-bit) and returns the next unsigned 32-bit output.
	 * @returns {number} An integer in `[0, 2 ** 32)`
	 */
	function nextUint32(): number {
		const t = (((a + b) | 0) + d) | 0;
		d = (d + 1) | 0;
		a = b ^ (b >>> 9);
		b = (c + (c << 3)) | 0;
		c = (c << 21) | (c >>> 11);
		c = (c + t) | 0;
		return t >>> 0;
	}

	// Discard the first outputs to decorrelate the stream from the (possibly similar) seeds.
	for (let i = 0; i < 15; i++) nextUint32();

	/**
	 * Draws an unbiased integer in `[0, range)` by rejection sampling, for `1 <= range <= 2 ** 53`.
	 * @param {number} range - The number of possible outcomes
	 * @returns {number} An integer in `[0, range)`
	 */
	function below(range: number): number {
		if (range <= UINT32_RANGE) {
			const limit = UINT32_RANGE - (UINT32_RANGE % range);
			let value = nextUint32();
			while (value >= limit) value = nextUint32();
			return value % range;
		}
		const space = 2 ** 53;
		const limit = space - (space % range);
		let value: number;
		do {
			value = (nextUint32() >>> 11) * UINT32_RANGE + nextUint32();
		} while (value >= limit);
		return value % range;
	}

	/**
	 * Returns the next float in `[0, 1)`.
	 * @returns {number} The next output divided by `2 ** 32`
	 */
	function generator(): number {
		return nextUint32() / UINT32_RANGE;
	}

	return Object.freeze(
		Object.assign(generator, {
			int: function int(min: number, max: number): number {
				assertNumber('SeededRandom.int', 'min', min, Number.isFinite(min), 'a finite number');
				assertNumber('SeededRandom.int', 'max', max, Number.isFinite(max), 'a finite number');
				const low = Math.ceil(min);
				const high = Math.floor(max);
				if (low > high) throw new RangeError(`SeededRandom.int: no integer exists in [${min}, ${max}]`);
				if (!Number.isSafeInteger(low) || !Number.isSafeInteger(high) || high - low > Number.MAX_SAFE_INTEGER) {
					throw new RangeError(`SeededRandom.int: [${min}, ${max}] must lie within safe integers and span at most 2 ** 53 values`);
				}
				return low + below(high - low + 1);
			},
			float: function float(min: number, max: number): number {
				return randomBetween(min, max, generator);
			},
			bool: function bool(probability: number = 0.5): boolean {
				return randomBoolean(probability, generator);
			},
			pick: function pick<T>(array: ReadonlyArray<T>): T | undefined {
				return sample(array, generator);
			},
			shuffle: function shuffleCopy<T>(array: ReadonlyArray<T>): T[] {
				return shuffle(array, generator);
			},
			fork: function fork(): SeededRandom {
				// Mix the parent's outputs with distinct constants so the child state never mirrors the parent's.
				return fromState([nextUint32() ^ 0x9e3779b9, nextUint32() ^ 0x243f6a88, nextUint32() ^ 0xb7e15162, nextUint32()]);
			},
			state: function state(): SeededRandomState {
				return Object.freeze([a >>> 0, b >>> 0, c >>> 0, d >>> 0] as const);
			},
			restore: function restore(snapshot: SeededRandomState): void {
				// An index loop (not `every`, which skips holes) so sparse arrays are rejected too.
				let valid = Array.isArray(snapshot) && snapshot.length === 4;
				for (let i = 0; valid && i < 4; i++) {
					const word: unknown = snapshot[i];
					valid = Number.isInteger(word) && (word as number) >= 0 && (word as number) < UINT32_RANGE;
				}
				if (!valid) {
					throw new TypeError('SeededRandom.restore: `snapshot` must be an array of four unsigned 32-bit integers');
				}
				a = snapshot[0] | 0;
				b = snapshot[1] | 0;
				c = snapshot[2] | 0;
				d = snapshot[3] | 0;
			}
		})
	);
}

/**
 * Creates a deterministic, seedable pseudo-random generator (sfc32, seeded through the cyrb128 string hash).
 *
 * The same seed always produces the same sequence on every platform and engine (only 32-bit integer math is used).
 * Numeric seeds are hashed through `String(seed)`, so `createRandom(1)` and `createRandom('1')` are the same stream.
 *
 * **Not cryptographically secure**: the output is predictable from the seed or from a few observed values.
 * Use {@link randomBytes}, {@link randomId} or {@link randomUUID} for tokens, keys or anything security-sensitive.
 * @param {number | string} seed - A finite number or any string
 * @returns {SeededRandom} A callable generator returning floats in `[0, 1)` with `int`, `float`, `bool`, `pick`, `shuffle`, `fork`, `state` and `restore` methods
 * @throws {TypeError} when `seed` is neither a number nor a string
 * @throws {RangeError} when `seed` is a non-finite number (NaN or ±Infinity)
 * @example
 * const rng = createRandom('my-seed');
 * rng(); // a float in [0, 1), always the same for this seed
 * rng.int(1, 6); // a die roll
 * rng.shuffle([1, 2, 3]); // a deterministic permutation
 * randomGaussian(0, 1, rng); // usable wherever a `Math.random`-like generator is expected
 * createRandom('my-seed')() === createRandom('my-seed')(); // => true // same seed, same sequence
 */
export function createRandom(seed: number | string): SeededRandom {
	if (typeof seed === 'number') {
		if (!Number.isFinite(seed)) throw new RangeError(`createRandom: \`seed\` must be a finite number or a string, got ${seed}`);
	} else if (typeof seed !== 'string') {
		throw new TypeError(`createRandom: \`seed\` must be a finite number or a string, got ${describe(seed)}`);
	}
	return fromState(cyrb128(String(seed)));
}

/**
 * Returns the platform's WebCrypto object, or throws when no CSPRNG is available.
 * @param {string} caller - Name of the public function, used in the error message
 * @returns {CryptoLike} The `globalThis.crypto` object
 * @throws {Error} when `globalThis.crypto.getRandomValues` is not available
 */
function getCrypto(caller: string): CryptoLike {
	const candidate = (globalThis as unknown as { crypto?: Partial<CryptoLike> | null }).crypto;
	if (candidate == null || typeof candidate.getRandomValues !== 'function') {
		throw new Error(`${caller}: no cryptographically secure random source is available (globalThis.crypto.getRandomValues is missing)`);
	}
	return candidate as CryptoLike;
}

/**
 * Generates cryptographically secure random bytes using `globalThis.crypto.getRandomValues`.
 * Requests larger than 65,536 bytes (the WebCrypto per-call limit) are filled in chunks.
 * @param {number} length - Number of bytes to generate (a non-negative safe integer)
 * @returns {Uint8Array} A fresh array of `length` random bytes
 * @throws {TypeError} when `length` is not a number
 * @throws {RangeError} when `length` is not a non-negative safe integer
 * @throws {Error} when no cryptographically secure random source is available
 * @example
 * randomBytes(16); // e.g. Uint8Array(16) [ 211, 7, 92, ... ]
 * randomBytes(16).length; // => 16
 */
export function randomBytes(length: number): Uint8Array {
	assertNumber('randomBytes', 'length', length, Number.isSafeInteger(length) && length >= 0, 'a safe integer >= 0');
	const crypto = getCrypto('randomBytes');
	const bytes = new Uint8Array(length);
	for (let offset = 0; offset < length; offset += MAX_RANDOM_VALUES_BYTES) {
		crypto.getRandomValues(bytes.subarray(offset, offset + MAX_RANDOM_VALUES_BYTES));
	}
	return bytes;
}

/**
 * Generates a random RFC 4122 / RFC 9562 version 4 UUID (e.g. `'3b241101-e2bb-4255-8caf-4136c566a962'`).
 * Uses `globalThis.crypto.randomUUID` when available, otherwise builds one from `crypto.getRandomValues`.
 * Never falls back to `Math.random`.
 * @returns {string} A lowercase, hyphenated version 4 UUID
 * @throws {Error} when no cryptographically secure random source is available
 * @example
 * randomUUID(); // e.g. 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
 * /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(randomUUID()); // => true
 */
export function randomUUID(): string {
	const candidate = (globalThis as unknown as { crypto?: Partial<CryptoLike> | null }).crypto;
	if (candidate != null && typeof candidate.randomUUID === 'function') return candidate.randomUUID();

	// Use our own buffer rather than the return value, which some `getRandomValues` polyfills leave undefined.
	const bytes = new Uint8Array(16);
	getCrypto('randomUUID').getRandomValues(bytes);
	bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
	let hex = '';
	for (let i = 0; i < 16; i++) {
		if (i === 4 || i === 6 || i === 8 || i === 10) hex += '-';
		hex += bytes[i].toString(16).padStart(2, '0');
	}
	return hex;
}

/**
 * Generates a cryptographically secure random identifier (nanoid-style).
 *
 * Characters are drawn with `crypto.getRandomValues` and a bit mask plus rejection sampling, so every character of
 * `alphabet` is exactly equally likely whatever its length. The alphabet is split into Unicode code points, so it may
 * contain astral characters (emoji); `size` counts code points, not UTF-16 units.
 * @param {number} [size=21] - Number of characters to generate (a non-negative safe integer)
 * @param {string} [alphabet=URL_ALPHABET] - Between 2 and 256 distinct characters to draw from
 * @returns {string} A random string of `size` characters from `alphabet`
 * @throws {TypeError} when `size` is not a number
 * @throws {RangeError} when `size` is not a non-negative safe integer, or `alphabet` has fewer than 2 or more than 256 characters or contains duplicates
 * @throws {Error} when no cryptographically secure random source is available
 * @example
 * randomId(); // e.g. 'V1StGXR8_Z5jdHi6B-myT'
 * randomId(6, '0123456789'); // e.g. '409182'
 * randomId().length; // => 21
 */
export function randomId(size: number = 21, alphabet: string = URL_ALPHABET): string {
	assertNumber('randomId', 'size', size, Number.isSafeInteger(size) && size >= 0, 'a safe integer >= 0');
	const characters = Array.from(alphabet);
	const length = characters.length;
	if (length < 2 || length > 256) {
		throw new RangeError(`randomId: \`alphabet\` must contain between 2 and 256 characters, got ${length}`);
	}
	if (new Set(characters).size !== length) {
		throw new RangeError('randomId: `alphabet` must not contain duplicate characters');
	}
	getCrypto('randomId');

	// Smallest all-ones bit mask covering every index; values above `length - 1` are rejected to stay unbiased.
	const mask = (2 << (31 - Math.clz32((length - 1) | 1))) - 1;
	// Over-request bytes so a single batch usually suffices (the expected acceptance rate is `length / (mask + 1)` > 1/2).
	const step = Math.min(Math.ceil((1.6 * mask * size) / length), MAX_RANDOM_VALUES_BYTES);
	let id = '';
	let count = 0;
	while (count < size) {
		const bytes = randomBytes(step);
		for (let i = 0; i < step && count < size; i++) {
			const index = bytes[i] & mask;
			if (index < length) {
				id += characters[index];
				count++;
			}
		}
	}
	return id;
}

/**
 * Picks a random item, with each item's chance proportional to its weight.
 * Items with weight `0` are never returned.
 * @template T
 * @param {ReadonlyArray<T>} items - The candidates
 * @param {ReadonlyArray<number>} weights - One finite, non-negative weight per item (they need not sum to 1)
 * @param {RandomGenerator} [random=Math.random] - Source of uniform numbers in `[0, 1)`, injectable for deterministic results
 * @returns {T} The chosen item
 * @throws {TypeError} when `random` is not a function, or a weight is a non-number that does not coerce to a valid weight
 * @throws {RangeError} when the arrays differ in length, a weight is negative, NaN or infinite, the total weight is zero or not finite, or `random()` returns a value outside `[0, 1)`
 * @example
 * weightedRandom(['common', 'rare'], [9, 1]); // 'common' ~90% of the time
 * weightedRandom(['a', 'b', 'c'], [0, 1, 0]); // => 'b' // always
 */
export function weightedRandom<T>(items: ReadonlyArray<T>, weights: ReadonlyArray<number>, random: RandomGenerator = Math.random): T {
	if (items.length !== weights.length) {
		throw new RangeError(`weightedRandom: \`items\` and \`weights\` must have the same length, got ${items.length} and ${weights.length}`);
	}
	let total = 0;
	let lastPositive = -1;
	for (let i = 0; i < weights.length; i++) {
		const weight = weights[i];
		if (!(weight >= 0 && weight < Infinity)) assertNumber('weightedRandom', `weights[${i}]`, weight, false, 'a finite number >= 0');
		total += weight;
		if (weight > 0) lastPositive = i;
	}
	if (!(total > 0 && total < Infinity)) {
		throw new RangeError(`weightedRandom: the total weight must be positive and finite, got ${total}`);
	}

	const target = draw('weightedRandom', random) * total;
	let cumulative = 0;
	// A zero-weight item can never satisfy `target < cumulative` before an earlier positive item did, so it is never chosen.
	// The last positive item takes whatever remains, which also absorbs floating-point rounding at the top end.
	for (let i = 0; i < lastPositive; i++) {
		cumulative += weights[i];
		if (target < cumulative) return items[i];
	}
	return items[lastPositive];
}

/**
 * Draws a normally distributed (Gaussian) random number using the Box–Muller transform.
 * The first uniform sample is mapped to `(0, 1]` so `Math.log` never sees `0`.
 * @param {number} [mean=0] - Mean of the distribution (finite)
 * @param {number} [stdDev=1] - Standard deviation (finite, non-negative; `0` always returns `mean`)
 * @param {RandomGenerator} [random=Math.random] - Source of uniform numbers in `[0, 1)`, called twice per draw
 * @returns {number} A sample from `N(mean, stdDev²)`
 * @throws {TypeError} when `mean` or `stdDev` is not a number, or `random` is not a function
 * @throws {RangeError} when `mean` is not finite, `stdDev` is negative or not finite, or `random()` returns a value outside `[0, 1)`
 * @example
 * randomGaussian(); // e.g. -0.4271…
 * randomGaussian(100, 15); // e.g. 112.3…
 */
export function randomGaussian(mean: number = 0, stdDev: number = 1, random: RandomGenerator = Math.random): number {
	assertNumber('randomGaussian', 'mean', mean, Number.isFinite(mean), 'a finite number');
	assertNumber('randomGaussian', 'stdDev', stdDev, stdDev >= 0 && stdDev < Infinity, 'a finite number >= 0');
	const u1 = 1 - draw('randomGaussian', random);
	const u2 = draw('randomGaussian', random);
	return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Returns `true` with the given probability.
 * `probability = 0` never returns `true` and `probability = 1` always does.
 * @param {number} [probability=0.5] - Chance of `true`, in `[0, 1]`
 * @param {RandomGenerator} [random=Math.random] - Source of uniform numbers in `[0, 1)`, injectable for deterministic results
 * @returns {boolean} A random boolean
 * @throws {TypeError} when `probability` is not a number, or `random` is not a function
 * @throws {RangeError} when `probability` is outside `[0, 1]` or NaN, or `random()` returns a value outside `[0, 1)`
 * @example
 * randomBoolean(); // true or false
 * randomBoolean(0.9); // true ~90% of the time
 */
export function randomBoolean(probability: number = 0.5, random: RandomGenerator = Math.random): boolean {
	assertNumber('randomBoolean', 'probability', probability, probability >= 0 && probability <= 1, 'a number in [0, 1]');
	return draw('randomBoolean', random) < probability;
}
