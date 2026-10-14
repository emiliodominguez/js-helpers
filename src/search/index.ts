import { assertFunction, assertInteger, assertNumber, describe as typeName } from '../utils/assert.js';

/** Points awarded for every matched character. */
const MATCH = 16;
/** Bonus for a matched character that starts a word. */
const BOUNDARY = 8;
/** Bonus for a matched character that directly follows the previous matched character. */
const CONSECUTIVE = 5;
/** Bonus for a matched character whose case is exactly the query's. */
const EXACT_CASE = 1;
/** Penalty for opening a gap (one or more skipped characters) between two matched characters. */
const GAP_START = -3;
/** Penalty for every skipped character of a gap after the first one. */
const GAP_EXTENSION = -1;
/** Largest penalty (one point per character) for the characters skipped before the first match. */
const MAX_LEADING_PENALTY = 8;
/** A letter or a digit, in any script. */
const WORD = /[\p{L}\p{N}]/u;

/**
 * Options accepted by {@link fuzzyMatch}.
 */
export interface FuzzyMatchOptions {
	/**
	 * When `true`, characters only match when their case is identical.
	 * @default false
	 */
	caseSensitive?: boolean;
}

/**
 * A successful {@link fuzzyMatch}.
 */
export interface FuzzyMatch {
	/** Score of the best alignment of the query in the target (higher is better). Scores are integers and only meaningful relative to each other. */
	score: number;
	/** Half-open `[start, end)` UTF-16 index ranges of the matched characters in the target: ascending, non-overlapping, adjacent ranges merged. */
	ranges: Array<[number, number]>;
}

/**
 * Options accepted by {@link fuzzySearch}.
 * @template T - The type of the searched items
 */
export interface FuzzySearchOptions<T> {
	/** Returns the text(s) to match for an item; when it returns several, the best-scoring one is used. Required unless the items are strings. */
	key?: (item: T) => string | ReadonlyArray<string>;
	/**
	 * Maximum number of results.
	 * @default Infinity
	 */
	limit?: number;
	/**
	 * Matches scoring below this value are dropped.
	 * @default -Infinity
	 */
	threshold?: number;
	/**
	 * When `true`, characters only match when their case is identical.
	 * @default false
	 */
	caseSensitive?: boolean;
}

/**
 * One result of {@link fuzzySearch}.
 * @template T - The type of the searched items
 */
export interface FuzzySearchResult<T> extends FuzzyMatch {
	/** The matching item. */
	item: T;
	/** The text that matched (the item itself, or the best of the texts returned by `key`): `ranges` index into it. */
	key: string;
}

/**
 * A segment of text produced by {@link highlight}.
 */
export interface HighlightSegment {
	/** The segment's text (never empty). */
	text: string;
	/** Whether the segment is covered by a range. */
	match: boolean;
}

/**
 * Throws a `TypeError` unless `value` is a string.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {string} name - Name of the validated parameter
 * @param {unknown} value - The value to validate
 * @returns {void}
 * @throws {TypeError} when `value` is not a string
 */
function assertString(caller: string, name: string, value: unknown): asserts value is string {
	if (typeof value !== 'string') throw new TypeError(`${caller}: \`${name}\` must be a string, got ${typeName(value)}`);
}

/**
 * Lower-cases one character (the case-insensitive folding of {@link fuzzyMatch}).
 * @param {string} char - A code point
 * @returns {string} Its lower-case form
 */
function lower(char: string): string {
	return char.toLowerCase();
}

/**
 * Returns its argument (the case-sensitive folding of {@link fuzzyMatch}).
 * @param {string} char - A code point
 * @returns {string} The same code point
 */
function identity(char: string): string {
	return char;
}

/**
 * Unvalidated implementation of {@link fuzzyMatch}: finds the best-scoring alignment with an O(n·m) dynamic program.
 *
 * `row[j]` holds the best score of an alignment of the first `i + 1` query characters whose last one is matched at target
 * position `j`. Gap penalties are affine, so the best gapped predecessor is maintained incrementally (Gotoh's algorithm):
 * `gap = max(gap + GAP_EXTENSION, previousRow[j - 2] + GAP_START)`.
 * @param {string} query - The query
 * @param {string} target - The text searched
 * @param {boolean} caseSensitive - Whether case must match exactly
 * @returns {FuzzyMatch | undefined} The best alignment, or `undefined` when the query is not a subsequence of the target
 */
function match(query: string, target: string, caseSensitive: boolean): FuzzyMatch | undefined {
	const q = Array.from(query);
	const t = Array.from(target);
	const m = q.length;
	const n = t.length;
	const fold = caseSensitive ? identity : lower;
	const fq = q.map(fold);
	const ft = t.map(fold);

	// Fast rejection (the common case while filtering): greedy subsequence check.
	let matched = 0;
	for (let j = 0; j < n && matched < m; j++) if (fq[matched] === ft[j]) matched++;
	if (matched < m) return undefined;
	if (m === 0) return { score: 0, ranges: [] };

	const bonus = t.map(function (char, j) {
		const previous = t[j - 1];
		return j === 0 || (WORD.test(char) && !WORD.test(previous)) || (previous !== previous.toUpperCase() && char !== char.toLowerCase()) ? BOUNDARY : 0;
	});
	const back = new Int32Array(m * n);
	let previousRow = new Float64Array(0);

	for (let i = 0; i < m; i++) {
		const row = new Float64Array(n).fill(-Infinity);
		let gap = -Infinity;
		let gapFrom = -1;
		for (let j = i; j < n; j++) {
			if (i > 0 && j > 1) {
				gap += GAP_EXTENSION;
				const open = previousRow[j - 2] + GAP_START;
				if (open >= gap) {
					gap = open;
					gapFrom = j - 2;
				}
			}
			if (fq[i] !== ft[j]) continue;
			let score = -Math.min(j, MAX_LEADING_PENALTY);
			let from = -1;
			if (i > 0) {
				const consecutive = previousRow[j - 1] + CONSECUTIVE;
				score = consecutive >= gap ? consecutive : gap;
				from = consecutive >= gap ? j - 1 : gapFrom;
			}
			row[j] = score + MATCH + bonus[j] + (q[i] === t[j] ? EXACT_CASE : 0);
			back[i * n + j] = from;
		}
		previousRow = row;
	}

	let score = -Infinity;
	let end = 0;
	previousRow.forEach(function (value, j) {
		if (value > score) {
			score = value;
			end = j;
		}
	});

	const positions = new Set<number>();
	for (let i = m - 1; i >= 0; i--) {
		positions.add(end);
		end = back[i * n + end];
	}

	const ranges: Array<[number, number]> = [];
	let offset = 0;
	t.forEach(function (char, j) {
		if (positions.has(j)) {
			const last = ranges[ranges.length - 1];
			if (last !== undefined && last[1] === offset) last[1] += char.length;
			else ranges.push([offset, offset + char.length]);
		}
		offset += char.length;
	});

	return { score, ranges };
}

/**
 * Fuzzy-matches `query` against `target` (as in command palettes and filter-as-you-type lists): the query matches when all of
 * its characters appear in the target in order, not necessarily contiguously. Among all such alignments, the one with the
 * highest score is returned, found exactly with an O(n·m) dynamic program (in the spirit of fzf's v2 algorithm / Smith–Waterman).
 *
 * Scoring (all integers, so results are deterministic) — each matched character earns `16`, plus:
 * - `+8` when it starts a word: first character of the target, a letter/digit after any other character (space, `-`, `_`, `.`, `/`...),
 *   or an upper-case letter after a lower-case one (camelCase);
 * - `+5` when it directly follows the previous matched character;
 * - `+1` when its case is exactly the query's;
 * - a gap of `g` skipped characters between two matched characters costs `3 + (g - 1)`;
 * - characters skipped before the first match cost `1` each, at most `8` in total.
 *
 * So an exact prefix always scores at least as much as the same query scattered over word starts, and shorter, tighter, earlier matches rank higher.
 * Among equally-scored alignments the one ending first is chosen, preferring consecutive matches.
 *
 * Characters are compared per Unicode code point after `toLowerCase()` (locale-independent; skipped when `caseSensitive`), so the
 * ranges never split a surrogate pair. There is no normalization and no grapheme segmentation: a precomposed `'é'` does not
 * match `'e'` + combining accent, characters whose lower case expands (`'İ'`) only match themselves, and ranges may split
 * multi-code-point graphemes (flags, ZWJ emoji). Normalize both strings (e.g. `.normalize('NFC')`) beforehand when that matters.
 *
 * An empty query matches every target with score `0` and no ranges. Time and memory are O(query length × target length).
 * @param {string} query - The characters to look for, in order
 * @param {string} target - The text to search in
 * @param {FuzzyMatchOptions} [options={}] - `caseSensitive` (default `false`)
 * @returns {FuzzyMatch | undefined} The score and matched ranges of the best alignment, or `undefined` when the query is not a subsequence of the target
 * @throws {TypeError} when `query` or `target` is not a string
 * @example
 * fuzzyMatch('fb', 'fooBar'); // => { score: 45, ranges: [[0, 1], [3, 4]] }
 * fuzzyMatch('bar', 'fooBar'); // => { score: 65, ranges: [[3, 6]] }
 * fuzzyMatch('rab', 'fooBar'); // => undefined
 * fuzzyMatch('', 'anything'); // => { score: 0, ranges: [] }
 * @example
 * // Word starts and consecutive runs beat scattered matches:
 * fuzzyMatch('gc', 'git commit').score > fuzzyMatch('gc', 'magic').score; // => true
 * fuzzyMatch('ab', 'Ab', { caseSensitive: true }); // => undefined
 */
export function fuzzyMatch(query: string, target: string, options: FuzzyMatchOptions = {}): FuzzyMatch | undefined {
	assertString('fuzzyMatch', 'query', query);
	assertString('fuzzyMatch', 'target', target);
	return match(query, target, options.caseSensitive === true);
}

/**
 * Fuzzy-filters and ranks `items` by how well they match `query` (see {@link fuzzyMatch} for the matching and scoring rules).
 * Results are sorted by descending score; ties keep the original order of `items`. An empty query matches every item with score `0`,
 * so the full list (up to `limit`) is returned in its original order.
 * @template T - The type of the searched items
 * @param {Iterable<T>} items - The items to search; strings unless `key` is given
 * @param {string} query - The characters to look for, in order
 * @param {FuzzySearchOptions<T>} [options={}] - `key` (text(s) of an item, best one wins), `limit`, `threshold` (minimum score), `caseSensitive`
 * @returns {Array<FuzzySearchResult<T>>} The matching items with their score, matched `key` text and its `ranges`, best first
 * @throws {TypeError} when `query` is not a string, `key` is not a function, or an item (without `key`) / a text returned by `key` is not a string
 * @throws {RangeError} when `limit` is not an integer >= 0 (or `Infinity`), or `threshold` is `NaN`
 * @example
 * fuzzySearch(['src/index.ts', 'README.md', 'src/search/index.ts'], 'sri').map(function (r) { return r.item; }); // => ['src/index.ts', 'src/search/index.ts']
 * @example
 * const commands = [{ title: 'Open File', id: 'open' }, { title: 'Find in Files', id: 'find' }, { title: 'Format Document', id: 'format' }];
 * const results = fuzzySearch(commands, 'ff', { key: function (c) { return c.title; }, limit: 1 });
 * results.map(function (r) { return r.item.id; }); // => ['find']
 * results[0].ranges; // => [[0, 1], [8, 9]]
 */
export function fuzzySearch(items: Iterable<string>, query: string, options?: FuzzySearchOptions<string>): Array<FuzzySearchResult<string>>;
export function fuzzySearch<T>(items: Iterable<T>, query: string, options: FuzzySearchOptions<T> & Required<Pick<FuzzySearchOptions<T>, 'key'>>): Array<FuzzySearchResult<T>>;
export function fuzzySearch<T>(items: Iterable<T>, query: string, options: FuzzySearchOptions<T> = {}): Array<FuzzySearchResult<T>> {
	const { key, limit = Infinity, threshold = -Infinity, caseSensitive = false } = options;
	assertString('fuzzySearch', 'query', query);
	if (key !== undefined) assertFunction('fuzzySearch', 'key', key);
	assertInteger('fuzzySearch', 'limit', limit, 0, true);
	assertNumber('fuzzySearch', 'threshold', threshold, !Number.isNaN(threshold), 'a number');

	const results: Array<FuzzySearchResult<T>> = [];
	for (const item of items) {
		const texts: unknown = key === undefined ? item : key(item);
		let best: FuzzySearchResult<T> | undefined;
		for (const text of Array.isArray(texts) ? (texts as unknown[]) : [texts]) {
			assertString('fuzzySearch', key === undefined ? 'item' : 'key(item)', text);
			const result = match(query, text, caseSensitive);
			if (result !== undefined && result.score >= threshold && (best === undefined || result.score > best.score)) best = { item, key: text, ...result };
		}
		if (best !== undefined) results.push(best);
	}

	return results
		.sort(function (a, b) {
			return b.score - a.score;
		})
		.slice(0, limit);
}

/**
 * Splits `text` into alternating matched / unmatched segments, e.g. to render the `ranges` of {@link fuzzyMatch} with `<mark>`
 * elements in React (no `dangerouslySetInnerHTML` needed). Ranges are half-open `[start, end)` UTF-16 indices; they may be given
 * in any order and may overlap or touch (they are merged). Empty ranges are ignored. Segments are never empty, and two consecutive
 * segments never have the same `match` flag.
 * @param {string} text - The text to split
 * @param {Iterable<readonly [number, number]>} ranges - The `[start, end)` ranges to mark
 * @returns {HighlightSegment[]} Segments whose texts concatenate back to `text` (`[]` for an empty text)
 * @throws {TypeError} when `text` is not a string or a bound is not a number
 * @throws {RangeError} when a bound is not an integer, or not `0 <= start <= end <= text.length`
 * @example
 * highlight('fooBar', [[0, 1], [3, 4]]); // => [{ text: 'f', match: true }, { text: 'oo', match: false }, { text: 'B', match: true }, { text: 'ar', match: false }]
 * highlight('abc', [[1, 2], [0, 2]]); // => [{ text: 'ab', match: true }, { text: 'c', match: false }]
 * highlight('abc', [[2, 5]]); // throws RangeError
 * @example
 * // doctest: skip
 * const { ranges } = fuzzyMatch(query, label) ?? { ranges: [] };
 * highlight(label, ranges).map(function (s, i) { return s.match ? <mark key={i}>{s.text}</mark> : s.text; });
 */
export function highlight(text: string, ranges: Iterable<readonly [number, number]>): HighlightSegment[] {
	assertString('highlight', 'text', text);
	const sorted = Array.from(ranges, function ([start, end]) {
		assertNumber('highlight', 'start', start, Number.isInteger(start) && start >= 0 && start <= text.length, `an integer between 0 and ${text.length}`);
		assertNumber('highlight', 'end', end, Number.isInteger(end) && end >= start && end <= text.length, `an integer between ${start} and ${text.length}`);
		return [start, end];
	}).sort(function (a, b) {
		return a[0] - b[0];
	});

	const segments: HighlightSegment[] = [];
	let cursor = 0;

	/**
	 * Appends `text[cursor, end)` with the given flag (merged into the last segment when it has the same flag), if not empty.
	 * @param {number} end - End of the segment
	 * @param {boolean} matched - Whether the segment is marked
	 * @returns {void}
	 */
	function push(end: number, matched: boolean): void {
		if (end <= cursor) return;
		const last = segments[segments.length - 1];
		const slice = text.slice(cursor, end);
		if (last !== undefined && last.match === matched) last.text += slice;
		else segments.push({ text: slice, match: matched });
		cursor = end;
	}

	for (const [start, end] of sorted) {
		push(start, false);
		push(end, true);
	}
	push(text.length, false);
	return segments;
}
