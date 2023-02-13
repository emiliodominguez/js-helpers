import * as helpers from '.';

describe('Objects helpers', () => {
	describe('merge', () => {
		it('should merge two objects correctly', () => {
			const target = { a: 1, b: 2 };
			const source = { c: 3, d: 4 };
			const result = helpers.merge(target, source);
			expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 });
		});

		it('should merge multiple objects correctly', () => {
			const target = { a: 1, b: 2 };
			const source1 = { c: 3, d: 4 };
			const source2 = { e: 5, f: 6 };
			const result = helpers.merge(target, source1, source2);
			expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
		});

		it('should override properties from earlier sources with properties from later sources', () => {
			const target = { a: 1, b: 2 };
			const source1 = { a: 3, c: 4 };
			const source2 = { a: 5, d: 6 };
			const result = helpers.merge(target, source1, source2);
			expect(result).toEqual({ a: 5, b: 2, c: 4, d: 6 });
		});

		it('should return the target object if no sources are provided', () => {
			const target = { a: 1, b: 2 };
			const result = helpers.merge(target);
			expect(result).toEqual({ a: 1, b: 2 });
		});
	});

	describe('clone', () => {
		it('should return a new object with the same properties', () => {
			const original = { name: 'John', age: 30 };
			const clone = helpers.merge({} as typeof original, original);
			expect(clone).toEqual(original);
			expect(clone).not.toBe(original);
		});

		it('should return a new object with the same properties even if the original object has nested objects', () => {
			const original = { name: 'John', age: 30, address: { street: '1st Ave', city: 'New York' } };
			const clone = helpers.merge({} as typeof original, original);
			expect(clone).toEqual(original);
			expect(clone).not.toBe(original);
		});
	});

	describe('hasProperty', () => {
		it('should return true if the object has the specified property', () => {
			const object = { name: 'John', age: 30 };
			const result = helpers.hasProperty(object, 'name');
			expect(result).toEqual(true);
		});

		it('should return false if the object does not have the specified property', () => {
			const object = { name: 'John', age: 30 };
			const result = helpers.hasProperty(object, 'email' as any);
			expect(result).toEqual(false);
		});
	});

	describe('getProperty', () => {
		it('should return the value of the specified property', () => {
			const object = { name: 'John', age: 30 };
			const result = helpers.getProperty(object, 'name');
			expect(result).toEqual('John');
		});

		it('should throw an error if the object does not have the specified property', () => {
			const object = { name: 'John', age: 30 };
			expect(helpers.getProperty(object, 'email' as any)).toEqual(undefined);
		});
	});

	describe('setProperty', () => {
		it('should set the specified property on the object to the specified value', () => {
			const obj = {};
			helpers.setProperty(obj, 'property', 'value');
			expect(obj).toEqual({ property: 'value' });
		});
	});

	describe('deleteProperty', () => {
		it('should delete the specified property from the object', () => {
			const obj = { property: 'value' };
			helpers.deleteProperty(obj, 'property');
			expect(obj).toEqual({});
		});
	});

	describe('getPropertyNames', () => {
		it('should return an array of all the names of properties of the object', () => {
			const obj = { property1: 'value1', property2: 'value2' };
			const propertyNames = helpers.getPropertyNames(obj);
			expect(propertyNames).toEqual(['property1', 'property2']);
		});
	});

	describe('getObjectByKeys', () => {
		it('should get an object property from the provided key(s)', () => {
			const testObject = { firstName: 'Lorem', lastName: 'Ipsum', dimensions: { height: 200, weight: 130 } };
			const firstName = helpers.getFromObjectByKeys<typeof testObject, string>(testObject, 'firstName');
			const lastName = helpers.getFromObjectByKeys<typeof testObject, string>(testObject, 'lastName');
			const height = helpers.getFromObjectByKeys<typeof testObject, string>(testObject, 'dimensions.height');
			const weight = helpers.getFromObjectByKeys<typeof testObject, string>(testObject, 'dimensions.weight');
			expect(firstName).toEqual(testObject.firstName);
			expect(lastName).toEqual(testObject.lastName);
			expect(height).toEqual(testObject.dimensions.height);
			expect(weight).toEqual(testObject.dimensions.weight);
		});
	});

	describe('isEmpty', () => {
		it('should return true if the object is empty', () => {
			expect(helpers.isEmpty({})).toEqual(true);
		});

		it('should return false if the object is not empty', () => {
			expect(helpers.isEmpty({ a: 1, b: 2 })).toEqual(false);
		});
	});

	describe('isObject', () => {
		it('should return true if the object is an object', () => {
			expect(helpers.isObject({ a: 1, b: 2 })).toEqual(true);
		});

		it('should return false if the object is not an object', () => {
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			expect(helpers.isObject(() => {})).toEqual(false);
			expect(helpers.isObject(1)).toEqual(false);
			expect(helpers.isObject('string')).toEqual(false);
			expect(helpers.isObject(null)).toEqual(false);
			expect(helpers.isObject(undefined)).toEqual(false);
		});
	});

	describe('isArray', () => {
		it('should return true if the object is an array', () => {
			expect(helpers.isArray([1, 2, 3])).toEqual(true);
		});

		it('should return false if the object is not an array', () => {
			expect(helpers.isArray({ a: 1, b: 2 })).toEqual(false);
			expect(helpers.isArray(1)).toEqual(false);
			expect(helpers.isArray('string')).toEqual(false);
			expect(helpers.isArray(null)).toEqual(false);
			expect(helpers.isArray(undefined)).toEqual(false);
		});
	});

	describe('isFunction', () => {
		it('should return true if the object is a function', () => {
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			expect(helpers.isFunction(() => {})).toEqual(true);
		});

		it('should return false if the object is not a function', () => {
			expect(helpers.isFunction({ a: 1, b: 2 })).toEqual(false);
			expect(helpers.isFunction(1)).toEqual(false);
			expect(helpers.isFunction('string')).toEqual(false);
			expect(helpers.isFunction(null)).toEqual(false);
			expect(helpers.isFunction(undefined)).toEqual(false);
		});
	});

	describe('isString', () => {
		it('should return true if the object is a string', () => {
			expect(helpers.isString('hello')).toEqual(true);
		});

		it('should return false if the object is not a string', () => {
			expect(helpers.isString(123)).toEqual(false);
			expect(helpers.isString(true)).toEqual(false);
			expect(helpers.isString({})).toEqual(false);
			expect(helpers.isString([])).toEqual(false);
			expect(helpers.isString(undefined)).toEqual(false);
			expect(helpers.isString(null)).toEqual(false);
		});
	});

	describe('isNumber', () => {
		it('should return true if the object is a number', () => {
			expect(helpers.isNumber(123)).toEqual(true);
		});

		it('should return false if the object is not a number', () => {
			expect(helpers.isNumber('hello')).toEqual(false);
			expect(helpers.isNumber(true)).toEqual(false);
			expect(helpers.isNumber({})).toEqual(false);
			expect(helpers.isNumber([])).toEqual(false);
			expect(helpers.isNumber(undefined)).toEqual(false);
			expect(helpers.isNumber(null)).toEqual(false);
		});
	});

	describe('isBoolean', () => {
		it('should return true if the object is a boolean', () => {
			expect(helpers.isBoolean(true)).toEqual(true);
			expect(helpers.isBoolean(false)).toEqual(true);
		});

		it('should return false if the object is not a boolean', () => {
			expect(helpers.isBoolean('hello')).toEqual(false);
			expect(helpers.isBoolean(123)).toEqual(false);
			expect(helpers.isBoolean({})).toEqual(false);
			expect(helpers.isBoolean([])).toEqual(false);
			expect(helpers.isBoolean(undefined)).toEqual(false);
			expect(helpers.isBoolean(null)).toEqual(false);
		});
	});

	describe('isUndefined', () => {
		it('should return true if the object is undefined', () => {
			expect(helpers.isUndefined(undefined)).toEqual(true);
		});

		it('should return false if the object is not undefined', () => {
			expect(helpers.isUndefined('hello')).toEqual(false);
			expect(helpers.isUndefined(123)).toEqual(false);
			expect(helpers.isUndefined(true)).toEqual(false);
			expect(helpers.isUndefined({})).toEqual(false);
			expect(helpers.isUndefined([])).toEqual(false);
			expect(helpers.isUndefined(null)).toEqual(false);
		});
	});

	describe('isNull', () => {
		it('should return true if the object is null', () => {
			expect(helpers.isNull(null)).toEqual(true);
		});

		it('should return false if the object is not null', () => {
			expect(helpers.isNull(undefined)).toEqual(false);
			expect(helpers.isNull(0)).toEqual(false);
			expect(helpers.isNull('')).toEqual(false);
			expect(helpers.isNull({})).toEqual(false);
		});
	});

	describe('isSymbol', () => {
		it('should return true if the object is a symbol', () => {
			expect(helpers.isSymbol(Symbol('test'))).toEqual(true);
		});

		it('should return false if the objet is not a symbol', () => {
			expect(helpers.isSymbol(undefined)).toEqual(false);
			expect(helpers.isSymbol(0)).toEqual(false);
			expect(helpers.isSymbol('')).toEqual(false);
			expect(helpers.isSymbol({})).toEqual(false);
		});
	});

	describe('isPromise', () => {
		it('should return true if the object is a promise', () => {
			expect(helpers.isPromise(new Promise<void>(resolve => resolve()))).toEqual(true);
		});

		it('should return false if the object is not a promise', () => {
			expect(helpers.isPromise(undefined)).toEqual(false);
			expect(helpers.isPromise(0)).toEqual(false);
			expect(helpers.isPromise('')).toEqual(false);
			expect(helpers.isPromise({})).toEqual(false);
		});
	});

	describe('isRegExp', () => {
		it('should return true if the object is a regular expression', () => {
			expect(helpers.isRegExp(/regex/)).toEqual(true);
		});

		it('should return false if the object is not a regular expression', () => {
			expect(helpers.isRegExp(undefined)).toEqual(false);
			expect(helpers.isRegExp(0)).toEqual(false);
			expect(helpers.isRegExp('')).toEqual(false);
			expect(helpers.isRegExp({})).toEqual(false);
		});
	});

	describe('isError', () => {
		it('should return true if the object is an error', () => {
			expect(helpers.isError(new Error('error'))).toEqual(true);
		});

		it('should return false if the object is not an error', () => {
			expect(helpers.isError(undefined)).toEqual(false);
			expect(helpers.isError(0)).toEqual(false);
			expect(helpers.isError('')).toEqual(false);
			expect(helpers.isError({})).toEqual(false);
		});
	});

	describe('isMap', () => {
		it('should return true if the object is a Map', () => {
			expect(helpers.isMap(new Map())).toEqual(true);
		});

		it('should return false if the object is not an Map', () => {
			expect(helpers.isMap(undefined)).toEqual(false);
			expect(helpers.isMap(0)).toEqual(false);
			expect(helpers.isMap('')).toEqual(false);
			expect(helpers.isMap({})).toEqual(false);
		});
	});

	describe('isSet', () => {
		it('should return true if the object is a Set', () => {
			expect(helpers.isSet(new Set())).toEqual(true);
		});

		it('should return false if the object is not an Set', () => {
			expect(helpers.isSet(undefined)).toEqual(false);
			expect(helpers.isSet(0)).toEqual(false);
			expect(helpers.isSet('')).toEqual(false);
			expect(helpers.isSet({})).toEqual(false);
		});
	});

	describe('isWeakMap', () => {
		it('should return true if the object is a WeakMap', () => {
			expect(helpers.isWeakMap(new WeakMap())).toEqual(true);
		});

		it('should return false if the object is not an WeakMap', () => {
			expect(helpers.isWeakMap(undefined)).toEqual(false);
			expect(helpers.isWeakMap(0)).toEqual(false);
			expect(helpers.isWeakMap('')).toEqual(false);
			expect(helpers.isWeakMap({})).toEqual(false);
		});
	});

	describe('isWeakSet', () => {
		it('should return true if the object is a WeakSet', () => {
			expect(helpers.isWeakSet(new WeakSet())).toEqual(true);
		});

		it('should return false if the object is not an WeakSet', () => {
			expect(helpers.isWeakSet(undefined)).toEqual(false);
			expect(helpers.isWeakSet(0)).toEqual(false);
			expect(helpers.isWeakSet('')).toEqual(false);
			expect(helpers.isWeakSet({})).toEqual(false);
		});
	});
});
