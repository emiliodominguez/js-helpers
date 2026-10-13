import fc from 'fast-check';
import * as helpers from '.';

const dateArb = fc.date({ min: new Date(1900, 0, 1), max: new Date(2200, 0, 1), noInvalidDate: true });
const weekdayArb = fc.integer({ min: 0, max: 6 }) as fc.Arbitrary<helpers.WeekdayIndex>;

/**
 * Local time-of-day components.
 */
function timeOfDay(date: Date): number[] {
	return [date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()];
}

/**
 * Local calendar components.
 */
function ymd(date: Date): number[] {
	return [date.getFullYear(), date.getMonth(), date.getDate()];
}

/**
 * Zero-pads a number to two digits.
 */
function p2(n: number): string {
	return String(n).padStart(2, '0');
}

describe('Date helpers (properties)', function () {
	it('addDays(addDays(d, n), -n) restores the calendar day and time of day', function () {
		fc.assert(
			fc.property(dateArb, fc.integer({ min: -100_000, max: 100_000 }), function (date, n) {
				const moved = helpers.addDays(date, n);

				// Skip the rare case where the wall-clock time does not exist on the target day (DST gap).
				fc.pre(timeOfDay(moved).join() === timeOfDay(date).join());

				const back = helpers.addDays(moved, -n);

				expect(ymd(back)).toEqual(ymd(date));
				expect(timeOfDay(back)).toEqual(timeOfDay(date));
			})
		);
	});

	it('diffInDays(addDays(d, n), d) === n', function () {
		fc.assert(
			fc.property(dateArb, fc.integer({ min: -100_000, max: 100_000 }), function (date, n) {
				expect(helpers.diffInDays(helpers.addDays(date, n), date)).toBe(n);
				expect(helpers.diffInDays(date, helpers.addDays(date, n))).toBe(0 - n);
			})
		);
	});

	it('diffInDays is consistent with addWeeks', function () {
		fc.assert(
			fc.property(dateArb, fc.integer({ min: -10_000, max: 10_000 }), function (date, n) {
				expect(helpers.diffInDays(helpers.addWeeks(date, n), date)).toBe(7 * n);
			})
		);
	});

	it('addMonths lands in the expected month, clamping the day', function () {
		fc.assert(
			fc.property(dateArb, fc.integer({ min: -2400, max: 2400 }), function (date, n) {
				const result = helpers.addMonths(date, n);
				const total = date.getMonth() + n;
				const expectedYear = date.getFullYear() + Math.floor(total / 12);
				const expectedMonth = ((total % 12) + 12) % 12;

				expect(result.getFullYear()).toBe(expectedYear);
				expect(result.getMonth()).toBe(expectedMonth);
				expect(result.getDate()).toBeLessThanOrEqual(date.getDate());
				expect(result.getDate()).toBe(Math.min(date.getDate(), helpers.daysInMonth(expectedYear, expectedMonth)));
			})
		);
	});

	it('addYears(d, n) equals addMonths(d, 12n)', function () {
		fc.assert(
			fc.property(dateArb, fc.integer({ min: -200, max: 200 }), function (date, n) {
				expect(helpers.addYears(date, n).getTime()).toBe(helpers.addMonths(date, 12 * n).getTime());
			})
		);
	});

	it('diffInMonths counts complete months: addMonths(e, k) <= l < addMonths(e, k + 1)', function () {
		fc.assert(
			fc.property(dateArb, dateArb, function (a, b) {
				const later = a.getTime() >= b.getTime() ? a : b;
				const earlier = later === a ? b : a;
				const k = helpers.diffInMonths(later, earlier);

				expect(k).toBeGreaterThanOrEqual(0);
				expect(helpers.addMonths(earlier, k).getTime()).toBeLessThanOrEqual(later.getTime());
				expect(helpers.addMonths(earlier, k + 1).getTime()).toBeGreaterThan(later.getTime());
				expect(helpers.diffInMonths(earlier, later) + k).toBe(0);
			})
		);
	});

	it('absolute arithmetic round-trips through the diff functions', function () {
		fc.assert(
			fc.property(dateArb, fc.integer({ min: -1_000_000, max: 1_000_000 }), function (date, n) {
				expect(helpers.diffInSeconds(helpers.addSeconds(date, n), date)).toBe(n);
				expect(helpers.diffInMinutes(helpers.addMinutes(date, n), date)).toBe(n);
				expect(helpers.diffInHours(helpers.addHours(date, n), date)).toBe(n);
				expect(helpers.addMilliseconds(date, n).getTime() - date.getTime()).toBe(n);
			})
		);
	});

	it('diffInSeconds/Minutes/Hours truncate the millisecond delta toward zero', function () {
		fc.assert(
			fc.property(dateArb, dateArb, function (a, b) {
				const delta = a.getTime() - b.getTime();

				expect(helpers.diffInSeconds(a, b)).toBe(Math.trunc(delta / 1000) + 0);
				expect(helpers.diffInMinutes(a, b)).toBe(Math.trunc(delta / 60_000) + 0);
				expect(helpers.diffInHours(a, b)).toBe(Math.trunc(delta / 3_600_000) + 0);
			})
		);
	});

	it('startOfDay <= d <= endOfDay, both on the same day, startOfDay idempotent', function () {
		fc.assert(
			fc.property(dateArb, function (date) {
				const start = helpers.startOfDay(date);
				const end = helpers.endOfDay(date);

				expect(start.getTime()).toBeLessThanOrEqual(date.getTime());
				expect(end.getTime()).toBeGreaterThanOrEqual(date.getTime());
				expect(helpers.isSameDay(start, date)).toBe(true);
				expect(helpers.isSameDay(end, date)).toBe(true);
				expect(helpers.startOfDay(start).getTime()).toBe(start.getTime());
				expect(helpers.endOfDay(end).getTime()).toBe(end.getTime());
			})
		);
	});

	it('startOfMonth / endOfMonth / startOfYear / endOfYear bracket the date', function () {
		fc.assert(
			fc.property(dateArb, function (date) {
				const time = date.getTime();
				const sm = helpers.startOfMonth(date);
				const em = helpers.endOfMonth(date);
				const sy = helpers.startOfYear(date);
				const ey = helpers.endOfYear(date);

				expect(sm.getTime()).toBeLessThanOrEqual(time);
				expect(em.getTime()).toBeGreaterThanOrEqual(time);
				expect(sm.getDate()).toBe(1);
				expect(em.getDate()).toBe(helpers.getDaysInMonth(date));
				expect(helpers.isSameMonth(sm, date) && helpers.isSameMonth(em, date)).toBe(true);
				expect(sy.getTime()).toBeLessThanOrEqual(sm.getTime());
				expect(ey.getTime()).toBeGreaterThanOrEqual(em.getTime());
				expect(ymd(sy)).toEqual([date.getFullYear(), 0, 1]);
				expect(ymd(ey)).toEqual([date.getFullYear(), 11, 31]);
			})
		);
	});

	it('startOfWeek is the right weekday, <= d and less than 7 days before; endOfWeek is 6 days later', function () {
		fc.assert(
			fc.property(dateArb, weekdayArb, function (date, weekStartsOn) {
				const start = helpers.startOfWeek(date, weekStartsOn);
				const end = helpers.endOfWeek(date, weekStartsOn);
				const diff = helpers.diffInDays(date, start);

				expect(start.getDay()).toBe(weekStartsOn);
				expect(start.getTime()).toBeLessThanOrEqual(date.getTime());
				expect(diff).toBeGreaterThanOrEqual(0);
				expect(diff).toBeLessThan(7);
				expect(helpers.diffInDays(end, start)).toBe(6);
				expect(end.getTime()).toBeGreaterThanOrEqual(date.getTime());
			})
		);
	});

	it('formatDate(d, "YYYY-MM-DD") === toISODateString(d) and parseISODate round-trips', function () {
		fc.assert(
			fc.property(dateArb, function (date) {
				const iso = helpers.toISODateString(date);

				expect(helpers.formatDate(date, 'YYYY-MM-DD')).toBe(iso);
				expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);

				const parsed = helpers.parseISODate(iso);

				expect(parsed).toBeDefined();
				expect(helpers.isSameDay(parsed as Date, date)).toBe(true);
				expect(helpers.toISODateString(parsed as Date)).toBe(iso);
			})
		);
	});

	it('formatDate agrees with a naive reference for every numeric token', function () {
		fc.assert(
			fc.property(dateArb, function (date) {
				const h12 = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
				const expected = [
					String(date.getFullYear()),
					p2(date.getMonth() + 1),
					p2(date.getDate()),
					p2(date.getHours()),
					p2(h12),
					p2(date.getMinutes()),
					p2(date.getSeconds()),
					String(date.getMilliseconds()).padStart(3, '0'),
					date.getHours() < 12 ? 'AM' : 'PM'
				].join('|');

				expect(helpers.formatDate(date, 'YYYY|MM|DD|HH|hh|mm|ss|SSS|A')).toBe(expected);
			})
		);
	});

	it('bracketed text is output verbatim', function () {
		fc.assert(
			fc.property(dateArb, fc.string({ unit: 'grapheme' }), function (date, text) {
				fc.pre(!text.includes(']'));
				expect(helpers.formatDate(date, `[${text}]`)).toBe(text);
			})
		);
	});

	it('parseISODate accepts exactly the valid calendar dates', function () {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 99 }), function (year, month, day) {
				const text = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
				const valid = month >= 1 && month <= 12 && day >= 1 && day <= helpers.daysInMonth(year, month - 1);
				const parsed = helpers.parseISODate(text);

				expect(parsed !== undefined).toBe(valid);
				if (parsed !== undefined) expect(ymd(parsed)).toEqual([year, month - 1, day]);
			})
		);
	});

	it('compareAsc is antisymmetric, consistent with getTime, and sorts', function () {
		fc.assert(
			fc.property(dateArb, dateArb, fc.array(dateArb), function (a, b, list) {
				const result = helpers.compareAsc(a, b);

				expect(result + helpers.compareAsc(b, a)).toBe(0);
				expect(result).toBe(Math.sign(a.getTime() - b.getTime()) + 0);
				expect(helpers.compareDesc(a, b)).toBe(helpers.compareAsc(b, a));

				const sorted = list.slice().sort(helpers.compareAsc);

				for (let i = 1; i < sorted.length; i++) {
					expect(sorted[i - 1].getTime()).toBeLessThanOrEqual(sorted[i].getTime());
				}
			})
		);
	});

	it('minDate / maxDate match Math.min / Math.max over timestamps', function () {
		fc.assert(
			fc.property(fc.array(dateArb, { minLength: 1 }), function (list) {
				const times = list.map(function (d) {
					return d.getTime();
				});

				expect(helpers.minDate(list)?.getTime()).toBe(Math.min(...times));
				expect(helpers.maxDate(list)?.getTime()).toBe(Math.max(...times));
			})
		);
	});

	it('isBetween("[]") matches !isBefore(start) && !isAfter(end); exclusive variants are subsets', function () {
		fc.assert(
			fc.property(dateArb, dateArb, dateArb, function (date, x, y) {
				const start = x.getTime() <= y.getTime() ? x : y;
				const end = start === x ? y : x;
				const inclusive = helpers.isBetween(date, start, end);

				expect(inclusive).toBe(!helpers.isBefore(date, start) && !helpers.isAfter(date, end));
				(['()', '[)', '(]'] as const).forEach(function (inclusivity) {
					if (helpers.isBetween(date, start, end, inclusivity)) expect(inclusive).toBe(true);
				});
			})
		);
	});

	it('isLeapYear agrees with daysInMonth and the native Date', function () {
		fc.assert(
			fc.property(fc.integer({ min: 100, max: 100_000 }), function (year) {
				expect(helpers.isLeapYear(year)).toBe(helpers.daysInMonth(year, 1) === 29);
				expect(helpers.isLeapYear(year)).toBe(new Date(year, 1, 29).getMonth() === 1);
			})
		);
	});

	it('daysInMonth agrees with the native Date', function () {
		fc.assert(
			fc.property(fc.integer({ min: 100, max: 100_000 }), fc.integer({ min: 0, max: 11 }), function (year, month) {
				expect(helpers.daysInMonth(year, month)).toBe(new Date(year, month + 1, 0).getDate());
			})
		);
	});

	it('never mutates its inputs', function () {
		fc.assert(
			fc.property(dateArb, dateArb, fc.integer({ min: -1000, max: 1000 }), weekdayArb, function (a, b, n, w) {
				const timeA = a.getTime();
				const timeB = b.getTime();

				helpers.addDays(a, n);
				helpers.addWeeks(a, n);
				helpers.addMonths(a, n);
				helpers.addYears(a, n);
				helpers.addHours(a, n);
				helpers.addMinutes(a, n);
				helpers.addSeconds(a, n);
				helpers.addMilliseconds(a, n);
				helpers.diffInDays(a, b);
				helpers.diffInMonths(a, b);
				helpers.diffInMonths(b, a);
				helpers.diffInHours(a, b);
				helpers.startOfDay(a);
				helpers.endOfDay(a);
				helpers.startOfMonth(a);
				helpers.endOfMonth(a);
				helpers.startOfWeek(a, w);
				helpers.endOfWeek(a, w);
				helpers.startOfYear(a);
				helpers.endOfYear(a);
				helpers.isSameDay(a, b);
				helpers.compareAsc(a, b);
				helpers.minDate([a, b]);
				helpers.maxDate([a, b]);
				helpers.formatDate(a, 'YYYY-MM-DD HH:mm:ss.SSS A');
				helpers.getRelativeTime(a, b);

				expect(a.getTime()).toBe(timeA);
				expect(b.getTime()).toBe(timeB);
			})
		);
	});
});
