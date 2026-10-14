import {
	addBusinessDays,
	addDays,
	addMonths,
	diffInDays,
	diffInMonths,
	eachDayOfInterval,
	formatDate,
	formatDuration,
	getISOWeek,
	getRelativeTime,
	parseDuration,
	parseISODate,
	startOfWeek,
	toISODateString
} from '@emiliodominguez/js-helpers/date';

// 100 deterministic dates spread over several years (local time).
const dates = Array.from({ length: 100 }, function (_, index) {
	return new Date(2020 + (index % 7), index % 12, (index % 28) + 1, index % 24, (index * 7) % 60, (index * 13) % 60, index * 9);
});
const isoStrings = dates.map(function (date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
});
const durations = dates.map(function (date) {
	return date.getTime() % 1_000_000_000;
});
const durationStrings = durations.map(function (ms, index) {
	return `${index}d ${ms % 24}h ${ms % 60}m ${(ms % 600) / 10}s`;
});

/**
 * Runs `fn` on every sample date and returns a checksum so the work cannot be optimized away.
 * @param {(date: Date, index: number) => number} fn - The work to do for one date
 * @returns {number} The checksum
 */
function each(fn) {
	let total = 0;
	for (let i = 0; i < dates.length; i++) total += fn(dates[i], i);
	return total;
}

export default [
	{
		name: "formatDate (100 × 'YYYY-MM-DD HH:mm:ss.SSS')",
		fn: function () {
			return each(function (date) {
				return formatDate(date, 'YYYY-MM-DD HH:mm:ss.SSS').length;
			});
		}
	},
	{
		name: "formatDate (100 × 'D/M/YY h:mm A [at]')",
		fn: function () {
			return each(function (date) {
				return formatDate(date, 'D/M/YY h:mm A [at]').length;
			});
		}
	},
	{
		name: 'toISODateString (100)',
		fn: function () {
			return each(function (date) {
				return toISODateString(date).length;
			});
		}
	},
	{
		name: 'parseISODate (100)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < isoStrings.length; i++) total += parseISODate(isoStrings[i]).getTime();
			return total;
		}
	},
	{
		name: 'addDays (100)',
		fn: function () {
			return each(function (date, index) {
				return addDays(date, index - 50).getTime();
			});
		}
	},
	{
		name: 'addMonths (100)',
		fn: function () {
			return each(function (date, index) {
				return addMonths(date, index - 50).getTime();
			});
		}
	},
	{
		name: 'addBusinessDays (100)',
		fn: function () {
			return each(function (date, index) {
				return addBusinessDays(date, index - 50).getTime();
			});
		}
	},
	{
		name: 'diffInDays (100)',
		fn: function () {
			return each(function (date, index) {
				return diffInDays(date, dates[99 - index]);
			});
		}
	},
	{
		name: 'diffInMonths (100)',
		fn: function () {
			return each(function (date, index) {
				return diffInMonths(date, dates[99 - index]);
			});
		}
	},
	{
		name: 'startOfWeek (100)',
		fn: function () {
			return each(function (date) {
				return startOfWeek(date, 1).getTime();
			});
		}
	},
	{
		name: 'getISOWeek (100)',
		fn: function () {
			return each(function (date) {
				return getISOWeek(date);
			});
		}
	},
	{
		name: 'getRelativeTime (100)',
		fn: function () {
			return each(function (date, index) {
				return getRelativeTime(date, dates[99 - index]).length;
			});
		}
	},
	{
		name: 'eachDayOfInterval (1 year)',
		fn: function () {
			return eachDayOfInterval(dates[0], dates[12]);
		}
	},
	{
		name: 'formatDuration (100)',
		fn: function () {
			let length = 0;
			for (let i = 0; i < durations.length; i++) length += formatDuration(durations[i]).length;
			return length;
		}
	},
	{
		name: 'parseDuration (100)',
		fn: function () {
			let total = 0;
			for (let i = 0; i < durationStrings.length; i++) total += parseDuration(durationStrings[i]);
			return total;
		}
	}
];
