/**
 * Binds a function to a specific `this` value.
 * @param {Function} fn - The function to be bound.
 * @param {any} thisValue - The `this` value to be bound to.
 * @returns {Function} A new function that is bound to the given `this` value.
 */
export function bind(fn: Function, thisValue: any): Function {
	return function () {
		return fn.apply(thisValue, arguments);
	};
}

/**
 * Creates a new function that is a curried version of the original function.
 * @param {Function} fn - The function to be curried.
 * @returns {Function} The curried function.
 */
export function curry(fn: Function): Function {
	let arity = fn.length;

	return function curriedFn(...args: any[]) {
		if (args.length >= arity) {
			return fn.apply(null, args);
		} else {
			return function (...moreArgs: any[]) {
				return curriedFn.apply(null, [...args, ...moreArgs]);
			};
		}
	};
}

/**
 * Composes multiple functions into a single function.
 * The functions are composed from right to left.
 * @param {...Function[]} fns - The functions to be composed.
 * @returns {Function} The composed function.
 */
export function compose(...fns: Function[]): Function {
	return fns.reduce(
		(f, g) =>
			(...args: any[]) =>
				f(g(...args))
	);
}

/**
 * Returns a new function that caches the results of the original function.
 * Subsequent calls to the memoized function with the same arguments will return the cached result.
 * @param {Function} fn - The function to be memoized.
 * @returns {Function} The memoized function.
 */
export function memoize(fn: Function): Function {
	let cache: { [key: string]: Function } = {};

	return function (...args: any[]) {
		let key = JSON.stringify(args);

		if (cache[key]) {
			return cache[key];
		} else {
			let result = fn.apply(null, args);
			cache[key] = result;
			return result;
		}
	};
}

/**
 * Returns a new function that limits the rate at which the original function can be called.
 * @param {Function} fn - The function to be throttled.
 * @param {number} delay - The minimum time interval between function calls.
 * @returns {Function} The throttled function.
 */
export function throttle(fn: Function, delay: number): Function {
	let lastCallTime: number;

	return function (...args: any[]) {
		let currentTime = Date.now();

		if (!lastCallTime || currentTime - lastCallTime >= delay) {
			lastCallTime = currentTime;
			return fn.apply(null, args);
		}
	};
}

/**
 * Returns a new function that waits for a specified amount of time before calling the original function.
 * If the function is called again before the specified delay, the previous call is cancelled.
 * @param {Function} fn - The function to be debounced.
 * @param {number} delay - The delay time in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(fn: Function, delay: number): Function {
	let timeout: number;

	return function (...args: any[]) {
		clearTimeout(timeout);
		timeout = setTimeout(() => fn.apply(null, args), delay) as unknown as number;
	};
}

/**
 * Returns a new function that partially applies arguments to the original function.
 * @param {Function} fn - The function to be partially applied.
 * @param {...any[]} args - The arguments to be partially applied.
 * @returns {Function} The partially applied function.
 */
export function partial(fn: Function, ...args: any[]): Function {
	return function (...moreArgs: any[]) {
		return fn.apply(null, [...args, ...moreArgs]);
	};
}
