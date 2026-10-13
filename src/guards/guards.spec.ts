import * as vm from 'vm';
import * as guards from '.';

const foreign = vm.runInNewContext(`({
	date: new Date(0),
	regexp: /a/g,
	error: new TypeError('x'),
	map: new Map([[1, 2]]),
	set: new Set([1]),
	weakMap: new WeakMap(),
	weakSet: new WeakSet(),
	array: [1, 2],
	object: { a: 1 },
	promise: Promise.resolve(1)
})`);

function noop(): void {}

describe('guards', function () {
	describe('isObject', function () {
		it('accepts non-null objects (incl. arrays, dates, boxed values)', function () {
			expect(guards.isObject({ a: 1 })).toBe(true);
			expect(guards.isObject([])).toBe(true);
			expect(guards.isObject(new Date())).toBe(true);
			expect(guards.isObject(Object.create(null))).toBe(true);
			expect(guards.isObject(new Number(1))).toBe(true);
		});

		it('rejects functions, primitives and null', function () {
			expect(guards.isObject(noop)).toBe(false);
			expect(guards.isObject(class {})).toBe(false);
			expect(guards.isObject(1)).toBe(false);
			expect(guards.isObject('string')).toBe(false);
			expect(guards.isObject(null)).toBe(false);
			expect(guards.isObject(undefined)).toBe(false);
		});

		it('narrows unknown to object', function () {
			const value: unknown = { a: 1 };
			if (guards.isObject(value)) {
				const narrowed: object = value;
				expect(Object.keys(narrowed)).toEqual(['a']);
			}
		});
	});

	describe('isArray', function () {
		it('accepts arrays, including cross-realm ones', function () {
			expect(guards.isArray([1, 2, 3])).toBe(true);
			expect(guards.isArray([])).toBe(true);
			expect(guards.isArray(foreign.array)).toBe(true);
		});

		it('rejects array-likes and other values', function () {
			expect(guards.isArray({ length: 0 })).toBe(false);
			expect(guards.isArray('string')).toBe(false);
			expect(guards.isArray(new Uint8Array(1))).toBe(false);
			expect(guards.isArray(null)).toBe(false);
			expect(guards.isArray(undefined)).toBe(false);
		});

		it('narrows to unknown[]', function () {
			const value: unknown = [1, 2];
			expect(guards.isArray(value) ? value.length : -1).toBe(2);
		});
	});

	describe('isFunction', function () {
		it('accepts every kind of function', function () {
			expect(guards.isFunction(noop)).toBe(true);
			expect(guards.isFunction(class {})).toBe(true);
			expect(guards.isFunction(async function () {})).toBe(true);
			expect(guards.isFunction(function* () {})).toBe(true);
		});

		it('rejects non-functions', function () {
			expect(guards.isFunction({ a: 1 })).toBe(false);
			expect(guards.isFunction(1)).toBe(false);
			expect(guards.isFunction(null)).toBe(false);
			expect(guards.isFunction(undefined)).toBe(false);
		});
	});

	describe('isString', function () {
		it('accepts primitive strings incl. empty and unicode', function () {
			expect(guards.isString('hello')).toBe(true);
			expect(guards.isString('')).toBe(true);
			expect(guards.isString('😀')).toBe(true);
		});

		it('rejects everything else, including boxed strings', function () {
			expect(guards.isString(new String('a'))).toBe(false);
			expect(guards.isString(123)).toBe(false);
			expect(guards.isString([])).toBe(false);
			expect(guards.isString(null)).toBe(false);
		});

		it('narrows to string', function () {
			const value: unknown = 'abc';
			expect(guards.isString(value) ? value.toUpperCase() : '').toBe('ABC');
		});
	});

	describe('isNumber', function () {
		it('accepts all numbers, NaN and Infinity included', function () {
			expect(guards.isNumber(123)).toBe(true);
			expect(guards.isNumber(-0)).toBe(true);
			expect(guards.isNumber(NaN)).toBe(true);
			expect(guards.isNumber(-Infinity)).toBe(true);
		});

		it('rejects non-numbers', function () {
			expect(guards.isNumber('1')).toBe(false);
			expect(guards.isNumber(1n)).toBe(false);
			expect(guards.isNumber(new Number(1))).toBe(false);
			expect(guards.isNumber(null)).toBe(false);
		});
	});

	describe('isBoolean', function () {
		it('accepts true and false only', function () {
			expect(guards.isBoolean(true)).toBe(true);
			expect(guards.isBoolean(false)).toBe(true);
			expect(guards.isBoolean(0)).toBe(false);
			expect(guards.isBoolean('true')).toBe(false);
			expect(guards.isBoolean(new Boolean(true))).toBe(false);
		});
	});

	describe('isUndefined / isNull / isNil / isDefined', function () {
		it('isUndefined', function () {
			expect(guards.isUndefined(undefined)).toBe(true);
			expect(guards.isUndefined(void 0)).toBe(true);
			expect(guards.isUndefined(null)).toBe(false);
			expect(guards.isUndefined(0)).toBe(false);
		});

		it('isNull', function () {
			expect(guards.isNull(null)).toBe(true);
			expect(guards.isNull(undefined)).toBe(false);
			expect(guards.isNull(0)).toBe(false);
			expect(guards.isNull('')).toBe(false);
		});

		it('isNil', function () {
			expect(guards.isNil(null)).toBe(true);
			expect(guards.isNil(undefined)).toBe(true);
			expect(guards.isNil(0)).toBe(false);
			expect(guards.isNil('')).toBe(false);
			expect(guards.isNil(false)).toBe(false);
		});

		it('isDefined filters nullish values and narrows the element type', function () {
			const list: Array<number | null | undefined> = [1, null, 0, undefined, 2];
			const defined: number[] = list.filter(guards.isDefined);
			expect(defined).toEqual([1, 0, 2]);
			expect(guards.isDefined(NaN)).toBe(true);
			expect(guards.isDefined(null)).toBe(false);
		});
	});

	describe('isSymbol / isBigInt', function () {
		it('isSymbol', function () {
			expect(guards.isSymbol(Symbol('test'))).toBe(true);
			expect(guards.isSymbol(Symbol.iterator)).toBe(true);
			expect(guards.isSymbol('symbol')).toBe(false);
			expect(guards.isSymbol(Object(Symbol('x')))).toBe(false);
		});

		it('isBigInt', function () {
			expect(guards.isBigInt(0n)).toBe(true);
			expect(guards.isBigInt(BigInt(10))).toBe(true);
			expect(guards.isBigInt(10)).toBe(false);
			expect(guards.isBigInt('10')).toBe(false);
		});
	});

	describe('isPromise', function () {
		it('accepts native promises (incl. cross-realm) and thenables', function () {
			expect(guards.isPromise(Promise.resolve())).toBe(true);
			expect(guards.isPromise(foreign.promise)).toBe(true);
			expect(guards.isPromise({ then: noop })).toBe(true);
			const thenableFunction = Object.assign(function () {}, { then: noop });
			expect(guards.isPromise(thenableFunction)).toBe(true);
		});

		it('rejects non-thenables', function () {
			expect(guards.isPromise(undefined)).toBe(false);
			expect(guards.isPromise(0)).toBe(false);
			expect(guards.isPromise('')).toBe(false);
			expect(guards.isPromise({})).toBe(false);
			expect(guards.isPromise({ then: 1 })).toBe(false);
			expect(guards.isPromise(noop)).toBe(false);
		});

		it('narrows to PromiseLike', async function () {
			const value: unknown = Promise.resolve(3);
			if (guards.isPromise(value)) await expect(value).resolves.toBe(3);
		});
	});

	describe('isRegExp', function () {
		it('accepts regexps, including cross-realm ones', function () {
			expect(guards.isRegExp(/regex/)).toBe(true);
			expect(guards.isRegExp(new RegExp('a', 'g'))).toBe(true);
			expect(guards.isRegExp(foreign.regexp)).toBe(true);
		});

		it('rejects non-regexps and fakes', function () {
			expect(guards.isRegExp('/a/')).toBe(false);
			expect(guards.isRegExp({})).toBe(false);
			expect(guards.isRegExp({ [Symbol.toStringTag]: 'RegExp' })).toBe(false);
			expect(guards.isRegExp(undefined)).toBe(false);
		});
	});

	describe('isError', function () {
		it('accepts errors and subclasses, including cross-realm ones', function () {
			expect(guards.isError(new Error('error'))).toBe(true);
			expect(guards.isError(new RangeError('error'))).toBe(true);
			expect(guards.isError(foreign.error)).toBe(true);
		});

		it('rejects error-like objects', function () {
			expect(guards.isError({ name: 'Error', message: 'x' })).toBe(false);
			expect(guards.isError('Error')).toBe(false);
			expect(guards.isError(undefined)).toBe(false);
		});
	});

	describe('isDate', function () {
		it('accepts dates (valid or not), including cross-realm ones', function () {
			expect(guards.isDate(new Date())).toBe(true);
			expect(guards.isDate(new Date('invalid'))).toBe(true);
			expect(guards.isDate(foreign.date)).toBe(true);
		});

		it('rejects timestamps, strings and fakes', function () {
			expect(guards.isDate(Date.now())).toBe(false);
			expect(guards.isDate('2020-01-01')).toBe(false);
			expect(guards.isDate({ [Symbol.toStringTag]: 'Date' })).toBe(false);
			expect(guards.isDate(null)).toBe(false);
		});
	});

	describe('isMap / isSet / isWeakMap / isWeakSet', function () {
		it('isMap', function () {
			expect(guards.isMap(new Map())).toBe(true);
			expect(guards.isMap(foreign.map)).toBe(true);
			expect(guards.isMap(new WeakMap())).toBe(false);
			expect(guards.isMap({ [Symbol.toStringTag]: 'Map' })).toBe(false);
			expect(guards.isMap({})).toBe(false);
			expect(guards.isMap(undefined)).toBe(false);
		});

		it('isSet', function () {
			expect(guards.isSet(new Set())).toBe(true);
			expect(guards.isSet(foreign.set)).toBe(true);
			expect(guards.isSet(new WeakSet())).toBe(false);
			expect(guards.isSet({ [Symbol.toStringTag]: 'Set' })).toBe(false);
			expect(guards.isSet([])).toBe(false);
		});

		it('isWeakMap', function () {
			expect(guards.isWeakMap(new WeakMap())).toBe(true);
			expect(guards.isWeakMap(foreign.weakMap)).toBe(true);
			expect(guards.isWeakMap(new Map())).toBe(false);
			expect(guards.isWeakMap({ [Symbol.toStringTag]: 'WeakMap' })).toBe(false);
			expect(guards.isWeakMap('')).toBe(false);
		});

		it('isWeakSet', function () {
			expect(guards.isWeakSet(new WeakSet())).toBe(true);
			expect(guards.isWeakSet(foreign.weakSet)).toBe(true);
			expect(guards.isWeakSet(new Set())).toBe(false);
			expect(guards.isWeakSet({ [Symbol.toStringTag]: 'WeakSet' })).toBe(false);
			expect(guards.isWeakSet(0)).toBe(false);
		});
	});

	describe('isPlainObject', function () {
		it('accepts literals, null-prototype objects and JSON output', function () {
			expect(guards.isPlainObject({})).toBe(true);
			expect(guards.isPlainObject({ a: { b: 1 } })).toBe(true);
			expect(guards.isPlainObject(Object.create(null))).toBe(true);
			expect(guards.isPlainObject(JSON.parse('{"a":1}'))).toBe(true);
		});

		it('rejects arrays, class instances, built-ins, cross-realm objects and primitives', function () {
			class Point {
				x = 1;
			}
			expect(guards.isPlainObject([])).toBe(false);
			expect(guards.isPlainObject(new Point())).toBe(false);
			expect(guards.isPlainObject(Object.create({}))).toBe(false);
			expect(guards.isPlainObject(new Date())).toBe(false);
			expect(guards.isPlainObject(new Map())).toBe(false);
			expect(guards.isPlainObject(foreign.object)).toBe(false);
			expect(guards.isPlainObject(noop)).toBe(false);
			expect(guards.isPlainObject(null)).toBe(false);
			expect(guards.isPlainObject('a')).toBe(false);
		});

		it('narrows to a record', function () {
			const value: unknown = { a: 1 };
			expect(guards.isPlainObject(value) ? value.a : undefined).toBe(1);
		});
	});

	describe('isPrimitive', function () {
		it('accepts every primitive', function () {
			for (const value of ['a', 1, NaN, 1n, true, Symbol('s'), null, undefined]) {
				expect(guards.isPrimitive(value)).toBe(true);
			}
		});

		it('rejects objects and functions', function () {
			expect(guards.isPrimitive({})).toBe(false);
			expect(guards.isPrimitive([])).toBe(false);
			expect(guards.isPrimitive(new String('a'))).toBe(false);
			expect(guards.isPrimitive(noop)).toBe(false);
		});
	});

	describe('isIterable / isAsyncIterable', function () {
		it('isIterable accepts strings, arrays, maps, sets, generators and custom iterables', function () {
			expect(guards.isIterable('abc')).toBe(true);
			expect(guards.isIterable('')).toBe(true);
			expect(guards.isIterable([1])).toBe(true);
			expect(guards.isIterable(new Map())).toBe(true);
			expect(guards.isIterable(new Set())).toBe(true);
			expect(guards.isIterable((function* () {})())).toBe(true);
			expect(guards.isIterable({ [Symbol.iterator]: noop })).toBe(true);
		});

		it('isIterable rejects non-iterables', function () {
			expect(guards.isIterable({})).toBe(false);
			expect(guards.isIterable({ [Symbol.iterator]: 1 })).toBe(false);
			expect(guards.isIterable(1)).toBe(false);
			expect(guards.isIterable(null)).toBe(false);
			expect(guards.isIterable(undefined)).toBe(false);
		});

		it('isAsyncIterable', function () {
			expect(guards.isAsyncIterable((async function* () {})())).toBe(true);
			expect(guards.isAsyncIterable({ [Symbol.asyncIterator]: noop })).toBe(true);
			expect(guards.isAsyncIterable([1])).toBe(false);
			expect(guards.isAsyncIterable('abc')).toBe(false);
			expect(guards.isAsyncIterable(null)).toBe(false);
			expect(guards.isAsyncIterable(undefined)).toBe(false);
		});
	});

	describe('isFiniteNumber / isInteger', function () {
		it('isFiniteNumber', function () {
			expect(guards.isFiniteNumber(0)).toBe(true);
			expect(guards.isFiniteNumber(-1.5)).toBe(true);
			expect(guards.isFiniteNumber(NaN)).toBe(false);
			expect(guards.isFiniteNumber(Infinity)).toBe(false);
			expect(guards.isFiniteNumber('1')).toBe(false);
		});

		it('isInteger', function () {
			expect(guards.isInteger(3)).toBe(true);
			expect(guards.isInteger(-0)).toBe(true);
			expect(guards.isInteger(1e21)).toBe(true);
			expect(guards.isInteger(3.5)).toBe(false);
			expect(guards.isInteger(NaN)).toBe(false);
			expect(guards.isInteger(Infinity)).toBe(false);
			expect(guards.isInteger(3n)).toBe(false);
			expect(guards.isInteger('3')).toBe(false);
		});
	});
});
