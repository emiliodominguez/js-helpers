import fc from 'fast-check';

import * as helpers from '.';

/** Keys made of URL-safe-ish characters, excluding the `[]` suffix that parseQueryString collapses. */
const key = fc.stringMatching(/^[a-zA-Z0-9_.~ -]{1,8}$/).filter(function (value) {
	return !value.endsWith('[]');
});
/** Arbitrary unicode values (including lone surrogates, `&`, `=`, `+`, `#`, `%`...). */
const value = fc.oneof(fc.string({ unit: 'binary' }), fc.string({ unit: fc.constantFrom('&', '=', '+', '#', '%', '?', ' ', ',', '[', ']', 'a', 'é') }));
/** A well-formed value (no lone surrogate), which round-trips exactly. */
const wellFormedValue = value.filter(function (text) {
	return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);
});
const segment = fc.stringMatching(/^[a-z0-9]{1,6}$/);

describe('URL helpers (properties)', function () {
	describe('buildQueryString / parseQueryString', function () {
		it('round-trips string values and repeated arrays (single-item arrays come back as strings)', function () {
			fc.assert(
				fc.property(fc.dictionary(key, fc.oneof(wellFormedValue, fc.array(wellFormedValue, { maxLength: 3 }))), function (params) {
					const expected: Record<string, string | string[]> = {};
					for (const [name, item] of Object.entries(params)) {
						if (!Array.isArray(item)) expected[name] = item;
						else if (item.length === 1) expected[name] = item[0];
						else if (item.length > 1) expected[name] = item;
					}
					expect({ ...helpers.parseQueryString(helpers.buildQueryString(params)) }).toEqual(expected);
					expect({ ...helpers.parseQueryString('?' + helpers.buildQueryString(params)) }).toEqual(expected);
				})
			);
		});

		it('round-trips arrays of any length with the brackets format', function () {
			fc.assert(
				fc.property(fc.dictionary(key, fc.array(wellFormedValue, { minLength: 1, maxLength: 3 })), function (params) {
					expect({ ...helpers.parseQueryString(helpers.buildQueryString(params, { arrayFormat: 'brackets' })) }).toEqual(params);
				})
			);
		});

		it('round-trips stringified numbers, booleans and bigints', function () {
			fc.assert(
				fc.property(fc.dictionary(key, fc.oneof(fc.double(), fc.boolean(), fc.bigInt())), function (params) {
					const expected: Record<string, string> = {};
					for (const [name, item] of Object.entries(params)) expected[name] = String(item);
					expect({ ...helpers.parseQueryString(helpers.buildQueryString(params)) }).toEqual(expected);
				})
			);
		});

		it('never leaves a raw &, =, #, + or , inside encoded keys and values', function () {
			fc.assert(
				fc.property(
					fc.dictionary(fc.oneof(key, value), fc.oneof(value, fc.array(value, { maxLength: 3 }))),
					fc.constantFrom<helpers.ArrayFormat>('repeat', 'comma', 'brackets'),
					function (params, arrayFormat) {
						const query = helpers.buildQueryString(params, { arrayFormat });
						if (query === '') return;
						for (const pair of query.split('&')) {
							const [name, ...rest] = pair.split('=');
							expect(rest.length).toBeLessThanOrEqual(1);
							expect(name).not.toMatch(/[#+,]/);
							const encoded = rest.join('');
							if (arrayFormat === 'comma') {
								encoded.split(',').forEach(function (item) {
									expect(item).not.toMatch(/[&=#+,]/);
								});
							} else expect(encoded).not.toMatch(/[&=#+,]/);
						}
					}
				)
			);
		});

		it('sort orders the keys without changing the parsed result', function () {
			fc.assert(
				fc.property(fc.dictionary(key, wellFormedValue), function (params) {
					const sorted = helpers.buildQueryString(params, { sort: true });
					const keys =
						sorted === ''
							? []
							: sorted.split('&').map(function (pair) {
									return decodeURIComponent(pair.split('=')[0]);
								});
					expect(keys).toEqual([...keys].sort());
					expect({ ...helpers.parseQueryString(sorted) }).toEqual({ ...helpers.parseQueryString(helpers.buildQueryString(params)) });
				})
			);
		});
	});

	describe('parseQueryString', function () {
		it('never throws and never touches Object.prototype', function () {
			fc.assert(
				fc.property(fc.string({ unit: fc.constantFrom('a', '=', '&', '%', '2', 'F', '+', '[', ']', '_', 'p', 'r', 'o', 't', '?', '#') }), function (query) {
					const result = helpers.parseQueryString('__proto__[]=x&' + query);
					expect(Object.getPrototypeOf(result)).toBeNull();
					expect(Object.prototype).not.toHaveProperty('x');
					for (const item of Object.values(result)) {
						if (Array.isArray(item)) expect(item.length).toBeGreaterThanOrEqual(1);
						else expect(typeof item).toBe('string');
					}
				})
			);
		});
	});

	describe('withQuery', function () {
		const path = fc.array(segment, { maxLength: 3 }).map(function (parts) {
			return '/' + parts.join('/');
		});
		const hash = fc.oneof(
			fc.constant(''),
			segment.map(function (text) {
				return '#' + text;
			})
		);

		it('preserves the path and the hash, and the new values win', function () {
			fc.assert(
				fc.property(path, fc.dictionary(key, wellFormedValue), hash, fc.dictionary(key, wellFormedValue), function (base, existing, fragment, params) {
					const existingQuery = helpers.buildQueryString(existing);
					const url = base + (existingQuery === '' ? '' : '?' + existingQuery) + fragment;
					const result = helpers.withQuery(url, params);
					expect(result.startsWith(base)).toBe(true);
					expect(result.endsWith(fragment)).toBe(true);
					expect({ ...helpers.parseQueryString(result.slice(base.length)) }).toEqual({ ...existing, ...params });
					for (const name of Object.keys(params)) expect(helpers.getQueryParam(result, name)).toBe(params[name]);
				})
			);
		});

		it('is a no-op on the parsed query when no parameter is given', function () {
			fc.assert(
				fc.property(path, fc.dictionary(key, wellFormedValue), hash, function (base, existing, fragment) {
					const query = helpers.buildQueryString(existing);
					const url = base + (query === '' ? '' : '?' + query) + fragment;
					expect(helpers.withQuery(url, {})).toBe(url);
				})
			);
		});
	});

	describe('joinUrl', function () {
		const part = fc.string({ unit: fc.constantFrom('a', 'b', '/', '/', '.'), maxLength: 6 });

		it('never produces // outside the scheme and keeps every segment in order', function () {
			fc.assert(
				fc.property(fc.constantFrom('', '/', '//', 'https://', 'http://host', '//host'), fc.array(part, { maxLength: 5 }), function (start, parts) {
					const joined = helpers.joinUrl(start, ...parts);
					const all = [start, ...parts];
					const first = all.find(Boolean) ?? '';
					// The only legitimate '//' is the scheme's or a protocol-relative '//host' at the very start.
					const prefix = first.includes('://') ? first.slice(0, first.indexOf('://') + 3) : /^\/\/[^/]/.test(first) ? '//' : '';
					expect(joined.startsWith(prefix)).toBe(true);
					expect(joined.slice(prefix.length)).not.toContain('//');
					const segments = all
						.join('/')
						.slice(all.join('/').indexOf(prefix) + prefix.length)
						.split('/')
						.filter(Boolean);
					expect(joined.slice(prefix.length).split('/').filter(Boolean)).toEqual(segments);
				})
			);
		});

		it('ends with / iff the last non-empty part does (and something was joined)', function () {
			fc.assert(
				fc.property(fc.array(part, { minLength: 1, maxLength: 5 }), function (parts) {
					const nonEmpty = parts.filter(Boolean);
					const joined = helpers.joinUrl(...parts);
					if (/[a.]/.test(joined)) expect(joined.endsWith('/')).toBe(nonEmpty[nonEmpty.length - 1].endsWith('/'));
					if (nonEmpty.length > 0) expect(joined.startsWith('/')).toBe(nonEmpty[0].startsWith('/'));
				})
			);
		});

		it('is associative for simple segments, including a trailing query', function () {
			const query = fc.oneof(
				fc.constant(''),
				segment.map(function (text) {
					return '?q=' + text;
				})
			);
			fc.assert(
				fc.property(segment, segment, segment, query, fc.boolean(), function (a, b, c, search, leading) {
					const first = leading ? '/' + a : a;
					const lastPart = c + search;
					const flat = helpers.joinUrl(first, b, lastPart);
					expect(helpers.joinUrl(first, helpers.joinUrl(b, lastPart))).toBe(flat);
					expect(helpers.joinUrl(helpers.joinUrl(first, b), lastPart)).toBe(flat);
					expect(flat).toBe(`${leading ? '/' : ''}${a}/${b}/${c}${search}`);
				})
			);
		});

		it('is idempotent on its own output', function () {
			fc.assert(
				fc.property(fc.array(part, { maxLength: 5 }), function (parts) {
					const joined = helpers.joinUrl(...parts);
					expect(helpers.joinUrl(joined)).toBe(joined);
				})
			);
		});
	});

	describe('isAbsoluteUrl', function () {
		it('recognizes joinUrl results built on an absolute base and rejects relative paths', function () {
			fc.assert(
				fc.property(fc.constantFrom('https://host', 'ftp://h', '//cdn'), fc.array(segment, { maxLength: 3 }), function (base, parts) {
					expect(helpers.isAbsoluteUrl(helpers.joinUrl(base, ...parts))).toBe(true);
					expect(helpers.isAbsoluteUrl(helpers.joinUrl('/', ...parts))).toBe(false);
				})
			);
		});
	});
});
