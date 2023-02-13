/**
 * Check if an array contains a value
 * @template T
 * @param {T[]} array - The array to be checked
 * @param {T} value - The value to look for
 * @returns {boolean} Whether the value is in the array
 */
export function contains<T>(array: T[], value: T): boolean {
	return array.indexOf(value) !== -1;
}

/**
 * Get the first item in an array
 * @template T
 * @param {T[]} array - The array to be processed
 * @returns {T} The first item in the array
 */
export function first<T>(array: T[]): T {
	return array[0];
}

/**
 * Get the last item in an array
 * @template T
 * @param {T[]} array - The array to be processed
 * @returns {T} The last item in the array
 */
export function last<T>(array: T[]): T {
	return array[array.length - 1];
}

/**
 * Flatten a nested array into a single-dimensional array
 * @template T
 * @param {T[]} array - The array to be flattened
 * @returns {T[]} The flattened array
 */
export function flatten<T>(array: T[]): T[] {
	return array.reduce((acc: T[], val: T) => acc.concat(val), []);
}

/**
 * Remove duplicates from an array
 * @template T
 * @param {T[]} array - The array to be processed
 * @returns {T[]} The array with duplicates removed
 */
export function removeDuplicates<T>(array: T[]): T[] {
	return Array.from(new Set(array));
}

/**
 * Get the union of two arrays (all unique values from both arrays)
 * @template A
 * @template B
 * @param {A[]} a - The first array
 * @param {B[]} b - The second array
 * @returns {(A | B)[]} The union of the two arrays
 */
export function union<A, B extends A>(a: A[], b: B[]): (A | B)[] {
	return removeDuplicates(a.concat(b));
}

/**
 * Get the intersection of two arrays (all values that exist in both arrays)
 * @template A
 * @template B
 * @param {A[]} a - The first array
 * @param {B[]} b - The second array
 * @returns {(A & B)[]} The intersection of the two arrays
 */
export function intersection<A extends B, B>(a: A[], b: B[]): (A & B)[] {
	return a.filter(value => b.includes(value));
}

/**
 * Get the difference of two arrays (all values that exist in the first array but not the second)
 * @template A
 * @template B
 * @param {A[]} a - The first array
 * @param {B[]} b - The second array
 * @returns {array} The difference of the two arrays
 */
export function difference<A extends B, B>(a: A[], b: B[]): (A & B)[] {
	return a.filter(value => !b.includes(value));
}
