import { clone, deepClone, deepFreeze, deepMerge, flattenObject, getFromObjectByKeys, isEqual, mapValues, merge, omit } from '@emiliodominguez/js-helpers/objects';

const users = Array.from({ length: 100 }, function (_, index) {
	return { id: index, team: `team-${index % 20}`, name: `user-${index}`, tags: ['a', 'b'] };
});
const config = { server: { host: 'localhost', port: 8080, tls: { cert: 'cert.pem', key: 'key.pem' } }, flags: [1, 2, 3, 4, 5] };
const state = { config, users, updatedAt: new Date(0) };
const stateCopy = { config: JSON.parse(JSON.stringify(config)), users: JSON.parse(JSON.stringify(users)), updatedAt: new Date(0) };
const defaults = { a: { x: 1, y: { z: 2, w: [1, 2] } }, b: 'text', c: { d: { e: { f: 1 } } }, list: [1, 2, 3] };
const overrides = { a: { y: { z: 3 }, q: 9 }, c: { d: { e: { g: 2 } } }, list: [9], extra: true };
const record = Object.fromEntries(
	users.map(function (user) {
		return [user.name, user.id];
	})
);

export default [
	{
		name: 'deepClone (100 users + config)',
		fn: function () {
			return deepClone(state);
		},
		baseline: function () {
			return structuredClone(state);
		}
	},
	{
		name: 'clone (plain object, 4 keys)',
		fn: function () {
			return clone(defaults);
		},
		baseline: function () {
			return { ...defaults };
		}
	},
	{
		name: 'isEqual (100 users + config, equal)',
		fn: function () {
			return isEqual(state, stateCopy);
		}
	},
	{
		name: 'deepMerge (2 nested objects)',
		fn: function () {
			return deepMerge(defaults, overrides);
		}
	},
	{
		name: 'merge (2 objects)',
		fn: function () {
			return merge(defaults, overrides);
		},
		baseline: function () {
			return { ...defaults, ...overrides };
		}
	},
	{
		name: 'mapValues (100 keys)',
		fn: function () {
			return mapValues(record, function (value) {
				return value * 2;
			});
		}
	},
	{
		name: 'omit (2 of 4 keys)',
		fn: function () {
			return omit(defaults, ['b', 'c']);
		}
	},
	{
		name: 'deepFreeze (fresh nested object)',
		fn: function () {
			return deepFreeze({ a: { b: [1, 2, { c: 3 }] }, d: { e: 1 } });
		}
	},
	{
		name: 'flattenObject (100 users + config)',
		fn: function () {
			return flattenObject(stateCopy);
		}
	},
	{
		name: 'getFromObjectByKeys (5 segments)',
		fn: function () {
			return getFromObjectByKeys(state, 'config.server.tls.cert');
		}
	}
];
