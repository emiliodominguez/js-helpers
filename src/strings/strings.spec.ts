import * as helpers from '.';

/**
 * Loads a fresh copy of the module while `Intl.Segmenter` is unavailable, to exercise the code-point fallback.
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
		// The segmenter is resolved lazily, so trigger it while Intl.Segmenter is still missing.
		isolated!.reverse('warm-up');
	} finally {
		intl.Segmenter = original;
	}

	return isolated!;
}

describe('String helpers', function () {
	describe('reverse', function () {
		it('should reverse the string', function () {
			expect(helpers.reverse('hello')).toEqual('olleh');
		});

		it('should return an empty string for an empty input', function () {
			expect(helpers.reverse('')).toEqual('');
		});

		it('should return the same string for a single character input', function () {
			expect(helpers.reverse('a')).toEqual('a');
		});

		it('should keep surrogate pairs, emoji sequences and combining marks intact', function () {
			expect(helpers.reverse('a😀b')).toEqual('b😀a');
			expect(helpers.reverse('x👍🏽y')).toEqual('y👍🏽x');
			expect(helpers.reverse('👨\u200d👩\u200d👧!')).toEqual('!👨\u200d👩\u200d👧');
			expect(helpers.reverse('ae\u0301b')).toEqual('be\u0301a');
			expect(helpers.reverse('🇫🇷🇩🇪')).toEqual('🇩🇪🇫🇷');
		});

		describe('without Intl.Segmenter', function () {
			const fallback = loadWithoutSegmenter();

			it('should fall back to code points (surrogate pairs kept)', function () {
				expect(fallback.reverse('a😀b')).toEqual('b😀a');
				expect(fallback.reverse('')).toEqual('');
				// Combining marks are separate code points in the fallback.
				expect(fallback.reverse('e\u0301')).toEqual('\u0301e');
			});

			it('should keep the other grapheme-aware helpers working', function () {
				expect(fallback.capitalize('😀abc')).toEqual('😀abc');
				expect(fallback.capitalize('élan')).toEqual('Élan');
				expect(fallback.capitalize('')).toEqual('');
				expect(fallback.truncate('😀😀😀', 2)).toEqual('😀😀...');
			});
		});
	});

	describe('capitalize', function () {
		it('should return the capitalized string', function () {
			expect(helpers.capitalize('hello')).toEqual('Hello');
			expect(helpers.capitalize('world')).toEqual('World');
			expect(helpers.capitalize('javascript')).toEqual('Javascript');
		});

		it('should return an empty string when given an empty string', function () {
			expect(helpers.capitalize('')).toEqual('');
		});

		it('should only touch the first character', function () {
			expect(helpers.capitalize('hELLO')).toEqual('HELLO');
			expect(helpers.capitalize('1abc')).toEqual('1abc');
		});

		it('should handle unicode first characters', function () {
			expect(helpers.capitalize('élan')).toEqual('Élan');
			expect(helpers.capitalize('e\u0301lan')).toEqual('E\u0301lan');
			expect(helpers.capitalize('😀 smile')).toEqual('😀 smile');
			expect(helpers.capitalize('𐐨x')).toEqual('𐐀x');
		});
	});

	describe('uncapitalize', function () {
		it('should lower-case the first character only', function () {
			expect(helpers.uncapitalize('Hello World')).toEqual('hello World');
			expect(helpers.uncapitalize('HELLO')).toEqual('hELLO');
			expect(helpers.uncapitalize('')).toEqual('');
		});

		it('should handle unicode first characters', function () {
			expect(helpers.uncapitalize('Élan')).toEqual('élan');
			expect(helpers.uncapitalize('𐐀x')).toEqual('𐐨x');
		});
	});

	describe('substring', function () {
		it('should extract a substring from a string based on start and end indices', function () {
			expect(helpers.substring('Hello, World!', 7, 12)).toEqual('World');
			expect(helpers.substring('Hello, World!', 0, 5)).toEqual('Hello');
		});

		it('should return an empty string if the start index is greater than the end index', function () {
			expect(helpers.substring('Hello, World!', 12, 7)).toEqual('');
		});

		it('should return the entire string if the end index is greater than the length of the string', function () {
			expect(helpers.substring('Hello, World!', 7, 100)).toEqual('World!');
		});

		it('should handle empty input', function () {
			expect(helpers.substring('', 0, 3)).toEqual('');
		});
	});

	describe('includes', function () {
		it('should return true if the string contains the specified substring', function () {
			expect(helpers.includes('hello world', 'hello')).toEqual(true);
			expect(helpers.includes('hello', '')).toEqual(true);
		});

		it('should return false if the string does not contain the specified substring', function () {
			expect(helpers.includes('hello world', 'goodbye')).toEqual(false);
			expect(helpers.includes('hello world', 'Hello')).toEqual(false);
		});
	});

	describe('replace', function () {
		it('should replace all occurrences of a specified substring with a replacement string', function () {
			expect(helpers.replace('hello world', 'o', '0')).toEqual('hell0 w0rld');
		});

		it('should return the original string if the specified substring is not found', function () {
			expect(helpers.replace('hello world', 'x', '0')).toEqual('hello world');
		});

		it('should return the original string if the searchValue is an empty string', function () {
			expect(helpers.replace('hello world', '', '0')).toEqual('hello world');
		});

		it('should treat the search value literally (no regex injection)', function () {
			expect(helpers.replace('a.b.c', '.', '-')).toEqual('a-b-c');
			expect(helpers.replace('f(x) = (y)', '(', '[')).toEqual('f[x) = [y)');
			expect(helpers.replace('a*b+c?', '*', 'x')).toEqual('axb+c?');
			expect(helpers.replace('a\\b', '\\', '/')).toEqual('a/b');
		});

		it('should treat the replacement literally (no $ patterns)', function () {
			expect(helpers.replace('price: 5', '5', '$&0')).toEqual('price: $&0');
			expect(helpers.replace('abc', 'b', '$1$$')).toEqual('a$1$$c');
			expect(helpers.replace('abc', 'b', "$`$'")).toEqual("a$`$'c");
		});

		it('should replace non-overlapping occurrences from left to right', function () {
			expect(helpers.replace('aaa', 'aa', 'b')).toEqual('ba');
		});
	});

	describe('truncate', function () {
		it('should truncate the string to the specified length and adds the suffix', function () {
			expect(helpers.truncate('hello world', 5)).toEqual('hello...');
			expect(helpers.truncate('hello world', 5, '!')).toEqual('hello!');
			expect(helpers.truncate('hello world', 0)).toEqual('...');
			expect(helpers.truncate('hello world', 5, '')).toEqual('hello');
		});

		it('should return the original string if the length is greater than or equal to the string length', function () {
			expect(helpers.truncate('hello world', 20)).toEqual('hello world');
			expect(helpers.truncate('hello world', 20, '!')).toEqual('hello world');
			expect(helpers.truncate('hello', 5)).toEqual('hello');
			expect(helpers.truncate('', 0)).toEqual('');
		});

		it('should never split a surrogate pair or a grapheme cluster', function () {
			expect(helpers.truncate('😀😀😀', 1)).toEqual('😀...');
			expect(helpers.truncate('👍🏽👍🏽👍🏽', 2)).toEqual('👍🏽👍🏽...');
			expect(helpers.truncate('e\u0301e\u0301e\u0301', 1)).toEqual('e\u0301...');
		});

		it('should count graphemes, not UTF-16 code units', function () {
			// 3 graphemes but 6 code units: nothing to truncate.
			expect(helpers.truncate('😀😀😀', 3)).toEqual('😀😀😀');
			expect(helpers.truncate('😀😀😀', 4)).toEqual('😀😀😀');
		});

		it('should throw a RangeError for invalid lengths', function () {
			expect(function () {
				helpers.truncate('hello', -1);
			}).toThrow(RangeError);
			expect(function () {
				helpers.truncate('hello', 1.5);
			}).toThrow(RangeError);
			expect(function () {
				helpers.truncate('hello', NaN);
			}).toThrow(RangeError);
			expect(function () {
				helpers.truncate('hello', Infinity);
			}).toThrow(/non-negative integer/);
		});
	});

	describe('repeat', function () {
		it('should repeat the string the specified number of times', function () {
			expect(helpers.repeat('hello', 3)).toEqual('hellohellohello');
			expect(helpers.repeat('', 3)).toEqual('');
			expect(helpers.repeat('ab', 0)).toEqual('');
			expect(helpers.repeat('😀', 2)).toEqual('😀😀');
		});

		it('should throw a RangeError for negative, fractional, NaN or infinite counts', function () {
			for (const times of [-1, 1.5, NaN, Infinity, -Infinity]) {
				expect(function () {
					helpers.repeat('a', times);
				}).toThrow(RangeError);
			}
		});
	});

	describe('trim', function () {
		it('should remove white spaces from the beginning and end of the string', function () {
			expect(helpers.trim('  hello world  ')).toEqual('hello world');
			expect(helpers.trim('hello world')).toEqual('hello world');
			expect(helpers.trim('')).toEqual('');
			expect(helpers.trim('\t\n hi \u00a0')).toEqual('hi');
		});
	});

	describe('toTitleCase', function () {
		it('should convert a string to title case', function () {
			expect(helpers.toTitleCase('hello world')).toEqual('Hello World');
			expect(helpers.toTitleCase('The quick brown fox')).toEqual('The Quick Brown Fox');
			expect(helpers.toTitleCase('HELLO wORLD')).toEqual('Hello World');
		});

		it('should preserve whitespace and punctuation', function () {
			expect(helpers.toTitleCase('  hello \t\n world  ')).toEqual('  Hello \t\n World  ');
			expect(helpers.toTitleCase('hello, world! (foo) "bar"')).toEqual('Hello, World! (Foo) "Bar"');
			expect(helpers.toTitleCase('hello-world')).toEqual('Hello-world');
			expect(helpers.toTitleCase('')).toEqual('');
		});

		it('should not capitalize a word that starts with a digit', function () {
			expect(helpers.toTitleCase('the 1st PLACE')).toEqual('The 1st Place');
		});

		it('should handle unicode letters', function () {
			expect(helpers.toTitleCase('élan vital')).toEqual('Élan Vital');
			expect(helpers.toTitleCase('ΑΘΗΝΑ')).toEqual('Αθηνα');
			expect(helpers.toTitleCase('straße ßa')).toEqual('Straße Ssa');
			expect(helpers.toTitleCase('ﬁne')).toEqual('Fine');
		});
	});

	describe('toSnakeCase', function () {
		it('should convert a string to snake case', function () {
			expect(helpers.toSnakeCase('hello world')).toEqual('hello_world');
			expect(helpers.toSnakeCase('The quick brown fox')).toEqual('the_quick_brown_fox');
		});

		it('should split on camelCase, acronyms and any separator', function () {
			expect(helpers.toSnakeCase('helloWorld')).toEqual('hello_world');
			expect(helpers.toSnakeCase('HelloWorld')).toEqual('hello_world');
			expect(helpers.toSnakeCase('a  b')).toEqual('a_b');
			expect(helpers.toSnakeCase('foo-bar.baz/qux')).toEqual('foo_bar_baz_qux');
			expect(helpers.toSnakeCase('XMLHttpRequest')).toEqual('xml_http_request');
			expect(helpers.toSnakeCase('getHTTPResponse2Code')).toEqual('get_http_response2_code');
			expect(helpers.toSnakeCase('  __private_value__  ')).toEqual('private_value');
			expect(helpers.toSnakeCase('CONSTANT_CASE')).toEqual('constant_case');
		});

		it('should keep digits attached to the preceding word', function () {
			expect(helpers.toSnakeCase('version2')).toEqual('version2');
			expect(helpers.toSnakeCase('version2Beta')).toEqual('version2_beta');
			expect(helpers.toSnakeCase('HTTP2Server')).toEqual('http2_server');
			expect(helpers.toSnakeCase('utf8 encoder')).toEqual('utf8_encoder');
		});

		it('should drop apostrophes', function () {
			expect(helpers.toSnakeCase("don't stop")).toEqual('dont_stop');
			expect(helpers.toSnakeCase('it’s fine')).toEqual('its_fine');
		});

		it('should handle unicode letters and empty input', function () {
			expect(helpers.toSnakeCase('ÉcoleNormale supérieure')).toEqual('école_normale_supérieure');
			expect(helpers.toSnakeCase('')).toEqual('');
			expect(helpers.toSnakeCase('  -_- ')).toEqual('');
		});
	});

	describe('toKebabCase', function () {
		it('should convert a string to kebab case', function () {
			expect(helpers.toKebabCase('Hello World')).toEqual('hello-world');
			expect(helpers.toKebabCase('helloWorld')).toEqual('hello-world');
			expect(helpers.toKebabCase('XMLHttpRequest')).toEqual('xml-http-request');
			expect(helpers.toKebabCase('snake_case_value')).toEqual('snake-case-value');
			expect(helpers.toKebabCase('')).toEqual('');
		});
	});

	describe('toConstantCase', function () {
		it('should convert a string to constant case', function () {
			expect(helpers.toConstantCase('maxRetryCount')).toEqual('MAX_RETRY_COUNT');
			expect(helpers.toConstantCase('hello world')).toEqual('HELLO_WORLD');
			expect(helpers.toConstantCase('api-v2-url')).toEqual('API_V2_URL');
			expect(helpers.toConstantCase('')).toEqual('');
		});
	});

	describe('toCamelCase', function () {
		it('should convert a string to camel case', function () {
			expect(helpers.toCamelCase('hello world')).toEqual('helloWorld');
			expect(helpers.toCamelCase('The quick brown fox')).toEqual('theQuickBrownFox');
		});

		it('should handle separators, acronyms and existing cases', function () {
			expect(helpers.toCamelCase('foo-bar_baz qux')).toEqual('fooBarBazQux');
			expect(helpers.toCamelCase('XMLHttpRequest')).toEqual('xmlHttpRequest');
			expect(helpers.toCamelCase('HELLO_WORLD')).toEqual('helloWorld');
			expect(helpers.toCamelCase('helloWorld')).toEqual('helloWorld');
			expect(helpers.toCamelCase('get-http-response2-code')).toEqual('getHttpResponse2Code');
			expect(helpers.toCamelCase('école normale')).toEqual('écoleNormale');
			expect(helpers.toCamelCase('')).toEqual('');
		});
	});

	describe('toPascalCase', function () {
		it('should convert a string to Pascal case', function () {
			expect(helpers.toPascalCase('hello world')).toEqual('HelloWorld');
			expect(helpers.toPascalCase('xml-http-request')).toEqual('XmlHttpRequest');
			expect(helpers.toPascalCase('helloWorld')).toEqual('HelloWorld');
			expect(helpers.toPascalCase('straße')).toEqual('Straße');
			expect(helpers.toPascalCase('ßa')).toEqual('Ssa');
			expect(helpers.toPascalCase('')).toEqual('');
		});
	});

	describe('removeDiacritics', function () {
		it('should strip accents and keep base letters', function () {
			expect(helpers.removeDiacritics('Crème Brûlée à Málaga')).toEqual('Creme Brulee a Malaga');
			expect(helpers.removeDiacritics('Ångström, naïve, façade, São Paulo')).toEqual('Angstrom, naive, facade, Sao Paulo');
			expect(helpers.removeDiacritics('e\u0301')).toEqual('e');
		});

		it('should leave other text untouched', function () {
			expect(helpers.removeDiacritics('')).toEqual('');
			expect(helpers.removeDiacritics('plain ascii 123')).toEqual('plain ascii 123');
			expect(helpers.removeDiacritics('한국어 日本語 😀')).toEqual('한국어 日本語 😀');
		});
	});

	describe('toSlug', function () {
		it('should convert a string to a URL-friendly slug', function () {
			expect(helpers.toSlug('hello world')).toEqual('hello-world');
			expect(helpers.toSlug('The quick brown fox!')).toEqual('the-quick-brown-fox');
		});

		it('should strip diacritics and transliterate common letters', function () {
			expect(helpers.toSlug('Café Society')).toEqual('cafe-society');
			expect(helpers.toSlug('Straße Æon Øre Łódź')).toEqual('strasse-aeon-ore-lodz');
			expect(helpers.toSlug('ﬁle №5')).toEqual('file-no5');
		});

		it('should collapse separators and trim hyphens', function () {
			expect(helpers.toSlug('  --Hello__World!!  ')).toEqual('hello-world');
			expect(helpers.toSlug('a - b')).toEqual('a-b');
			expect(helpers.toSlug('snake_case')).toEqual('snake-case');
		});

		it('should return an empty string when nothing is left', function () {
			expect(helpers.toSlug('')).toEqual('');
			expect(helpers.toSlug('!!! 😀 ---')).toEqual('');
			expect(helpers.toSlug('日本語')).toEqual('');
		});
	});

	describe('toBoolean', function () {
		it('should convert a string to a boolean', function () {
			expect(helpers.toBoolean('true')).toEqual(true);
			expect(helpers.toBoolean('false')).toEqual(false);
		});

		it('should accept common truthy values, trimmed and case-insensitively', function () {
			for (const value of ['true', 'TRUE', ' True ', '1', 'yes', 'YES', 'y', 'Y', 'on', 'ON', '\ton\n']) {
				expect(helpers.toBoolean(value)).toEqual(true);
			}
		});

		it('should return false for everything else', function () {
			for (const value of ['', ' ', '0', 'no', 'n', 'off', 'false', 'truthy', '2', 't', 'yes please']) {
				expect(helpers.toBoolean(value)).toEqual(false);
			}
		});
	});

	describe('toNumber', function () {
		it('should convert a string to a number', function () {
			expect(helpers.toNumber('123')).toEqual(123);
			expect(helpers.toNumber('123.45')).toEqual(123.45);
			expect(helpers.toNumber(' -7 ')).toEqual(-7);
			expect(helpers.toNumber('1e3')).toEqual(1000);
			expect(helpers.toNumber('0x1f')).toEqual(31);
			expect(helpers.toNumber('Infinity')).toEqual(Infinity);
		});

		it('should return NaN for blank or non-numeric strings', function () {
			expect(helpers.toNumber('')).toBeNaN();
			expect(helpers.toNumber('   ')).toBeNaN();
			expect(helpers.toNumber('\n\t')).toBeNaN();
			expect(helpers.toNumber('12px')).toBeNaN();
			expect(helpers.toNumber('abc')).toBeNaN();
		});
	});

	describe('startsWith', function () {
		it('should true if string starts with subString', function () {
			expect(helpers.startsWith('hello world', 'hello')).toEqual(true);
			expect(helpers.startsWith('hello world', '')).toEqual(true);
		});

		it('should false if string does not start with subString', function () {
			expect(helpers.startsWith('hello world', 'world')).toEqual(false);
			expect(helpers.startsWith('hello world', 'Hello')).toEqual(false);
		});
	});

	describe('endsWith', function () {
		it('should return true if string ends with subString', function () {
			expect(helpers.endsWith('hello world', 'world')).toEqual(true);
		});

		it('should return false if string does not end with subString', function () {
			expect(helpers.endsWith('hello world', 'hello')).toEqual(false);
		});
	});

	describe('countSubString', function () {
		it('should return the number of occurrences of the sub-string in the string', function () {
			expect(helpers.countSubString('hello world, hello', 'hello')).toEqual(2);
		});

		it('should return 0 if the sub-string is not found in the string', function () {
			expect(helpers.countSubString('hello world, hello', 'goodbye')).toEqual(0);
			expect(helpers.countSubString('', 'a')).toEqual(0);
		});

		it('should return 0 for an empty sub-string', function () {
			expect(helpers.countSubString('hello', '')).toEqual(0);
			expect(helpers.countSubString('', '')).toEqual(0);
		});

		it('should match literally (no regex injection)', function () {
			expect(helpers.countSubString('a.b.c', '.')).toEqual(2);
			expect(helpers.countSubString('f(x) + (y)', '(')).toEqual(2);
			expect(helpers.countSubString('a*b', '*')).toEqual(1);
		});

		it('should count non-overlapping occurrences', function () {
			expect(helpers.countSubString('aaaa', 'aa')).toEqual(2);
			expect(helpers.countSubString('aaa', 'aa')).toEqual(1);
		});

		it('should be case-sensitive by default and support ignoreCase', function () {
			expect(helpers.countSubString('Hello hello HELLO', 'hello')).toEqual(1);
			expect(helpers.countSubString('Hello hello HELLO', 'hello', { ignoreCase: true })).toEqual(3);
			expect(helpers.countSubString('Hello hello', 'HELLO', { ignoreCase: true })).toEqual(2);
			expect(helpers.countSubString('ÉCOLE école', 'école', { ignoreCase: true })).toEqual(2);
			expect(helpers.countSubString('İstanbul İzmir', 'İ', { ignoreCase: true })).toEqual(2);
		});
	});

	describe('isEmpty', function () {
		it('should return true for empty strings', function () {
			expect(helpers.isEmpty('')).toEqual(true);
			expect(helpers.isEmpty('   ')).toEqual(true);
			expect(helpers.isEmpty('\n\t\u00a0')).toEqual(true);
		});

		it('should return false for non-empty strings', function () {
			expect(helpers.isEmpty('Hello World')).toEqual(false);
			expect(helpers.isEmpty('   Hello World   ')).toEqual(false);
		});
	});

	describe('getWords', function () {
		it('should return an empty array for empty strings', function () {
			expect(helpers.getWords('')).toEqual([]);
			expect(helpers.getWords('   ')).toEqual([]);
			expect(helpers.getWords('!?, -')).toEqual([]);
		});

		it('should return the words in the string as an array', function () {
			expect(helpers.getWords('Hello World')).toEqual(['Hello', 'World']);
			expect(helpers.getWords('Hello   World')).toEqual(['Hello', 'World']);
			expect(helpers.getWords('one,two;three')).toEqual(['one', 'two', 'three']);
		});

		it('should support unicode letters, numbers and combining marks', function () {
			expect(helpers.getWords('café naïve 2024')).toEqual(['café', 'naïve', '2024']);
			expect(helpers.getWords('cafe\u0301 Привет мир')).toEqual(['cafe\u0301', 'Привет', 'мир']);
		});

		it('should keep inner apostrophes but not leading/trailing ones', function () {
			expect(helpers.getWords("Don't stop, it’s 'quoted'")).toEqual(["Don't", 'stop', 'it’s', 'quoted']);
		});

		it('should split on underscores (unlike \\w)', function () {
			expect(helpers.getWords('snake_case')).toEqual(['snake', 'case']);
		});
	});

	describe('isPalindrome', function () {
		it('should return true for a palindrome string', function () {
			expect(helpers.isPalindrome('racecar')).toEqual(true);
		});

		it('should return false for a non-palindrome string', function () {
			expect(helpers.isPalindrome('hello')).toEqual(false);
		});

		it('should return true for an empty string', function () {
			expect(helpers.isPalindrome('')).toEqual(true);
		});

		it('should return true for a single character string', function () {
			expect(helpers.isPalindrome('a')).toEqual(true);
		});

		it('should be strict by default', function () {
			expect(helpers.isPalindrome('Racecar')).toEqual(false);
			expect(helpers.isPalindrome('race car')).toEqual(false);
		});

		it('should support ignoreCase and ignoreNonAlphanumeric', function () {
			expect(helpers.isPalindrome('Racecar', { ignoreCase: true })).toEqual(true);
			expect(helpers.isPalindrome('race car', { ignoreNonAlphanumeric: true })).toEqual(true);
			expect(helpers.isPalindrome('A man, a plan, a canal: Panama', { ignoreCase: true, ignoreNonAlphanumeric: true })).toEqual(true);
			expect(helpers.isPalindrome('A man, a plan, a canal: Panama', { ignoreNonAlphanumeric: true })).toEqual(false);
			expect(helpers.isPalindrome('hello, world', { ignoreCase: true, ignoreNonAlphanumeric: true })).toEqual(false);
		});

		it('should be grapheme-aware', function () {
			expect(helpers.isPalindrome('😀a😀')).toEqual(true);
			expect(helpers.isPalindrome('👍🏽x👍🏽')).toEqual(true);
			expect(helpers.isPalindrome('e\u0301te\u0301')).toEqual(true);
		});
	});

	describe('escapeRegExp', function () {
		it('should escape every regex metacharacter', function () {
			expect(helpers.escapeRegExp('.*+?^${}()|[]\\')).toEqual('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
			expect(helpers.escapeRegExp('1.5*(x)')).toEqual('1\\.5\\*\\(x\\)');
		});

		it('should leave other characters untouched', function () {
			expect(helpers.escapeRegExp('')).toEqual('');
			expect(helpers.escapeRegExp('abc-/ 😀')).toEqual('abc-/ 😀');
		});

		it('should produce patterns that match literally, with and without the u flag', function () {
			const source = 'a.b*(c)[d]{1}|$^\\-/';
			expect(new RegExp(`^${helpers.escapeRegExp(source)}$`).test(source)).toEqual(true);
			expect(new RegExp(`^${helpers.escapeRegExp(source)}$`, 'u').test(source)).toEqual(true);
			expect(new RegExp(helpers.escapeRegExp('a.b')).test('axb')).toEqual(false);
		});
	});

	describe('escapeHtml', function () {
		it('should escape & < > " and \'', function () {
			expect(helpers.escapeHtml('<a href="x">Tom & Jerry\'s</a>')).toEqual('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
		});

		it('should escape already-escaped entities again', function () {
			expect(helpers.escapeHtml('&amp;')).toEqual('&amp;amp;');
		});

		it('should leave safe text untouched', function () {
			expect(helpers.escapeHtml('')).toEqual('');
			expect(helpers.escapeHtml('plain text 😀')).toEqual('plain text 😀');
		});
	});

	describe('unescapeHtml', function () {
		it('should decode the entities produced by escapeHtml and common aliases', function () {
			expect(helpers.unescapeHtml('&lt;b&gt;Tom &amp; Jerry&#39;s&lt;/b&gt;')).toEqual("<b>Tom & Jerry's</b>");
			expect(helpers.unescapeHtml('&quot;&#x27;&#X27;&apos;')).toEqual("\"'''");
		});

		it('should not double-unescape', function () {
			expect(helpers.unescapeHtml('&amp;lt;')).toEqual('&lt;');
			expect(helpers.unescapeHtml('&amp;amp;')).toEqual('&amp;');
			expect(helpers.unescapeHtml('&amp;#39;')).toEqual('&#39;');
		});

		it('should leave unknown or malformed entities untouched', function () {
			expect(helpers.unescapeHtml('&nbsp; &copy; &lt &amp')).toEqual('&nbsp; &copy; &lt &amp');
			expect(helpers.unescapeHtml('')).toEqual('');
		});
	});

	describe('normalizeWhitespace', function () {
		it('should trim and collapse whitespace runs', function () {
			expect(helpers.normalizeWhitespace('  hello \n\t world  ')).toEqual('hello world');
			expect(helpers.normalizeWhitespace('a\u00a0\u2003b')).toEqual('a b');
			expect(helpers.normalizeWhitespace('already normal')).toEqual('already normal');
		});

		it('should return an empty string for blank input', function () {
			expect(helpers.normalizeWhitespace('')).toEqual('');
			expect(helpers.normalizeWhitespace(' \n ')).toEqual('');
		});
	});

	describe('interpolate', function () {
		it('should replace simple and nested placeholders', function () {
			expect(helpers.interpolate('Hello {user.name}, you have {count} messages', { user: { name: 'Ada' }, count: 3 })).toEqual('Hello Ada, you have 3 messages');
			expect(helpers.interpolate('{ name }!', { name: 'Bob' })).toEqual('Bob!');
			expect(helpers.interpolate('{items.1}', { items: ['a', 'b'] })).toEqual('b');
			expect(helpers.interpolate('{a}{a}', { a: 'x' })).toEqual('xx');
		});

		it('should stringify values with String()', function () {
			expect(helpers.interpolate('{a} {b} {c} {d} {e}', { a: null, b: false, c: 0, d: [1, 2], e: 10n })).toEqual('null false 0 1,2 10');
		});

		it('should leave missing placeholders untouched', function () {
			expect(helpers.interpolate('Hi {missing}', {})).toEqual('Hi {missing}');
			expect(helpers.interpolate('{user.age}', { user: { name: 'Ada' } })).toEqual('{user.age}');
			expect(helpers.interpolate('{user.name.first}', { user: { name: 'Ada' } })).toEqual('{user.name.first}');
			expect(helpers.interpolate('{a.b}', { a: null })).toEqual('{a.b}');
			expect(helpers.interpolate('{u}', { u: undefined })).toEqual('{u}');
		});

		it('should not read inherited properties', function () {
			expect(helpers.interpolate('{constructor} {toString} {__proto__}', {})).toEqual('{constructor} {toString} {__proto__}');
		});

		it('should ignore text that is not a placeholder', function () {
			expect(helpers.interpolate('no placeholders', { a: 1 })).toEqual('no placeholders');
			expect(helpers.interpolate('{} { a', { a: 1 })).toEqual('{} { a');
			expect(helpers.interpolate('', {})).toEqual('');
		});
	});
});
