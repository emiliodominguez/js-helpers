import {
	escapeHtml,
	getWords,
	interpolate,
	levenshtein,
	reverse,
	similarity,
	toCamelCase,
	toKebabCase,
	toSlug,
	toSnakeCase,
	truncate,
	unescapeHtml
} from '@emiliodominguez/js-helpers/strings';

const identifiers = [
	'helloWorld',
	'XMLHttpRequest',
	'get-http-response2-code',
	'SOME_CONSTANT_NAME',
	'user name',
	'version2Beta',
	'Crème brûlée recipe',
	'already_snake_case'
];
const titles = ['Café Society: A Review', '  --Hello__World!!  ', 'Ünïcödé Straße & Œuvre', 'The Quick Brown Fox Jumps Over The Lazy Dog 2024'];
const html = '<p class="intro">Tom & Jerry\'s "best" episodes</p>'.repeat(20);
const escaped = escapeHtml(html);
const plain = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor. '.repeat(10);
const paragraph = "Don't stop believing: café 2024, naïve résumé — it's 100% fine! ".repeat(10);
const names = ['Ada Lovelace', 'Grace Hopper', 'Tom & Jerry', 'Alan Turing', "O'Brien", 'Edsger Dijkstra', 'Barbara Liskov', '<script>'];
const template = 'Hello {user.name}, you have {count} new messages from {sender} ({user.email}).';
const values = { user: { name: 'Ada', email: 'ada@example.com' }, count: 3, sender: 'Bob' };

export default [
	{
		name: 'toCamelCase (8 identifiers)',
		fn: function () {
			return identifiers.map(toCamelCase);
		}
	},
	{
		name: 'toSnakeCase (8 identifiers)',
		fn: function () {
			return identifiers.map(toSnakeCase);
		}
	},
	{
		name: 'toKebabCase (8 identifiers)',
		fn: function () {
			return identifiers.map(toKebabCase);
		}
	},
	{
		name: 'toSlug (4 titles)',
		fn: function () {
			return titles.map(toSlug);
		}
	},
	{
		name: 'levenshtein (2 x 40 chars)',
		fn: function () {
			return levenshtein('the quick brown fox jumps over a lazy dog', 'a quick brown dog leaps over the lazy fox');
		}
	},
	{
		name: 'similarity (short words)',
		fn: function () {
			return similarity('kitten', 'sitting') + similarity('flaw', 'lawn');
		}
	},
	{
		name: 'escapeHtml (1 KB)',
		fn: function () {
			return escapeHtml(html);
		}
	},
	{
		name: 'unescapeHtml (1.6 KB)',
		fn: function () {
			return unescapeHtml(escaped);
		}
	},
	{
		name: 'escapeHtml (800 B, nothing to escape)',
		fn: function () {
			return escapeHtml(plain);
		}
	},
	{
		name: 'escapeHtml (8 short strings)',
		fn: function () {
			return names.map(escapeHtml);
		}
	},
	{
		name: 'unescapeHtml (8 short strings)',
		fn: function () {
			return names.map(unescapeHtml);
		}
	},
	{
		name: 'reverse (12 chars)',
		fn: function () {
			return reverse('hello, world');
		}
	},
	{
		name: 'truncate (800 chars to 20)',
		fn: function () {
			return truncate(plain, 20);
		}
	},
	{
		name: 'interpolate (4 placeholders)',
		fn: function () {
			return interpolate(template, values);
		}
	},
	{
		name: 'getWords (640 chars)',
		fn: function () {
			return getWords(paragraph);
		}
	}
];
