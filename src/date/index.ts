/**
 * Date helpers.
 *
 * Conventions shared by every function in this module:
 * - **Local time.** All calendar fields (year, month, day, weekday, hours…) are read and written in the
 *   runtime's LOCAL time zone, exactly like `Date#getDate()` / `Date#setDate()`. Nothing here uses UTC
 *   unless its name says so.
 * - **Pure.** Inputs are never mutated; every function that returns a date returns a NEW `Date` instance.
 * - **Inputs.** Every date parameter accepts a {@link DateInput}: a `Date` or a millisecond timestamp.
 * - **Invalid dates.** Every function except {@link isValidDate} throws `RangeError('Invalid date')` when
 *   given an invalid date (`new Date(NaN)`, `NaN`, `Infinity`…), and `TypeError` when given something that is
 *   neither a `Date` nor a number.
 * - **DST safety.** Calendar arithmetic (`addDays`, `addMonths`, `startOfWeek`…) works on local calendar fields,
 *   so "one day later" keeps the wall-clock time even across a daylight-saving transition (the day may then last
 *   23 or 25 hours). Calendar-day differences are computed from the local calendar fields, never by dividing a
 *   millisecond delta by 86 400 000. When a wall-clock time does not exist on the target day (it falls inside a
 *   DST gap), the engine moves it forward by the size of the gap.
 * - **Absolute arithmetic.** `addHours`, `addMinutes`, `addSeconds`, `addMilliseconds` and `diffInHours` & co.
 *   work on the absolute timeline (milliseconds), so `addHours(date, 24)` is not always the same as `addDays(date, 1)`.
 */

/**
 * A value that can be interpreted as a date: a `Date` instance or a millisecond timestamp.
 */
export type DateInput = Date | number;

/**
 * Index of a day of the week, `0` (Sunday) to `6` (Saturday), as returned by `Date#getDay()`.
 */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Bound inclusivity for {@link isBetween}: `[` / `]` include the bound, `(` / `)` exclude it.
 */
export type BetweenInclusivity = '[]' | '()' | '[)' | '(]';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const DAYS_PER_MONTH: ReadonlyArray<number> = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const INCLUSIVITIES: ReadonlyArray<string> = ['[]', '()', '[)', '(]'];

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Single tokenizing regex used by {@link formatDate}. Alternatives are ordered longest-first so that e.g. `YYYY`
 * wins over `YY` and `MM` over `M`. A `[...]` group captures literal text.
 */
const FORMAT_TOKEN_REGEX = /\[([^\]]*)]|YYYY|YY|SSS|MM|M|DD|D|HH|H|hh|h|mm|m|ss|s|A|a/g;

/**
 * Left-pads the absolute value of an integer with zeros, keeping a leading minus sign for negatives.
 * @param {number} value - The integer to pad
 * @param {number} length - The minimum number of digits
 * @returns {string} The padded string
 * @example
 * pad(7, 2); // '07'
 */
function pad(value: number, length: number): string {
	const digits = String(Math.abs(value)).padStart(length, '0');

	return value < 0 ? `-${digits}` : digits;
}

/**
 * Converts a 24-hour clock hour to a 12-hour clock hour (`0` → `12`, `13` → `1`).
 * @param {number} hours - The hour, 0-23
 * @returns {number} The hour, 1-12
 * @example
 * to12Hour(0); // 12
 */
function to12Hour(hours: number): number {
	return hours % 12 === 0 ? 12 : hours % 12;
}

/**
 * Token formatters for {@link formatDate}, keyed by token.
 */
const FORMATTERS: Readonly<Record<string, (date: Date) => string>> = {
	YYYY: function (date: Date): string {
		return pad(date.getFullYear(), 4);
	},
	YY: function (date: Date): string {
		return pad(Math.abs(date.getFullYear()) % 100, 2);
	},
	MM: function (date: Date): string {
		return pad(date.getMonth() + 1, 2);
	},
	M: function (date: Date): string {
		return String(date.getMonth() + 1);
	},
	DD: function (date: Date): string {
		return pad(date.getDate(), 2);
	},
	D: function (date: Date): string {
		return String(date.getDate());
	},
	HH: function (date: Date): string {
		return pad(date.getHours(), 2);
	},
	H: function (date: Date): string {
		return String(date.getHours());
	},
	hh: function (date: Date): string {
		return pad(to12Hour(date.getHours()), 2);
	},
	h: function (date: Date): string {
		return String(to12Hour(date.getHours()));
	},
	mm: function (date: Date): string {
		return pad(date.getMinutes(), 2);
	},
	m: function (date: Date): string {
		return String(date.getMinutes());
	},
	ss: function (date: Date): string {
		return pad(date.getSeconds(), 2);
	},
	s: function (date: Date): string {
		return String(date.getSeconds());
	},
	SSS: function (date: Date): string {
		return pad(date.getMilliseconds(), 3);
	},
	A: function (date: Date): string {
		return date.getHours() < 12 ? 'AM' : 'PM';
	},
	a: function (date: Date): string {
		return date.getHours() < 12 ? 'am' : 'pm';
	}
};

/**
 * Converts a {@link DateInput} into a fresh, valid `Date` copy.
 * @param {DateInput} input - The date or timestamp
 * @returns {Date} A new `Date` instance
 * @throws {TypeError} when `input` is neither a `Date` nor a number
 * @throws {RangeError} when `input` is an invalid date
 * @example
 * toValidDate(0); // 1970-01-01T00:00:00.000Z
 */
function toValidDate(input: DateInput): Date {
	if (!(input instanceof Date) && typeof input !== 'number') {
		throw new TypeError('Expected a Date or a timestamp number');
	}

	const date = new Date(input instanceof Date ? input.getTime() : input);

	if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date');

	return date;
}

/**
 * Returns the millisecond timestamp of a valid {@link DateInput}.
 * @param {DateInput} input - The date or timestamp
 * @returns {number} The timestamp in milliseconds
 * @throws {TypeError} when `input` is neither a `Date` nor a number
 * @throws {RangeError} when `input` is an invalid date
 * @example
 * timeOf(new Date(5)); // 5
 */
function timeOf(input: DateInput): number {
	return toValidDate(input).getTime();
}

/**
 * Throws when an arithmetic result fell outside the representable `Date` range.
 * @param {Date} date - The computed date
 * @returns {Date} The same date, when valid
 * @throws {RangeError} when the date is invalid (out of range)
 * @example
 * ensureInRange(new Date(0)); // returns the date
 */
function ensureInRange(date: Date): Date {
	if (Number.isNaN(date.getTime())) throw new RangeError('Resulting date is out of range');

	return date;
}

/**
 * Asserts that a calendar amount is an integer.
 * @param {number} amount - The amount to check
 * @param {string} name - The parameter name, used in the error message
 * @returns {void}
 * @throws {RangeError} when `amount` is not an integer
 * @example
 * assertInteger(3, 'amount'); // ok
 */
function assertInteger(amount: number, name: string): void {
	if (!Number.isInteger(amount)) throw new RangeError(`${name} must be an integer, received ${String(amount)}`);
}

/**
 * Asserts that a time amount is a finite number.
 * @param {number} amount - The amount to check
 * @returns {void}
 * @throws {RangeError} when `amount` is not a finite number
 * @example
 * assertFinite(1.5); // ok
 */
function assertFinite(amount: number): void {
	if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new RangeError(`amount must be a finite number, received ${String(amount)}`);
}

/**
 * Asserts that a value is a valid weekday index (integer 0-6).
 * @param {number} weekStartsOn - The value to check
 * @returns {void}
 * @throws {RangeError} when the value is not an integer between 0 and 6
 * @example
 * assertWeekday(1); // ok
 */
function assertWeekday(weekStartsOn: number): void {
	if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
		throw new RangeError(`weekStartsOn must be an integer between 0 and 6, received ${String(weekStartsOn)}`);
	}
}

/**
 * Returns the number of whole days between the Unix epoch and the given LOCAL calendar date, using UTC so that
 * the result is unaffected by daylight-saving transitions.
 * @param {Date} date - A valid date
 * @returns {number} The epoch day number of the local calendar date
 * @example
 * epochDay(new Date(1970, 0, 2)); // 1
 */
function epochDay(date: Date): number {
	const utc = new Date(0);

	// setUTCFullYear (unlike Date.UTC) does not remap years 0-99 to 1900-1999.
	utc.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());

	return utc.getTime() / MS_PER_DAY;
}

/**
 * Returns the number of calendar months from `earlier` to `later`, ignoring the day and time.
 * @param {Date} later - A valid date
 * @param {Date} earlier - A valid date
 * @returns {number} `12 * yearDelta + monthDelta`
 * @example
 * calendarMonthDiff(new Date(2024, 0, 1), new Date(2023, 11, 31)); // 1
 */
function calendarMonthDiff(later: Date, earlier: Date): number {
	return (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth());
}

/**
 * Truncates toward zero, normalizing `-0` to `0`.
 * @param {number} value - The value to truncate
 * @returns {number} The truncated value
 * @example
 * truncate(-0.5); // 0
 */
function truncate(value: number): number {
	return Math.trunc(value) + 0;
}

/**
 * Returns the last millisecond of the local day of `date` (normally 23:59:59.999), computed as the start of the
 * next local day minus 1 ms so that it is correct even when the clock is set back around midnight.
 * @param {Date} date - A valid date (not mutated)
 * @returns {Date} A new date at the end of the local day
 * @throws {RangeError} when the end of the day is outside the representable range
 * @example
 * lastInstantOfDay(new Date(2024, 0, 1, 12)); // 2024-01-01 23:59:59.999 (local)
 */
function lastInstantOfDay(date: Date): Date {
	const nextDay = new Date(date.getTime());

	nextDay.setDate(nextDay.getDate() + 1);
	nextDay.setHours(0, 0, 0, 0);

	return ensureInRange(new Date(nextDay.getTime() - 1));
}

/**
 * Checks whether a value is a `Date` instance holding a valid time (i.e. not `new Date(NaN)`).
 * @param {unknown} value - The value to check
 * @returns {boolean} `true` when `value` is a valid `Date`
 * @example
 * isValidDate(new Date()); // true
 * isValidDate(new Date('nope')); // false
 * isValidDate(Date.now()); // false (a number, not a Date)
 */
export function isValidDate(value: unknown): value is Date {
	return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Adds a number of calendar days (local time). The wall-clock time is preserved, even across DST transitions.
 * @param {DateInput} date - The date to start from
 * @param {number} amount - The integer number of days to add (negative to subtract)
 * @returns {Date} A new date
 * @throws {RangeError} when `date` is invalid, `amount` is not an integer, or the result is out of range
 * @example
 * addDays(new Date(2024, 0, 31), 1); // 2024-02-01 (local), same time of day
 */
export function addDays(date: DateInput, amount: number): Date {
	assertInteger(amount, 'amount');

	const result = toValidDate(date);

	result.setDate(result.getDate() + amount);

	return ensureInRange(result);
}

/**
 * Adds a number of weeks (7 calendar days each, local time).
 * @param {DateInput} date - The date to start from
 * @param {number} amount - The integer number of weeks to add (negative to subtract)
 * @returns {Date} A new date
 * @throws {RangeError} when `date` is invalid, `amount` is not an integer, or the result is out of range
 * @example
 * addWeeks(new Date(2024, 0, 1), 2); // 2024-01-15 (local)
 */
export function addWeeks(date: DateInput, amount: number): Date {
	assertInteger(amount, 'amount');

	return addDays(date, amount * 7);
}

/**
 * Adds a number of calendar months (local time). When the original day does not exist in the target month the
 * result is clamped to that month's last day. The time of day is preserved.
 * @param {DateInput} date - The date to start from
 * @param {number} amount - The integer number of months to add (negative to subtract)
 * @returns {Date} A new date
 * @throws {RangeError} when `date` is invalid, `amount` is not an integer, or the result is out of range
 * @example
 * addMonths(new Date(2023, 0, 31), 1); // 2023-02-28 (local)
 * addMonths(new Date(2024, 0, 31), 1); // 2024-02-29 (local)
 */
export function addMonths(date: DateInput, amount: number): Date {
	assertInteger(amount, 'amount');

	const result = toValidDate(date);
	const totalMonths = result.getMonth() + amount;
	const year = result.getFullYear() + Math.floor(totalMonths / 12);
	const month = ((totalMonths % 12) + 12) % 12;

	result.setFullYear(year, month, Math.min(result.getDate(), daysInMonth(year, month)));

	return ensureInRange(result);
}

/**
 * Adds a number of calendar years (local time). February 29th is clamped to February 28th in non-leap years.
 * @param {DateInput} date - The date to start from
 * @param {number} amount - The integer number of years to add (negative to subtract)
 * @returns {Date} A new date
 * @throws {RangeError} when `date` is invalid, `amount` is not an integer, or the result is out of range
 * @example
 * addYears(new Date(2024, 1, 29), 1); // 2025-02-28 (local)
 */
export function addYears(date: DateInput, amount: number): Date {
	assertInteger(amount, 'amount');

	return addMonths(date, amount * 12);
}

/**
 * Adds an absolute number of hours (3 600 000 ms each); unlike {@link addDays}, this is not wall-clock based.
 * @param {DateInput} date - The date to start from
 * @param {number} amount - The finite number of hours to add (may be fractional or negative)
 * @returns {Date} A new date
 * @throws {RangeError} when `date` is invalid, `amount` is not finite, or the result is out of range
 * @example
 * addHours(new Date(Date.UTC(2024, 0, 1)), 2).toISOString(); // '2024-01-01T02:00:00.000Z'
 */
export function addHours(date: DateInput, amount: number): Date {
	assertFinite(amount);

	return addMilliseconds(date, amount * MS_PER_HOUR);
}

/**
 * Adds an absolute number of minutes.
 * @param {DateInput} date - The date to start from
 * @param {number} amount - The finite number of minutes to add (may be fractional or negative)
 * @returns {Date} A new date
 * @throws {RangeError} when `date` is invalid, `amount` is not finite, or the result is out of range
 * @example
 * addMinutes(new Date(Date.UTC(2024, 0, 1)), 90).toISOString(); // '2024-01-01T01:30:00.000Z'
 */
export function addMinutes(date: DateInput, amount: number): Date {
	assertFinite(amount);

	return addMilliseconds(date, amount * MS_PER_MINUTE);
}

/**
 * Adds an absolute number of seconds.
 * @param {DateInput} date - The date to start from
 * @param {number} amount - The finite number of seconds to add (may be fractional or negative)
 * @returns {Date} A new date
 * @throws {RangeError} when `date` is invalid, `amount` is not finite, or the result is out of range
 * @example
 * addSeconds(new Date(0), 1.5).getTime(); // 1500
 */
export function addSeconds(date: DateInput, amount: number): Date {
	assertFinite(amount);

	return addMilliseconds(date, amount * MS_PER_SECOND);
}

/**
 * Adds an absolute number of milliseconds. Fractional results are truncated by the `Date` constructor.
 * @param {DateInput} date - The date to start from
 * @param {number} amount - The finite number of milliseconds to add (negative to subtract)
 * @returns {Date} A new date
 * @throws {RangeError} when `date` is invalid, `amount` is not finite, or the result is out of range
 * @example
 * addMilliseconds(new Date(0), 250).getTime(); // 250
 */
export function addMilliseconds(date: DateInput, amount: number): Date {
	assertFinite(amount);

	return ensureInRange(new Date(timeOf(date) + amount));
}

/**
 * Returns the signed number of calendar days between two dates (local time), ignoring the time of day:
 * `diffInDays(Jan 2 00:01, Jan 1 23:59) === 1`. DST-safe: a 23- or 25-hour day still counts as one day.
 * @param {DateInput} later - The later date (the result is negative if it is actually earlier)
 * @param {DateInput} earlier - The earlier date
 * @returns {number} `later`'s calendar day minus `earlier`'s calendar day
 * @throws {RangeError} when either date is invalid
 * @example
 * diffInDays(new Date(2024, 2, 1), new Date(2024, 1, 1)); // 29
 * diffInDays(new Date(2024, 0, 1), new Date(2024, 0, 3)); // -2
 */
export function diffInDays(later: DateInput, earlier: DateInput): number {
	return epochDay(toValidDate(later)) - epochDay(toValidDate(earlier));
}

/**
 * Returns the signed number of whole hours between two dates, truncated toward zero (absolute time).
 * @param {DateInput} later - The later date
 * @param {DateInput} earlier - The earlier date
 * @returns {number} The number of whole hours
 * @throws {RangeError} when either date is invalid
 * @example
 * diffInHours(new Date(2024, 0, 1, 10, 59), new Date(2024, 0, 1, 9, 0)); // 1 (when no DST change happens in between)
 */
export function diffInHours(later: DateInput, earlier: DateInput): number {
	return truncate((timeOf(later) - timeOf(earlier)) / MS_PER_HOUR);
}

/**
 * Returns the signed number of whole minutes between two dates, truncated toward zero (absolute time).
 * @param {DateInput} later - The later date
 * @param {DateInput} earlier - The earlier date
 * @returns {number} The number of whole minutes
 * @throws {RangeError} when either date is invalid
 * @example
 * diffInMinutes(150_000, 0); // 2
 */
export function diffInMinutes(later: DateInput, earlier: DateInput): number {
	return truncate((timeOf(later) - timeOf(earlier)) / MS_PER_MINUTE);
}

/**
 * Returns the signed number of whole seconds between two dates, truncated toward zero (absolute time).
 * @param {DateInput} later - The later date
 * @param {DateInput} earlier - The earlier date
 * @returns {number} The number of whole seconds
 * @throws {RangeError} when either date is invalid
 * @example
 * diffInSeconds(0, 2_500); // -2
 */
export function diffInSeconds(later: DateInput, earlier: DateInput): number {
	return truncate((timeOf(later) - timeOf(earlier)) / MS_PER_SECOND);
}

/**
 * Returns the signed number of COMPLETE calendar months between two dates (date-fns `differenceInMonths` semantics):
 * for `later >= earlier` it is the largest `n` such that `addMonths(earlier, n) <= later` (time of day included, with
 * end-of-month clamping, so Jan 31 → Feb 28 counts as one full month); for `later < earlier` it is
 * `-diffInMonths(earlier, later)`.
 * @param {DateInput} later - The later date
 * @param {DateInput} earlier - The earlier date
 * @returns {number} The number of complete months
 * @throws {RangeError} when either date is invalid
 * @example
 * diffInMonths(new Date(2024, 2, 14), new Date(2024, 0, 15)); // 1
 * diffInMonths(new Date(2023, 1, 28), new Date(2023, 0, 31)); // 1
 */
export function diffInMonths(later: DateInput, earlier: DateInput): number {
	const end = toValidDate(later);
	const start = toValidDate(earlier);

	if (end.getTime() < start.getTime()) return 0 - diffInMonths(start, end);

	const months = calendarMonthDiff(end, start);

	return addMonths(start, months).getTime() > end.getTime() ? months - 1 : months;
}

/**
 * Returns the start of the local day (00:00:00.000).
 * @param {DateInput} date - The date
 * @returns {Date} A new date at the start of the same local day
 * @throws {RangeError} when `date` is invalid
 * @example
 * startOfDay(new Date(2024, 4, 10, 15, 30)); // 2024-05-10 00:00:00.000 (local)
 */
export function startOfDay(date: DateInput): Date {
	const result = toValidDate(date);

	result.setHours(0, 0, 0, 0);

	return result;
}

/**
 * Returns the last millisecond of the local day (23:59:59.999). Computed as the start of the next day minus 1 ms,
 * so it is correct even in zones whose clocks are set back around midnight.
 * @param {DateInput} date - The date
 * @returns {Date} A new date at the end of the same local day
 * @throws {RangeError} when `date` is invalid or the result is outside the representable range
 * @example
 * endOfDay(new Date(2024, 4, 10, 15, 30)); // 2024-05-10 23:59:59.999 (local)
 */
export function endOfDay(date: DateInput): Date {
	return lastInstantOfDay(toValidDate(date));
}

/**
 * Returns the first day of the local month at 00:00:00.000.
 * @param {DateInput} date - The date
 * @returns {Date} A new date at the start of the month
 * @throws {RangeError} when `date` is invalid
 * @example
 * startOfMonth(new Date(2024, 1, 20)); // 2024-02-01 00:00:00.000 (local)
 */
export function startOfMonth(date: DateInput): Date {
	const result = toValidDate(date);

	result.setDate(1);
	result.setHours(0, 0, 0, 0);

	return result;
}

/**
 * Returns the last day of the local month at 23:59:59.999.
 * @param {DateInput} date - The date
 * @returns {Date} A new date at the end of the month
 * @throws {RangeError} when `date` is invalid or the result is outside the representable range
 * @example
 * endOfMonth(new Date(2024, 1, 20)); // 2024-02-29 23:59:59.999 (local)
 */
export function endOfMonth(date: DateInput): Date {
	const result = toValidDate(date);

	result.setDate(daysInMonth(result.getFullYear(), result.getMonth()));

	return lastInstantOfDay(result);
}

/**
 * Returns the start (00:00:00.000, local) of the week containing `date`.
 * @param {DateInput} date - The date
 * @param {WeekdayIndex} [weekStartsOn=0] - The first day of the week: 0 = Sunday … 6 = Saturday
 * @returns {Date} A new date at the start of the week
 * @throws {RangeError} when `date` is invalid or `weekStartsOn` is not an integer between 0 and 6
 * @example
 * startOfWeek(new Date(2024, 4, 15)); // Sun 2024-05-12 00:00 (local)
 * startOfWeek(new Date(2024, 4, 15), 1); // Mon 2024-05-13 00:00 (local)
 */
export function startOfWeek(date: DateInput, weekStartsOn: WeekdayIndex = 0): Date {
	assertWeekday(weekStartsOn);

	const result = toValidDate(date);

	result.setDate(result.getDate() - ((result.getDay() - weekStartsOn + 7) % 7));
	result.setHours(0, 0, 0, 0);

	return result;
}

/**
 * Returns the end (23:59:59.999, local) of the week containing `date`.
 * @param {DateInput} date - The date
 * @param {WeekdayIndex} [weekStartsOn=0] - The first day of the week: 0 = Sunday … 6 = Saturday
 * @returns {Date} A new date at the end of the week
 * @throws {RangeError} when `date` is invalid `weekStartsOn` is not an integer between 0 and 6, or the result is out of range
 * @example
 * endOfWeek(new Date(2024, 4, 15)); // Sat 2024-05-18 23:59:59.999 (local)
 */
export function endOfWeek(date: DateInput, weekStartsOn: WeekdayIndex = 0): Date {
	const result = startOfWeek(date, weekStartsOn);

	result.setDate(result.getDate() + 6);

	return lastInstantOfDay(result);
}

/**
 * Returns January 1st of the local year at 00:00:00.000.
 * @param {DateInput} date - The date
 * @returns {Date} A new date at the start of the year
 * @throws {RangeError} when `date` is invalid
 * @example
 * startOfYear(new Date(2024, 6, 4)); // 2024-01-01 00:00:00.000 (local)
 */
export function startOfYear(date: DateInput): Date {
	const result = toValidDate(date);

	result.setMonth(0, 1);
	result.setHours(0, 0, 0, 0);

	return result;
}

/**
 * Returns December 31st of the local year at 23:59:59.999.
 * @param {DateInput} date - The date
 * @returns {Date} A new date at the end of the year
 * @throws {RangeError} when `date` is invalid or the result is outside the representable range
 * @example
 * endOfYear(new Date(2024, 6, 4)); // 2024-12-31 23:59:59.999 (local)
 */
export function endOfYear(date: DateInput): Date {
	const result = toValidDate(date);

	result.setMonth(11, 31);

	return lastInstantOfDay(result);
}

/**
 * Checks whether two dates fall on the same local calendar day.
 * @param {DateInput} a - The first date
 * @param {DateInput} b - The second date
 * @returns {boolean} `true` when year, month and day match
 * @throws {RangeError} when either date is invalid
 * @example
 * isSameDay(new Date(2024, 0, 1, 0, 0), new Date(2024, 0, 1, 23, 59)); // true
 */
export function isSameDay(a: DateInput, b: DateInput): boolean {
	const left = toValidDate(a);
	const right = toValidDate(b);

	return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

/**
 * Checks whether two dates fall in the same local calendar month (of the same year).
 * @param {DateInput} a - The first date
 * @param {DateInput} b - The second date
 * @returns {boolean} `true` when year and month match
 * @throws {RangeError} when either date is invalid
 * @example
 * isSameMonth(new Date(2024, 0, 1), new Date(2024, 0, 31)); // true
 * isSameMonth(new Date(2024, 0, 1), new Date(2023, 0, 1)); // false
 */
export function isSameMonth(a: DateInput, b: DateInput): boolean {
	const left = toValidDate(a);
	const right = toValidDate(b);

	return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

/**
 * Checks whether two dates fall in the same local calendar year.
 * @param {DateInput} a - The first date
 * @param {DateInput} b - The second date
 * @returns {boolean} `true` when the years match
 * @throws {RangeError} when either date is invalid
 * @example
 * isSameYear(new Date(2024, 0, 1), new Date(2024, 11, 31)); // true
 */
export function isSameYear(a: DateInput, b: DateInput): boolean {
	return toValidDate(a).getFullYear() === toValidDate(b).getFullYear();
}

/**
 * Checks whether a year (or the local year of a date) is a Gregorian leap year.
 * @param {number | Date} yearOrDate - An integer year, or a date
 * @returns {boolean} `true` for leap years
 * @throws {RangeError} when given a non-integer year or an invalid date
 * @example
 * isLeapYear(2024); // true
 * isLeapYear(1900); // false
 * isLeapYear(new Date(2000, 5, 1)); // true
 */
export function isLeapYear(yearOrDate: number | Date): boolean {
	const year = yearOrDate instanceof Date ? toValidDate(yearOrDate).getFullYear() : yearOrDate;

	assertInteger(year, 'year');

	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the number of days in a month.
 * @param {number} year - The integer year
 * @param {number} monthIndex - The zero-based month index (0 = January … 11 = December)
 * @returns {number} 28, 29, 30 or 31
 * @throws {RangeError} when `year` is not an integer or `monthIndex` is not an integer between 0 and 11
 * @example
 * daysInMonth(2024, 1); // 29
 * daysInMonth(2023, 1); // 28
 */
export function daysInMonth(year: number, monthIndex: number): number {
	assertInteger(year, 'year');

	if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
		throw new RangeError(`monthIndex must be an integer between 0 and 11, received ${String(monthIndex)}`);
	}

	return monthIndex === 1 && isLeapYear(year) ? 29 : DAYS_PER_MONTH[monthIndex];
}

/**
 * Returns the number of days in the local month of a date.
 * @param {DateInput} date - The date
 * @returns {number} 28, 29, 30 or 31
 * @throws {RangeError} when `date` is invalid
 * @example
 * getDaysInMonth(new Date(2024, 1, 10)); // 29
 */
export function getDaysInMonth(date: DateInput): number {
	const d = toValidDate(date);

	return daysInMonth(d.getFullYear(), d.getMonth());
}

/**
 * Checks whether a date falls on a Saturday or a Sunday (local time).
 * @param {DateInput} date - The date
 * @returns {boolean} `true` on weekends
 * @throws {RangeError} when `date` is invalid
 * @example
 * isWeekend(new Date(2024, 4, 18)); // true (Saturday)
 */
export function isWeekend(date: DateInput): boolean {
	const day = toValidDate(date).getDay();

	return day === 0 || day === 6;
}

/**
 * Checks whether `a` is strictly before `b`.
 * @param {DateInput} a - The date to check
 * @param {DateInput} b - The date to compare against
 * @returns {boolean} `true` when `a < b`
 * @throws {RangeError} when either date is invalid
 * @example
 * isBefore(new Date(2024, 0, 1), new Date(2024, 0, 2)); // true
 */
export function isBefore(a: DateInput, b: DateInput): boolean {
	return timeOf(a) < timeOf(b);
}

/**
 * Checks whether `a` is strictly after `b`.
 * @param {DateInput} a - The date to check
 * @param {DateInput} b - The date to compare against
 * @returns {boolean} `true` when `a > b`
 * @throws {RangeError} when either date is invalid
 * @example
 * isAfter(new Date(2024, 0, 2), new Date(2024, 0, 1)); // true
 */
export function isAfter(a: DateInput, b: DateInput): boolean {
	return timeOf(a) > timeOf(b);
}

/**
 * Checks whether a date lies within a range.
 * @param {DateInput} date - The date to check
 * @param {DateInput} start - The start of the range
 * @param {DateInput} end - The end of the range (must not be before `start`)
 * @param {BetweenInclusivity} [inclusivity='[]'] - Whether each bound is included (`[`, `]`) or excluded (`(`, `)`)
 * @returns {boolean} `true` when `date` is inside the range
 * @throws {RangeError} when a date is invalid, `start` is after `end`, or `inclusivity` is not one of `'[]' | '()' | '[)' | '(]'`
 * @example
 * isBetween(new Date(2024, 0, 5), new Date(2024, 0, 1), new Date(2024, 0, 10)); // true
 * isBetween(new Date(2024, 0, 10), new Date(2024, 0, 1), new Date(2024, 0, 10), '[)'); // false
 */
export function isBetween(date: DateInput, start: DateInput, end: DateInput, inclusivity: BetweenInclusivity = '[]'): boolean {
	if (!INCLUSIVITIES.includes(inclusivity)) throw new RangeError(`inclusivity must be one of ${INCLUSIVITIES.join(', ')}, received ${String(inclusivity)}`);

	const time = timeOf(date);
	const from = timeOf(start);
	const to = timeOf(end);

	if (from > to) throw new RangeError('start must not be after end');

	const afterStart = inclusivity[0] === '[' ? time >= from : time > from;
	const beforeEnd = inclusivity[1] === ']' ? time <= to : time < to;

	return afterStart && beforeEnd;
}

/**
 * Ascending comparator, usable with `Array#sort`.
 * @param {DateInput} a - The first date
 * @param {DateInput} b - The second date
 * @returns {number} `-1` if `a < b`, `1` if `a > b`, `0` if equal
 * @throws {RangeError} when either date is invalid
 * @example
 * [new Date(2024, 1, 1), new Date(2023, 1, 1)].sort(compareAsc); // [2023-02-01, 2024-02-01]
 */
export function compareAsc(a: DateInput, b: DateInput): -1 | 0 | 1 {
	const left = timeOf(a);
	const right = timeOf(b);

	if (left < right) return -1;

	return left > right ? 1 : 0;
}

/**
 * Descending comparator, usable with `Array#sort`.
 * @param {DateInput} a - The first date
 * @param {DateInput} b - The second date
 * @returns {number} `1` if `a < b`, `-1` if `a > b`, `0` if equal
 * @throws {RangeError} when either date is invalid
 * @example
 * [new Date(2023, 1, 1), new Date(2024, 1, 1)].sort(compareDesc); // [2024-02-01, 2023-02-01]
 */
export function compareDesc(a: DateInput, b: DateInput): -1 | 0 | 1 {
	return compareAsc(b, a);
}

/**
 * Returns a copy of the earliest date.
 * @param {Iterable<DateInput>} dates - The dates to scan
 * @returns {Date | undefined} A new `Date` equal to the earliest date, or `undefined` when `dates` is empty
 * @throws {RangeError} when any date is invalid
 * @example
 * minDate([new Date(2024, 0, 2), new Date(2024, 0, 1)]); // 2024-01-01
 * minDate([]); // undefined
 */
export function minDate(dates: Iterable<DateInput>): Date | undefined {
	let result: number | undefined;

	for (const date of dates) {
		const time = timeOf(date);

		if (result === undefined || time < result) result = time;
	}

	return result === undefined ? undefined : new Date(result);
}

/**
 * Returns a copy of the latest date.
 * @param {Iterable<DateInput>} dates - The dates to scan
 * @returns {Date | undefined} A new `Date` equal to the latest date, or `undefined` when `dates` is empty
 * @throws {RangeError} when any date is invalid
 * @example
 * maxDate([new Date(2024, 0, 2), new Date(2024, 0, 1)]); // 2024-01-02
 * maxDate([]); // undefined
 */
export function maxDate(dates: Iterable<DateInput>): Date | undefined {
	let result: number | undefined;

	for (const date of dates) {
		const time = timeOf(date);

		if (result === undefined || time > result) result = time;
	}

	return result === undefined ? undefined : new Date(result);
}

/**
 * Formats a date (local time) with a token pattern. No locale data is used.
 *
 * | Token | Output | Token | Output |
 * |-------|--------|-------|--------|
 * | `YYYY` | 4-digit year (`2024`) | `YY` | 2-digit year (`24`) |
 * | `MM` / `M` | month `01-12` / `1-12` | `DD` / `D` | day `01-31` / `1-31` |
 * | `HH` / `H` | hour `00-23` / `0-23` | `hh` / `h` | hour `01-12` / `1-12` |
 * | `mm` / `m` | minute `00-59` / `0-59` | `ss` / `s` | second `00-59` / `0-59` |
 * | `SSS` | millisecond `000-999` | `A` / `a` | `AM`/`PM` / `am`/`pm` |
 *
 * Text inside `[square brackets]` is output literally (without the brackets). Any other character is copied as is;
 * note that a bare `a`, `s`, `m`, `h`, `D`… IS a token, so wrap words in brackets: `'[at] HH:mm'`.
 * @param {DateInput} date - The date to format
 * @param {string} pattern - The format pattern
 * @returns {string} The formatted date
 * @throws {RangeError} when `date` is invalid
 * @example
 * formatDate(new Date(2024, 0, 5, 14, 7, 9, 3), 'YYYY-MM-DD HH:mm:ss.SSS'); // '2024-01-05 14:07:09.003'
 * formatDate(new Date(2024, 0, 5, 14, 7), 'D/M/YY h:mm A [o\'clock]'); // "5/1/24 2:07 PM o'clock"
 */
export function formatDate(date: DateInput, pattern: string): string {
	const d = toValidDate(date);

	return pattern.replace(FORMAT_TOKEN_REGEX, function (token: string, literal: string | undefined): string {
		return literal === undefined ? FORMATTERS[token](d) : literal;
	});
}

/**
 * Returns the LOCAL calendar date as `'YYYY-MM-DD'`.
 * Note: this differs from `date.toISOString().slice(0, 10)`, which uses the UTC date.
 * @param {DateInput} date - The date
 * @returns {string} The local date in ISO 8601 calendar format
 * @throws {RangeError} when `date` is invalid
 * @example
 * toISODateString(new Date(2024, 0, 5, 23, 30)); // '2024-01-05'
 */
export function toISODateString(date: DateInput): string {
	return formatDate(date, 'YYYY-MM-DD');
}

/**
 * Parses a strict `'YYYY-MM-DD'` string into a date at LOCAL midnight (unlike `new Date('YYYY-MM-DD')`, which is UTC).
 * Month and day ranges are validated, so impossible dates such as `'2023-02-30'` are rejected.
 * @param {string} value - The string to parse
 * @returns {Date | undefined} The parsed date, or `undefined` when the string is not a valid calendar date
 * @example
 * parseISODate('2024-02-29'); // 2024-02-29 00:00 (local)
 * parseISODate('2023-02-29'); // undefined
 * parseISODate('2024-2-1'); // undefined
 */
export function parseISODate(value: string): Date | undefined {
	const match = typeof value === 'string' ? ISO_DATE_REGEX.exec(value) : null;

	if (match === null) return undefined;

	const year = Number(match[1]);
	const monthIndex = Number(match[2]) - 1;
	const day = Number(match[3]);

	if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > daysInMonth(year, monthIndex)) return undefined;

	const result = new Date(0);

	// setFullYear (unlike the Date constructor) does not remap years 0-99 to 1900-1999.
	result.setFullYear(year, monthIndex, day);
	result.setHours(0, 0, 0, 0);

	return result;
}

/**
 * Describes `date` relative to `baseDate` in words, e.g. `'in 3 days'`, `'2 hours ago'`, `'yesterday'`, `'now'`,
 * using `Intl.RelativeTimeFormat` with `numeric: 'auto'`.
 *
 * The unit is chosen as follows: seconds below one minute, minutes below one hour, hours below one day (all from
 * the absolute millisecond delta, truncated toward zero); then calendar days (see {@link diffInDays}) below 7 days,
 * weeks while less than one complete month has elapsed (see {@link diffInMonths}), months below 12 months, else years.
 * @param {DateInput} date - The date to describe
 * @param {DateInput} [baseDate=new Date()] - The reference date ("now")
 * @param {string} [locale='en'] - A BCP 47 locale passed to `Intl.RelativeTimeFormat`
 * @returns {string} The relative time phrase
 * @throws {RangeError} when either date is invalid or the locale is malformed
 * @example
 * const base = new Date(2024, 0, 10, 12);
 * getRelativeTime(new Date(2024, 0, 10, 9), base); // '3 hours ago'
 * getRelativeTime(new Date(2024, 0, 11, 12), base); // 'tomorrow'
 * getRelativeTime(new Date(2024, 3, 10, 12), base); // 'in 3 months'
 */
export function getRelativeTime(date: DateInput, baseDate: DateInput = new Date(), locale = 'en'): string {
	const target = toValidDate(date);
	const base = toValidDate(baseDate);
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
	const delta = target.getTime() - base.getTime();

	if (Math.abs(delta) < MS_PER_MINUTE) return formatter.format(truncate(delta / MS_PER_SECOND), 'second');
	if (Math.abs(delta) < MS_PER_HOUR) return formatter.format(truncate(delta / MS_PER_MINUTE), 'minute');

	const days = diffInDays(target, base);

	// `days === 0` covers a 24h+ delta inside a single 25-hour (DST) day.
	if (Math.abs(delta) < MS_PER_DAY || days === 0) return formatter.format(truncate(delta / MS_PER_HOUR), 'hour');
	if (Math.abs(days) < 7) return formatter.format(days, 'day');

	const months = diffInMonths(target, base);

	if (months === 0) return formatter.format(truncate(days / 7), 'week');
	if (Math.abs(months) < 12) return formatter.format(months, 'month');

	return formatter.format(truncate(months / 12), 'year');
}
