import * as vm from 'vm';
import * as helpers from '.';
import * as guards from '../guards/index.js';

type Equals<X, Y> = (<V>() => V extends X ? 1 : 2) extends <V>() => V extends Y ? 1 : 2 ? true : false;

function assertType<T extends true>(_value: T): void {}

describe('Objects helpers', function () {
	describe('merge', function () {
		it('should merge two objects correctly', function () {
			const result = helpers.merge({ a: 1, b: 2 }, { c: 3, d: 4 });
			expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 });
		});

		it('should merge multiple objects correctly', function () {
			const result = helpers.merge({ a: 1, b: 2 }, { c: 3, d: 4 }, { e: 5, f: 6 });
			expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
		});

		it('should override properties from earlier sources with properties from later sources', function () {
			const result = helpers.merge({ a: 1, b: 2 }, { a: 3, c: 4 }, { a: 5, d: 6 });
			expect(result).toEqual({ a: 5, b: 2, c: 4, d: 6 });
		});

		it('should return a copy of the target if no sources are provided', function () {
			const target = { a: 1, b: 2 };
			const result = helpers.merge(target);
			expect(result).toEqual({ a: 1, b: 2 });
			expect(result).not.toBe(target);
		});

		it('does not mutate any input and is shallow', function () {
			const nested = { deep: true };
			const target = { a: 1 };
			const source = { b: nested };
			const result = helpers.merge(target, source);
			expect(target).toEqual({ a: 1 });
			expect(source).toEqual({ b: nested });
			expect(result.b).toBe(nested);
		});

		it('copies symbol keys, lets undefined override, and skips nullish sources', function () {
			const key = Symbol('k');
			const result = helpers.merge({ a: 1, [key]: 1 }, { a: undefined }, null as any, undefined as any, { [key]: 2 });
			expect(result).toEqual({ a: undefined, [key]: 2 });
			expect(Object.prototype.hasOwnProperty.call(result, 'a')).toBe(true);
		});

		it('treats a "__proto__" key as an own property instead of changing the prototype', function () {
			const result = helpers.merge({}, JSON.parse('{"__proto__":{"polluted":1}}'));
			expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
			expect((result as any).polluted).toBeUndefined();
			expect(({} as any).polluted).toBeUndefined();
		});

		it('is typed left-to-right with later keys overriding (disjoint objects compile)', function () {
			const result = helpers.merge({ a: 1, b: 'x' }, { b: true, c: [1] }, { d: null });
			assertType<Equals<typeof result, { a: number; b: boolean; c: number[]; d: null }>>(true);
			const optional = helpers.merge({ a: 1 }, {} as { a?: string; z?: number });
			assertType<Equals<typeof optional, { a: number | string | undefined; z?: number }>>(true);
			const spread = helpers.merge({ a: 1 }, ...([] as Array<{ b: string }>));
			assertType<Equals<typeof spread, { a: number; b?: string | undefined }>>(true);
			expect(result.b).toBe(true);
		});
	});

	describe('clone', function () {
		it('should return a new object with the same properties', function () {
			const original = { name: 'John', age: 30 };
			const copy = helpers.clone(original);
			expect(copy).toEqual(original);
			expect(copy).not.toBe(original);
		});

		it('is shallow: nested objects are shared', function () {
			const original = { name: 'John', address: { street: '1st Ave', city: 'New York' } };
			const copy = helpers.clone(original);
			expect(copy).toEqual(original);
			expect(copy.address).toBe(original.address);
		});

		it('keeps arrays as arrays (was converted to an object before), preserving holes', function () {
			const copy = helpers.clone([1, 2]);
			expect(Array.isArray(copy)).toBe(true);
			expect(copy).toEqual([1, 2]);
			// eslint-disable-next-line no-sparse-arrays
			const sparse = helpers.clone([1, , 3]);
			expect(sparse).toHaveLength(3);
			expect(1 in sparse).toBe(false);
		});

		it('preserves class instance prototypes and symbol keys', function () {
			class Point {
				x: number;
				y: number;
				constructor(x: number, y: number) {
					this.x = x;
					this.y = y;
				}
				sum(): number {
					return this.x + this.y;
				}
			}
			const tag = Symbol('tag');
			const original = Object.assign(new Point(1, 2), { [tag]: 'p' });
			const copy = helpers.clone(original);
			expect(copy).toBeInstanceOf(Point);
			expect(copy.sum()).toBe(3);
			expect(copy[tag]).toBe('p');
			expect(copy).not.toBe(original);
		});

		it('creates new Date, Map, Set and RegExp instances', function () {
			const date = new Date(5);
			const map = new Map([['a', { v: 1 }]]);
			const set = new Set([1, 2]);
			const regexp = /a/g;
			regexp.lastIndex = 3;

			const dateCopy = helpers.clone(date);
			expect(dateCopy).not.toBe(date);
			expect(dateCopy.getTime()).toBe(5);

			const mapCopy = helpers.clone(map);
			expect(mapCopy).not.toBe(map);
			expect(mapCopy.get('a')).toBe(map.get('a'));

			const setCopy = helpers.clone(set);
			expect(setCopy).not.toBe(set);
			expect([...setCopy]).toEqual([1, 2]);

			const regexpCopy = helpers.clone(regexp);
			expect(regexpCopy).not.toBe(regexp);
			expect(regexpCopy.source).toBe('a');
			expect(regexpCopy.flags).toBe('g');
			expect(regexpCopy.lastIndex).toBe(3);
		});

		it('keeps subclass prototypes of built-ins', function () {
			class MyDate extends Date {}
			const copy = helpers.clone(new MyDate(1));
			expect(copy).toBeInstanceOf(MyDate);
			expect(copy.getTime()).toBe(1);
		});

		it('copies binary data', function () {
			const bytes = new Uint8Array([1, 2, 3]);
			const copy = helpers.clone(bytes);
			expect(copy).not.toBe(bytes);
			expect(copy.buffer).not.toBe(bytes.buffer);
			expect(Array.from(copy)).toEqual([1, 2, 3]);

			const buffer = new ArrayBuffer(4);
			const bufferCopy = helpers.clone(buffer);
			expect(bufferCopy).not.toBe(buffer);
			expect(bufferCopy.byteLength).toBe(4);
		});

		it('copies boxed primitives', function () {
			const boxed = new Number(5);
			const copy = helpers.clone(boxed);
			expect(copy).not.toBe(boxed);
			expect(copy.valueOf()).toBe(5);
			const deep = helpers.deepClone({ s: Object('ab') as string });
			expect(typeof deep.s).toBe('object');
			expect(deep.s.valueOf()).toBe('ab');
		});

		it('keeps error messages', function () {
			const error = new TypeError('boom');
			const copy = helpers.clone(error);
			expect(copy).not.toBe(error);
			expect(copy).toBeInstanceOf(TypeError);
			expect(copy.message).toBe('boom');
		});

		it('returns primitives, functions, weak collections and promises as-is', function () {
			function fn(): number {
				return 1;
			}
			const weakMap = new WeakMap();
			const promise = Promise.resolve();
			expect(helpers.clone(1)).toBe(1);
			expect(helpers.clone('a')).toBe('a');
			expect(helpers.clone(null)).toBe(null);
			expect(helpers.clone(undefined)).toBe(undefined);
			expect(helpers.clone(fn)).toBe(fn);
			expect(helpers.clone(weakMap)).toBe(weakMap);
			expect(helpers.clone(promise)).toBe(promise);
		});
	});

	describe('deepClone', function () {
		it('copies nested structures without sharing references', function () {
			const original = { a: [1, { b: 2 }], c: { d: { e: 'x' } }, when: new Date(10) };
			const copy = helpers.deepClone(original);
			expect(copy).toEqual(original);
			expect(copy.a).not.toBe(original.a);
			expect(copy.a[1]).not.toBe(original.a[1]);
			expect(copy.c.d).not.toBe(original.c.d);
			expect(copy.when).not.toBe(original.when);
			expect(copy.when.getTime()).toBe(10);
		});

		it('returns primitives as-is and copies functions by reference', function () {
			function fn(): void {}
			expect(helpers.deepClone(1)).toBe(1);
			expect(helpers.deepClone(NaN)).toBeNaN();
			expect(helpers.deepClone(null)).toBe(null);
			expect(helpers.deepClone(fn)).toBe(fn);
			expect(helpers.deepClone({ fn }).fn).toBe(fn);
		});

		it('handles circular and shared references', function () {
			const shared = { s: 1 };
			const original: any = { left: shared, right: shared, list: [] as any[] };
			original.self = original;
			original.list.push(original.list, original);
			const copy = helpers.deepClone(original);
			expect(copy).not.toBe(original);
			expect(copy.self).toBe(copy);
			expect(copy.left).toBe(copy.right);
			expect(copy.left).not.toBe(shared);
			expect(copy.list[0]).toBe(copy.list);
			expect(copy.list[1]).toBe(copy);
		});

		it('clones Map keys and values and Set members', function () {
			const key = { k: 1 };
			const value = { v: 1 };
			const member = { m: 1 };
			const original = { map: new Map<object, object>([[key, value]]), set: new Set([member]) };
			const copy = helpers.deepClone(original);
			const [[copiedKey, copiedValue]] = Array.from(copy.map);
			const [copiedMember] = Array.from(copy.set);
			expect(copiedKey).toEqual(key);
			expect(copiedKey).not.toBe(key);
			expect(copiedValue).toEqual(value);
			expect(copiedValue).not.toBe(value);
			expect(copiedMember).toEqual(member);
			expect(copiedMember).not.toBe(member);
		});

		it('handles circular Maps and Sets', function () {
			const map = new Map<string, unknown>();
			map.set('self', map);
			const set = new Set<unknown>();
			set.add(set);
			const mapCopy = helpers.deepClone(map);
			const setCopy = helpers.deepClone(set);
			expect(mapCopy.get('self')).toBe(mapCopy);
			expect(setCopy.has(setCopy)).toBe(true);
		});

		it('copies RegExp with lastIndex, typed arrays, DataView and ArrayBuffer', function () {
			const regexp = /x/gi;
			regexp.lastIndex = 2;
			const floats = new Float64Array([1.5, NaN]);
			const view = new DataView(new ArrayBuffer(4), 1, 2);
			view.setUint8(0, 7);
			const original = { regexp, floats, view, buffer: new Uint16Array([1, 2]).buffer };
			const copy = helpers.deepClone(original);

			expect(copy.regexp).not.toBe(regexp);
			expect(copy.regexp.flags).toBe('gi');
			expect(copy.regexp.lastIndex).toBe(2);
			expect(copy.floats).toBeInstanceOf(Float64Array);
			expect(copy.floats.buffer).not.toBe(floats.buffer);
			expect(Array.from(copy.floats)).toEqual([1.5, NaN]);
			expect(copy.view).toBeInstanceOf(DataView);
			expect(copy.view.byteLength).toBe(2);
			expect(copy.view.getUint8(0)).toBe(7);
			expect(copy.buffer).not.toBe(original.buffer);
			expect(new Uint16Array(copy.buffer)[1]).toBe(2);
		});

		it('preserves class prototypes, symbol keys and getters (as values)', function () {
			class Box {
				items: number[] = [1];
				get size(): number {
					return this.items.length;
				}
			}
			const sym = Symbol('s');
			const original = Object.assign(new Box(), { [sym]: { deep: true } });
			const copy = helpers.deepClone(original);
			expect(copy).toBeInstanceOf(Box);
			expect(copy.size).toBe(1);
			expect(copy.items).not.toBe(original.items);
			expect(copy[sym]).toEqual({ deep: true });
			expect(copy[sym]).not.toBe(original[sym]);
		});

		it('copies errors including message and cause', function () {
			const error = new RangeError('bad', { cause: { code: 1 } });
			const copy = helpers.deepClone(error);
			expect(copy).toBeInstanceOf(RangeError);
			expect(copy.message).toBe('bad');
			expect(copy.cause).toEqual({ code: 1 });
			expect(copy.cause).not.toBe(error.cause);
		});

		it('keeps null-prototype objects and array subclasses', function () {
			class List extends Array<number> {}
			const bare = Object.assign(Object.create(null), { a: 1 });
			const list = List.from([1, 2]) as List;
			expect(Object.getPrototypeOf(helpers.deepClone(bare))).toBe(null);
			const listCopy = helpers.deepClone(list);
			expect(listCopy).toBeInstanceOf(List);
			expect(Array.from(listCopy)).toEqual([1, 2]);
		});

		it('returns weak collections and promises by reference', function () {
			const original = { weakSet: new WeakSet(), promise: Promise.resolve() };
			const copy = helpers.deepClone(original);
			expect(copy.weakSet).toBe(original.weakSet);
			expect(copy.promise).toBe(original.promise);
		});
	});

	describe('hasProperty', function () {
		it('should return true if the object has the specified own property', function () {
			expect(helpers.hasProperty({ name: 'John', age: 30 }, 'name')).toBe(true);
			expect(helpers.hasProperty({ value: undefined }, 'value')).toBe(true);
			expect(helpers.hasProperty([1], 0)).toBe(true);
		});

		it('should return false if the object does not have the specified property', function () {
			expect(helpers.hasProperty({ name: 'John', age: 30 }, 'email')).toBe(false);
		});

		it('ignores inherited properties (behaviour change: used to use `in`)', function () {
			expect(helpers.hasProperty({}, 'toString')).toBe(false);
			expect(helpers.hasProperty(Object.create({ inherited: 1 }), 'inherited')).toBe(false);
		});

		it('supports symbol keys and null-prototype objects', function () {
			const sym = Symbol('s');
			expect(helpers.hasProperty({ [sym]: 1 }, sym)).toBe(true);
			expect(helpers.hasProperty(Object.assign(Object.create(null), { a: 1 }), 'a')).toBe(true);
		});

		it('narrows the object type', function () {
			const value: object = { email: 'a@b.c' };
			if (helpers.hasProperty(value, 'email')) {
				const email: unknown = value.email;
				expect(email).toBe('a@b.c');
			}
		});
	});

	describe('getProperty', function () {
		it('should return the value of the specified property', function () {
			const result = helpers.getProperty({ name: 'John', age: 30 }, 'name');
			assertType<Equals<typeof result, string>>(true);
			expect(result).toBe('John');
		});

		it('returns undefined for missing properties', function () {
			expect(helpers.getProperty({ name: 'John' } as { name: string; email?: string }, 'email')).toBeUndefined();
		});
	});

	describe('setProperty', function () {
		it('should set (mutate) the specified property on the object', function () {
			const obj = {};
			helpers.setProperty(obj, 'property', 'value');
			expect(obj).toEqual({ property: 'value' });
		});
	});

	describe('deleteProperty', function () {
		it('should delete (mutate) the specified property from the object', function () {
			const obj: { property?: string; other: number } = { property: 'value', other: 1 };
			helpers.deleteProperty(obj, 'property');
			expect(obj).toEqual({ other: 1 });
		});
	});

	describe('getPropertyNames', function () {
		it('should return an array of all the names of properties of the object', function () {
			expect(helpers.getPropertyNames({ property1: 'value1', property2: 'value2' })).toEqual(['property1', 'property2']);
		});

		it('includes non-enumerable own string keys but not symbols', function () {
			expect(helpers.getPropertyNames([1])).toEqual(['0', 'length']);
			const obj = Object.defineProperty({ [Symbol('s')]: 1 }, 'hidden', { value: 1, enumerable: false });
			expect(helpers.getPropertyNames(obj)).toEqual(['hidden']);
		});
	});

	describe('getFromObjectByKeys', function () {
		it('should return the correct nested value (inferred path type)', function () {
			const target = { a: { b: { c: 'hello world' } } };
			const result = helpers.getFromObjectByKeys(target, 'a.b.c');
			assertType<Equals<typeof result, string>>(true);
			expect(result).toBe('hello world');
		});

		it('should return the correct value for non-nested keys', function () {
			expect(helpers.getFromObjectByKeys({ a: 'hello world' }, 'a')).toBe('hello world');
		});

		it('should return undefined for non-existing keys', function () {
			expect(helpers.getFromObjectByKeys({ a: 'hello world' }, 'b' as any)).toBeUndefined();
		});

		it('does not throw on missing or null intermediates (used to throw)', function () {
			const target: { a: { x?: { y: number } | null } } = { a: {} };
			expect(helpers.getFromObjectByKeys(target, 'a.x.y')).toBeUndefined();
			target.a.x = null;
			expect(helpers.getFromObjectByKeys(target, 'a.x.y')).toBeUndefined();
			expect(helpers.getFromObjectByKeys(target, 'a.x')).toBeNull();
		});

		it('supports array index segments', function () {
			const target = { list: [{ id: 1 }, { id: 2 }] };
			const result = helpers.getFromObjectByKeys(target, 'list.1.id');
			assertType<Equals<typeof result, number | undefined>>(true);
			expect(result).toBe(2);
			expect(helpers.getFromObjectByKeys(target, 'list.5.id')).toBeUndefined();
		});

		it('returns the default value only when the resolved value is undefined', function () {
			const target: { a: { b?: number; n: null; z: number } } = { a: { n: null, z: 0 } };
			const fallback = helpers.getFromObjectByKeys(target, 'a.b', 42);
			assertType<Equals<typeof fallback, number>>(true);
			expect(fallback).toBe(42);
			expect(helpers.getFromObjectByKeys(target, 'a.z', 42)).toBe(0);
			expect(helpers.getFromObjectByKeys(target, 'a.n', 42)).toBeNull();
			expect(helpers.getFromObjectByKeys({ a: null as { b: string } | null }, 'a.b', 'def')).toBe('def');
		});
	});

	describe('setInObjectByKeys', function () {
		it('sets nested values, creating objects and arrays as needed, and returns the target', function () {
			const target: Record<string, any> = { keep: 1 };
			const result = helpers.setInObjectByKeys(target, 'a.list.0.id', 7);
			expect(result).toBe(target);
			expect(target).toEqual({ keep: 1, a: { list: [{ id: 7 }] } });
			expect(Array.isArray(target.a.list)).toBe(true);
		});

		it('reuses existing intermediates and replaces null ones', function () {
			const target: Record<string, any> = { a: { b: 1 }, n: null, list: [{ x: 1 }] };
			helpers.setInObjectByKeys(target, 'a.c', 2);
			helpers.setInObjectByKeys(target, 'n.deep', true);
			helpers.setInObjectByKeys(target, 'list.0.y', 3);
			helpers.setInObjectByKeys(target, 'top', 'v');
			expect(target).toEqual({ a: { b: 1, c: 2 }, n: { deep: true }, list: [{ x: 1, y: 3 }], top: 'v' });
		});

		it('throws RangeError for empty segments', function () {
			expect(function () {
				helpers.setInObjectByKeys({}, '', 1);
			}).toThrow(RangeError);
			expect(function () {
				helpers.setInObjectByKeys({}, 'a..b', 1);
			}).toThrow(RangeError);
			expect(function () {
				helpers.setInObjectByKeys({}, 'a.', 1);
			}).toThrow(RangeError);
		});

		it('throws RangeError for unsafe segments without touching the target or Object.prototype', function () {
			for (const path of ['__proto__.polluted', 'a.constructor.prototype.polluted', 'prototype', 'a.__proto__']) {
				const target = {};
				expect(function () {
					helpers.setInObjectByKeys(target, path, 1);
				}).toThrow(RangeError);
				expect(target).toEqual({});
			}
			expect(({} as any).polluted).toBeUndefined();
		});

		it('throws TypeError when an intermediate is a primitive', function () {
			expect(function () {
				helpers.setInObjectByKeys({ a: 1 }, 'a.b', 2);
			}).toThrow(new TypeError('setInObjectByKeys: cannot set "a.b": "a" is a number, not an object'));
			expect(function () {
				helpers.setInObjectByKeys({}, 'a.__proto__', 2);
			}).toThrow(new RangeError('setInObjectByKeys: `path` must not contain the unsafe segment "__proto__", got "a.__proto__"'));
		});
	});

	describe('isEmpty', function () {
		it('should return true if the object is empty', function () {
			expect(helpers.isEmpty({})).toBe(true);
			expect(helpers.isEmpty(Object.create({ inherited: 1 }))).toBe(true);
			expect(helpers.isEmpty(Object.defineProperty({}, 'hidden', { value: 1 }))).toBe(true);
		});

		it('should return false if the object is not empty', function () {
			expect(helpers.isEmpty({ a: 1, b: 2 })).toBe(false);
			expect(helpers.isEmpty({ [Symbol('s')]: 1 })).toBe(false);
		});

		it('handles arrays, strings, maps, sets and nullish values', function () {
			expect(helpers.isEmpty([])).toBe(true);
			expect(helpers.isEmpty([undefined])).toBe(false);
			expect(helpers.isEmpty('')).toBe(true);
			expect(helpers.isEmpty(' ')).toBe(false);
			expect(helpers.isEmpty(new Map())).toBe(true);
			expect(helpers.isEmpty(new Map([[1, 1]]))).toBe(false);
			expect(helpers.isEmpty(new Set())).toBe(true);
			expect(helpers.isEmpty(new Set([0]))).toBe(false);
			expect(helpers.isEmpty(null)).toBe(true);
			expect(helpers.isEmpty(undefined)).toBe(true);
		});

		it('treats other primitives as empty and functions by their own keys', function () {
			expect(helpers.isEmpty(0)).toBe(true);
			expect(helpers.isEmpty(true)).toBe(true);
			expect(helpers.isEmpty(function () {})).toBe(true);
			expect(helpers.isEmpty(Object.assign(function () {}, { a: 1 }))).toBe(false);
		});
	});

	describe('pick / omit', function () {
		it('pick keeps only the requested keys', function () {
			const result = helpers.pick({ a: 1, b: 'x', c: true }, ['a', 'c']);
			assertType<Equals<typeof result, { a: number; c: boolean }>>(true);
			expect(result).toEqual({ a: 1, c: true });
		});

		it('pick skips missing keys and reads inherited getters', function () {
			class User {
				first = 'Ada';
				get upper(): string {
					return this.first.toUpperCase();
				}
			}
			expect(helpers.pick({} as { a?: number }, ['a'])).toEqual({});
			expect(helpers.pick(new User(), ['upper'])).toEqual({ upper: 'ADA' });
		});

		it('omit drops the requested keys and keeps symbol keys', function () {
			const sym = Symbol('s');
			const result = helpers.omit({ a: 1, b: 'x', [sym]: 2 }, ['b']);
			assertType<Equals<typeof result, { a: number; [sym]: number }>>(true);
			expect(result).toEqual({ a: 1, [sym]: 2 });
			expect(helpers.omit({ a: 1 }, [])).toEqual({ a: 1 });
		});

		it('do not mutate the input', function () {
			const input = { a: 1, b: 2 };
			helpers.pick(input, ['a']);
			helpers.omit(input, ['a']);
			expect(input).toEqual({ a: 1, b: 2 });
		});
	});

	describe('mapValues / mapKeys', function () {
		it('mapValues maps every own enumerable value', function () {
			const result = helpers.mapValues({ a: 1, b: 2 }, function (value, key) {
				return `${String(key)}=${value * 10}`;
			});
			assertType<Equals<typeof result, { a: string; b: string }>>(true);
			expect(result).toEqual({ a: 'a=10', b: 'b=20' });
			expect(
				helpers.mapValues({}, function () {
					return 1;
				})
			).toEqual({});
		});

		it('mapValues passes the object and handles symbol keys', function () {
			const sym = Symbol('s');
			const input = { [sym]: 1 };
			const result = helpers.mapValues(input, function (value, _key, object) {
				expect(object).toBe(input);
				return value + 1;
			});
			expect(result[sym]).toBe(2);
		});

		it('mapKeys renames keys (last collision wins)', function () {
			expect(
				helpers.mapKeys({ a: 1, b: 2 }, function (_value, key) {
					return String(key).toUpperCase();
				})
			).toEqual({ A: 1, B: 2 });
			expect(
				helpers.mapKeys({ a: 1, b: 2 }, function () {
					return 'same';
				})
			).toEqual({ same: 2 });
		});
	});

	describe('invert', function () {
		it('swaps keys and values', function () {
			const result = helpers.invert({ a: 'x', b: 'y' } as const);
			assertType<Equals<typeof result, { x: 'a'; y: 'b' }>>(true);
			expect(result).toEqual({ x: 'a', y: 'b' });
		});

		it('stringifies numeric values, supports symbols, last duplicate wins', function () {
			const sym = Symbol('s');
			expect(helpers.invert({ a: 1, b: 1, c: 2 })).toEqual({ 1: 'b', 2: 'c' });
			expect(helpers.invert({ a: sym })[sym]).toBe('a');
			expect(helpers.invert({ 1: 'one' })).toEqual({ one: '1' });
			expect(helpers.invert({})).toEqual({});
		});

		it('handles a "__proto__" value safely', function () {
			const result = helpers.invert({ a: '__proto__' });
			expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
			expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(true);
		});

		it('throws TypeError for non-key values', function () {
			expect(function () {
				helpers.invert({ a: {} } as any);
			}).toThrow(TypeError);
		});
	});

	describe('deepMerge', function () {
		it('recursively merges plain objects; later sources win', function () {
			const result = helpers.deepMerge({ a: { x: 1, y: 2 }, keep: 'k' }, { a: { y: 3 } }, { a: { z: 4 }, extra: true });
			assertType<Equals<typeof result, { a: { x: number; y: number; z: number }; keep: string; extra: boolean }>>(true);
			expect(result).toEqual({ a: { x: 1, y: 3, z: 4 }, keep: 'k', extra: true });
		});

		it('replaces arrays and non-plain values by reference', function () {
			const list = [9];
			const date = new Date(1);
			const result = helpers.deepMerge({ list: [1, 2], when: new Date(0), a: { b: 1 } }, { list, when: date, a: 'scalar' });
			expect(result.list).toBe(list);
			expect(result.when).toBe(date);
			expect(result.a).toBe('scalar');
		});

		it('replaces a scalar with an object and lets undefined override', function () {
			const result = helpers.deepMerge({ a: 1 as unknown, b: 2 }, { a: { c: 1 }, b: undefined });
			expect(result).toEqual({ a: { c: 1 }, b: undefined });
		});

		it('does not mutate inputs and never shares merged plain objects with them', function () {
			const target = { a: { x: 1 } };
			const source = { a: { y: 2 }, b: { z: 3 } };
			const result = helpers.deepMerge(target, source);
			expect(target).toEqual({ a: { x: 1 } });
			expect(source).toEqual({ a: { y: 2 }, b: { z: 3 } });
			expect(result.a).not.toBe(target.a);
			expect(result.b).not.toBe(source.b);
			result.b.z = 99;
			expect(source.b.z).toBe(3);
		});

		it('ignores __proto__, constructor and prototype keys (no prototype pollution)', function () {
			const malicious = JSON.parse(
				'{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":2}},"prototype":{"polluted":3},"safe":{"__proto__":{"polluted":4}}}'
			);
			const result: any = helpers.deepMerge({}, malicious);
			expect(({} as any).polluted).toBeUndefined();
			expect((Object.prototype as any).polluted).toBeUndefined();
			expect(result.polluted).toBeUndefined();
			expect(Object.keys(result)).toEqual(['safe']);
			expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
			expect(Object.getPrototypeOf(result.safe)).toBe(Object.prototype);
			expect(result.safe.polluted).toBeUndefined();
		});

		it('merges symbol keys and null-prototype objects, skips nullish sources', function () {
			const sym = Symbol('s');
			const bare = Object.assign(Object.create(null), { a: { b: 1 } });
			const result: any = helpers.deepMerge(bare, { [sym]: 1 }, null as any, undefined as any, { a: { c: 2 } });
			expect(Object.getPrototypeOf(result)).toBe(null);
			expect(result[sym]).toBe(1);
			expect({ ...result.a }).toEqual({ b: 1, c: 2 });
		});

		it('supports shared (non-circular) references', function () {
			const shared = { v: 1 };
			expect(helpers.deepMerge({}, { a: shared, b: shared })).toEqual({ a: { v: 1 }, b: { v: 1 } });
		});

		it('throws TypeError on circular references and non-plain inputs', function () {
			const circular: any = { a: {} };
			circular.a.self = circular;
			expect(function () {
				helpers.deepMerge({}, circular);
			}).toThrow(TypeError);
			expect(function () {
				helpers.deepMerge([] as object, {});
			}).toThrow(TypeError);
			expect(function () {
				helpers.deepMerge({}, new Date());
			}).toThrow(TypeError);
		});

		it('types optional overrides as unions', function () {
			const result = helpers.deepMerge({ a: { x: 1 } }, {} as { a?: { y: string } });
			assertType<Equals<typeof result, { a: { x: number } | { x: number; y: string } }>>(true);
			const spread = helpers.deepMerge({ a: 1 }, ...([] as Array<{ a: number }>));
			assertType<Equals<typeof spread, { a: number }>>(true);
			expect(result).toEqual({ a: { x: 1 } });
		});
	});

	describe('isEqual', function () {
		it('compares primitives with SameValueZero', function () {
			expect(helpers.isEqual(1, 1)).toBe(true);
			expect(helpers.isEqual('a', 'a')).toBe(true);
			expect(helpers.isEqual(NaN, NaN)).toBe(true);
			expect(helpers.isEqual(0, -0)).toBe(true);
			expect(helpers.isEqual(1, '1')).toBe(false);
			expect(helpers.isEqual(null, undefined)).toBe(false);
			expect(helpers.isEqual(1n, 1n)).toBe(true);
		});

		it('compares functions by reference', function () {
			function a(): void {}
			function b(): void {}
			expect(helpers.isEqual(a, a)).toBe(true);
			expect(helpers.isEqual(a, b)).toBe(false);
			expect(helpers.isEqual({ fn: a }, { fn: a })).toBe(true);
		});

		it('compares arrays and objects deeply', function () {
			expect(helpers.isEqual({ a: [1, { b: [2] }] }, { a: [1, { b: [2] }] })).toBe(true);
			expect(helpers.isEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
			expect(helpers.isEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
			expect(helpers.isEqual({ a: 1, c: undefined }, { a: 1, b: undefined })).toBe(false);
			expect(helpers.isEqual([1, 2], [1, 2, 3])).toBe(false);
			expect(helpers.isEqual([1, 2], [2, 1])).toBe(false);
			expect(helpers.isEqual([1], { 0: 1 })).toBe(false);
			expect(helpers.isEqual({}, null)).toBe(false);
			// eslint-disable-next-line no-sparse-arrays
			expect(helpers.isEqual([, 1], [undefined, 1])).toBe(false);
		});

		it('compares symbol keys', function () {
			const sym = Symbol('s');
			expect(helpers.isEqual({ [sym]: 1 }, { [sym]: 1 })).toBe(true);
			expect(helpers.isEqual({ [sym]: 1 }, { [sym]: 2 })).toBe(false);
			expect(helpers.isEqual({ [sym]: 1 }, { [Symbol('s')]: 1 })).toBe(false);
		});

		it('requires identical prototypes', function () {
			class A {
				v = 1;
			}
			class B {
				v = 1;
			}
			expect(helpers.isEqual(new A(), new A())).toBe(true);
			expect(helpers.isEqual(new A(), new B())).toBe(false);
			expect(helpers.isEqual({ v: 1 }, new A())).toBe(false);
			expect(helpers.isEqual({}, Object.create(null))).toBe(false);
		});

		it('compares dates, regexps and boxed primitives by value', function () {
			expect(helpers.isEqual(new Date(1), new Date(1))).toBe(true);
			expect(helpers.isEqual(new Date(1), new Date(2))).toBe(false);
			expect(helpers.isEqual(new Date('x'), new Date('y'))).toBe(true);
			expect(helpers.isEqual(/a/g, /a/g)).toBe(true);
			expect(helpers.isEqual(/a/g, /a/i)).toBe(false);
			expect(helpers.isEqual(/a/, /b/)).toBe(false);
			expect(helpers.isEqual(new Number(1), new Number(1))).toBe(true);
			expect(helpers.isEqual(new Number(1), new Number(2))).toBe(false);
			expect(helpers.isEqual(new String('ab'), new String('ab'))).toBe(true);
			expect(helpers.isEqual(new Boolean(true), new Boolean(false))).toBe(false);
			expect(helpers.isEqual(Object(1n), Object(1n))).toBe(true);
			const sym = Symbol('s');
			expect(helpers.isEqual(Object(sym), Object(sym))).toBe(true);
			expect(helpers.isEqual(Object(sym), Object(Symbol('s')))).toBe(false);
			const fakeNumber = Object.create(Number.prototype, { [Symbol.toStringTag]: { value: 'Number' } });
			expect(helpers.isEqual(new Number(1), fakeNumber)).toBe(false);
			expect(helpers.isEqual(fakeNumber, Object.create(Number.prototype, { [Symbol.toStringTag]: { value: 'Number' } }))).toBe(true);
		});

		it('rejects same-prototype objects with different tags', function () {
			const fake = Object.create(Date.prototype);
			expect(helpers.isEqual(new Date(0), fake)).toBe(false);
		});

		it('compares Maps and Sets regardless of order with deep keys and members', function () {
			expect(
				helpers.isEqual(
					new Map([
						['a', 1],
						['b', 2]
					]),
					new Map([
						['b', 2],
						['a', 1]
					])
				)
			).toBe(true);
			expect(
				helpers.isEqual(
					new Map([
						['a', 1],
						['b', 2]
					]),
					new Map([
						['a', 1],
						['b', 2]
					])
				)
			).toBe(true);
			expect(helpers.isEqual(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false);
			expect(helpers.isEqual(new Map([['a', 1]]), new Map([['b', 1]]))).toBe(false);
			expect(helpers.isEqual(new Map([['a', 1]]), new Map())).toBe(false);
			expect(helpers.isEqual(new Map([[{ k: 1 }, { v: 1 }]]), new Map([[{ k: 1 }, { v: 1 }]]))).toBe(true);
			expect(helpers.isEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
			expect(helpers.isEqual(new Set([{ a: 1 }, { a: 2 }]), new Set([{ a: 2 }, { a: 1 }]))).toBe(true);
			expect(helpers.isEqual(new Set([{ a: 1 }, { a: 1 }]), new Set([{ a: 1 }, { a: 2 }]))).toBe(false);
			expect(helpers.isEqual(new Set([1]), new Set([1, 2]))).toBe(false);
			expect(helpers.isEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);
			expect(helpers.isEqual(new Set([1, { a: 1 }]), new Set([{ a: 1 }, 1]))).toBe(true);
			expect(helpers.isEqual(new Map([[{ k: 1 }, 1]]), new Map([[{ k: 2 }, 1]]))).toBe(false);
			expect(
				helpers.isEqual(
					new Map<unknown, number>([
						[{ k: 1 }, 1],
						['p', 2]
					]),
					new Map<unknown, number>([
						['p', 2],
						[{ k: 1 }, 1]
					])
				)
			).toBe(true);
		});

		it('compares typed arrays, DataViews and ArrayBuffers by content', function () {
			expect(helpers.isEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
			expect(helpers.isEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
			expect(helpers.isEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
			expect(helpers.isEqual(new Float32Array([NaN]), new Float32Array([NaN]))).toBe(true);
			expect(helpers.isEqual(new Uint8Array([1]), new Int8Array([1]))).toBe(false);
			expect(helpers.isEqual(new DataView(new Uint8Array([1, 2, 3]).buffer, 1), new DataView(new Uint8Array([2, 3]).buffer))).toBe(true);
			expect(helpers.isEqual(new Uint8Array([1]).buffer, new Uint8Array([1]).buffer)).toBe(true);
			expect(helpers.isEqual(new Uint8Array([1]).buffer, new Uint8Array([2]).buffer)).toBe(false);
		});

		it('compares errors by name, message and own enumerable props', function () {
			expect(helpers.isEqual(new Error('a'), new Error('a'))).toBe(true);
			expect(helpers.isEqual(new Error('a'), new Error('b'))).toBe(false);
			expect(helpers.isEqual(Object.assign(new Error('a'), { code: 1 }), Object.assign(new Error('a'), { code: 2 }))).toBe(false);
		});

		it('treats weak collections and promises as equal only to themselves', function () {
			const weak = new WeakMap();
			expect(helpers.isEqual(weak, weak)).toBe(true);
			expect(helpers.isEqual(new WeakMap(), new WeakMap())).toBe(false);
			expect(helpers.isEqual(Promise.resolve(1), Promise.resolve(1))).toBe(false);
		});

		it('handles circular structures', function () {
			const a: any = { name: 'x' };
			a.self = a;
			const b: any = { name: 'x' };
			b.self = b;
			const c: any = { name: 'y' };
			c.self = c;
			expect(helpers.isEqual(a, b)).toBe(true);
			expect(helpers.isEqual(a, c)).toBe(false);

			const listA: any[] = [1];
			listA.push(listA);
			const listB: any[] = [1];
			listB.push(listB);
			expect(helpers.isEqual(listA, listB)).toBe(true);
		});

		it('agrees with deepClone output', function () {
			const original = { a: [1, new Date(3), new Map([[1, new Set(['x'])]])], b: { c: /re/m } };
			expect(helpers.isEqual(original, helpers.deepClone(original))).toBe(true);
		});

		it('supports cross-realm arrays only when prototypes match', function () {
			const foreignArray = vm.runInNewContext('[1, 2]');
			expect(helpers.isEqual(foreignArray, [1, 2])).toBe(false);
			expect(helpers.isEqual(foreignArray, vm.runInNewContext('[1, 2]'))).toBe(false);
		});
	});

	describe('deepFreeze', function () {
		it('freezes nested objects and arrays and returns the same reference', function () {
			const input = { a: { b: [1, { c: 2 }] } };
			const result = helpers.deepFreeze(input);
			expect(result).toBe(input);
			expect(Object.isFrozen(input)).toBe(true);
			expect(Object.isFrozen(input.a)).toBe(true);
			expect(Object.isFrozen(input.a.b)).toBe(true);
			expect(Object.isFrozen(input.a.b[1])).toBe(true);
			expect(function () {
				(result as any).a.b.push(3);
			}).toThrow(TypeError);
		});

		it('handles circular references, symbol keys, maps and sets', function () {
			const sym = Symbol('s');
			const inner = { v: 1 };
			const input: any = { [sym]: { deep: {} }, map: new Map([[{ k: 1 }, inner]]), set: new Set([{ m: 1 }]) };
			input.self = input;
			helpers.deepFreeze(input);
			expect(Object.isFrozen(input[sym].deep)).toBe(true);
			expect(Object.isFrozen(inner)).toBe(true);
			expect(Object.isFrozen(Array.from(input.map.keys())[0])).toBe(true);
			expect(Object.isFrozen(Array.from(input.set)[0])).toBe(true);
			expect(Object.isFrozen(input.map)).toBe(true);
		});

		it('skips typed arrays, functions and getters', function () {
			function fn(): void {}
			let reads = 0;
			const input = {
				bytes: new Uint8Array([1]),
				fn,
				get lazy(): object {
					reads++;
					return {};
				}
			};
			helpers.deepFreeze(input);
			expect(Object.isFrozen(input)).toBe(true);
			expect(Object.isFrozen(input.bytes)).toBe(false);
			expect(Object.isFrozen(fn)).toBe(false);
			expect(reads).toBe(0);
		});

		it('returns primitives untouched', function () {
			expect(helpers.deepFreeze(1)).toBe(1);
			expect(helpers.deepFreeze(null)).toBe(null);
		});

		it('is typed as DeepReadonly', function () {
			const frozen = helpers.deepFreeze({ a: { b: [1] } });
			assertType<Equals<typeof frozen, { readonly a: { readonly b: ReadonlyArray<number> } }>>(true);
			expect(frozen.a.b[0]).toBe(1);
		});
	});

	describe('backward-compatible guard re-exports', function () {
		it('are the same functions as in the guards module', function () {
			const names = [
				'isObject',
				'isArray',
				'isFunction',
				'isString',
				'isNumber',
				'isBoolean',
				'isUndefined',
				'isNull',
				'isSymbol',
				'isPromise',
				'isRegExp',
				'isError',
				'isMap',
				'isSet',
				'isWeakMap',
				'isWeakSet'
			] as const;
			const objectsExports: Record<string, unknown> = { ...helpers };
			const guardsExports: Record<string, unknown> = { ...guards };
			for (const name of names) {
				expect(objectsExports[name]).toBe(guardsExports[name]);
			}
		});

		it('keep their original behaviour', function () {
			expect(helpers.isObject({ a: 1 })).toBe(true);
			expect(helpers.isObject(function () {})).toBe(false);
			expect(helpers.isArray([1])).toBe(true);
			expect(helpers.isString('a')).toBe(true);
			expect(helpers.isNumber(1)).toBe(true);
			expect(helpers.isBoolean(false)).toBe(true);
			expect(helpers.isUndefined(undefined)).toBe(true);
			expect(helpers.isNull(null)).toBe(true);
			expect(helpers.isSymbol(Symbol('x'))).toBe(true);
			expect(helpers.isFunction(function () {})).toBe(true);
			expect(helpers.isPromise(Promise.resolve())).toBe(true);
			expect(helpers.isRegExp(/a/)).toBe(true);
			expect(helpers.isError(new Error('e'))).toBe(true);
			expect(helpers.isMap(new Map())).toBe(true);
			expect(helpers.isSet(new Set())).toBe(true);
			expect(helpers.isWeakMap(new WeakMap())).toBe(true);
			expect(helpers.isWeakSet(new WeakSet())).toBe(true);
		});
	});

	describe('round 2 regressions', function () {
		it('omit drops numeric keys (they are strings at runtime)', function () {
			const result = helpers.omit({ 1: 'a', 2: 'b', x: true }, [1, 'x']);
			assertType<Equals<typeof result, { 2: string }>>(true);
			expect(result).toEqual({ 2: 'b' });
			expect(Object.keys(result)).toEqual(['2']);
		});

		it('mapValues returns an array for an array input, as its return type says', function () {
			const input = [1, 2, 3];
			const result = helpers.mapValues(input, function (value) {
				return String(value);
			});
			assertType<Equals<typeof result, string[]>>(true);
			expect(Array.isArray(result)).toBe(true);
			expect(result).toEqual(['1', '2', '3']);
			// eslint-disable-next-line no-sparse-arrays
			const sparse = helpers.mapValues([1, , 3], function (value) {
				return value;
			});
			expect(sparse).toHaveLength(3);
			expect(1 in sparse).toBe(false);
		});

		it('setInObjectByKeys never writes through inherited properties (built-ins stay untouched)', function () {
			const target: Record<string, any> = {};
			helpers.setInObjectByKeys(target, 'toString.polluted', 1);
			expect((Object.prototype.toString as any).polluted).toBeUndefined();
			expect(target.toString).toEqual({ polluted: 1 });
			expect(Object.prototype.hasOwnProperty.call(target, 'toString')).toBe(true);

			const list: any[] = [];
			helpers.setInObjectByKeys(list, 'map.polluted', 1);
			expect((Array.prototype.map as any).polluted).toBeUndefined();

			const shared = { defaults: { a: 1 } };
			const instance = Object.create(shared) as Record<string, any>;
			helpers.setInObjectByKeys(instance, 'defaults.a', 2);
			expect(shared.defaults.a).toBe(1);
			expect(instance.defaults).toEqual({ a: 2 });
		});

		it('setInObjectByKeys only creates arrays for canonical array indices', function () {
			const target: Record<string, any> = {};
			helpers.setInObjectByKeys(target, 'a.01', 1);
			helpers.setInObjectByKeys(target, 'b.4294967295', 2);
			helpers.setInObjectByKeys(target, 'c.4294967294', 3);
			helpers.setInObjectByKeys(target, 'd.0', 4);
			expect(Array.isArray(target.a)).toBe(false);
			expect(target.a).toEqual({ '01': 1 });
			expect(Array.isArray(target.b)).toBe(false);
			expect(Array.isArray(target.c)).toBe(true);
			expect(target.d).toEqual([4]);
			expect(JSON.parse(JSON.stringify(target.a))).toEqual({ '01': 1 });
		});
	});

	describe('typedKeys / typedEntries / typedFromEntries', function () {
		it('return own enumerable string keys with precise types', function () {
			const sym = Symbol('s');
			const input = { a: 1, b: 'x', 3: true, [sym]: 0 };
			const keys = helpers.typedKeys(input);
			assertType<Equals<typeof keys, Array<'a' | 'b' | '3'>>>(true);
			expect(keys).toEqual(['3', 'a', 'b']);
			const entries = helpers.typedEntries(input);
			assertType<Equals<typeof entries, Array<['a', number] | ['b', string] | ['3', boolean]>>>(true);
			expect(entries).toEqual([
				['3', true],
				['a', 1],
				['b', 'x']
			]);
			expect(helpers.typedKeys(Object.create({ inherited: 1 }))).toEqual([]);
		});

		it('typedEntries keeps undefined in optional value types', function () {
			const input: { a?: number } = { a: undefined };
			const entries = helpers.typedEntries(input);
			assertType<Equals<typeof entries, Array<['a', number | undefined]>>>(true);
			expect(entries).toEqual([['a', undefined]]);
		});

		it('typedFromEntries builds a typed object, last duplicate wins, __proto__ is a plain key', function () {
			const entries: Array<['a', number] | ['b', string]> = [
				['a', 1],
				['b', 'x'],
				['a', 2]
			];
			const result = helpers.typedFromEntries(entries);
			assertType<Equals<typeof result, { a: number; b: string }>>(true);
			expect(result).toEqual({ a: 2, b: 'x' });

			const unsafe = helpers.typedFromEntries([['__proto__', { polluted: true }] as [string, unknown]]);
			expect(Object.getPrototypeOf(unsafe)).toBe(Object.prototype);
			expect(Object.prototype.hasOwnProperty.call(unsafe, '__proto__')).toBe(true);
			expect(({} as any).polluted).toBeUndefined();

			const sym = Symbol('s');
			expect(
				helpers.typedFromEntries(
					new Map<symbol | number, number>([
						[sym, 1],
						[2, 3]
					])
				)
			).toEqual({ [sym]: 1, 2: 3 });
		});

		it('round-trips through typedEntries', function () {
			const input = { a: 1, b: [2] };
			expect(helpers.typedFromEntries(helpers.typedEntries(input))).toEqual(input);
		});
	});

	describe('pickBy / omitBy', function () {
		it('pickBy keeps properties matching the predicate', function () {
			const sym = Symbol('s');
			const input = { a: 1, b: null, c: 3, [sym]: 4 };
			const result = helpers.pickBy(input, function (value) {
				return typeof value === 'number' && value > 1;
			});
			assertType<Equals<typeof result, Partial<typeof input>>>(true);
			expect(result).toEqual({ c: 3, [sym]: 4 });
		});

		it('omitBy drops properties matching the predicate and passes key and object', function () {
			const input = { a: 1, _b: 2 };
			const seen: unknown[] = [];
			const result = helpers.omitBy(input, function (_value, key, object) {
				seen.push(object);
				return String(key).startsWith('_');
			});
			expect(result).toEqual({ a: 1 });
			expect(seen).toEqual([input, input]);
			expect(input).toEqual({ a: 1, _b: 2 });
		});

		it('store __proto__ keys as plain own properties', function () {
			const input = JSON.parse('{"__proto__": {"polluted": true}, "a": 1}') as Record<string, unknown>;
			const result = helpers.pickBy(input, function () {
				return true;
			});
			expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
			expect(({} as any).polluted).toBeUndefined();
		});
	});

	describe('compactObject', function () {
		it('removes only undefined values', function () {
			const sym = Symbol('s');
			const input: { a: number; b: string | undefined; c: null; d?: boolean; e: number; [sym]: undefined } = {
				a: 0,
				b: undefined,
				c: null,
				d: false,
				e: NaN,
				[sym]: undefined
			};
			const result = helpers.compactObject(input);
			assertType<Equals<typeof result, { a: number; c: null; e: number; b?: string; d?: boolean; [sym]?: never }>>(true);
			expect(result).toEqual({ a: 0, c: null, d: false, e: NaN });
			expect(Object.keys(result)).toEqual(['a', 'c', 'd', 'e']);
			expect(Object.getOwnPropertySymbols(result)).toEqual([]);
			expect(input.b).toBeUndefined();
			expect('b' in input).toBe(true);
		});

		it('is shallow', function () {
			const nested = { x: undefined };
			const result = helpers.compactObject({ nested });
			expect(result.nested).toBe(nested);
		});
	});

	describe('flattenObject / unflattenObject', function () {
		it('flattens nested objects and arrays into leaf paths', function () {
			const when = new Date(0);
			expect(helpers.flattenObject({ a: { b: 1, c: [2, { d: 3 }] }, e: {}, f: [], when, n: null })).toEqual({
				'a.b': 1,
				'a.c.0': 2,
				'a.c.1.d': 3,
				e: {},
				f: [],
				when,
				n: null
			});
			expect(helpers.flattenObject({})).toEqual({});
			expect(helpers.flattenObject([1, [2]])).toEqual({ 0: 1, '1.0': 2 });
		});

		it('supports custom separators and keeps leaves by reference', function () {
			const map = new Map();
			const result = helpers.flattenObject({ a: { b: map } }, { separator: '/' });
			expect(result).toEqual({ 'a/b': map });
			expect(result['a/b']).toBe(map);
			expect(helpers.flattenObject({ a: { b: 1 } }, { separator: '::' })).toEqual({ 'a::b': 1 });
		});

		it('recurses into null-prototype objects, skips symbols and holes, and stores __proto__ safely', function () {
			const bare = Object.create(null) as Record<string, unknown>;
			bare.x = 1;
			// eslint-disable-next-line no-sparse-arrays
			const result = helpers.flattenObject({ bare, [Symbol('s')]: 1, list: [1, , 3] });
			expect(result).toEqual({ 'bare.x': 1, 'list.0': 1, 'list.2': 3 });
			const unsafe = helpers.flattenObject(JSON.parse('{"__proto__": {"polluted": true}}'));
			expect(Object.keys(unsafe)).toEqual(['__proto__.polluted']);
			expect(({} as any).polluted).toBeUndefined();
		});

		it('rejects invalid input, separators and circular structures', function () {
			const circular: Record<string, unknown> = { a: 1 };
			circular.self = { back: circular };
			expect(function () {
				helpers.flattenObject(circular);
			}).toThrow(TypeError);
			expect(function () {
				helpers.flattenObject(new Date());
			}).toThrow(TypeError);
			expect(function () {
				helpers.flattenObject({}, { separator: '' });
			}).toThrow(RangeError);
			expect(function () {
				helpers.flattenObject({}, { separator: 1 as any });
			}).toThrow(TypeError);
		});

		it('flattens shared (non-circular) references', function () {
			const shared = { v: 1 };
			expect(helpers.flattenObject({ a: shared, b: shared })).toEqual({ 'a.v': 1, 'b.v': 1 });
		});

		it('unflattens paths, creating arrays for numeric segments', function () {
			expect(helpers.unflattenObject({ 'a.b': 1, 'a.c.0': 2, 'a.c.1.d': 3, e: {} })).toEqual({ a: { b: 1, c: [2, { d: 3 }] }, e: {} });
			expect(helpers.unflattenObject({ 'a/b': 1 }, { separator: '/' })).toEqual({ a: { b: 1 } });
			expect(helpers.unflattenObject({})).toEqual({});
			const nested = helpers.unflattenObject({ 'x.01': 1, 'y.1': 2 }) as Record<string, any>;
			expect(Array.isArray(nested.x)).toBe(false);
			expect(Array.isArray(nested.y)).toBe(true);
			expect(nested.y).toHaveLength(2);
		});

		it('round-trips', function () {
			const input = { a: { b: 1, c: [2, { d: [3, []] }] }, e: {}, f: 'x' };
			expect(helpers.unflattenObject(helpers.flattenObject(input))).toEqual(input);
		});

		it('rejects unsafe segments, empty segments and bad separators', function () {
			for (const key of ['__proto__.polluted', 'a.constructor', 'prototype']) {
				expect(function () {
					helpers.unflattenObject({ [key]: 1 });
				}).toThrow(RangeError);
			}
			expect(function () {
				helpers.unflattenObject(JSON.parse('{"__proto__": {"polluted": true}}'));
			}).toThrow(RangeError);
			expect(({} as any).polluted).toBeUndefined();
			expect(function () {
				helpers.unflattenObject({ 'a..b': 1 });
			}).toThrow(new RangeError('unflattenObject: `record` keys must not contain empty segments, got "a..b"'));
			expect(function () {
				helpers.unflattenObject({ '': 1 });
			}).toThrow(RangeError);
			expect(function () {
				helpers.unflattenObject({}, { separator: '' });
			}).toThrow(RangeError);
		});

		it('rejects conflicting keys in any order and never mutates the input', function () {
			const leaf = {};
			const record = { a: leaf, 'a.b': 1 };
			expect(function () {
				helpers.unflattenObject(record);
			}).toThrow(/already set/);
			expect(leaf).toEqual({});
			expect(function () {
				helpers.unflattenObject({ 'a.b': 1, a: 2 });
			}).toThrow(/already holds/);
			expect(function () {
				helpers.unflattenObject({ a: null, 'a.b': 1 });
			}).toThrow(TypeError);
		});
	});

	describe('hasInObjectByKeys / deleteFromObjectByKeys', function () {
		it('hasInObjectByKeys follows own properties only', function () {
			const target = { a: { b: [undefined], s: 'text', n: null }, fn: Object.assign(function () {}, { x: 1 }) };
			expect(helpers.hasInObjectByKeys(target, 'a')).toBe(true);
			expect(helpers.hasInObjectByKeys(target, 'a.b.0')).toBe(true);
			expect(helpers.hasInObjectByKeys(target, 'a.n')).toBe(true);
			expect(helpers.hasInObjectByKeys(target, 'fn.x')).toBe(true);
			expect(helpers.hasInObjectByKeys({ fn: Object.assign(function () {}, { inner: { z: 1 } }) }, 'fn.inner.z')).toBe(true);
			expect(helpers.hasInObjectByKeys(target, 'a.b.1')).toBe(false);
			expect(helpers.hasInObjectByKeys(target, 'a.toString')).toBe(false);
			expect(helpers.hasInObjectByKeys(target, 'a.s.length')).toBe(false);
			expect(helpers.hasInObjectByKeys(target, 'a.n.x')).toBe(false);
			expect(helpers.hasInObjectByKeys(target, 'missing.x.y')).toBe(false);
			expect(helpers.hasInObjectByKeys(Object.create({ a: { b: 1 } }), 'a.b')).toBe(false);
		});

		it('deleteFromObjectByKeys deletes own properties and reports success', function () {
			const target: Record<string, any> = { a: { b: 1, c: 2 }, list: [1, 2, 3] };
			expect(helpers.deleteFromObjectByKeys(target, 'a.b')).toBe(true);
			expect(target).toEqual({ a: { c: 2 }, list: [1, 2, 3] });
			expect(helpers.deleteFromObjectByKeys(target, 'a.b')).toBe(false);
			expect(helpers.deleteFromObjectByKeys(target, 'list.1')).toBe(true);
			expect(target.list).toHaveLength(3);
			expect(1 in target.list).toBe(false);
			expect(helpers.deleteFromObjectByKeys(target, 'a.toString')).toBe(false);
			expect(helpers.deleteFromObjectByKeys(target, 'nope.x')).toBe(false);
			expect(helpers.deleteFromObjectByKeys(target, 'a')).toBe(true);
			expect(target).toEqual({ list: [1, , 3] }); // eslint-disable-line no-sparse-arrays
		});

		it('deleteFromObjectByKeys never deletes inherited properties and returns false for non-configurable ones', function () {
			const proto = { shared: 1 };
			const child = Object.create(proto) as Record<string, unknown>;
			expect(helpers.deleteFromObjectByKeys(child, 'shared')).toBe(false);
			expect(proto.shared).toBe(1);
			const locked = Object.defineProperty({}, 'fixed', { value: 1, configurable: false });
			expect(helpers.deleteFromObjectByKeys(locked, 'fixed')).toBe(false);
			expect(helpers.deleteFromObjectByKeys([1, 2], 'length')).toBe(false);
		});
	});

	describe('diff', function () {
		it('lists added paths in the order of b and removed paths in the order of a', function () {
			const a = { a: [], z: 1 };
			const b = { c: 0, a: [0] };
			expect(helpers.diff(a, b)).toEqual({ added: ['c', 'a.0'], removed: ['z'], changed: [] });
			expect(helpers.diff(b, a)).toEqual({ added: ['z'], removed: ['c', 'a.0'], changed: [] });
		});

		it('reports added, removed and changed dot paths', function () {
			expect(helpers.diff({ a: 1, b: { c: 2, d: [1] } }, { b: { c: 3, d: [1, 2] }, e: 0 })).toEqual({
				added: ['b.d.1', 'e'],
				removed: ['a'],
				changed: ['b.c']
			});
		});

		it('compares leaves with isEqual and reports kind changes as changed', function () {
			const result = helpers.diff(
				{ date: new Date(0), same: new Date(1), nan: NaN, kind: [1], set: new Set([1]), nil: null },
				{ date: new Date(5), same: new Date(1), nan: NaN, kind: { 0: 1 }, set: new Set([1]), nil: undefined }
			);
			expect(result).toEqual({ added: [], removed: [], changed: ['date', 'kind', 'nil'] });
		});

		it('handles arrays at the root, holes and identical inputs', function () {
			expect(helpers.diff([1, 2, 3], [1, 5])).toEqual({ added: [], removed: ['2'], changed: ['1'] });
			// eslint-disable-next-line no-sparse-arrays
			expect(helpers.diff([1, , 3], [1, 2, 3])).toEqual({ added: ['1'], removed: [], changed: [] });
			const tree = { a: { b: [1, { c: 2 }] } };
			expect(helpers.diff(tree, tree)).toEqual({ added: [], removed: [], changed: [] });
			expect(helpers.diff(tree, helpers.deepClone(tree))).toEqual({ added: [], removed: [], changed: [] });
			expect(helpers.diff({ a: {} }, { a: { x: { y: 1 } } })).toEqual({ added: ['a.x'], removed: [], changed: [] });
		});

		it('only considers own enumerable string keys', function () {
			const hidden = Object.defineProperty({ a: 1 }, 'h', { value: 1, enumerable: false });
			expect(helpers.diff(hidden, { a: 1, h: 1 })).toEqual({ added: ['h'], removed: [], changed: [] });
			expect(helpers.diff({ a: 1, h: 1 }, hidden)).toEqual({ added: [], removed: ['h'], changed: [] });
			expect(helpers.diff({ [Symbol('s')]: 1 }, {})).toEqual({ added: [], removed: [], changed: [] });
		});

		it('works when one tree contains the other', function () {
			const inner = { p: {} };
			// `b` is the subtree `a.p`: it must not be mistaken for a cycle; it is compared like any other pair.
			expect(helpers.diff({ p: inner }, inner)).toEqual({ added: [], removed: ['p.p'], changed: [] });
			expect(helpers.diff({ p: inner }, { p: { q: 1 } })).toEqual({ added: ['p.q'], removed: ['p.p'], changed: [] });
		});

		it('rejects mismatched roots and circular structures', function () {
			expect(function () {
				helpers.diff({}, []);
			}).toThrow(TypeError);
			expect(function () {
				helpers.diff(new Date(), new Date());
			}).toThrow(TypeError);
			const a: Record<string, unknown> = {};
			a.self = a;
			const b: Record<string, unknown> = {};
			b.self = b;
			expect(function () {
				helpers.diff(a, b);
			}).toThrow(TypeError);
			expect(function () {
				helpers.diff({ x: 1 }, b);
			}).not.toThrow();
		});
	});

	describe('argument validation', function () {
		it('rejects non-function callbacks with a TypeError, even for empty objects', function () {
			expect(function () {
				helpers.mapValues({}, undefined as any);
			}).toThrow(new TypeError('mapValues: `fn` must be a function, got undefined'));
			expect(function () {
				helpers.mapKeys({}, null as any);
			}).toThrow(new TypeError('mapKeys: `fn` must be a function, got null'));
			expect(function () {
				helpers.pickBy({}, 'x' as any);
			}).toThrow(new TypeError('pickBy: `predicate` must be a function, got string'));
			expect(function () {
				helpers.omitBy({}, 1 as any);
			}).toThrow(new TypeError('omitBy: `predicate` must be a function, got number'));
		});

		it('names the offending argument', function () {
			expect(function () {
				helpers.deepMerge({}, { a: 1 }, [] as any);
			}).toThrow(new TypeError('deepMerge: `sources[1]` must be a plain object, got object'));
			expect(function () {
				helpers.deepMerge(null as any);
			}).toThrow(new TypeError('deepMerge: `target` must be a plain object, got null'));
			expect(function () {
				helpers.flattenObject('x' as any);
			}).toThrow(new TypeError('flattenObject: `object` must be a plain object or an array, got string'));
			expect(function () {
				helpers.invert({ a: true } as any);
			}).toThrow(new TypeError('invert: `object.a` must be a string, number or symbol, got boolean'));
		});
	});
});
