import fc from 'fast-check';
import * as helpers from '.';

// Small alphabets so that matches (and ties) are frequent; separators and case changes exercise the word-start bonuses.
const alphabet = fc.constantFrom('a', 'b', 'c', 'A', 'B', ' ', '-', '_', '.', 'é', '😀');
const shortText = fc.array(alphabet, { maxLength: 9 }).map(function (chars) {
	return chars.join('');
});
const shortQuery = fc.array(alphabet, { maxLength: 4 }).map(function (chars) {
	return chars.join('');
});
const lowerWord = fc.array(fc.constantFrom('a', 'b', 'c'), { minLength: 1, maxLength: 4 }).map(function (chars) {
	return chars.join('');
});

function fold(char: string, caseSensitive: boolean): string {
	return caseSensitive ? char : char.toLowerCase();
}

function isWord(c: string | undefined): boolean {
	return c !== undefined && /[\p{L}\p{N}]/u.test(c);
}

/** Independent re-implementation of the documented scoring of one alignment (positions are code point indices). */
function referenceScore(query: string[], target: string[], positions: number[]): number {
	let score = -Math.min(positions[0], 8);
	positions.forEach(function (p, i) {
		const prev = target[p - 1];
		const boundary = p === 0 || (isWord(target[p]) && !isWord(prev)) || (prev !== prev.toUpperCase() && target[p] !== target[p].toLowerCase());
		score += 16 + (boundary ? 8 : 0) + (query[i] === target[p] ? 1 : 0);
		if (i > 0) {
			const gap = p - positions[i - 1] - 1;
			score += gap === 0 ? 5 : -3 - (gap - 1);
		}
	});
	return score;
}

/** Brute force: the best score over every alignment, or undefined when there is none. */
function bruteForce(query: string, target: string, caseSensitive: boolean): number | undefined {
	const q = Array.from(query);
	const t = Array.from(target);
	if (q.length === 0) return 0;
	let best: number | undefined;
	(function search(i: number, from: number, positions: number[]): void {
		if (i === q.length) {
			const score = referenceScore(q, t, positions);
			if (best === undefined || score > best) best = score;
			return;
		}
		for (let p = from; p < t.length; p++) {
			if (fold(q[i], caseSensitive) === fold(t[p], caseSensitive)) search(i + 1, p + 1, [...positions, p]);
		}
	})(0, 0, []);
	return best;
}

/** UTF-16 ranges → code point positions in `target`. */
function positionsOf(target: string, ranges: Array<[number, number]>): number[] {
	const positions: number[] = [];
	let offset = 0;
	Array.from(target).forEach(function (char, index) {
		if (
			ranges.some(function ([start, end]) {
				return offset >= start && offset < end;
			})
		)
			positions.push(index);
		offset += char.length;
	});
	return positions;
}

describe('Search helpers (property-based)', function () {
	describe('fuzzyMatch', function () {
		it('should be defined iff the query is a subsequence, and score the optimal alignment (vs brute force)', function () {
			fc.assert(
				fc.property(shortQuery, shortText, fc.boolean(), function (query, target, caseSensitive) {
					const result = helpers.fuzzyMatch(query, target, { caseSensitive });
					const expected = bruteForce(query, target, caseSensitive);
					expect(result?.score).toBe(expected);
				}),
				{ numRuns: 500 }
			);
		});

		it('should find the optimum on queries built from the target (always matching)', function () {
			fc.assert(
				fc.property(
					shortText.chain(function (target) {
						return fc.tuple(fc.constant(target), fc.subarray(Array.from(target)));
					}),
					function ([target, chars]) {
						const query = chars.join('');
						const result = helpers.fuzzyMatch(query, target);
						expect(result).toBeDefined();
						expect(result!.score).toBe(bruteForce(query, target, false));
					}
				)
			);
		});

		it('should return sorted, non-overlapping, merged, in-bounds ranges that spell the query with the reported score', function () {
			fc.assert(
				fc.property(shortQuery, shortText, function (query, target) {
					const result = helpers.fuzzyMatch(query, target);
					if (result === undefined) return;
					const { ranges, score } = result;
					ranges.forEach(function ([start, end], i) {
						expect(0 <= start && start < end && end <= target.length).toBe(true);
						if (i > 0) expect(start).toBeGreaterThan(ranges[i - 1][1]);
					});
					const spelled = ranges
						.map(function ([start, end]) {
							return target.slice(start, end);
						})
						.join('');
					expect(spelled.toLowerCase()).toBe(query.toLowerCase());
					if (query !== '') expect(referenceScore(Array.from(query), Array.from(target), positionsOf(target, ranges))).toBe(score);
				})
			);
		});

		it('should score an exact prefix at least as high as the same query scattered', function () {
			fc.assert(
				fc.property(
					lowerWord,
					fc.array(fc.constantFrom('a', 'b', 'x', ' ', '-', '_'), { maxLength: 6 }),
					fc.array(fc.constantFrom('a', 'x', ' ', '-'), { maxLength: 3 }),
					function (query, fillers, suffix) {
						const scattered = Array.from(query)
							.map(function (char, i) {
								return (fillers[i] ?? '') + char;
							})
							.join('');
						const prefixed = query + suffix.join('');
						expect(helpers.fuzzyMatch(query, prefixed)!.score).toBeGreaterThanOrEqual(helpers.fuzzyMatch(query, scattered)!.score);
					}
				)
			);
		});
	});

	describe('fuzzySearch', function () {
		it('should return the matching items, sorted by score, ties in original order', function () {
			fc.assert(
				fc.property(fc.array(shortText, { maxLength: 15 }), shortQuery, function (items, query) {
					const results = helpers.fuzzySearch(
						items.map(function (text, index) {
							return { text, index };
						}),
						query,
						{
							key: function (item) {
								return item.text;
							}
						}
					);
					const expected = items
						.map(function (text, index) {
							return { index, match: helpers.fuzzyMatch(query, text) };
						})
						.filter(function (entry) {
							return entry.match !== undefined;
						});
					expect(results).toHaveLength(expected.length);
					results.forEach(function (result, i) {
						expect(result.score).toBe(helpers.fuzzyMatch(query, result.key)!.score);
						if (i > 0) {
							const previous = results[i - 1];
							expect(previous.score > result.score || (previous.score === result.score && previous.item.index < result.item.index)).toBe(true);
						}
					});
				})
			);
		});

		it('should agree with the unlimited search for any limit and threshold', function () {
			fc.assert(
				fc.property(fc.array(shortText, { maxLength: 15 }), shortQuery, fc.nat(20), fc.integer({ min: -20, max: 80 }), function (items, query, limit, threshold) {
					const all = helpers.fuzzySearch(items, query);
					expect(helpers.fuzzySearch(items, query, { limit, threshold })).toEqual(
						all
							.filter(function (r) {
								return r.score >= threshold;
							})
							.slice(0, limit)
					);
				})
			);
		});

		it('should pick the best of several keys', function () {
			fc.assert(
				fc.property(fc.array(shortText, { minLength: 1, maxLength: 4 }), shortQuery, function (texts, query) {
					const results = helpers.fuzzySearch([texts], query, {
						key: function (item) {
							return item;
						}
					});
					const scores = texts
						.map(function (text) {
							return helpers.fuzzyMatch(query, text)?.score;
						})
						.filter(function (score): score is number {
							return score !== undefined;
						});
					if (scores.length === 0) expect(results).toEqual([]);
					else expect(results[0].score).toBe(Math.max(...scores));
				})
			);
		});
	});

	describe('highlight', function () {
		it('should produce segments that concatenate to the text and whose flags match the ranges', function () {
			fc.assert(
				fc.property(
					fc.string({ maxLength: 20 }).chain(function (text) {
						const bound = fc.nat(text.length);
						return fc.tuple(
							fc.constant(text),
							fc.array(
								fc.tuple(bound, bound).map(function ([a, b]): [number, number] {
									return [Math.min(a, b), Math.max(a, b)];
								}),
								{ maxLength: 5 }
							)
						);
					}),
					function ([text, ranges]) {
						const segments = helpers.highlight(text, ranges);
						expect(
							segments
								.map(function (s) {
									return s.text;
								})
								.join('')
						).toBe(text);
						let offset = 0;
						segments.forEach(function (segment, i) {
							expect(segment.text).not.toBe('');
							if (i > 0) expect(segment.match).not.toBe(segments[i - 1].match);
							for (let k = offset; k < offset + segment.text.length; k++) {
								const covered = ranges.some(function ([start, end]) {
									return k >= start && k < end;
								});
								expect(covered).toBe(segment.match);
							}
							offset += segment.text.length;
						});
					}
				)
			);
		});
	});
});
