import { buildQueryString, getQueryParam, joinUrl, parseQueryString, withQuery } from '@emiliodominguez/js-helpers/url';

const query = '?q=hello+world&page=2&sort=desc&tag=a&tag=b&ids[]=1&ids[]=2&empty&utm_source=newsletter&ref=%C3%A9t%C3%A9';
const params = { q: 'hello world', page: 2, sort: 'desc', tags: ['a', 'b', 'c'], active: true, since: new Date(Date.UTC(2024, 0, 1)), skip: undefined, none: null };
const url = 'https://example.com/search?q=old&page=2&sort=asc#results';

export default [
	{
		name: 'parseQueryString (10 pairs)',
		fn: function () {
			return parseQueryString(query);
		}
	},
	{
		name: 'buildQueryString (8 keys)',
		fn: function () {
			return buildQueryString(params);
		}
	},
	{
		name: 'buildQueryString (brackets, sorted)',
		fn: function () {
			return buildQueryString(params, { arrayFormat: 'brackets', sort: true });
		}
	},
	{
		name: 'withQuery (replace 2, add 1)',
		fn: function () {
			return withQuery(url, { q: 'new value', page: null, lang: 'en' });
		}
	},
	{
		name: 'getQueryParam',
		fn: function () {
			return getQueryParam(url, 'page');
		}
	},
	{
		name: 'joinUrl (4 parts)',
		fn: function () {
			return joinUrl('https://api.example.com/', '/v1/', 'users', '42?expand=true');
		}
	}
];
