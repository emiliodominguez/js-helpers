import { formatCompact, formatCurrency, formatDateTime, formatList, formatNumber, formatOrdinal, formatPercent, pluralRule } from '@emiliodominguez/js-helpers/format';

const instant = Date.UTC(2024, 0, 15, 13, 45);
const items = ['apples', 'bananas', 'cherries'];

export default [
	{
		name: 'formatNumber (no options)',
		fn: function () {
			return formatNumber(1234567.891);
		},
		baseline: (function () {
			const formatter = new Intl.NumberFormat('en-US');
			return function () {
				return formatter.format(1234567.891);
			};
		})()
	},
	{
		name: 'formatNumber (locale + 1 option)',
		fn: function () {
			return formatNumber(1234.5, { locale: 'de-DE', minimumFractionDigits: 2 });
		}
	},
	{
		name: 'formatCurrency (USD)',
		fn: function () {
			return formatCurrency(1234.5, 'USD');
		}
	},
	{
		name: 'formatPercent (decimals: 1)',
		fn: function () {
			return formatPercent(0.256, { decimals: 1 });
		}
	},
	{
		name: 'formatCompact (no options)',
		fn: function () {
			return formatCompact(3_400_000);
		}
	},
	{
		name: 'formatDateTime (no options)',
		fn: function () {
			return formatDateTime(instant);
		}
	},
	{
		name: 'formatDateTime (dateStyle)',
		fn: function () {
			return formatDateTime(instant, { dateStyle: 'medium' });
		}
	},
	{
		name: 'formatList (3 items)',
		fn: function () {
			return formatList(items);
		}
	},
	{
		name: 'formatOrdinal',
		fn: function () {
			return formatOrdinal(22);
		}
	},
	{
		name: 'pluralRule',
		fn: function () {
			return pluralRule(2);
		}
	}
];
