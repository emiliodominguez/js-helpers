import { NestedKeyOf } from '../utils/types';

/**
 * Merges two or more objects into a new object
 * @template Target
 * @template Output
 * @param {Target} target - The target object that will receive the properties from the other objects
 * @param {...any} sources - The sources from which to get the properties
 * @returns {Target & Source & Output} The merged object
 */
export function merge<Target, Source extends Partial<Target>, Output>(target: Target, ...sources: Source[]): Target & Source & Output {
	return { ...target, ...Object.assign({}, ...sources) };
}

/**
 * Clones an object by creating a new object with the same properties
 * @template T @extends {Object}
 * @param {T} object - The object to clone
 * @returns {T} The cloned object
 */
export function clone<T extends Object>(object: T): T {
	return { ...object };
}

/**
 * Determines if an object has a specified property
 * @template T @extends {Object}
 * @param {T} object - The object to check
 * @param {keyof T} property - The property to check for
 * @returns {property is keyof T} Whether the object has the specified property
 */
export function hasProperty<T extends Object>(object: T, property: keyof T): property is keyof T {
	return property in object;
}

/**
 * Gets the value of a specified property from an object
 * @template T
 * @param {T} object - The object to get the property value from
 * @param {keyof T} property - The name of the property to get the value of
 * @returns {T[keyof T]} The value of the specified property
 */
export function getProperty<T>(object: T, property: keyof T): T[keyof T] {
	return object[property];
}

/**
 * Sets the value of a specified property on an object
 * @template T @extends {Object}
 * @template K @extends {string | number | symbol}
 * @template V
 * @param {T} object - The object to set the property value on
 * @param {K} property - The name of the property to set the value of
 * @param {V} value - The value to set for the property
 * @returns {void}
 */
export function setProperty<T extends Object, K extends string | number | symbol, V>(object: T, property: K, value: V): void {
	(object as any)[property] = value;
}

/**
 * Deletes a specified property from an object
 * @template T
 * @template K extends keyof T
 * @param {T} object - The object to delete the property from
 * @param {K} property - The name of the property to delete
 * @returns {void}
 */
export function deleteProperty<T, K extends keyof T>(object: T, property: K): void {
	delete object[property];
}

/**
 * Gets the names of all properties of an object
 * @template T
 * @param {T} object - The object to get the property names from
 * @returns {Array<keyof T>} An array of the names of all properties of the object
 */
export function getPropertyNames<T>(object: T): Array<keyof T> {
	return Object.getOwnPropertyNames(object) as Array<keyof T>;
}

/**
 * Gets a nested (or not) value by its key
 * @template T
 * @template Result
 * @param {T} target - The original object
 * @param {NestedKeyOf<T>} keys - The key(s)
 * @returns {Result} The resultant object
 */
export function getFromObjectByKeys<T extends Object, Result>(target: T, keys: NestedKeyOf<T>): Result {
	// @ts-ignore
	return keys.split('.').reduce((acc, key) => (acc as any)[key], target) as unknown as Result;
}

/**
 * Determines if an object is empty
 * @template T @extends {Object}
 * @param {T} object - The object to check
 * @returns {boolean} True if the object is empty, false otherwise
 */
export function isEmpty<T extends Object>(object: T): boolean {
	return Object.keys(object).length === 0;
}

/**
 * Check if the given value is an object
 * @template T
 * @param {T} object - The value to check
 * @returns {boolean} Whether the value is an object
 */
export function isObject<T>(object: T): boolean {
	return object !== null && typeof object === 'object';
}

/**
 * Check if the given value is an array
 * @template T
 * @param {T} object - The value to check
 * @returns {boolean} Whether the value is an array
 */
export function isArray<T>(object: T): boolean {
	return Array.isArray(object);
}

/**
 * Check if the given value is a function
 * @template T
 * @param {T} object - The value to check
 * @returns {boolean} Whether the value is a function
 */
export function isFunction<T>(object: T): boolean {
	return typeof object === 'function';
}

/**
 * Check if the given value is a string
 * @template T
 * @param {T} object - The value to check
 * @returns {boolean} Whether the value is a string
 */
export function isString<T>(object: T): boolean {
	return typeof object === 'string';
}

/**
 * Check if the given value is a number
 * @template T
 * @param {T} object - The value to check
 * @returns {boolean} Whether the value is a number
 */
export function isNumber<T>(object: T): boolean {
	return typeof object === 'number';
}

/**
 * Check if the given value is a boolean
 * @template T
 * @param {T} object - The value to check
 * @returns {boolean} Whether the value is a boolean
 */
export function isBoolean<T>(object: T): boolean {
	return typeof object === 'boolean';
}

/**
 * Check if the given value is undefined
 * @template T
 * @param {T} object - The value to check
 * @returns {boolean} Whether the value is undefined
 */
export function isUndefined<T>(object: T): boolean {
	return typeof object === 'undefined';
}

/**
 * Check if the given value is null
 * @template T
 * @param {T} object - The value to check
 * @returns {boolean} Whether the value is null
 */
export function isNull<T>(object: T): boolean {
	return object === null;
}

/**
 * Check if the given value is a symbol
 * @template T
 * @param {T} object - The value to check
 * @returns {boolean} Whether the value is a symbol
 */
export function isSymbol<T>(object: T): boolean {
	return typeof object === 'symbol';
}

/**
 * Check if the given value is a Promise
 * @template T
 * @param {T} object - The value to check
 * @returns {boolean} Whether the value is a Promise
 */
export function isPromise<T>(object: T): boolean {
	return object instanceof Promise;
}

/**
 * Check if an object is a `RegExp` object
 * @template T
 * @param {T} object - The value to check
 * @returns {boolean} Whether the object is a `RegExp` object
 */
export function isRegExp<T>(object: T): boolean {
	return object instanceof RegExp;
}

/**
 * Check if an object is an `Error` object
 * @param {T} object - The value to check
 * @returns {boolean} Whether the object is an `Error` object
 */
export function isError<T>(object: T): boolean {
	return object instanceof Error;
}

/**
 * Check if an object is a `Map` object
 * @param {T} object - The value to check
 * @returns {boolean} Whether the object is a `Map` object
 */
export function isMap<T>(object: T): boolean {
	return object instanceof Map;
}

/**
 * Check if an object is a `Set` object
 * @param {T} object - The value to check
 * @returns {boolean} Whether the object is a `Set` object
 */
export function isSet<T>(object: T): boolean {
	return object instanceof Set;
}

/**
 * Check if an object is a `WeakMap` object
 * @param {T} object - The value to check
 * @returns {boolean} Whether the object is a `WeakMap` object
 */
export function isWeakMap<T>(object: T): boolean {
	return object instanceof WeakMap;
}

/**
 * Check if an object is a `WeakSet` object
 * @param {T} object - The value to check
 * @returns {boolean} Whether the object is a `WeakSet` object
 */
export function isWeakSet<T>(object: T): boolean {
	return object instanceof WeakSet;
}
