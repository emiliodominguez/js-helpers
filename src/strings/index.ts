/**
 * Reverses a given string
 * @param {string} string - The string to be reversed
 * @returns {string} The reversed string
 */
export function reverse(string: string): string {
	return string.split('').reverse().join('');
}

/**
 * Capitalizes the first letter of a given string
 * @param {string} string - The string to be capitalized
 * @returns {string} The capitalized string
 */
export function capitalize(string: string): string {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Extracts a substring from a string based on start and end indices
 * @param {string} string - The original string
 * @param {number} start - The start index of the substring
 * @param {number} end - The end index of the substring
 * @returns {string} The extracted substring
 */
export function substring(string: string, start: number, end: number): string {
	if (start > end) return '';

	return string.substring(start, end);
}

/**
 * Check if a string contains a specified substring
 * @param {string} string - The original string
 * @param {string} subString - The substring to be searched for
 * @returns {boolean} Whether the string contains the specified substring
 */
export function includes(string: string, subString: string): boolean {
	return string.includes(subString);
}

/**
 * Replaces all occurrences of a specified substring with a replacement string
 * @param {string} string - The original string
 * @param {string} searchValue - The substring to be replaced
 * @param {string} replaceValue - The replacement string
 * @returns {string} The string with all occurrences of the substring replaced
 */
export function replace(string: string, searchValue: string, replaceValue: string): string {
	if (!searchValue) return string;

	return string.replace(new RegExp(searchValue, 'g'), replaceValue);
}

/**
 * Truncates a string to a specified length and adds an optional suffix
 * @param {string} string - The original string
 * @param {number} length - The desired length of the truncated string
 * @param {string} [suffix='...'] - The suffix to be added to the truncated string
 * @returns {string} The truncated string
 */
export function truncate(string: string, length: number, suffix: string = '...'): string {
	return string.length > length ? string.slice(0, length) + suffix : string;
}

/**
 * Repeat a string a specified number of times
 * @param {string} string - The original string
 * @param {number} times - The number of times to repeat the string
 * @returns {string} The repeated string
 */
export function repeat(string: string, times: number): string {
	return new Array(times + 1).join(string);
}

/**
 * Removes white spaces from the beginning and end of a string
 * @param {string} string - The string to be trimmed
 * @returns {string} The trimmed string
 */
export function trim(string: string): string {
	return string.trim();
}

/**
 * Converts a given string to title case, where each word is capitalized
 * @param {string} string - The string to be converted to title case
 * @returns {string} The string in title case
 */
export function toTitleCase(string: string): string {
	return string
		.toLowerCase()
		.split(' ')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * Converts a given string to snake case, where words are separated by underscores
 * @param {string} string - The string to be converted to snake case
 * @returns {string} The string in snake case
 */
export function toSnakeCase(string: string): string {
	return string
		.split(' ')
		.map(word => word.toLowerCase())
		.join('_');
}

/**
 * Converts a given string to camel case, where words are joined without separators
 * @param {string} string - The string to be converted to camel case
 * @returns {string} The string in camel case
 */
export function toCamelCase(string: string): string {
	return string
		.toLowerCase()
		.split(' ')
		.map((word, i) => (i > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
		.join('');
}

/**
 * Converts a string to a URL-friendly slug
 * @param {string} string - The string to be converted to a slug
 * @returns {string} The URL-friendly slug
 */
export function toSlug(string: string): string {
	return string
		.toLowerCase()
		.replace(/[^\w ]+/g, '')
		.replace(/ +/g, '-');
}

/**
 * Converts a string to a boolean
 * @param {string} string - The string to be converted to a boolean
 * @returns {boolean} The converted boolean
 */
export function toBoolean(string: string): boolean {
	return string.toLowerCase() === 'true';
}

/**
 * Convert a string to a number
 * @param {string} string - The string to be converted to a number
 * @returns {number} The converted number
 */
export function toNumber(string: string): number {
	return Number(string);
}

/**
 * Checks if a string starts with a given sub-string
 * @param {string} string - The string to be checked
 * @param {string} subString - The sub-string to search for
 * @returns {boolean} Whether the string starts with the sub-string
 */
export function startsWith(string: string, subString: string): boolean {
	return string.startsWith(subString);
}

/**
 * Check if a string ends with a specified substring
 * @param {string} string - The original string
 * @param {string} subString - The substring to be searched for
 * @returns {boolean} Whether the string ends with the specified substring
 */
export function endsWith(string: string, subString: string): boolean {
	return string.endsWith(subString);
}

/**
 * Counts the number of occurrences of a sub-string in a string
 * @param {string} string - The string to search in
 * @param {string} subString - The sub-string to search for
 * @returns {number} The number of occurrences of the sub-string
 */
export function countSubString(string: string, subString: string): number {
	return (string.match(new RegExp(subString, 'gi')) || []).length;
}

/**
 * Check if a string is empty (contains only whitespace characters)
 * @param {string} string - The string to be checked
 * @returns {boolean} Whether the string is empty
 */
export function isEmpty(string: string): boolean {
	return !string.trim().length;
}

/**
 * Extracts the words from a string and returns them as an array
 * @param {string} string - The string to be split into words
 * @returns {string[]} The words in the string
 */
export function getWords(string: string): string[] {
	return string.match(/\b\w+\b/g) ?? [];
}

/**
 * Check if a string is a palindrome
 * @param {string} string - The string to be checked
 * @returns {boolean} Whether the string is a palindrome
 */
export function isPalindrome(string: string): boolean {
	return string === reverse(string);
}
