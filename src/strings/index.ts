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
 * Upper-cases a single letter for use at the start of a word. When the upper-case mapping expands to several code points
 * (`'ß'` → `'SS'`, `'ﬁ'` → `'FI'`) only the first one stays upper-case (`'Ss'`, `'Fi'`), approximating Unicode title case.
 * @param {string} letter - The letter to convert
 * @returns {string} The title-cased letter
 */
function titleCaseLetter(letter: string): string {
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
 * reverse('hello'); // 'olleh'
 * reverse('a👍🏽b'); // 'b👍🏽a'
 */
export function reverse(string: string): string {
	return splitGraphemes(string).reverse().join('');
}

/**
 * Upper-cases the first user-perceived character (grapheme cluster) of a string and leaves the rest untouched.
 * @param {string} string - The string to be capitalized
 * @returns {string} The capitalized string
 * @example
 * capitalize('hello'); // 'Hello'
 * capitalize('élan'); // 'Élan'
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
 * uncapitalize('Hello World'); // 'hello World'
 */
export function uncapitalize(string: string): string {
	const first = firstGrapheme(string);

	return first.toLowerCase() + string.slice(first.length);
}

/**
 * Extracts a substring from a string based on start and end indices (UTF-16 code units, like `String.prototype.substring`).
 * Unlike the native method, the indices are not swapped: when `start > end` an empty string is returned.
 * @param {string} string - The original string
 * @param {number} start - The start index of the substring
 * @param {number} end - The end index of the substring (exclusive)
 * @returns {string} The extracted substring
 * @example
 * substring('Hello, World!', 7, 12); // 'World'
 * substring('Hello, World!', 12, 7); // ''
 */
export function substring(string: string, start: number, end: number): string {
	if (start > end) return '';

	return string.substring(start, end);
}

/**
 * Checks if a string contains a specified substring (case-sensitive).
 * @param {string} string - The original string
 * @param {string} subString - The substring to be searched for
 * @returns {boolean} Whether the string contains the specified substring
 * @example
 * includes('hello world', 'lo w'); // true
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
 * replace('a.b.c', '.', '-'); // 'a-b-c'
 * replace('price: 5', '5', '$&0'); // 'price: $&0'
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
 * truncate('hello world', 5); // 'hello...'
 * truncate('hello world', 5, '!'); // 'hello!'
 * truncate('👍🏽👍🏽👍🏽', 1); // '👍🏽...'
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
 * repeat('ab', 3); // 'ababab'
 * repeat('ab', 0); // ''
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
 * trim('  hello world  '); // 'hello world'
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
 * toTitleCase('hello  WORLD'); // 'Hello  World'
 * toTitleCase('élan vital, "quoted"'); // 'Élan Vital, "Quoted"'
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
 * toSnakeCase('hello world'); // 'hello_world'
 * toSnakeCase('helloWorld'); // 'hello_world'
 * toSnakeCase('XMLHttpRequest'); // 'xml_http_request'
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
 * toKebabCase('Hello World'); // 'hello-world'
 * toKebabCase('getHTTPResponse2Code'); // 'get-http-response2-code'
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
 * toConstantCase('maxRetryCount'); // 'MAX_RETRY_COUNT'
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
 * toCamelCase('hello world'); // 'helloWorld'
 * toCamelCase('XMLHttpRequest'); // 'xmlHttpRequest'
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
 * toPascalCase('hello world'); // 'HelloWorld'
 * toPascalCase('xml-http-request'); // 'XmlHttpRequest'
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
 * removeDiacritics('Crème Brûlée à Málaga'); // 'Creme Brulee a Malaga'
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
 * toSlug('Café Society'); // 'cafe-society'
 * toSlug('  --Hello__World!!  '); // 'hello-world'
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
 * toBoolean(' TRUE '); // true
 * toBoolean('on'); // true
 * toBoolean('false'); // false
 * toBoolean('anything else'); // false
 */
export function toBoolean(string: string): boolean {
	return TRUTHY_STRINGS.has(string.trim().toLowerCase());
}

/**
 * Converts a string to a number with `Number()` semantics, except that blank strings (empty or whitespace only) give `NaN` instead of `0`.
 * @param {string} string - The string to be converted to a number
 * @returns {number} The converted number, or `NaN` when the string is blank or not numeric
 * @example
 * toNumber(' 42 '); // 42
 * toNumber('0x1f'); // 31
 * toNumber(''); // NaN
 * toNumber('12px'); // NaN
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
 * startsWith('hello world', 'hello'); // true
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
 * endsWith('hello world', 'world'); // true
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
 * countSubString('hello world, hello', 'hello'); // 2
 * countSubString('Hello hello', 'hello'); // 1
 * countSubString('Hello hello', 'hello', { ignoreCase: true }); // 2
 * countSubString('a.b.c', '.'); // 2
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
 * isEmpty('   '); // true
 * isEmpty(' a '); // false
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
 * getWords("Don't stop, café 2024!"); // ["Don't", 'stop', 'café', '2024']
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
 * isPalindrome('racecar'); // true
 * isPalindrome('Racecar'); // false
 * isPalindrome('A man, a plan, a canal: Panama', { ignoreCase: true, ignoreNonAlphanumeric: true }); // true
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
 * escapeRegExp('1.5*(x)'); // '1\\.5\\*\\(x\\)'
 * new RegExp(escapeRegExp('a.b')).test('axb'); // false
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
 * escapeHtml('<a href="x">Tom & Jerry\'s</a>'); // '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;'
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
 * unescapeHtml('&lt;b&gt;Tom &amp; Jerry&#39;s&lt;/b&gt;'); // "<b>Tom & Jerry's</b>"
 * unescapeHtml('&amp;lt;'); // '&lt;'
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
 * normalizeWhitespace('  hello \n\t world  '); // 'hello world'
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
 * interpolate('Hello {user.name}, you have {count} messages', { user: { name: 'Ada' }, count: 3 }); // 'Hello Ada, you have 3 messages'
 * interpolate('Hi {missing}', {}); // 'Hi {missing}'
 */
export function interpolate(template: string, values: InterpolationValues): string {
	return template.replace(/\{([^{}]+)\}/g, function (placeholder: string, path: string): string {
		const value = resolvePath(values, path.trim());

		return value === undefined ? placeholder : String(value);
	});
}
