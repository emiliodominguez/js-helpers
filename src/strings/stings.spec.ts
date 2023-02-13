import * as helpers from '.';

describe('String helpers', () => {
	describe('reverse', () => {
		it('should reverse the string', () => {
			const input = 'hello';
			const expectedOutput = 'olleh';
			expect(helpers.reverse(input)).toEqual(expectedOutput);
		});

		it('should return an empty string for an empty input', () => {
			const input = '';
			const expectedOutput = '';
			expect(helpers.reverse(input)).toEqual(expectedOutput);
		});

		it('should return the same string for a single character input', () => {
			const input = 'a';
			const expectedOutput = 'a';
			expect(helpers.reverse(input)).toEqual(expectedOutput);
		});
	});

	describe('capitalize', () => {
		it('should return the capitalized string', () => {
			expect(helpers.capitalize('hello')).toEqual('Hello');
			expect(helpers.capitalize('world')).toEqual('World');
			expect(helpers.capitalize('javascript')).toEqual('Javascript');
		});

		it('should return an empty string when given an empty string', () => {
			expect(helpers.capitalize('')).toEqual('');
		});
	});

	describe('substring', () => {
		it('should extract a substring from a string based on start and end indices', () => {
			expect(helpers.substring('Hello, World!', 7, 12)).toEqual('World');
			expect(helpers.substring('Hello, World!', 0, 5)).toEqual('Hello');
		});

		it('should return an empty string if the start index is greater than the end index', () => {
			expect(helpers.substring('Hello, World!', 12, 7)).toEqual('');
		});

		it('should return the entire string if the end index is greater than the length of the string', () => {
			expect(helpers.substring('Hello, World!', 7, 100)).toEqual('World!');
		});
	});

	describe('includes', () => {
		it('should return true if the string contains the specified substring', () => {
			expect(helpers.includes('hello world', 'hello')).toEqual(true);
		});

		it('should return false if the string does not contain the specified substring', () => {
			expect(helpers.includes('hello world', 'goodbye')).toEqual(false);
		});
	});

	describe('replace', () => {
		it('should replace all occurrences of a specified substring with a replacement string', () => {
			const string = 'hello world';
			const searchValue = 'o';
			const replaceValue = '0';
			expect(helpers.replace(string, searchValue, replaceValue)).toEqual('hell0 w0rld');
		});

		it('should return the original string if the specified substring is not found', () => {
			const string = 'hello world';
			const searchValue = 'x';
			const replaceValue = '0';
			expect(helpers.replace(string, searchValue, replaceValue)).toEqual(string);
		});

		it('should return the original string if the searchValue is an empty string', () => {
			const string = 'hello world';
			const searchValue = '';
			const replaceValue = '0';
			expect(helpers.replace(string, searchValue, replaceValue)).toEqual(string);
		});
	});

	describe('truncate', () => {
		it('should truncate the string to the specified length and adds the suffix', () => {
			expect(helpers.truncate('hello world', 5)).toEqual('hello...');
			expect(helpers.truncate('hello world', 5, '!')).toEqual('hello!');
		});

		it('should return the original string if the length is greater than the string length', () => {
			expect(helpers.truncate('hello world', 20)).toEqual('hello world');
			expect(helpers.truncate('hello world', 20, '!')).toEqual('hello world');
		});
	});

	describe('repeat', () => {
		it('should repeat the string the specified number of times', () => {
			expect(helpers.repeat('hello', 3)).toEqual('hellohellohello');
			expect(helpers.repeat('', 3)).toEqual('');
		});
	});

	describe('trim', () => {
		it('should remove white spaces from the beginning and end of the string', () => {
			expect(helpers.trim('  hello world  ')).toEqual('hello world');
			expect(helpers.trim('hello world')).toEqual('hello world');
			expect(helpers.trim('')).toEqual('');
		});
	});

	describe('toTitleCase', () => {
		it('should convert a string to title case', () => {
			expect(helpers.toTitleCase('hello world')).toEqual('Hello World');
			expect(helpers.toTitleCase('The quick brown fox')).toEqual('The Quick Brown Fox');
		});
	});

	describe('toSnakeCase', () => {
		it('should convert a string to snake case', () => {
			expect(helpers.toSnakeCase('hello world')).toEqual('hello_world');
			expect(helpers.toSnakeCase('The quick brown fox')).toEqual('the_quick_brown_fox');
		});
	});

	describe('toCamelCase', () => {
		it('should convert a string to camel case', () => {
			expect(helpers.toCamelCase('hello world')).toEqual('helloWorld');
			expect(helpers.toCamelCase('The quick brown fox')).toEqual('theQuickBrownFox');
		});
	});

	describe('toSlug', () => {
		it('should convert a string to a URL-friendly slug', () => {
			expect(helpers.toSlug('hello world')).toEqual('hello-world');
			expect(helpers.toSlug('The quick brown fox!')).toEqual('the-quick-brown-fox');
		});
	});

	describe('toBoolean', () => {
		it('should convert a string to a boolean', () => {
			expect(helpers.toBoolean('true')).toEqual(true);
			expect(helpers.toBoolean('false')).toEqual(false);
		});
	});

	describe('toNumber', () => {
		it('should convert a string to a number', () => {
			expect(helpers.toNumber('123')).toEqual(123);
			expect(helpers.toNumber('123.45')).toEqual(123.45);
		});
	});

	describe('startsWith', () => {
		it('should true if string starts with subString', () => {
			expect(helpers.startsWith('hello world', 'hello')).toEqual(true);
		});

		it('should false if string does not start with subString', () => {
			expect(helpers.startsWith('hello world', 'world')).toEqual(false);
		});
	});

	describe('endsWith', () => {
		it('should return true if string ends with subString', () => {
			expect(helpers.endsWith('hello world', 'world')).toEqual(true);
		});

		it('should return false if string does not end with subString', () => {
			expect(helpers.endsWith('hello world', 'hello')).toEqual(false);
		});
	});

	describe('countSubString', () => {
		it('should return the number of occurrences of the sub-string in the string', () => {
			expect(helpers.countSubString('hello world, hello', 'hello')).toEqual(2);
		});

		it('should return 0 if the sub-string is not found in the string', () => {
			expect(helpers.countSubString('hello world, hello', 'goodbye')).toEqual(0);
		});
	});

	describe('isEmpty', () => {
		it('should return true for empty strings', () => {
			expect(helpers.isEmpty('')).toEqual(true);
			expect(helpers.isEmpty('   ')).toEqual(true);
		});

		it('should return false for non-empty strings', () => {
			expect(helpers.isEmpty('Hello World')).toEqual(false);
			expect(helpers.isEmpty('   Hello World   ')).toEqual(false);
		});
	});

	describe('getWords', () => {
		it('should return an empty array for empty strings', () => {
			expect(helpers.getWords('')).toEqual([]);
			expect(helpers.getWords('   ')).toEqual([]);
		});

		it('should return the words in the string as an array', () => {
			expect(helpers.getWords('Hello World')).toEqual(['Hello', 'World']);
			expect(helpers.getWords('Hello   World')).toEqual(['Hello', 'World']);
		});
	});

	describe('isPalindrome', () => {
		it('should return true for a palindrome string', () => {
			expect(helpers.isPalindrome('racecar')).toEqual(true);
		});

		it('should return false for a non-palindrome string', () => {
			expect(helpers.isPalindrome('hello')).toEqual(false);
		});

		it('should return true for an empty string', () => {
			expect(helpers.isPalindrome('')).toEqual(true);
		});

		it('should return true for a single character string', () => {
			expect(helpers.isPalindrome('a')).toEqual(true);
		});
	});
});
