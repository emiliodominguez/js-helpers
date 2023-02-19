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
 * Remove duplicates from an iterable
 * @template T
 * @param {Iterable<T>} iterable - The iterable to be processed
 * @returns {T[]} The array with duplicates removed
 */
export function removeDuplicates<T>(iterable: Iterable<T>): T[] {
	return Array.from(new Set(iterable));
}

/**
 * Get the union of two iterables (all unique values from both iterables)
 * @template A
 * @template B
 * @param {Iterable<A>} a - The first iterable
 * @param {Iterable<B>} b - The second iterable
 * @returns {(A | B)[]} The union of the two iterables
 */
export function union<A, B extends A>(a: Iterable<A>, b: Iterable<B>): (A | B)[] {
	const setA = new Set(a);
	const setB = new Set(b);
	return Array.from(new Set([...setA, ...setB]));
}

/**
 * Get the intersection of two iterables (all values that exist in both iterables)
 * @template A
 * @template BF
 * @param {Iterable<A>} a - The first iterable
 * @param {Iterable<B>} b - The second iterable
 * @returns {Array<A & B>} The intersection of the two iterables
 */
export function intersection<A extends B, B>(a: Iterable<A>, b: Iterable<B>): Array<A & B> {
	const setA = new Set(a);
	const setB = new Set(b);
	return Array.from(new Set([...setA].filter(value => setB.has(value))));
}

/**
 * Get the difference of two iterables (all values that exist in the first iterable but not the second)
 * @template A
 * @template B
 * @param {Iterable<A>} a - The first iterable
 * @param {Iterable<B>} b - The second iterable
 * @returns {Array<A & B>} The difference of the two iterables
 */
export function difference<A extends B, B>(a: Iterable<A>, b: Iterable<B>): Array<A & B> {
	const setA = new Set(a);
	const setB = new Set(b);
	return Array.from(new Set([...setA].filter(value => !setB.has(value))));
}
