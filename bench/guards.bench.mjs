import { isArrayOf, isDate, isFiniteNumber, isMap, isPlainObject, isRegExp, isSet, isString } from '@emiliodominguez/js-helpers/guards';

// A mixed bag of values, like the nodes a deep clone / deep equality walk sees.
const values = [];
for (let i = 0; i < 100; i++) {
	values.push({ id: i }, [i], `s${i}`, i, new Date(i), new Map(), null);
}
const objects = values.filter(function (value) {
	return typeof value === 'object' && value !== null;
});
const isStrings = isArrayOf(isString);
const strings = Array.from({ length: 100 }, function (_, index) {
	return `s${index}`;
});

export default [
	{
		name: 'isPlainObject (700 mixed values)',
		fn: function () {
			let count = 0;
			for (const value of values) if (isPlainObject(value)) count++;
			return count;
		}
	},
	{
		name: 'isDate (700 mixed values)',
		fn: function () {
			let count = 0;
			for (const value of values) if (isDate(value)) count++;
			return count;
		},
		baseline: function () {
			let count = 0;
			for (const value of values) if (value instanceof Date) count++;
			return count;
		}
	},
	{
		name: 'isDate/isRegExp/isMap/isSet (400 objects)',
		fn: function () {
			let count = 0;
			for (const value of objects) if (isDate(value) || isRegExp(value) || isMap(value) || isSet(value)) count++;
			return count;
		}
	},
	{
		name: 'isFiniteNumber (700 mixed values)',
		fn: function () {
			let count = 0;
			for (const value of values) if (isFiniteNumber(value)) count++;
			return count;
		}
	},
	{
		name: 'isArrayOf(isString) (100 strings)',
		fn: function () {
			return isStrings(strings);
		}
	}
];
