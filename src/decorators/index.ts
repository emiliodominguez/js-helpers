/**
 * A decorator that makes a property readonly
 * @template T
 * @param {T} target The object the property belongs to
 * @param {keyof T} propertyKey The property key
 */
export function readonly<T>(target: T, propertyKey: keyof T): void {
	Object.defineProperty(target, propertyKey, {
		writable: false
	});
}

/**
 * A decorator that logs a method's call and return value
 * @template T
 * @param {T} _target The object the method belongs to
 * @param {keyof T} propertyKey The method key
 * @param {PropertyDescriptor} descriptor The property descriptor
 */
export function log<T>(_target: T, propertyKey: keyof T, descriptor: PropertyDescriptor): void {
	const originalMethod = descriptor.value;

	descriptor.value = function (...args: any[]): Function {
		// eslint-disable-next-line no-console
		console.log(`${String(propertyKey)} method called with arguments:`, args);
		const result = originalMethod.apply(this, args);
		// eslint-disable-next-line no-console
		console.log(`${String(propertyKey)} method returned:`, result);
		return result;
	};
}

/**
 * A decorator that memoizes a method's results
 * @template T
 * @param {T} _target The object the method belongs to
 * @param {keyof T} _propertyKey The method key
 * @param {PropertyDescriptor} descriptor The property descriptor
 */
export function memoize<T>(_target: T, _propertyKey: keyof T, descriptor: PropertyDescriptor): void {
	const originalMethod = descriptor.value;
	const cache: Map<string, any> = new Map();

	descriptor.value = function (...args: any[]): Function {
		const key = JSON.stringify(args);

		if (cache.has(key)) return cache.get(key);

		const result = originalMethod.apply(this, args);
		cache.set(key, result);
		return result;
	};
}
