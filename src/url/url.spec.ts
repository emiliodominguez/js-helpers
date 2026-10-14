import * as helpers from '.';

describe('URL helpers', function () {
	describe('buildQueryString', function () {
		it('should encode keys and values without a leading ?', function () {
			expect(helpers.buildQueryString({ q: 'hello world', page: 2 })).toBe('q=hello%20world&page=2');
			expect(helpers.buildQueryString({ 'a&b': 'c=d', e: '#?/+' })).toBe('a%26b=c%3Dd&e=%23%3F%2F%2B');
			expect(helpers.buildQueryString({ city: 'São Paulo', emoji: '😀' })).toBe('city=S%C3%A3o%20Paulo&emoji=%F0%9F%98%80');
			expect(helpers.buildQueryString({})).toBe('');
			expect(helpers.buildQueryString({ empty: '' })).toBe('empty=');
		});

		it('should serialize numbers, booleans, bigints and dates', function () {
			expect(helpers.buildQueryString({ n: 1.5, z: -0, t: true, f: false, big: 10n, nan: NaN })).toBe('n=1.5&z=0&t=true&f=false&big=10&nan=NaN');
			expect(helpers.buildQueryString({ d: new Date(Date.UTC(2024, 0, 2, 3, 4, 5)) })).toBe('d=2024-01-02T03%3A04%3A05.000Z');
		});

		it('should skip undefined, and null unless skipNull is false', function () {
			expect(helpers.buildQueryString({ a: undefined, b: null, c: 1 })).toBe('c=1');
			expect(helpers.buildQueryString({ a: undefined, b: null, c: 1 }, { skipNull: false })).toBe('b&c=1');
		});

		it('should support the three array formats', function () {
			const params = { tags: ['a', 'b c', 'd,e'], one: 1 };
			expect(helpers.buildQueryString(params)).toBe('tags=a&tags=b%20c&tags=d%2Ce&one=1');
			expect(helpers.buildQueryString(params, { arrayFormat: 'repeat' })).toBe('tags=a&tags=b%20c&tags=d%2Ce&one=1');
			expect(helpers.buildQueryString(params, { arrayFormat: 'brackets' })).toBe('tags[]=a&tags[]=b%20c&tags[]=d%2Ce&one=1');
			expect(helpers.buildQueryString(params, { arrayFormat: 'comma' })).toBe('tags=a,b%20c,d%2Ce&one=1');
		});

		it('should skip empty arrays and nullish array items', function () {
			const items = [null, 1, undefined, 2] as any;
			expect(helpers.buildQueryString({ a: [], b: items })).toBe('b=1&b=2');
			expect(helpers.buildQueryString({ a: [], b: items }, { arrayFormat: 'comma' })).toBe('b=1,2');
			expect(helpers.buildQueryString({ a: [null] as any }, { skipNull: false })).toBe('');
		});

		it('should sort keys when asked, keeping the value order', function () {
			expect(helpers.buildQueryString({ b: 1, a: [3, 2], c: 0 }, { sort: true })).toBe('a=3&a=2&b=1&c=0');
		});

		it('should only read own enumerable keys', function () {
			const params = Object.create({ inherited: 'x' });
			params.own = 'y';
			expect(helpers.buildQueryString(params)).toBe('own=y');
		});

		it('should replace lone surrogates with U+FFFD instead of throwing', function () {
			expect(helpers.buildQueryString({ a: '\uD800', b: 'x\uDC00y', '\uD83D': '😀' })).toBe('a=%EF%BF%BD&b=x%EF%BF%BDy&%EF%BF%BD=%F0%9F%98%80');
			// Valid pairs next to a lone surrogate are kept.
			expect(helpers.buildQueryString({ c: '😀\uDC00😀' })).toBe('c=%F0%9F%98%80%EF%BF%BD%F0%9F%98%80');
		});

		it('should throw for invalid dates, unsupported values and unknown array formats', function () {
			expect(function () {
				helpers.buildQueryString({ d: new Date(NaN) });
			}).toThrow(RangeError);
			expect(function () {
				helpers.buildQueryString({ o: { nested: true } as any });
			}).toThrow(TypeError);
			expect(function () {
				helpers.buildQueryString({ s: [Symbol('x')] as any });
			}).toThrow(TypeError);
			expect(function () {
				helpers.buildQueryString({ a: 1 }, { arrayFormat: 'json' as any });
			}).toThrow(RangeError);
		});
	});

	describe('parseQueryString', function () {
		it('should parse pairs, with or without a leading ?', function () {
			expect(helpers.parseQueryString('?a=1&b=two')).toEqual({ a: '1', b: 'two' });
			expect(helpers.parseQueryString('a=1&b=two')).toEqual({ a: '1', b: 'two' });
			expect(helpers.parseQueryString('')).toEqual({});
			expect(helpers.parseQueryString('?')).toEqual({});
		});

		it('should decode percent-escapes and + as a space', function () {
			expect(helpers.parseQueryString('q=hello+world&r=a%20b%2Bc&e=%F0%9F%98%80')).toEqual({ q: 'hello world', r: 'a b+c', e: '😀' });
			expect(helpers.parseQueryString('a%26b=c%3Dd')).toEqual({ 'a&b': 'c=d' });
		});

		it('should not throw on malformed escapes', function () {
			expect(helpers.parseQueryString('a=%zz&b=%E0%A4%A&c=100%')).toEqual({ a: '%zz', b: '\uFFFD%A', c: '100%' });
		});

		it('should handle missing values, empty keys and empty pairs', function () {
			expect(helpers.parseQueryString('flag&x=&&=v&a=b=c')).toEqual({ flag: '', x: '', '': 'v', a: 'b=c' });
		});

		it('should collect repeated keys into arrays', function () {
			expect(helpers.parseQueryString('a=1&b=2&a=3&a=4')).toEqual({ a: ['1', '3', '4'], b: '2' });
		});

		it('should collapse bracket keys into arrays, even with one value', function () {
			expect(helpers.parseQueryString('ids[]=1&ids[]=2')).toEqual({ ids: ['1', '2'] });
			expect(helpers.parseQueryString('ids[]=1')).toEqual({ ids: ['1'] });
			expect(helpers.parseQueryString('ids%5B%5D=1&ids=2')).toEqual({ ids: ['1', '2'] });
			expect(helpers.parseQueryString('ids=0&ids[]=1')).toEqual({ ids: ['0', '1'] });
		});

		it('should not split comma-separated values', function () {
			expect(helpers.parseQueryString('a=1,2')).toEqual({ a: '1,2' });
		});

		it('should ignore the fragment', function () {
			expect(helpers.parseQueryString('?a=1#b=2')).toEqual({ a: '1' });
			expect(helpers.parseQueryString('#a=1')).toEqual({});
		});

		it('should be safe against prototype pollution', function () {
			const result = helpers.parseQueryString('__proto__=polluted&constructor=x&toString=y&__proto__[]=z');
			expect(Object.getPrototypeOf(result)).toBeNull();
			expect(Object.keys(result)).toEqual(['__proto__', 'constructor', 'toString']);
			expect(result.__proto__).toEqual(['polluted', 'z']);
			expect(result.constructor).toBe('x');
			expect(({} as any).polluted).toBeUndefined();
			expect(Object.prototype).not.toHaveProperty('polluted');
		});
	});

	describe('withQuery', function () {
		it('should add a query to a URL without one', function () {
			expect(helpers.withQuery('https://x.com/path', { a: 1, b: 'c d' })).toBe('https://x.com/path?a=1&b=c%20d');
			expect(helpers.withQuery('/path', {})).toBe('/path');
			expect(helpers.withQuery('', { a: 1 })).toBe('?a=1');
		});

		it('should merge with an existing query, overwriting existing keys', function () {
			expect(helpers.withQuery('https://x.com/search?q=old&page=2#results', { q: 'new value', lang: 'en' })).toBe(
				'https://x.com/search?page=2&q=new%20value&lang=en#results'
			);
			expect(helpers.withQuery('/a?x=1&x=2&y=3', { x: [4, 5] })).toBe('/a?y=3&x=4&x=5');
			expect(helpers.withQuery('/a?t[]=1&t%5B%5D=2&u=1', { t: 3 })).toBe('/a?u=1&t=3');
			expect(helpers.withQuery('/a?hello+world=1&hello%20world=2&b', { 'hello world': 'x' })).toBe('/a?b&hello%20world=x');
		});

		it('should keep the untouched pairs verbatim', function () {
			expect(helpers.withQuery('/a?raw=a+b%2c&bad=%zz', { c: 1 })).toBe('/a?raw=a+b%2c&bad=%zz&c=1');
		});

		it('should ignore undefined values and remove keys set to null', function () {
			expect(helpers.withQuery('/a?x=1&y=2', { x: undefined, y: null })).toBe('/a?x=1');
			expect(helpers.withQuery('/a?y=2', { y: null })).toBe('/a');
			expect(helpers.withQuery('/a?y=2', { y: null }, { skipNull: false })).toBe('/a?y');
			expect(helpers.withQuery('/a?y=2', { y: [] })).toBe('/a');
		});

		it('should preserve the fragment and drop a dangling ?', function () {
			expect(helpers.withQuery('/a#frag?not=query', { b: 1 })).toBe('/a?b=1#frag?not=query');
			expect(helpers.withQuery('/a?#top', {})).toBe('/a#top');
			expect(helpers.withQuery('/a?&&', {})).toBe('/a');
		});

		it('should apply the options to the new parameters', function () {
			expect(helpers.withQuery('/a?z=1', { c: [1, 2], b: 0 }, { arrayFormat: 'brackets', sort: true })).toBe('/a?z=1&b=0&c[]=1&c[]=2');
		});
	});

	describe('joinUrl / withQuery edge cases', function () {
		it('withQuery should replace bare keys (without =) too', function () {
			expect(helpers.withQuery('/p?flag&x=1', { flag: 'on' })).toBe('/p?x=1&flag=on');
		});

		it('joinUrl should only treat a leading scheme (letters, digits, +, -, .) as a scheme', function () {
			expect(helpers.joinUrl('s3://bucket/', '/key')).toBe('s3://bucket/key');
			expect(helpers.joinUrl('files/a:b', 'c')).toBe('files/a:b/c');
			expect(helpers.joinUrl('/a:b//', 'c')).toBe('/a:b/c');
		});
	});

	describe('joinUrl', function () {
		it('should join parts with exactly one slash', function () {
			expect(helpers.joinUrl('https://api.example.com/', '/v1/', 'users', '42')).toBe('https://api.example.com/v1/users/42');
			expect(helpers.joinUrl('a', 'b', 'c')).toBe('a/b/c');
			expect(helpers.joinUrl('a//b', '//c//')).toBe('a/b/c/');
		});

		it('should preserve the scheme, a protocol-relative prefix or a leading slash', function () {
			expect(helpers.joinUrl('http://localhost:3000', 'api')).toBe('http://localhost:3000/api');
			expect(helpers.joinUrl('file:///etc', 'hosts')).toBe('file:///etc/hosts');
			expect(helpers.joinUrl('//cdn.example.com', 'lib.js')).toBe('//cdn.example.com/lib.js');
			expect(helpers.joinUrl('///cdn', 'lib.js')).toBe('/cdn/lib.js');
			expect(helpers.joinUrl('//', 'a')).toBe('/a');
			expect(helpers.joinUrl('//')).toBe('/');
			expect(helpers.joinUrl('/api', 'items')).toBe('/api/items');
			expect(helpers.joinUrl('https://', 'example.com', 'a')).toBe('https://example.com/a');
			expect(helpers.joinUrl('https://')).toBe('https://');
		});

		it('should keep a trailing slash only when the last part has one', function () {
			expect(helpers.joinUrl('a', 'b/')).toBe('a/b/');
			expect(helpers.joinUrl('a/', 'b')).toBe('a/b');
			expect(helpers.joinUrl('a', '/')).toBe('a/');
			expect(helpers.joinUrl('/')).toBe('/');
			expect(helpers.joinUrl('/', '/')).toBe('/');
			expect(helpers.joinUrl('https://x.com/')).toBe('https://x.com/');
		});

		it('should ignore empty parts', function () {
			expect(helpers.joinUrl('a', '', 'b')).toBe('a/b');
			expect(helpers.joinUrl('', '/a')).toBe('/a');
			expect(helpers.joinUrl()).toBe('');
			expect(helpers.joinUrl('', '')).toBe('');
		});

		it('should keep the query and fragment of the last part', function () {
			expect(helpers.joinUrl('/api', 'items/', '?page=2')).toBe('/api/items?page=2');
			expect(helpers.joinUrl('/api', 'items/?page=2')).toBe('/api/items/?page=2');
			expect(helpers.joinUrl('a', 'b#x//y')).toBe('a/b#x//y');
			expect(helpers.joinUrl('a?x//y')).toBe('a?x//y');
			expect(helpers.joinUrl('?q')).toBe('?q');
		});

		it('should throw a TypeError for non-string parts', function () {
			expect(function () {
				helpers.joinUrl('a', 1 as any);
			}).toThrow(TypeError);
		});
	});

	describe('getQueryParam', function () {
		it('should return the first value of a parameter', function () {
			expect(helpers.getQueryParam('https://x.com/?q=hello+world&q=2#top', 'q')).toBe('hello world');
			expect(helpers.getQueryParam('/p?ids[]=7&ids[]=8', 'ids')).toBe('7');
			expect(helpers.getQueryParam('/path?flag', 'flag')).toBe('');
		});

		it('should return undefined for missing parameters', function () {
			expect(helpers.getQueryParam('/path', 'q')).toBeUndefined();
			expect(helpers.getQueryParam('q=1', 'q')).toBeUndefined();
			expect(helpers.getQueryParam('/p?a=1', 'b')).toBeUndefined();
			expect(helpers.getQueryParam('/p#?q=1', 'q')).toBeUndefined();
		});

		it('should not see inherited properties', function () {
			expect(helpers.getQueryParam('/p?a=1', 'constructor')).toBeUndefined();
			expect(helpers.getQueryParam('/p?a=1', '__proto__')).toBeUndefined();
			expect(helpers.getQueryParam('/p?__proto__=1', '__proto__')).toBe('1');
		});
	});

	describe('isAbsoluteUrl', function () {
		it('should accept scheme:// and protocol-relative URLs', function () {
			expect(helpers.isAbsoluteUrl('https://example.com')).toBe(true);
			expect(helpers.isAbsoluteUrl('HTTP://EXAMPLE.COM')).toBe(true);
			expect(helpers.isAbsoluteUrl('ftp://host/file')).toBe(true);
			expect(helpers.isAbsoluteUrl('custom+app.v2-x://open')).toBe(true);
			expect(helpers.isAbsoluteUrl('//cdn.example.com/lib.js')).toBe(true);
		});

		it('should reject relative URLs and schemes without //', function () {
			expect(helpers.isAbsoluteUrl('/relative/path')).toBe(false);
			expect(helpers.isAbsoluteUrl('relative/path')).toBe(false);
			expect(helpers.isAbsoluteUrl('mailto:someone@example.com')).toBe(false);
			expect(helpers.isAbsoluteUrl('1http://x')).toBe(false);
			expect(helpers.isAbsoluteUrl('./a://b')).toBe(false);
			expect(helpers.isAbsoluteUrl('')).toBe(false);
		});
	});

	describe('argument validation', function () {
		it('uses the library-wide message format', function () {
			expect(function () {
				helpers.buildQueryString({ a: {} as any });
			}).toThrow(new TypeError('buildQueryString: `params.a` must be a string, number, boolean, bigint or Date, got object'));
			expect(function () {
				helpers.buildQueryString({ when: new Date(NaN) });
			}).toThrow(new RangeError('buildQueryString: `params.when` must be a valid Date, got Invalid Date'));
			expect(function () {
				helpers.buildQueryString({}, { arrayFormat: 'x' as any });
			}).toThrow(new RangeError("buildQueryString: `arrayFormat` must be 'repeat', 'comma' or 'brackets', got x"));
			expect(function () {
				helpers.joinUrl('a', null as any);
			}).toThrow(new TypeError('joinUrl: `parts` must only contain strings, got null'));
		});
	});
});
