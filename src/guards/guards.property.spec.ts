import fc from 'fast-check';
import * as guards from '.';

const anythingOrFunction = fc.oneof(
	fc.anything({ withBigInt: true, withBoxedValues: true, withDate: true, withMap: true, withSet: true, withTypedArray: true, withNullPrototype: true }),
	fc.constant(function () {}),
	fc.constant(class {}),
	fc.constant(Math.max),
	fc.constant(Symbol('s')),
	fc.constant(Symbol.iterator)
);

describe('guards (properties)', function () {
	it('exactly one typeof-category guard holds for any value', function () {
		const categories = [
			guards.isString,
			guards.isNumber,
			guards.isBoolean,
			guards.isUndefined,
			guards.isNull,
			guards.isSymbol,
			guards.isBigInt,
			guards.isFunction,
			guards.isObject
		];
		fc.assert(
			fc.property(anythingOrFunction, function (value) {
				const holding = categories.filter(function (guard) {
					return guard(value);
				});
				expect(holding).toHaveLength(1);
			})
		);
	});

	it('isPrimitive(x) === !(isObject(x) || isFunction(x))', function () {
		fc.assert(
			fc.property(anythingOrFunction, function (value) {
				expect(guards.isPrimitive(value)).toBe(!(guards.isObject(value) || guards.isFunction(value)));
			})
		);
	});

	it('isNil === isNull || isUndefined, and isDefined === !isNil', function () {
		fc.assert(
			fc.property(anythingOrFunction, function (value) {
				expect(guards.isNil(value)).toBe(guards.isNull(value) || guards.isUndefined(value));
				expect(guards.isDefined(value)).toBe(!guards.isNil(value));
			})
		);
	});

	it('isPlainObject implies isObject and excludes arrays', function () {
		fc.assert(
			fc.property(anythingOrFunction, function (value) {
				if (guards.isPlainObject(value)) {
					expect(guards.isObject(value)).toBe(true);
					expect(guards.isArray(value)).toBe(false);
				}
			})
		);
	});

	it('isInteger implies isFiniteNumber implies isNumber', function () {
		fc.assert(
			fc.property(fc.oneof(fc.double(), fc.integer(), fc.anything()), function (value) {
				if (guards.isInteger(value)) expect(guards.isFiniteNumber(value)).toBe(true);
				if (guards.isFiniteNumber(value)) expect(guards.isNumber(value)).toBe(true);
				expect(guards.isFiniteNumber(value)).toBe(typeof value === 'number' && value - value === 0);
			})
		);
	});

	it('every string and array is iterable; plain objects never are', function () {
		fc.assert(
			fc.property(fc.oneof(fc.string(), fc.array(fc.anything())), function (value) {
				expect(guards.isIterable(value)).toBe(true);
			})
		);
		fc.assert(
			fc.property(fc.object(), function (value) {
				expect(guards.isIterable(value)).toBe(false);
			})
		);
	});
});
