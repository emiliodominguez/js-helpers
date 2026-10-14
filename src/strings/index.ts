import type { RandomGenerator } from '../utils/index.js';

/**
 * Options accepted by {@link countSubString}.
 */
export interface CountSubStringOptions {
	/** Compare case-insensitively (both strings are lower-cased with `String.prototype.toLowerCase`). Defaults to `false`. */
	readonly ignoreCase?: boolean;
}

/**
 * Options accepted by {@link isPalindrome}.
 */
export interface IsPalindromeOptions {
	/** Compare case-insensitively. Defaults to `false`. */
	readonly ignoreCase?: boolean;
	/** Ignore every character that is not a Unicode letter, combining mark or number (spaces, punctuation, symbols...). Defaults to `false`. */
	readonly ignoreNonAlphanumeric?: boolean;
}

/**
 * Values accepted by {@link interpolate}: a (possibly nested) record whose leaves are stringified with `String()`.
 */
export type InterpolationValues = Readonly<Record<string, unknown>>;

/**
 * Lazily created grapheme segmenter. `undefined` = not initialized yet, `null` = `Intl.Segmenter` is not available.
 */
let graphemeSegmenter: Intl.Segmenter | null | undefined;

/**
 * Returns the shared grapheme segmenter, creating it on first use.
 * @returns {Intl.Segmenter | null} The segmenter, or `null` when the runtime has no `Intl.Segmenter`
 */
function getGraphemeSegmenter(): Intl.Segmenter | null {
	if (graphemeSegmenter === undefined) {
		graphemeSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
	}

	return graphemeSegmenter;
}

/**
 * Lazily iterates the user-perceived characters of a string: grapheme clusters when `Intl.Segmenter` is available, code points otherwise.
 * @param {string} string - The string to iterate
 * @returns {Generator<string, void, undefined>} An iterator over the graphemes (or code points) of `string`
 */
function* iterateGraphemes(string: string): Generator<string, void, undefined> {
	const segmenter = getGraphemeSegmenter();

	if (segmenter === null) {
		yield* string;
		return;
	}

	for (const data of segmenter.segment(string)) yield data.segment;
}

/**
 * Splits a string into grapheme clusters (or code points when `Intl.Segmenter` is unavailable).
 * @param {string} string - The string to split
 * @returns {string[]} The graphemes of `string`
 */
function splitGraphemes(string: string): string[] {
	return Array.from(iterateGraphemes(string));
}

/**
 * Returns the first grapheme cluster (or code point) of a string.
 * @param {string} string - The string to inspect
 * @returns {string} The first grapheme, or `''` for an empty string
 */
function firstGrapheme(string: string): string {
	const result = iterateGraphemes(string).next();

	return result.done ? '' : result.value;
}

/**
 * Latin digraphs, whose Unicode title-case form is a dedicated letter (`ǆ` → `ǅ`) rather than their upper-case form (`Ǆ`).
 */
const TITLE_CASE_EXCEPTIONS: ReadonlyMap<string, string> = new Map([
	['Ǆ', 'ǅ'],
	['ǅ', 'ǅ'],
	['ǆ', 'ǅ'],
	['Ǉ', 'ǈ'],
	['ǈ', 'ǈ'],
	['ǉ', 'ǈ'],
	['Ǌ', 'ǋ'],
	['ǋ', 'ǋ'],
	['ǌ', 'ǋ'],
	['Ǳ', 'ǲ'],
	['ǲ', 'ǲ'],
	['ǳ', 'ǲ']
]);

/**
 * Title-cases a single letter (one code point) for use at the start of a word. Digraphs use their dedicated title-case letter (`'ǆ'` → `'ǅ'`).
 * When the upper-case mapping expands to several code points (`'ß'` → `'SS'`, `'ﬁ'` → `'FI'`) only the first one stays upper-case
 * (`'Ss'`, `'Fi'`), approximating Unicode title case.
 * @param {string} letter - The letter to convert
 * @returns {string} The title-cased letter
 */
function titleCaseLetter(letter: string): string {
	const exception = TITLE_CASE_EXCEPTIONS.get(letter);

	if (exception !== undefined) return exception;

	const upper = letter.toUpperCase();
	const head = String.fromCodePoint(upper.codePointAt(0) as number);

	return head + upper.slice(head.length).toLowerCase();
}

/**
 * Lower-cases a word and title-cases its first code point.
 * @param {string} word - The word to convert
 * @returns {string} The converted word (`'hELLO'` → `'Hello'`)
 */
function upperFirstLowerRest(word: string): string {
	return word.toLowerCase().replace(/^./su, titleCaseLetter);
}

/**
 * Splits an identifier or free text into words for the case-conversion helpers.
 *
 * Rules:
 * - Apostrophes (`'` and `’`) are removed (`"don't"` → `dont`).
 * - Any character that is not a Unicode letter, combining mark or number separates words (whitespace, `-`, `_`, `.`, other punctuation, symbols).
 * - A lower-case letter or digit followed by an upper-case letter starts a new word (`helloWorld` → `hello`, `World`; `version2Beta` → `version2`, `Beta`).
 * - Inside a run of upper-case letters, the last one starts a new word when followed by a lower-case letter (`XMLHttpRequest` → `XML`, `Http`, `Request`).
 * - Letter/digit transitions do NOT split (`version2` and `utf8` stay single words).
 * - A run without any lower-case letter is a single word (`HTTP2`, `A0B1`, the parts of `CONSTANT_CASE`), so constant case round-trips.
 * @param {string} string - The text to tokenize
 * @returns {string[]} The words, in their original casing
 */
function splitWords(string: string): string[] {
	const chunks = string.replace(/['’]/g, '').match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
	const words: string[] = [];

	for (const chunk of chunks) {
		// A chunk without lower-case letters is CONSTANT_CASE or an acronym (`HTTP2`, `A0B1`): keep it whole.
		if (!/\p{Ll}/u.test(chunk)) {
			words.push(chunk);
			continue;
		}

		const spaced = chunk.replace(/([\p{Ll}\p{N}]\p{M}*)(?=[\p{Lu}\p{Lt}])/gu, '$1 ').replace(/([\p{Lu}\p{Lt}]\p{M}*)(?=[\p{Lu}\p{Lt}]\p{M}*\p{Ll})/gu, '$1 ');

		words.push(...spaced.split(' '));
	}

	return words;
}

/**
 * Reverses a string by user-perceived characters (grapheme clusters), so emoji, surrogate pairs and combining marks are kept intact.
 * Uses `Intl.Segmenter` when available and falls back to code points otherwise.
 * @param {string} string - The string to be reversed
 * @returns {string} The reversed string
 * @example
 * reverse('hello'); // => 'olleh'
 * reverse('a👍🏽b'); // => 'b👍🏽a'
 */
export function reverse(string: string): string {
	return splitGraphemes(string).reverse().join('');
}

/**
 * Upper-cases the first user-perceived character (grapheme cluster) of a string and leaves the rest untouched.
 * @param {string} string - The string to be capitalized
 * @returns {string} The capitalized string
 * @example
 * capitalize('hello'); // => 'Hello'
 * capitalize('élan'); // => 'Élan'
 */
export function capitalize(string: string): string {
	const first = firstGrapheme(string);

	return first.toUpperCase() + string.slice(first.length);
}

/**
 * Lower-cases the first user-perceived character (grapheme cluster) of a string and leaves the rest untouched.
 * @param {string} string - The string to be uncapitalized
 * @returns {string} The uncapitalized string
 * @example
 * uncapitalize('Hello World'); // => 'hello World'
 */
export function uncapitalize(string: string): string {
	const first = firstGrapheme(string);

	return first.toLowerCase() + string.slice(first.length);
}

/**
 * Converts an index to an integer in `[0, length]`, like `String.prototype.substring` does: `NaN` → `0`, fractions truncated, out-of-range values clamped.
 * @param {number} index - The index to normalize
 * @param {number} length - The length of the string
 * @returns {number} The normalized index
 */
function clampIndex(index: number, length: number): number {
	if (Number.isNaN(index)) return 0;

	return Math.min(Math.max(Math.trunc(index), 0), length);
}

/**
 * Extracts a substring from a string based on start and end indices (UTF-16 code units, like `String.prototype.substring`).
 * Indices are normalized like the native method (`NaN` → `0`, fractions truncated, clamped to `[0, string.length]`), but they are never swapped:
 * when the normalized `start` is not before the normalized `end`, an empty string is returned.
 * @param {string} string - The original string
 * @param {number} start - The start index of the substring
 * @param {number} end - The end index of the substring (exclusive)
 * @returns {string} The extracted substring
 * @example
 * substring('Hello, World!', 7, 12); // => 'World'
 * substring('Hello, World!', 12, 7); // => ''
 */
export function substring(string: string, start: number, end: number): string {
	const from = clampIndex(start, string.length);
	const to = clampIndex(end, string.length);

	return from < to ? string.slice(from, to) : '';
}

/**
 * Checks if a string contains a specified substring (case-sensitive).
 * @param {string} string - The original string
 * @param {string} subString - The substring to be searched for
 * @returns {boolean} Whether the string contains the specified substring
 * @example
 * includes('hello world', 'lo w'); // => true
 */
export function includes(string: string, subString: string): boolean {
	return string.includes(subString);
}

/**
 * Replaces all occurrences of a substring with a replacement string. Both values are treated literally:
 * the search value is never interpreted as a regular expression and `$&`, `$1`, `$$`... in the replacement are not expanded.
 * @param {string} string - The original string
 * @param {string} searchValue - The substring to be replaced; when empty the input is returned unchanged
 * @param {string} replaceValue - The replacement string
 * @returns {string} The string with all occurrences of the substring replaced
 * @example
 * replace('a.b.c', '.', '-'); // => 'a-b-c'
 * replace('price: 5', '5', '$&0'); // => 'price: $&0'
 */
export function replace(string: string, searchValue: string, replaceValue: string): string {
	if (!searchValue) return string;

	return string.replaceAll(searchValue, function (): string {
		return replaceValue;
	});
}

/**
 * Truncates a string to `length` user-perceived characters (grapheme clusters) and appends a suffix when it was longer.
 * The cut never splits a surrogate pair, an emoji sequence or a base character from its combining marks.
 * The suffix is not counted in `length`.
 * @param {string} string - The original string
 * @param {number} length - The maximum number of graphemes to keep (non-negative integer)
 * @param {string} [suffix='...'] - The suffix appended when the string is truncated
 * @returns {string} The truncated string, or the original one when it has at most `length` graphemes
 * @throws {RangeError} when `length` is negative or not an integer
 * @example
 * truncate('hello world', 5); // => 'hello...'
 * truncate('hello world', 5, '!'); // => 'hello!'
 * truncate('👍🏽👍🏽👍🏽', 1); // => '👍🏽...'
 */
export function truncate(string: string, length: number, suffix: string = '...'): string {
	if (!Number.isInteger(length) || length < 0) throw new RangeError(`truncate: length must be a non-negative integer, received ${String(length)}`);

	// A string never has more graphemes than UTF-16 code units.
	if (string.length <= length) return string;

	let count = 0;
	let end = 0;

	for (const grapheme of iterateGraphemes(string)) {
		if (count === length) return string.slice(0, end) + suffix;

		count++;
		end += grapheme.length;
	}

	return string;
}

/**
 * Repeats a string a specified number of times (wraps `String.prototype.repeat`).
 * @param {string} string - The original string
 * @param {number} times - How many times to repeat the string (non-negative integer)
 * @returns {string} The repeated string
 * @throws {RangeError} when `times` is negative, not an integer, `NaN` or infinite
 * @example
 * repeat('ab', 3); // => 'ababab'
 * repeat('ab', 0); // => ''
 */
export function repeat(string: string, times: number): string {
	if (!Number.isInteger(times) || times < 0) throw new RangeError(`repeat: times must be a non-negative integer, received ${String(times)}`);

	return string.repeat(times);
}

/**
 * Removes whitespace (and line terminators) from both ends of a string.
 * @param {string} string - The string to be trimmed
 * @returns {string} The trimmed string
 * @example
 * trim('  hello world  '); // => 'hello world'
 */
export function trim(string: string): string {
	return string.trim();
}

/**
 * Converts a string to title case: in every whitespace-separated word the first letter is upper-cased and everything else is lower-cased.
 * Whitespace and punctuation are preserved exactly. Leading punctuation is skipped (`'(hello)'` → `'(Hello)'`),
 * but a word starting with a digit is left lower-case (`'1st'` stays `'1st'`). Works with Unicode letters.
 * @param {string} string - The string to be converted to title case
 * @returns {string} The string in title case
 * @example
 * toTitleCase('hello  WORLD'); // => 'Hello  World'
 * toTitleCase('élan vital, "quoted"'); // => 'Élan Vital, "Quoted"'
 */
export function toTitleCase(string: string): string {
	return string.replace(/\S+/g, function (word: string): string {
		return word.toLowerCase().replace(/^([^\p{L}\p{N}]*)(\p{L})/u, function (_match: string, prefix: string, letter: string): string {
			return prefix + titleCaseLetter(letter);
		});
	});
}

/**
 * Converts a string to snake_case. Words are detected on whitespace, punctuation (`-`, `_`, `.`...), camelCase and acronym boundaries
 * (`XMLHttpRequest` → `xml_http_request`). Digits stay attached to the preceding letters (`version2` is one word). Apostrophes are dropped.
 * @param {string} string - The string to be converted to snake case
 * @returns {string} The string in snake case
 * @example
 * toSnakeCase('hello world'); // => 'hello_world'
 * toSnakeCase('helloWorld'); // => 'hello_world'
 * toSnakeCase('XMLHttpRequest'); // => 'xml_http_request'
 */
export function toSnakeCase(string: string): string {
	return splitWords(string)
		.map(function (word: string): string {
			return word.toLowerCase();
		})
		.join('_');
}

/**
 * Converts a string to kebab-case, using the same word detection as {@link toSnakeCase}.
 * @param {string} string - The string to be converted to kebab case
 * @returns {string} The string in kebab case
 * @example
 * toKebabCase('Hello World'); // => 'hello-world'
 * toKebabCase('getHTTPResponse2Code'); // => 'get-http-response2-code'
 */
export function toKebabCase(string: string): string {
	return splitWords(string)
		.map(function (word: string): string {
			return word.toLowerCase();
		})
		.join('-');
}

/**
 * Converts a string to CONSTANT_CASE (SCREAMING_SNAKE_CASE), using the same word detection as {@link toSnakeCase}.
 * @param {string} string - The string to be converted to constant case
 * @returns {string} The string in constant case
 * @example
 * toConstantCase('maxRetryCount'); // => 'MAX_RETRY_COUNT'
 */
export function toConstantCase(string: string): string {
	return splitWords(string)
		.map(function (word: string): string {
			return word.toUpperCase();
		})
		.join('_');
}

/**
 * Converts a string to camelCase, using the same word detection as {@link toSnakeCase}.
 * The first word is lower-cased; every following word is lower-cased with its first letter upper-cased.
 * Note that consecutive single-letter words are ambiguous once joined (`'a b c'` → `'aBC'`, which reads back as `a`, `bc`).
 * @param {string} string - The string to be converted to camel case
 * @returns {string} The string in camel case
 * @example
 * toCamelCase('hello world'); // => 'helloWorld'
 * toCamelCase('XMLHttpRequest'); // => 'xmlHttpRequest'
 */
export function toCamelCase(string: string): string {
	return splitWords(string)
		.map(function (word: string, index: number): string {
			return index === 0 ? word.toLowerCase() : upperFirstLowerRest(word);
		})
		.join('');
}

/**
 * Converts a string to PascalCase, using the same word detection as {@link toSnakeCase}.
 * @param {string} string - The string to be converted to Pascal case
 * @returns {string} The string in Pascal case
 * @example
 * toPascalCase('hello world'); // => 'HelloWorld'
 * toPascalCase('xml-http-request'); // => 'XmlHttpRequest'
 */
export function toPascalCase(string: string): string {
	return splitWords(string).map(upperFirstLowerRest).join('');
}

/**
 * Removes diacritical marks (accents, umlauts, cedillas...) from a string: it is decomposed (NFD), the combining diacritical marks are stripped
 * and the result is recomposed (NFC). Only the combining diacritical mark blocks are removed, so scripts that use other combining marks are left intact.
 * @param {string} string - The string to clean
 * @returns {string} The string without diacritics
 * @example
 * removeDiacritics('Crème Brûlée à Málaga'); // => 'Creme Brulee a Malaga'
 */
export function removeDiacritics(string: string): string {
	return string
		.normalize('NFD')
		.replace(/[\u0300-\u036f]|[\u1ab0-\u1aff]|[\u1dc0-\u1dff]|[\u20d0-\u20ff]|[\ufe20-\ufe2f]/g, '')
		.normalize('NFC');
}

/**
 * Latin letters that have no Unicode decomposition, mapped to their usual ASCII transliteration for slugs.
 */
const SLUG_TRANSLITERATIONS: Readonly<Record<string, string>> = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ð: 'd', ł: 'l', þ: 'th', ı: 'i' };

/**
 * Converts a string to a URL-friendly slug: compatibility-decomposed (NFKD), diacritics removed, a few common Latin letters transliterated
 * (`ß` → `ss`, `æ` → `ae`, `ø` → `o`...), lower-cased, every run of characters outside `[a-z0-9]` replaced by a single `-`,
 * and leading/trailing hyphens removed. The result always matches `/^([a-z0-9]+(-[a-z0-9]+)*)?$/`.
 * @param {string} string - The string to be converted to a slug
 * @returns {string} The URL-friendly slug (possibly empty)
 * @example
 * toSlug('Café Society'); // => 'cafe-society'
 * toSlug('  --Hello__World!!  '); // => 'hello-world'
 */
export function toSlug(string: string): string {
	return removeDiacritics(string.normalize('NFKD'))
		.toLowerCase()
		.replace(/[ßæœøđðłþı]/g, function (letter: string): string {
			return SLUG_TRANSLITERATIONS[letter];
		})
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Values recognized as `true` by {@link toBoolean} (compared after trimming and lower-casing).
 */
const TRUTHY_STRINGS: ReadonlySet<string> = new Set(['true', '1', 'yes', 'y', 'on']);

/**
 * Converts a string to a boolean, which is handy for environment variables and query parameters.
 * The input is trimmed and compared case-insensitively; `'true'`, `'1'`, `'yes'`, `'y'` and `'on'` are `true`, everything else is `false`.
 * @param {string} string - The string to be converted to a boolean
 * @returns {boolean} The converted boolean
 * @example
 * toBoolean(' TRUE '); // => true
 * toBoolean('on'); // => true
 * toBoolean('false'); // => false
 * toBoolean('anything else'); // => false
 */
export function toBoolean(string: string): boolean {
	return TRUTHY_STRINGS.has(string.trim().toLowerCase());
}

/**
 * Converts a string to a number with `Number()` semantics, except that blank strings (empty or whitespace only) give `NaN` instead of `0`.
 * @param {string} string - The string to be converted to a number
 * @returns {number} The converted number, or `NaN` when the string is blank or not numeric
 * @example
 * toNumber(' 42 '); // => 42
 * toNumber('0x1f'); // => 31
 * toNumber(''); // => NaN
 * toNumber('12px'); // => NaN
 */
export function toNumber(string: string): number {
	const trimmed = string.trim();

	return trimmed === '' ? NaN : Number(trimmed);
}

/**
 * Checks if a string starts with a given substring (case-sensitive).
 * @param {string} string - The string to be checked
 * @param {string} subString - The substring to search for
 * @returns {boolean} Whether the string starts with the substring
 * @example
 * startsWith('hello world', 'hello'); // => true
 */
export function startsWith(string: string, subString: string): boolean {
	return string.startsWith(subString);
}

/**
 * Checks if a string ends with a given substring (case-sensitive).
 * @param {string} string - The original string
 * @param {string} subString - The substring to be searched for
 * @returns {boolean} Whether the string ends with the specified substring
 * @example
 * endsWith('hello world', 'world'); // => true
 */
export function endsWith(string: string, subString: string): boolean {
	return string.endsWith(subString);
}

/**
 * Counts the non-overlapping, literal occurrences of a substring, scanning left to right (`countSubString('aaaa', 'aa')` is `2`).
 * The comparison is case-sensitive by default. With `ignoreCase`, both strings are lower-cased with the locale-independent
 * `String.prototype.toLowerCase` before counting; since a few characters change length when lower-cased (e.g. `'İ'`), the count is
 * computed on the lower-cased forms.
 * @param {string} string - The string to search in
 * @param {string} subString - The substring to search for; an empty substring yields `0`
 * @param {CountSubStringOptions} [options={}] - Matching options
 * @returns {number} The number of occurrences
 * @example
 * countSubString('hello world, hello', 'hello'); // => 2
 * countSubString('Hello hello', 'hello'); // => 1
 * countSubString('Hello hello', 'hello', { ignoreCase: true }); // => 2
 * countSubString('a.b.c', '.'); // => 2
 */
export function countSubString(string: string, subString: string, options: CountSubStringOptions = {}): number {
	if (subString === '') return 0;

	const haystack = options.ignoreCase ? string.toLowerCase() : string;
	const needle = options.ignoreCase ? subString.toLowerCase() : subString;
	let count = 0;
	let index = haystack.indexOf(needle);

	while (index !== -1) {
		count++;
		index = haystack.indexOf(needle, index + needle.length);
	}

	return count;
}

/**
 * Checks if a string is empty or contains only whitespace characters.
 * @param {string} string - The string to be checked
 * @returns {boolean} Whether the string is blank
 * @example
 * isEmpty('   '); // => true
 * isEmpty(' a '); // => false
 */
export function isEmpty(string: string): boolean {
	return !string.trim().length;
}

/**
 * Extracts the words of a string. A word is a run of Unicode letters, combining marks and numbers, optionally joined by inner
 * apostrophes (`'` or `’`), so `"don't"` and `'café'` are single words. Everything else (whitespace, punctuation, symbols) separates words.
 * @param {string} string - The string to be split into words
 * @returns {string[]} The words in the string
 * @example
 * getWords("Don't stop, café 2024!"); // => ["Don't", 'stop', 'café', '2024']
 */
export function getWords(string: string): string[] {
	return string.match(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu) ?? [];
}

/**
 * Checks if a string reads the same backwards (grapheme-aware, see {@link reverse}). Strict by default.
 * @param {string} string - The string to be checked
 * @param {IsPalindromeOptions} [options={}] - `ignoreCase` and `ignoreNonAlphanumeric` (both default to `false`)
 * @returns {boolean} Whether the string is a palindrome
 * @example
 * isPalindrome('racecar'); // => true
 * isPalindrome('Racecar'); // => false
 * isPalindrome('A man, a plan, a canal: Panama', { ignoreCase: true, ignoreNonAlphanumeric: true }); // => true
 */
export function isPalindrome(string: string, options: IsPalindromeOptions = {}): boolean {
	let candidate = options.ignoreNonAlphanumeric ? string.replace(/[^\p{L}\p{M}\p{N}]+/gu, '') : string;

	if (options.ignoreCase) candidate = candidate.toLowerCase();

	return candidate === reverse(candidate);
}

/**
 * Escapes every character that has a special meaning in a regular expression (`. * + ? ^ $ { } ( ) | [ ] \`), so the result
 * matches the input literally. The output is valid with and without the `u` flag.
 * @param {string} string - The string to escape
 * @returns {string} The escaped string
 * @example
 * escapeRegExp('1.5*(x)'); // => '1\\.5\\*\\(x\\)'
 * new RegExp(escapeRegExp('a.b')).test('axb'); // => false
 */
export function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * HTML entities produced by {@link escapeHtml}.
 */
const HTML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Escapes the HTML-significant characters `&`, `<`, `>`, `"` and `'` so the string can be safely embedded in HTML text or quoted attributes.
 * @param {string} string - The string to escape
 * @returns {string} The escaped string
 * @example
 * escapeHtml('<a href="x">Tom & Jerry\'s</a>'); // => '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;'
 */
export function escapeHtml(string: string): string {
	return string.replace(/[&<>"']/g, function (char: string): string {
		return HTML_ESCAPES[char];
	});
}

/**
 * Characters for the entities decoded by {@link unescapeHtml}.
 */
const HTML_UNESCAPES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&#X27;': "'", '&apos;': "'" };

/**
 * Reverses {@link escapeHtml}: decodes `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&#x27;`, `&apos;` and `&amp;`. Decoding happens in a single pass,
 * so `&amp;` is effectively decoded last and `'&amp;lt;'` becomes `'&lt;'` (never `'<'`). Other entities are left untouched.
 * @param {string} string - The string to unescape
 * @returns {string} The unescaped string
 * @example
 * unescapeHtml('&lt;b&gt;Tom &amp; Jerry&#39;s&lt;/b&gt;'); // => "<b>Tom & Jerry's</b>"
 * unescapeHtml('&amp;lt;'); // => '&lt;'
 */
export function unescapeHtml(string: string): string {
	return string.replace(/&(?:amp|lt|gt|quot|apos|#39|#[xX]27);/g, function (entity: string): string {
		return HTML_UNESCAPES[entity];
	});
}

/**
 * Trims a string and collapses every run of whitespace (spaces, tabs, line breaks, non-breaking spaces...) into a single space.
 * @param {string} string - The string to normalize
 * @returns {string} The normalized string
 * @example
 * normalizeWhitespace('  hello \n\t world  '); // => 'hello world'
 */
export function normalizeWhitespace(string: string): string {
	return string.trim().replace(/\s+/g, ' ');
}

/**
 * Resolves a dot-separated path against a value, following own properties only.
 * @param {unknown} source - The root value
 * @param {string} path - The dot-separated path (`'user.name'`, `'items.0'`)
 * @returns {unknown} The value found at `path`, or `undefined` when any segment is missing
 */
function resolvePath(source: unknown, path: string): unknown {
	let current: unknown = source;

	for (const key of path.split('.')) {
		if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) return undefined;

		current = (current as Readonly<Record<string, unknown>>)[key];
	}

	return current;
}

/**
 * Replaces `{key}` and `{nested.key}` placeholders (whitespace inside the braces is ignored) with values from an object.
 * Values are stringified with `String()`. Placeholders whose path does not exist (or resolves to `undefined`) are left untouched.
 * Only own properties are read, so `{constructor}` or `{__proto__}` never leak prototype members. There is no escaping syntax for braces.
 * @param {string} template - The template containing placeholders
 * @param {InterpolationValues} values - The values to insert; nested objects and arrays are addressed with dots (`{items.0}`)
 * @returns {string} The interpolated string
 * @example
 * interpolate('Hello {user.name}, you have {count} messages', { user: { name: 'Ada' }, count: 3 }); // => 'Hello Ada, you have 3 messages'
 * interpolate('Hi {missing}', {}); // => 'Hi {missing}'
 */
export function interpolate(template: string, values: InterpolationValues): string {
	return template.replace(/\{([^{}]+)\}/g, function (placeholder: string, path: string): string {
		const value = resolvePath(values, path.trim());

		return value === undefined ? placeholder : String(value);
	});
}

/**
 * Returns the number of user-perceived characters (grapheme clusters, or code points without `Intl.Segmenter`) of a string.
 * @param {string} string - The string to measure
 * @returns {number} The grapheme count
 */
function graphemeLength(string: string): number {
	let count = 0;

	for (const _grapheme of iterateGraphemes(string)) count++;

	return count;
}

/**
 * Computes the Levenshtein edit distance between two strings: the minimum number of single-character insertions, deletions and substitutions
 * turning `a` into `b`. Characters are Unicode code points, so an astral character (emoji, surrogate pair) counts as one.
 * The common prefix and suffix are skipped and the dynamic-programming table keeps a single row sized after the shorter string,
 * so the extra memory is O(min(n, m)) and the time O(n × m).
 * @param {string} a - The first string
 * @param {string} b - The second string
 * @returns {number} The edit distance (a non-negative integer, `0` iff the strings are equal)
 * @example
 * levenshtein('kitten', 'sitting'); // => 3
 * levenshtein('', 'abc'); // => 3
 * levenshtein('😀a', '😃a'); // => 1
 */
export function levenshtein(a: string, b: string): number {
	if (a === b) return 0;

	let shorter = Array.from(a);
	let longer = Array.from(b);

	if (shorter.length > longer.length) [shorter, longer] = [longer, shorter];

	// Skip the common prefix and suffix: they never contribute to the distance.
	let start = 0;
	let shorterEnd = shorter.length;
	let longerEnd = longer.length;

	while (start < shorterEnd && shorter[start] === longer[start]) start++;

	while (shorterEnd > start && shorter[shorterEnd - 1] === longer[longerEnd - 1]) {
		shorterEnd--;
		longerEnd--;
	}

	const rowLength = shorterEnd - start;

	if (rowLength === 0) return longerEnd - start;

	const row = new Uint32Array(rowLength + 1);

	for (let i = 0; i <= rowLength; i++) row[i] = i;

	for (let j = 1; j <= longerEnd - start; j++) {
		const character = longer[start + j - 1];
		let diagonal = row[0];

		row[0] = j;

		for (let i = 1; i <= rowLength; i++) {
			const above = row[i];
			const substitution = diagonal + (shorter[start + i - 1] === character ? 0 : 1);

			row[i] = Math.min(above + 1, row[i - 1] + 1, substitution);
			diagonal = above;
		}
	}

	return row[rowLength];
}

/**
 * Computes a normalized similarity score from the {@link levenshtein} distance: `1 - distance / maxLength`, where lengths are counted in code points.
 * Two empty strings are considered identical (`1`).
 * @param {string} a - The first string
 * @param {string} b - The second string
 * @returns {number} A score in `[0, 1]`: `1` iff the strings are equal, `0` when every character must be changed
 * @example
 * similarity('kitten', 'sitting'); // => 0.5714285714285714 // 1 - 3 / 7
 * similarity('abc', 'abc'); // => 1
 * similarity('', ''); // => 1
 * similarity('abc', 'xyz'); // => 0
 */
export function similarity(a: string, b: string): number {
	const maxLength = Math.max(Array.from(a).length, Array.from(b).length);

	return maxLength === 0 ? 1 : 1 - levenshtein(a, b) / maxLength;
}

/**
 * Removes the common indentation from template literal parts. Interpolation points (between two parts) count as non-blank content
 * and end a line's indentation, but are never modified themselves.
 * @param {ReadonlyArray<string>} parts - The literal parts (one more than the interpolated values)
 * @returns {string[]} The dedented parts, in the same order
 */
function dedentParts(parts: ReadonlyArray<string>): string[] {
	const joined = parts.join('');
	const valueOffsets: number[] = [];
	let offset = 0;

	for (let index = 0; index < parts.length - 1; index++) {
		offset += parts[index].length;
		valueOffsets.push(offset);
	}

	const valueAt = new Set(valueOffsets);
	const lines: Array<{ start: number; end: number; next: number; indentation: string; blank: boolean }> = [];
	const separator = /\r\n|\r|\n/g;
	let start = 0;
	let valueIndex = 0;

	for (;;) {
		const match = separator.exec(joined);
		const end = match === null ? joined.length : match.index;
		const next = match === null ? joined.length : match.index + match[0].length;
		let indentationEnd = start;
		let hasValue = false;

		while (indentationEnd < end && (joined[indentationEnd] === ' ' || joined[indentationEnd] === '\t') && !valueAt.has(indentationEnd)) indentationEnd++;

		// A value belongs to this line when it is inserted before the next line starts (or anywhere after the start of the last line).
		while (valueIndex < valueOffsets.length && (match === null || valueOffsets[valueIndex] < next)) {
			hasValue = true;
			valueIndex++;
		}

		lines.push({ start, end, next, indentation: joined.slice(start, indentationEnd), blank: !hasValue && indentationEnd === end });

		if (match === null) break;

		start = next;
	}

	const removed = new Uint8Array(joined.length);
	const first = 0;
	const last = lines.length - 1;
	const dropFirst = lines[first].blank;
	const dropLast = last > first && lines[last].blank;

	/**
	 * Marks the code units in `[from, to)` as removed.
	 * @param {number} from - First removed index
	 * @param {number} to - End of the removed range (exclusive)
	 * @returns {void}
	 */
	function remove(from: number, to: number): void {
		removed.fill(1, from, to);
	}

	if (dropFirst) remove(lines[first].start, lines[first].next);

	if (dropLast) remove(lines[last - 1].end, lines[last].next);

	const kept = lines.slice(dropFirst ? 1 : 0, dropLast ? last : lines.length);
	let common: string | undefined;

	for (const line of kept) {
		if (line.blank) continue;

		if (common === undefined) {
			common = line.indentation;
			continue;
		}

		let length = 0;

		while (length < common.length && length < line.indentation.length && common[length] === line.indentation[length]) length++;

		common = common.slice(0, length);
	}

	const commonLength = common === undefined ? 0 : common.length;

	for (const line of kept) {
		if (line.blank) remove(line.start, line.end);
		else remove(line.start, line.start + commonLength);
	}

	const result: string[] = [];
	let base = 0;

	for (const part of parts) {
		let text = '';

		for (let index = 0; index < part.length; index++) {
			if (removed[base + index] === 0) text += part[index];
		}

		result.push(text);
		base += part.length;
	}

	return result;
}

/**
 * Removes the common leading indentation from a multi-line string, so it can be written indented in the source code.
 *
 * Rules:
 * - Lines are separated by `\n`, `\r\n` or `\r` (separators are kept as they are).
 * - The first line is dropped when it is blank (empty or only spaces/tabs), and so is the last one; this removes the line breaks that
 *   follow the opening backtick and precede the closing one.
 * - The longest common prefix of spaces/tabs of the remaining non-blank lines is removed from each of them (tabs and spaces are not
 *   converted into each other). Lines that contain only spaces/tabs become empty.
 *
 * It can be called as a function or used as a template tag. As a tag, the indentation is computed on the literal text only (cooked,
 * i.e. escape sequences such as `\n` are already resolved; the raw text is used for an invalid escape) and the interpolated values are
 * inserted afterwards with `String()`: they are NOT re-indented, so a multi-line value keeps its own line breaks and indentation,
 * and a line holding an interpolation is never treated as blank.
 * @param {string} string - The text to dedent
 * @returns {string} The dedented text
 * @example
 * dedent('\n    a\n      b\n    c\n'); // => 'a\n  b\nc'
 */
export function dedent(string: string): string;
/**
 * Template-tag form of {@link dedent}: removes the common indentation of the literal text, then inserts the values (not re-indented).
 * @param {TemplateStringsArray} strings - The literal parts of the template
 * @param {...unknown} values - The interpolated values, stringified with `String()`
 * @returns {string} The dedented text
 * @example
 * const name = 'Ada';
 * dedent`
 *     Hello ${name},
 *       welcome!
 * `; // => 'Hello Ada,\n  welcome!'
 */
export function dedent(strings: TemplateStringsArray, ...values: unknown[]): string;
/**
 * Removes the common leading indentation from a multi-line string; usable as a function or as a template tag (see the overloads).
 * @param {string | TemplateStringsArray} input - The text, or the literal parts of a template
 * @param {...unknown} values - The interpolated values when used as a tag
 * @returns {string} The dedented text
 * @throws {TypeError} when `input` is neither a string nor a template strings array
 * @example
 * dedent('  a\n    b'); // => 'a\n  b'
 */
export function dedent(input: string | TemplateStringsArray, ...values: unknown[]): string {
	if (typeof input === 'string') return dedentParts([input])[0];

	if (!Array.isArray(input)) throw new TypeError(`dedent: expected a string or a template strings array, received ${typeof input}`);

	const literals = input.map(function (cooked: string | undefined, index: number): string {
		return cooked ?? input.raw[index];
	});
	const parts = dedentParts(literals);
	let result = parts[0];

	for (let index = 1; index < parts.length; index++) result += String(values[index - 1]) + parts[index];

	return result;
}

/**
 * Splits a string into lines. `\r\n`, `\r` and `\n` are all recognized as line breaks; the separators are not included in the result.
 * A trailing line break produces a trailing empty line, and an empty string gives `['']`.
 * @param {string} string - The text to split
 * @returns {string[]} The lines (at least one)
 * @example
 * splitLines('a\r\nb\rc\nd'); // => ['a', 'b', 'c', 'd']
 * splitLines('a\n'); // => ['a', '']
 */
export function splitLines(string: string): string[] {
	return string.split(/\r\n|\r|\n/);
}

/**
 * Options accepted by {@link wordWrap}.
 */
export interface WordWrapOptions {
	/** Cut words longer than `width` into `width`-sized pieces. When `false`, such words stay whole on their own (overlong) line. Defaults to `false`. */
	readonly breakLongWords?: boolean;
	/** The line break inserted between output lines. Defaults to `'\n'`. */
	readonly newline?: string;
}

/**
 * Wraps text to lines of at most `width` user-perceived characters (grapheme clusters) using a greedy algorithm: words are separated
 * by whitespace and added to the current line while they fit, with a single space between them.
 *
 * Existing line breaks (`\n`, `\r\n`, `\r`) are kept as hard breaks (each input line is wrapped on its own, blank lines are preserved),
 * every output line break is `newline`, and runs of other whitespace (including indentation and trailing spaces) collapse into the
 * separating single space. A word longer than `width` starts a new line; it is cut into `width`-sized pieces when `breakLongWords` is set
 * (the last piece can be followed by more words), otherwise it is kept whole.
 * @param {string} string - The text to wrap
 * @param {number} width - The maximum line width in graphemes (a positive integer, or `Infinity` to only normalize whitespace)
 * @param {WordWrapOptions} [options={}] - `breakLongWords` (default `false`) and `newline` (default `'\n'`)
 * @returns {string} The wrapped text
 * @throws {RangeError} when `width` is less than 1, `NaN` or a non-integer finite number
 * @example
 * wordWrap('The quick brown fox jumps', 10); // => 'The quick\nbrown fox\njumps'
 * wordWrap('abcdefghij xy', 4, { breakLongWords: true }); // => 'abcd\nefgh\nij\nxy'
 * wordWrap('a b c', 3, { newline: '<br>' }); // => 'a b<br>c'
 */
export function wordWrap(string: string, width: number, options: WordWrapOptions = {}): string {
	if (!(width >= 1) || (!Number.isInteger(width) && width !== Infinity)) throw new RangeError(`wordWrap: width must be a positive integer, received ${String(width)}`);

	const { breakLongWords = false, newline = '\n' } = options;
	const output: string[] = [];

	for (const line of splitLines(string)) {
		let current = '';
		let currentLength = 0;

		for (const word of line.split(/\s+/)) {
			if (word === '') continue;

			const wordLength = graphemeLength(word);

			if (wordLength > width && breakLongWords) {
				if (current !== '') output.push(current);

				const pieces = splitGraphemes(word);

				for (let index = 0; index + width < pieces.length; index += width) output.push(pieces.slice(index, index + width).join(''));

				const lastLength = pieces.length % width || width;

				current = pieces.slice(pieces.length - lastLength).join('');
				currentLength = lastLength;
			} else if (current === '') {
				current = word;
				currentLength = wordLength;
			} else if (currentLength + 1 + wordLength <= width) {
				current += ' ' + word;
				currentLength += 1 + wordLength;
			} else {
				output.push(current);
				current = word;
				currentLength = wordLength;
			}
		}

		output.push(current);
	}

	return output.join(newline);
}

/**
 * Options accepted by {@link mask}.
 */
export interface MaskOptions {
	/** How many graphemes to leave visible at the start. Defaults to `0`. */
	readonly visibleStart?: number;
	/** How many graphemes to leave visible at the end. Defaults to `4`. */
	readonly visibleEnd?: number;
	/** The replacement for every hidden grapheme; must be exactly one grapheme. Defaults to `'*'`. */
	readonly char?: string;
}

/**
 * Hides the middle of a string (card numbers, tokens, phone numbers...), replacing every user-perceived character (grapheme cluster)
 * except the first `visibleStart` and the last `visibleEnd` ones with `char`. The grapheme length is preserved.
 * When the visible parts cover the whole string (it has at most `visibleStart + visibleEnd` graphemes), nothing is hidden and
 * the string is returned unchanged — pick the visible counts accordingly for short secrets.
 * @param {string} string - The string to mask
 * @param {MaskOptions} [options={}] - `visibleStart` (default `0`), `visibleEnd` (default `4`) and `char` (default `'*'`)
 * @returns {string} The masked string
 * @throws {RangeError} when `visibleStart` or `visibleEnd` is not a non-negative integer, or `char` is not exactly one grapheme
 * @example
 * mask('4111111111111111'); // => '************1111'
 * mask('john.doe@mail.com', { visibleStart: 2, visibleEnd: 9, char: '•' }); // => 'jo••••••@mail.com'
 * mask('👍🏽👍🏽👍🏽👍🏽👍🏽', { visibleEnd: 1 }); // => '****👍🏽'
 */
export function mask(string: string, options: MaskOptions = {}): string {
	const { visibleStart = 0, visibleEnd = 4, char = '*' } = options;

	if (!Number.isInteger(visibleStart) || visibleStart < 0) throw new RangeError(`mask: visibleStart must be a non-negative integer, received ${String(visibleStart)}`);

	if (!Number.isInteger(visibleEnd) || visibleEnd < 0) throw new RangeError(`mask: visibleEnd must be a non-negative integer, received ${String(visibleEnd)}`);

	if (graphemeLength(char) !== 1) throw new RangeError(`mask: char must be exactly one grapheme, received ${JSON.stringify(char)}`);

	const graphemes = splitGraphemes(string);
	const hidden = graphemes.length - visibleStart - visibleEnd;

	if (hidden <= 0) return string;

	return graphemes.slice(0, visibleStart).join('') + char.repeat(hidden) + graphemes.slice(visibleStart + hidden).join('');
}

/**
 * The default alphabet of {@link randomString}: ASCII letters and digits.
 */
const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generates a random string by drawing `length` characters uniformly and independently from `alphabet`.
 *
 * The alphabet is split into Unicode code points and duplicates are ignored, so every distinct character is equally likely;
 * the result therefore has exactly `length` code points.
 *
 * NOT cryptographically secure: with the default `Math.random` the output is predictable. Do not use it for passwords, tokens,
 * session ids or anything security-sensitive; use `crypto.getRandomValues` / `crypto.randomUUID` instead.
 * @param {number} length - The number of characters to generate (non-negative integer)
 * @param {string} [alphabet='A-Za-z0-9'] - The characters to choose from (defaults to the 62 ASCII letters and digits)
 * @param {RandomGenerator} [random=Math.random] - Source of uniform numbers in `[0, 1)`, injectable for deterministic results
 * @returns {string} The random string
 * @throws {RangeError} when `length` is not a non-negative integer, `alphabet` is empty, or `random()` returns a value outside `[0, 1)`
 * @example
 * randomString(8); // e.g. 'aZ3kP0qx'
 * randomString(6, '0123456789'); // e.g. '402913'
 * randomString(3, 'ab', function () { return 0; }); // => 'aaa'
 */
export function randomString(length: number, alphabet: string = ALPHANUMERIC, random: RandomGenerator = Math.random): string {
	if (!Number.isInteger(length) || length < 0) throw new RangeError(`randomString: length must be a non-negative integer, received ${String(length)}`);

	const characters = Array.from(new Set(alphabet));

	if (characters.length === 0) throw new RangeError('randomString: alphabet must not be empty');

	let result = '';

	for (let index = 0; index < length; index++) {
		const value = random();

		if (!(value >= 0 && value < 1)) throw new RangeError(`randomString: \`random()\` must return a number in [0, 1), got ${String(value)}`);

		result += characters[Math.floor(value * characters.length)];
	}

	return result;
}

/**
 * Converts a string to Sentence case, using the same word detection as {@link toSnakeCase}: the words are lower-cased, joined with
 * single spaces, and the first letter of the first word is upper-cased. Punctuation and separators are dropped, and acronyms are
 * lower-cased too (`'XMLHttpRequest'` → `'Xml http request'`).
 * @param {string} string - The string to convert
 * @returns {string} The string in sentence case
 * @example
 * toSentenceCase('helloWorld-foo'); // => 'Hello world foo'
 * toSentenceCase('SOME_CONSTANT_NAME'); // => 'Some constant name'
 */
export function toSentenceCase(string: string): string {
	return splitWords(string)
		.map(function (word: string, index: number): string {
			return index === 0 ? upperFirstLowerRest(word) : word.toLowerCase();
		})
		.join(' ');
}

/**
 * Picks the singular or plural form of a word for a count. The singular is used when `count` is `1` or `-1`, the plural otherwise
 * (including `0`, fractions and `NaN`). Only the word is returned; see {@link formatCount} to include the number.
 * @param {number} count - The quantity
 * @param {string} singular - The singular form
 * @param {string} [plural=singular + 's'] - The plural form, for irregular plurals
 * @returns {string} `singular` or `plural`
 * @example
 * pluralize(1, 'item'); // => 'item'
 * pluralize(3, 'item'); // => 'items'
 * pluralize(0, 'child', 'children'); // => 'children'
 */
export function pluralize(count: number, singular: string, plural: string = singular + 's'): string {
	return Math.abs(count) === 1 ? singular : plural;
}

/**
 * Formats a count followed by the matching singular or plural word (see {@link pluralize}); the number is stringified with `String()`.
 * @param {number} count - The quantity
 * @param {string} singular - The singular form
 * @param {string} [plural=singular + 's'] - The plural form, for irregular plurals
 * @returns {string} `'<count> <word>'`
 * @example
 * formatCount(3, 'item'); // => '3 items'
 * formatCount(1, 'item'); // => '1 item'
 * formatCount(2, 'person', 'people'); // => '2 people'
 */
export function formatCount(count: number, singular: string, plural: string = singular + 's'): string {
	return `${String(count)} ${pluralize(count, singular, plural)}`;
}

/**
 * Prepends `prefix` unless the string already starts with it.
 * @param {string} string - The original string
 * @param {string} prefix - The required prefix
 * @returns {string} A string that starts with `prefix`
 * @example
 * ensurePrefix('example.com', 'https://'); // => 'https://example.com'
 * ensurePrefix('https://example.com', 'https://'); // => 'https://example.com'
 */
export function ensurePrefix(string: string, prefix: string): string {
	return string.startsWith(prefix) ? string : prefix + string;
}

/**
 * Appends `suffix` unless the string already ends with it.
 * @param {string} string - The original string
 * @param {string} suffix - The required suffix
 * @returns {string} A string that ends with `suffix`
 * @example
 * ensureSuffix('path/to', '/'); // => 'path/to/'
 * ensureSuffix('path/to/', '/'); // => 'path/to/'
 */
export function ensureSuffix(string: string, suffix: string): string {
	return string.endsWith(suffix) ? string : string + suffix;
}

/**
 * Removes `prefix` from the start of the string once, if present.
 * @param {string} string - The original string
 * @param {string} prefix - The prefix to remove
 * @returns {string} The string without the prefix (unchanged when it does not start with it)
 * @example
 * stripPrefix('https://example.com', 'https://'); // => 'example.com'
 * stripPrefix('//a', '/'); // => '/a'
 */
export function stripPrefix(string: string, prefix: string): string {
	return string.startsWith(prefix) ? string.slice(prefix.length) : string;
}

/**
 * Removes `suffix` from the end of the string once, if present.
 * @param {string} string - The original string
 * @param {string} suffix - The suffix to remove
 * @returns {string} The string without the suffix (unchanged when it does not end with it)
 * @example
 * stripSuffix('report.pdf', '.pdf'); // => 'report'
 * stripSuffix('a//', '/'); // => 'a/'
 */
export function stripSuffix(string: string, suffix: string): string {
	return string.endsWith(suffix) ? string.slice(0, string.length - suffix.length) : string;
}
