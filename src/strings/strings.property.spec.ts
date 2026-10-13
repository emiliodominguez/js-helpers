import fc from 'fast-check';

import * as helpers from '.';

/**
 * Loads a fresh copy of the module while `Intl.Segmenter` is unavailable (code-point fallback).
 */
function loadWithoutSegmenter(): typeof helpers {
	const intl = Intl as any;
	const original = intl.Segmenter;
	let isolated: typeof helpers | undefined;

	try {
		delete intl.Segmenter;
		jest.isolateModules(function () {
			isolated = jest.requireActual<typeof helpers>('./index');
		});
		isolated!.reverse('warm-up');
	} finally {
		intl.Segmenter = original;
	}

	return isolated!;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function graphemes(value: string): string[] {
	return Array.from(segmenter.segment(value), function (data) {
		return data.segment;
	});
}

function codePoints(value: string): string[] {
	return Array.from(value);
}

/**
 * Lowercase ASCII words starting with two letters. Shorter words are inherently ambiguous once joined without separators:
 * `toPascalCase('a b')` is `'AB'` and `toPascalCase('a0 b0')` is `'A0B0'`, which read back as a single acronym.
 */
const asciiWord = fc.stringMatching(/^[a-z]{2}[a-z0-9]{0,6}$/);
const lowerLetterWord = fc.stringMatching(/^[a-z]{2,8}$/);
const separator = fc.constantFrom(' ', '  ', '_', '-', '.', ' - ', '__', '/');

/** ASCII alphanumeric words joined by arbitrary separators. */
const separatedWords = fc.tuple(fc.array(asciiWord, { minLength: 1, maxLength: 6 }), fc.array(separator, { minLength: 6, maxLength: 6 })).map(function ([words, seps]) {
	return words
		.map(function (word, index) {
			return index === 0 ? word : seps[index] + word;
		})
		.join('');
});

/** Lowercase ASCII letter words separated by single spaces. */
const spacedLowerWords = fc.array(lowerLetterWord, { minLength: 1, maxLength: 6 }).map(function (words) {
	return words.join(' ');
});

const caseFunctions = [helpers.toSnakeCase, helpers.toKebabCase, helpers.toConstantCase, helpers.toCamelCase, helpers.toPascalCase];

describe('String helpers (properties)', function () {
	describe('reverse', function () {
		it('is an involution on grapheme strings', function () {
			fc.assert(
				fc.property(fc.string({ unit: 'grapheme' }), function (s) {
					expect(helpers.reverse(helpers.reverse(s))).toBe(s);
				})
			);
		});

		it('reverses the grapheme sequence', function () {
			fc.assert(
				fc.property(fc.string({ unit: 'grapheme' }), function (s) {
					expect(graphemes(helpers.reverse(s))).toEqual(graphemes(s).reverse());
				})
			);
		});

		it('preserves the multiset of code points (and therefore the code-point length) for any string', function () {
			fc.assert(
				fc.property(fc.string({ unit: 'binary' }), function (s) {
					const reversed = helpers.reverse(s);
					expect(codePoints(reversed)).toHaveLength(codePoints(s).length);
					expect(codePoints(reversed).sort()).toEqual(codePoints(s).sort());
				})
			);
		});

		it('is an involution on arbitrary code points in the fallback mode', function () {
			const fallback = loadWithoutSegmenter();

			fc.assert(
				fc.property(fc.string({ unit: 'binary' }), function (s) {
					expect(fallback.reverse(fallback.reverse(s))).toBe(s);
					expect(fallback.reverse(s)).toBe(codePoints(s).reverse().join(''));
				})
			);
		});
	});

	describe('isPalindrome', function () {
		it('accepts s + reverse(s)', function () {
			fc.assert(
				fc.property(fc.string({ unit: 'grapheme' }), function (s) {
					expect(helpers.isPalindrome(s + helpers.reverse(s))).toBe(true);
				})
			);
		});
	});

	describe('capitalize / uncapitalize', function () {
		it('round-trips strings starting with a lowercase ASCII letter', function () {
			fc.assert(
				fc.property(fc.stringMatching(/^[a-z]/), fc.string({ unit: 'grapheme' }), function (head, rest) {
					const s = head + rest;
					expect(helpers.uncapitalize(helpers.capitalize(s))).toBe(s);
				})
			);
		});

		it('only changes the first grapheme', function () {
			fc.assert(
				fc.property(fc.string({ unit: 'grapheme', minLength: 1 }), function (s) {
					const tail = s.slice(graphemes(s)[0].length);
					expect(helpers.capitalize(s).endsWith(tail)).toBe(true);
					expect(helpers.uncapitalize(s).endsWith(tail)).toBe(true);
				})
			);
		});
	});

	describe('replace', function () {
		it('matches the split/join reference implementation', function () {
			fc.assert(
				fc.property(fc.string(), fc.string({ minLength: 1, maxLength: 3 }), fc.string(), function (s, search, replacement) {
					expect(helpers.replace(s, search, replacement)).toBe(s.split(search).join(replacement));
				})
			);
		});

		it('matches the reference on a small alphabet (frequent matches)', function () {
			const small = fc.string({ unit: fc.constantFrom('a', 'b', '.', '$', '&') });
			fc.assert(
				fc.property(small, small.filter(Boolean), small, function (s, search, replacement) {
					expect(helpers.replace(s, search, replacement)).toBe(s.split(search).join(replacement));
				})
			);
		});

		it('leaves no occurrence of a single-character search value when the replacement does not contain it', function () {
			fc.assert(
				fc.property(fc.string(), fc.string({ minLength: 1, maxLength: 1 }), fc.string(), function (s, search, replacement) {
					fc.pre(!replacement.includes(search));
					expect(helpers.replace(s, search, replacement).includes(search)).toBe(false);
				})
			);
		});
	});

	describe('countSubString', function () {
		it('matches the split-based reference implementation', function () {
			const small = fc.string({ unit: fc.constantFrom('a', 'b', '.', '(') });
			fc.assert(
				fc.property(small, small.filter(Boolean), function (s, sub) {
					expect(helpers.countSubString(s, sub)).toBe(s.split(sub).length - 1);
				})
			);
		});

		it('ignoreCase matches the reference on lower-cased inputs', function () {
			fc.assert(
				fc.property(
					fc.string({ unit: fc.constantFrom('a', 'A', 'b', 'B') }),
					fc.string({ unit: fc.constantFrom('a', 'A', 'b'), minLength: 1, maxLength: 3 }),
					function (s, sub) {
						expect(helpers.countSubString(s, sub, { ignoreCase: true })).toBe(s.toLowerCase().split(sub.toLowerCase()).length - 1);
					}
				)
			);
		});

		it('counts the copies of a repeated substring', function () {
			fc.assert(
				fc.property(fc.string({ minLength: 1 }), fc.nat(20), function (sub, n) {
					expect(helpers.countSubString(sub.repeat(n), sub)).toBe(n);
				})
			);
		});
	});

	describe('escapeRegExp', function () {
		it('builds a pattern that matches exactly the input', function () {
			fc.assert(
				fc.property(fc.string({ unit: 'grapheme' }), fc.string(), function (s, other) {
					const escaped = helpers.escapeRegExp(s);
					expect(new RegExp(escaped).test(s)).toBe(true);
					expect(new RegExp(`^${escaped}$`).test(s)).toBe(true);
					expect(new RegExp(`^${escaped}$`, 'u').test(s)).toBe(true);
					expect(new RegExp(`^${escaped}$`).test(other)).toBe(other === s);
				})
			);
		});
	});

	describe('escapeHtml / unescapeHtml', function () {
		it('round-trips any string', function () {
			fc.assert(
				fc.property(fc.string({ unit: 'binary' }), function (s) {
					expect(helpers.unescapeHtml(helpers.escapeHtml(s))).toBe(s);
				})
			);
		});

		it('round-trips strings full of entity-like text', function () {
			const entityish = fc.string({ unit: fc.constantFrom('&', 'amp;', 'lt;', 'gt;', 'quot;', '#39;', '#x27;', '<', '>', '"', "'", 'a') });
			fc.assert(
				fc.property(entityish, function (s) {
					expect(helpers.unescapeHtml(helpers.escapeHtml(s))).toBe(s);
				})
			);
		});

		it('produces no raw special characters', function () {
			const entityish = fc.string({ unit: fc.constantFrom('&', 'amp;', '<', '>', '"', "'", 'x', ';') });
			fc.assert(
				fc.property(fc.oneof(fc.string(), entityish), function (s) {
					const escaped = helpers.escapeHtml(s);
					expect(/[<>"']/.test(escaped)).toBe(false);
					expect(/&(?!(?:amp|lt|gt|quot|#39);)/.test(escaped)).toBe(false);
				})
			);
		});
	});

	describe('toSlug', function () {
		it('produces a well-formed slug and is idempotent', function () {
			fc.assert(
				fc.property(fc.oneof(fc.string(), fc.string({ unit: 'grapheme' }), fc.string({ unit: 'binary' })), function (s) {
					const slug = helpers.toSlug(s);
					expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$|^$/);
					expect(helpers.toSlug(slug)).toBe(slug);
				})
			);
		});
	});

	describe('case conversions', function () {
		it('are idempotent on their own output', function () {
			fc.assert(
				fc.property(separatedWords, function (s) {
					for (const convert of caseFunctions) {
						const once = convert(s);
						expect(convert(once)).toBe(once);
					}
				})
			);
		});

		it('preserve the word sequence when converting between cases', function () {
			fc.assert(
				fc.property(spacedLowerWords, function (s) {
					const expected = helpers.toSnakeCase(s);
					expect(expected).toBe(s.split(' ').join('_'));
					for (const convert of caseFunctions) {
						expect(helpers.toSnakeCase(convert(s))).toBe(expected);
					}
				})
			);
		});

		it('agree on the word sequence for separated alphanumeric words', function () {
			fc.assert(
				fc.property(separatedWords, function (s) {
					const snake = helpers.toSnakeCase(s);
					expect(helpers.toKebabCase(s)).toBe(snake.replace(/_/g, '-'));
					expect(helpers.toConstantCase(s)).toBe(snake.toUpperCase());
					expect(helpers.toSnakeCase(helpers.toKebabCase(s))).toBe(snake);
					expect(helpers.toSnakeCase(helpers.toConstantCase(s))).toBe(snake);
				})
			);
		});

		it('only emit letters, digits and their own separator', function () {
			fc.assert(
				fc.property(fc.string({ unit: 'grapheme' }), function (s) {
					expect(helpers.toKebabCase(s)).not.toMatch(/^-|-$|--|[\s_]/);
					expect(helpers.toSnakeCase(s)).not.toMatch(/^_|_$|__|[\s-]/);
					expect(helpers.toCamelCase(s)).not.toMatch(/[\s_-]/);
				})
			);
		});
	});

	describe('toTitleCase', function () {
		it('is idempotent and preserves whitespace positions', function () {
			fc.assert(
				fc.property(fc.oneof(fc.string(), fc.string({ unit: 'grapheme' })), function (s) {
					const titled = helpers.toTitleCase(s);
					expect(helpers.toTitleCase(titled)).toBe(titled);
					expect(titled.match(/\s+/g) ?? []).toEqual(s.match(/\s+/g) ?? []);
				})
			);
		});

		it('preserves the length of ASCII strings', function () {
			fc.assert(
				fc.property(fc.string(), function (s) {
					expect(helpers.toTitleCase(s)).toHaveLength(s.length);
					expect(helpers.toTitleCase(s).toLowerCase()).toBe(s.toLowerCase());
				})
			);
		});
	});

	describe('truncate', function () {
		it('returns a prefix plus the suffix, bounded by length graphemes', function () {
			fc.assert(
				fc.property(fc.string({ unit: 'grapheme' }), fc.nat(20), fc.string({ maxLength: 3 }), function (s, length, suffix) {
					const result = helpers.truncate(s, length, suffix);
					const count = graphemes(s).length;

					if (count <= length) {
						expect(result).toBe(s);
					} else {
						expect(result.endsWith(suffix)).toBe(true);
						const prefix = result.slice(0, result.length - suffix.length);
						expect(s.startsWith(prefix)).toBe(true);
						expect(graphemes(prefix)).toEqual(graphemes(s).slice(0, length));
					}
				})
			);
		});

		it('never splits a surrogate pair', function () {
			fc.assert(
				fc.property(fc.string({ unit: 'binary' }), fc.nat(20), function (s, length) {
					const result = helpers.truncate(s, length, '');
					expect(s.startsWith(result)).toBe(true);
					expect(/[\uD800-\uDBFF]$/.test(result)).toBe(false);
				})
			);
		});
	});

	describe('normalizeWhitespace', function () {
		it('is idempotent and leaves no leading, trailing or repeated whitespace', function () {
			const spacey = fc.string({ unit: fc.constantFrom(' ', '\t', '\n', '\u00a0', 'a', 'b') });
			fc.assert(
				fc.property(fc.oneof(fc.string(), spacey), function (s) {
					const normalized = helpers.normalizeWhitespace(s);
					expect(helpers.normalizeWhitespace(normalized)).toBe(normalized);
					expect(normalized).not.toMatch(/^\s|\s$|\s\s|[^\S ]/);
					expect(normalized.split(' ').filter(Boolean)).toEqual(s.split(/\s+/).filter(Boolean));
				})
			);
		});
	});

	describe('removeDiacritics', function () {
		it('is idempotent and leaves ASCII untouched', function () {
			fc.assert(
				fc.property(fc.string({ unit: 'grapheme' }), fc.string(), function (s, ascii) {
					const cleaned = helpers.removeDiacritics(s);
					expect(helpers.removeDiacritics(cleaned)).toBe(cleaned);
					expect(helpers.removeDiacritics(ascii)).toBe(ascii);
				})
			);
		});
	});

	describe('toBoolean / toNumber', function () {
		it('toBoolean ignores surrounding whitespace and case', function () {
			fc.assert(
				fc.property(
					fc.constantFrom('true', '1', 'yes', 'y', 'on', 'false', '0', 'no', 'off', ''),
					fc.stringMatching(/^\s*$/),
					fc.boolean(),
					function (value, pad, upper) {
						const input = pad + (upper ? value.toUpperCase() : value) + pad;
						expect(helpers.toBoolean(input)).toBe(['true', '1', 'yes', 'y', 'on'].includes(value));
					}
				)
			);
		});

		it('toNumber round-trips integers and returns NaN for blank strings', function () {
			fc.assert(
				fc.property(fc.integer(), fc.stringMatching(/^\s*$/), function (n, pad) {
					expect(helpers.toNumber(pad + String(n) + pad)).toBe(n);
					expect(helpers.toNumber(pad)).toBeNaN();
				})
			);
		});
	});

	describe('interpolate', function () {
		it('substitutes every known key and leaves templates without placeholders unchanged', function () {
			fc.assert(
				fc.property(fc.dictionary(fc.stringMatching(/^[a-z]{1,5}$/), fc.string()), fc.string(), function (values, text) {
					fc.pre(!/[{}]/.test(text));
					const keys = Object.keys(values);
					const template = keys
						.map(function (key) {
							return `{${key}}`;
						})
						.join(text);
					const expected = keys
						.map(function (key) {
							return values[key];
						})
						.join(text);
					expect(helpers.interpolate(template, values)).toBe(expected);
					expect(helpers.interpolate(text, values)).toBe(text);
				})
			);
		});
	});
});
