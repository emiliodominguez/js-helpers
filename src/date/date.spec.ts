import * as helpers from '.';

/**
 * Returns the local calendar/time components of a date, for TZ-agnostic assertions.
 */
function parts(date: Date): number[] {
	return [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()];
}

/**
 * Returns the local calendar components (year, month, day) of a date.
 */
function ymd(date: Date): number[] {
	return [date.getFullYear(), date.getMonth(), date.getDate()];
}

const INVALID = new Date(NaN);

describe('Date helpers', function () {
	describe('isValidDate', function () {
		it('accepts valid Date instances only', function () {
			expect(helpers.isValidDate(new Date())).toBe(true);
			expect(helpers.isValidDate(new Date(0))).toBe(true);
			expect(helpers.isValidDate(INVALID)).toBe(false);
			expect(helpers.isValidDate(new Date('not a date'))).toBe(false);
			expect(helpers.isValidDate(Date.now())).toBe(false);
			expect(helpers.isValidDate('2024-01-01')).toBe(false);
			expect(helpers.isValidDate(null)).toBe(false);
			expect(helpers.isValidDate(undefined)).toBe(false);
			expect(
				helpers.isValidDate({
					getTime: function () {
						return 0;
					}
				})
			).toBe(false);
		});
	});

	describe('input validation', function () {
		const unary: Array<[string, (d: any) => unknown]> = [
			[
				'addDays',
				function (d) {
					return helpers.addDays(d, 1);
				}
			],
			[
				'addWeeks',
				function (d) {
					return helpers.addWeeks(d, 1);
				}
			],
			[
				'addMonths',
				function (d) {
					return helpers.addMonths(d, 1);
				}
			],
			[
				'addYears',
				function (d) {
					return helpers.addYears(d, 1);
				}
			],
			[
				'addHours',
				function (d) {
					return helpers.addHours(d, 1);
				}
			],
			[
				'addMinutes',
				function (d) {
					return helpers.addMinutes(d, 1);
				}
			],
			[
				'addSeconds',
				function (d) {
					return helpers.addSeconds(d, 1);
				}
			],
			[
				'addMilliseconds',
				function (d) {
					return helpers.addMilliseconds(d, 1);
				}
			],
			[
				'diffInDays',
				function (d) {
					return helpers.diffInDays(d, 0);
				}
			],
			[
				'diffInDays (2nd arg)',
				function (d) {
					return helpers.diffInDays(0, d);
				}
			],
			[
				'diffInHours',
				function (d) {
					return helpers.diffInHours(d, 0);
				}
			],
			[
				'diffInMinutes',
				function (d) {
					return helpers.diffInMinutes(0, d);
				}
			],
			[
				'diffInSeconds',
				function (d) {
					return helpers.diffInSeconds(d, 0);
				}
			],
			[
				'diffInMonths',
				function (d) {
					return helpers.diffInMonths(d, 0);
				}
			],
			[
				'diffInMonths (2nd arg)',
				function (d) {
					return helpers.diffInMonths(0, d);
				}
			],
			['startOfDay', helpers.startOfDay],
			['endOfDay', helpers.endOfDay],
			['startOfMonth', helpers.startOfMonth],
			['endOfMonth', helpers.endOfMonth],
			[
				'startOfWeek',
				function (d) {
					return helpers.startOfWeek(d);
				}
			],
			[
				'endOfWeek',
				function (d) {
					return helpers.endOfWeek(d);
				}
			],
			['startOfYear', helpers.startOfYear],
			['endOfYear', helpers.endOfYear],
			[
				'isSameDay',
				function (d) {
					return helpers.isSameDay(d, 0);
				}
			],
			[
				'isSameMonth',
				function (d) {
					return helpers.isSameMonth(0, d);
				}
			],
			[
				'isSameYear',
				function (d) {
					return helpers.isSameYear(d, 0);
				}
			],
			[
				'isLeapYear',
				function (d) {
					return helpers.isLeapYear(d instanceof Date ? d : new Date(d));
				}
			],
			['getDaysInMonth', helpers.getDaysInMonth],
			['isWeekend', helpers.isWeekend],
			[
				'isBefore',
				function (d) {
					return helpers.isBefore(d, 0);
				}
			],
			[
				'isAfter',
				function (d) {
					return helpers.isAfter(0, d);
				}
			],
			[
				'isBetween',
				function (d) {
					return helpers.isBetween(d, 0, 1);
				}
			],
			[
				'isBetween (end)',
				function (d) {
					return helpers.isBetween(0, 0, d);
				}
			],
			[
				'compareAsc',
				function (d) {
					return helpers.compareAsc(d, 0);
				}
			],
			[
				'compareDesc',
				function (d) {
					return helpers.compareDesc(0, d);
				}
			],
			[
				'minDate',
				function (d) {
					return helpers.minDate([0, d]);
				}
			],
			[
				'maxDate',
				function (d) {
					return helpers.maxDate([d, 0]);
				}
			],
			[
				'formatDate',
				function (d) {
					return helpers.formatDate(d, 'YYYY');
				}
			],
			['toISODateString', helpers.toISODateString],
			[
				'getRelativeTime',
				function (d) {
					return helpers.getRelativeTime(d, 0);
				}
			],
			[
				'getRelativeTime (base)',
				function (d) {
					return helpers.getRelativeTime(0, d);
				}
			]
		];

		it.each(unary)('%s throws RangeError("Invalid date") for invalid dates', function (_name, fn) {
			expect(function () {
				fn(INVALID);
			}).toThrow(new RangeError('Invalid date'));
			expect(function () {
				fn(NaN);
			}).toThrow(RangeError);
			expect(function () {
				fn(Infinity);
			}).toThrow(RangeError);
		});

		it.each(
			unary.filter(function (entry) {
				return entry[0] !== 'isLeapYear';
			})
		)('%s throws TypeError for non-date inputs', function (_name, fn) {
			expect(function () {
				fn('2024-01-01');
			}).toThrow(TypeError);
			expect(function () {
				fn(null);
			}).toThrow(TypeError);
		});

		it('accepts timestamps as well as Date instances', function () {
			const time = new Date(2024, 0, 15, 10).getTime();

			expect(helpers.addDays(time, 1).getDate()).toBe(16);
			expect(helpers.isSameDay(time, new Date(time))).toBe(true);
		});
	});

	describe('addDays / addWeeks', function () {
		it('adds and subtracts calendar days, preserving the time of day', function () {
			expect(parts(helpers.addDays(new Date(2024, 0, 31, 10, 20, 30, 400), 1))).toEqual([2024, 1, 1, 10, 20, 30, 400]);
			expect(parts(helpers.addDays(new Date(2024, 2, 1, 8), -1))).toEqual([2024, 1, 29, 8, 0, 0, 0]);
			expect(parts(helpers.addDays(new Date(2023, 11, 31), 1))).toEqual([2024, 0, 1, 0, 0, 0, 0]);
			expect(parts(helpers.addDays(new Date(2024, 4, 10), 0))).toEqual([2024, 4, 10, 0, 0, 0, 0]);
			expect(parts(helpers.addDays(new Date(2024, 0, 1), 366))).toEqual([2025, 0, 1, 0, 0, 0, 0]);
		});

		it('adds weeks', function () {
			expect(ymd(helpers.addWeeks(new Date(2024, 0, 1), 2))).toEqual([2024, 0, 15]);
			expect(ymd(helpers.addWeeks(new Date(2024, 0, 1), -1))).toEqual([2023, 11, 25]);
		});

		it('rejects non-integer amounts', function () {
			expect(function () {
				helpers.addDays(new Date(), 1.5);
			}).toThrow(RangeError);
			expect(function () {
				helpers.addDays(new Date(), NaN);
			}).toThrow(RangeError);
			expect(function () {
				helpers.addDays(new Date(), Infinity);
			}).toThrow(RangeError);
			expect(function () {
				helpers.addWeeks(new Date(), 0.5);
			}).toThrow(RangeError);
		});

		it('rejects results outside the Date range', function () {
			expect(function () {
				helpers.addDays(new Date(2024, 0, 1), 1e9);
			}).toThrow('Resulting date is out of range');
		});
	});

	describe('addMonths / addYears', function () {
		it('adds months, clamping to the end of the target month', function () {
			expect(ymd(helpers.addMonths(new Date(2023, 0, 31), 1))).toEqual([2023, 1, 28]);
			expect(ymd(helpers.addMonths(new Date(2024, 0, 31), 1))).toEqual([2024, 1, 29]);
			expect(ymd(helpers.addMonths(new Date(2024, 2, 31), -1))).toEqual([2024, 1, 29]);
			expect(ymd(helpers.addMonths(new Date(2024, 4, 31), 1))).toEqual([2024, 5, 30]);
			expect(ymd(helpers.addMonths(new Date(2024, 0, 15), 0))).toEqual([2024, 0, 15]);
		});

		it('crosses year boundaries in both directions', function () {
			expect(ymd(helpers.addMonths(new Date(2023, 10, 15), 3))).toEqual([2024, 1, 15]);
			expect(ymd(helpers.addMonths(new Date(2024, 1, 15), -3))).toEqual([2023, 10, 15]);
			expect(ymd(helpers.addMonths(new Date(2024, 0, 15), -25))).toEqual([2021, 11, 15]);
			expect(ymd(helpers.addMonths(new Date(2024, 0, 15), 120))).toEqual([2034, 0, 15]);
		});

		it('preserves the time of day', function () {
			expect(parts(helpers.addMonths(new Date(2024, 0, 31, 13, 14, 15, 16), 1))).toEqual([2024, 1, 29, 13, 14, 15, 16]);
		});

		it('handles years 0-99 without remapping them to 1900-1999', function () {
			const date = new Date(2000, 0, 31);

			date.setFullYear(50);

			expect(ymd(helpers.addMonths(date, 1))).toEqual([50, 1, 28]);
		});

		it('adds years, clamping February 29th', function () {
			expect(ymd(helpers.addYears(new Date(2024, 1, 29), 1))).toEqual([2025, 1, 28]);
			expect(ymd(helpers.addYears(new Date(2024, 1, 29), 4))).toEqual([2028, 1, 29]);
			expect(ymd(helpers.addYears(new Date(2024, 5, 1), -10))).toEqual([2014, 5, 1]);
		});

		it('rejects non-integer amounts and out-of-range results', function () {
			expect(function () {
				helpers.addMonths(new Date(), 0.5);
			}).toThrow(RangeError);
			expect(function () {
				helpers.addYears(new Date(), 0.5);
			}).toThrow(RangeError);
			expect(function () {
				helpers.addMonths(new Date(2024, 0, 1), 1e10);
			}).toThrow('Resulting date is out of range');
			expect(function () {
				helpers.addYears(new Date(2024, 0, 1), 1e300);
			}).toThrow(RangeError);
		});
	});

	describe('addHours / addMinutes / addSeconds / addMilliseconds', function () {
		it('performs absolute (millisecond based) arithmetic', function () {
			const base = Date.UTC(2024, 0, 1);

			expect(helpers.addHours(base, 2).toISOString()).toBe('2024-01-01T02:00:00.000Z');
			expect(helpers.addHours(base, -1.5).toISOString()).toBe('2023-12-31T22:30:00.000Z');
			expect(helpers.addMinutes(base, 90).toISOString()).toBe('2024-01-01T01:30:00.000Z');
			expect(helpers.addSeconds(base, 1.5).getTime()).toBe(base + 1500);
			expect(helpers.addMilliseconds(base, -250).getTime()).toBe(base - 250);
		});

		it('rejects non-finite amounts and out-of-range results', function () {
			expect(function () {
				helpers.addHours(0, NaN);
			}).toThrow(RangeError);
			expect(function () {
				helpers.addMinutes(0, Infinity);
			}).toThrow(RangeError);
			expect(function () {
				helpers.addSeconds(0, -Infinity);
			}).toThrow(RangeError);
			expect(function () {
				helpers.addMilliseconds(0, '1' as any);
			}).toThrow(RangeError);
			expect(function () {
				helpers.addMilliseconds(8.64e15, 1);
			}).toThrow('Resulting date is out of range');
		});
	});

	describe('diffInDays', function () {
		it('counts calendar days, ignoring the time of day', function () {
			expect(helpers.diffInDays(new Date(2024, 2, 1), new Date(2024, 1, 1))).toBe(29);
			expect(helpers.diffInDays(new Date(2024, 0, 2, 0, 1), new Date(2024, 0, 1, 23, 59))).toBe(1);
			expect(helpers.diffInDays(new Date(2024, 0, 1, 23, 59), new Date(2024, 0, 1, 0, 0))).toBe(0);
			expect(helpers.diffInDays(new Date(2024, 0, 1), new Date(2024, 0, 3))).toBe(-2);
			expect(helpers.diffInDays(new Date(2025, 0, 1), new Date(2024, 0, 1))).toBe(366);
			expect(Object.is(helpers.diffInDays(new Date(2024, 0, 1, 5), new Date(2024, 0, 1, 6)), 0)).toBe(true);
		});

		it('handles years 0-99', function () {
			const a = new Date(2000, 0, 1);
			const b = new Date(2000, 0, 1);

			a.setFullYear(50, 0, 1);
			b.setFullYear(49, 0, 1);

			expect(helpers.diffInDays(a, b)).toBe(365);
		});
	});

	describe('diffInHours / diffInMinutes / diffInSeconds', function () {
		it('truncates toward zero', function () {
			expect(helpers.diffInHours(5_399_999, 0)).toBe(1);
			expect(helpers.diffInHours(0, 5_399_999)).toBe(-1);
			expect(helpers.diffInMinutes(150_000, 0)).toBe(2);
			expect(helpers.diffInSeconds(0, 2_500)).toBe(-2);
			expect(helpers.diffInSeconds(new Date(1999), new Date(0))).toBe(1);
		});

		it('never returns -0', function () {
			expect(Object.is(helpers.diffInHours(0, 1), 0)).toBe(true);
			expect(Object.is(helpers.diffInMinutes(0, 1), 0)).toBe(true);
			expect(Object.is(helpers.diffInSeconds(0, 1), 0)).toBe(true);
		});
	});

	describe('diffInMonths', function () {
		it('counts complete months', function () {
			expect(helpers.diffInMonths(new Date(2024, 2, 14), new Date(2024, 0, 15))).toBe(1);
			expect(helpers.diffInMonths(new Date(2024, 2, 15), new Date(2024, 0, 15))).toBe(2);
			expect(helpers.diffInMonths(new Date(2024, 0, 20), new Date(2024, 0, 15))).toBe(0);
			expect(helpers.diffInMonths(new Date(2025, 0, 15), new Date(2024, 0, 15))).toBe(12);
			expect(helpers.diffInMonths(new Date(2024, 0, 1), new Date(2023, 11, 31))).toBe(0);
		});

		it('uses end-of-month clamping (date-fns semantics)', function () {
			expect(helpers.diffInMonths(new Date(2023, 1, 28), new Date(2023, 0, 31))).toBe(1);
			expect(helpers.diffInMonths(new Date(2023, 1, 27), new Date(2023, 0, 31))).toBe(0);
			expect(helpers.diffInMonths(new Date(2023, 2, 31), new Date(2023, 1, 28))).toBe(1);
		});

		it('takes the time of day into account', function () {
			expect(helpers.diffInMonths(new Date(2024, 1, 15, 9), new Date(2024, 0, 15, 10))).toBe(0);
			expect(helpers.diffInMonths(new Date(2024, 1, 15, 10), new Date(2024, 0, 15, 10))).toBe(1);
		});

		it('is negative when later is before earlier, never -0', function () {
			expect(helpers.diffInMonths(new Date(2024, 0, 15), new Date(2024, 2, 15))).toBe(-2);
			expect(helpers.diffInMonths(new Date(2024, 0, 15), new Date(2024, 2, 14))).toBe(-1);
			expect(Object.is(helpers.diffInMonths(new Date(2024, 0, 15), new Date(2024, 0, 20)), 0)).toBe(true);
		});
	});

	describe('startOf / endOf', function () {
		const date = new Date(2024, 4, 15, 13, 45, 30, 500); // Wednesday

		it('startOfDay / endOfDay', function () {
			expect(parts(helpers.startOfDay(date))).toEqual([2024, 4, 15, 0, 0, 0, 0]);
			expect(parts(helpers.endOfDay(date))).toEqual([2024, 4, 15, 23, 59, 59, 999]);
		});

		it('startOfMonth / endOfMonth', function () {
			expect(parts(helpers.startOfMonth(date))).toEqual([2024, 4, 1, 0, 0, 0, 0]);
			expect(parts(helpers.endOfMonth(date))).toEqual([2024, 4, 31, 23, 59, 59, 999]);
			expect(parts(helpers.endOfMonth(new Date(2024, 1, 10)))).toEqual([2024, 1, 29, 23, 59, 59, 999]);
			expect(parts(helpers.endOfMonth(new Date(2023, 1, 10)))).toEqual([2023, 1, 28, 23, 59, 59, 999]);
			expect(parts(helpers.endOfMonth(new Date(2024, 0, 31, 12)))).toEqual([2024, 0, 31, 23, 59, 59, 999]);
		});

		it('startOfWeek / endOfWeek', function () {
			expect(parts(helpers.startOfWeek(date))).toEqual([2024, 4, 12, 0, 0, 0, 0]);
			expect(parts(helpers.startOfWeek(date, 1))).toEqual([2024, 4, 13, 0, 0, 0, 0]);
			expect(parts(helpers.startOfWeek(date, 3))).toEqual([2024, 4, 15, 0, 0, 0, 0]);
			expect(parts(helpers.startOfWeek(date, 4))).toEqual([2024, 4, 9, 0, 0, 0, 0]);
			expect(parts(helpers.endOfWeek(date))).toEqual([2024, 4, 18, 23, 59, 59, 999]);
			expect(parts(helpers.endOfWeek(date, 1))).toEqual([2024, 4, 19, 23, 59, 59, 999]);
			expect(parts(helpers.startOfWeek(new Date(2024, 0, 2), 1))).toEqual([2024, 0, 1, 0, 0, 0, 0]);
			expect(parts(helpers.startOfWeek(new Date(2024, 0, 1)))).toEqual([2023, 11, 31, 0, 0, 0, 0]);
		});

		it('rejects invalid weekStartsOn values', function () {
			expect(function () {
				helpers.startOfWeek(date, 7 as any);
			}).toThrow(RangeError);
			expect(function () {
				helpers.startOfWeek(date, -1 as any);
			}).toThrow(RangeError);
			expect(function () {
				helpers.endOfWeek(date, 1.5 as any);
			}).toThrow(RangeError);
		});

		it('startOfYear / endOfYear', function () {
			expect(parts(helpers.startOfYear(date))).toEqual([2024, 0, 1, 0, 0, 0, 0]);
			expect(parts(helpers.endOfYear(date))).toEqual([2024, 11, 31, 23, 59, 59, 999]);
			expect(parts(helpers.endOfYear(new Date(2024, 1, 29)))).toEqual([2024, 11, 31, 23, 59, 59, 999]);
		});

		it('throws when the end of the period is outside the Date range', function () {
			expect(function () {
				helpers.endOfDay(8.64e15);
			}).toThrow('Resulting date is out of range');
			expect(function () {
				helpers.endOfYear(8.64e15);
			}).toThrow(RangeError);
			expect(helpers.startOfDay(-8.64e15 + 86_400_000 * 2).getTime()).toBeGreaterThanOrEqual(-8.64e15);
		});

		it('returns new instances and does not mutate the input', function () {
			const input = new Date(2024, 4, 15, 13);
			const before = input.getTime();
			const fns = [
				helpers.startOfDay,
				helpers.endOfDay,
				helpers.startOfMonth,
				helpers.endOfMonth,
				helpers.startOfWeek,
				helpers.endOfWeek,
				helpers.startOfYear,
				helpers.endOfYear
			];

			fns.forEach(function (fn) {
				expect(fn(input)).not.toBe(input);
			});
			expect(helpers.addDays(input, 0)).not.toBe(input);
			expect(helpers.addMonths(input, 0)).not.toBe(input);
			expect(helpers.addMilliseconds(input, 0)).not.toBe(input);
			expect(input.getTime()).toBe(before);
		});
	});

	describe('isSameDay / isSameMonth / isSameYear', function () {
		it('compares local calendar components', function () {
			expect(helpers.isSameDay(new Date(2024, 0, 1, 0, 0), new Date(2024, 0, 1, 23, 59, 59, 999))).toBe(true);
			expect(helpers.isSameDay(new Date(2024, 0, 1), new Date(2024, 0, 2))).toBe(false);
			expect(helpers.isSameDay(new Date(2024, 0, 1), new Date(2024, 1, 1))).toBe(false);
			expect(helpers.isSameDay(new Date(2024, 0, 1), new Date(2023, 0, 1))).toBe(false);
			expect(helpers.isSameMonth(new Date(2024, 0, 1), new Date(2024, 0, 31))).toBe(true);
			expect(helpers.isSameMonth(new Date(2024, 0, 1), new Date(2023, 0, 1))).toBe(false);
			expect(helpers.isSameMonth(new Date(2024, 0, 1), new Date(2024, 1, 1))).toBe(false);
			expect(helpers.isSameYear(new Date(2024, 0, 1), new Date(2024, 11, 31))).toBe(true);
			expect(helpers.isSameYear(new Date(2024, 0, 1), new Date(2023, 11, 31))).toBe(false);
		});
	});

	describe('isLeapYear / daysInMonth / getDaysInMonth', function () {
		it('applies the Gregorian rules', function () {
			expect(helpers.isLeapYear(2024)).toBe(true);
			expect(helpers.isLeapYear(2023)).toBe(false);
			expect(helpers.isLeapYear(1900)).toBe(false);
			expect(helpers.isLeapYear(2000)).toBe(true);
			expect(helpers.isLeapYear(0)).toBe(true);
			expect(helpers.isLeapYear(-4)).toBe(true);
			expect(helpers.isLeapYear(new Date(2000, 5, 1))).toBe(true);
			expect(helpers.isLeapYear(new Date(2100, 5, 1))).toBe(false);
		});

		it('returns the number of days in a month', function () {
			expect(
				[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (m) {
					return helpers.daysInMonth(2023, m);
				})
			).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
			expect(helpers.daysInMonth(2024, 1)).toBe(29);
			expect(helpers.getDaysInMonth(new Date(2024, 1, 10))).toBe(29);
			expect(helpers.getDaysInMonth(new Date(2024, 3, 30))).toBe(30);
		});

		it('rejects invalid arguments', function () {
			expect(function () {
				helpers.isLeapYear(2024.5);
			}).toThrow(RangeError);
			expect(function () {
				helpers.isLeapYear(NaN);
			}).toThrow(RangeError);
			expect(function () {
				helpers.daysInMonth(2024, 12);
			}).toThrow(RangeError);
			expect(function () {
				helpers.daysInMonth(2024, -1);
			}).toThrow(RangeError);
			expect(function () {
				helpers.daysInMonth(2024, 1.5);
			}).toThrow(RangeError);
			expect(function () {
				helpers.daysInMonth(2024.5, 1);
			}).toThrow(RangeError);
		});
	});

	describe('isWeekend', function () {
		it('detects Saturdays and Sundays', function () {
			expect(helpers.isWeekend(new Date(2024, 4, 18))).toBe(true); // Sat
			expect(helpers.isWeekend(new Date(2024, 4, 19))).toBe(true); // Sun
			expect(helpers.isWeekend(new Date(2024, 4, 20))).toBe(false); // Mon
			expect(helpers.isWeekend(new Date(2024, 4, 17))).toBe(false); // Fri
		});
	});

	describe('isBefore / isAfter / isBetween', function () {
		const a = new Date(2024, 0, 1);
		const b = new Date(2024, 0, 2);
		const c = new Date(2024, 0, 3);

		it('compares strictly', function () {
			expect(helpers.isBefore(a, b)).toBe(true);
			expect(helpers.isBefore(b, a)).toBe(false);
			expect(helpers.isBefore(a, a.getTime())).toBe(false);
			expect(helpers.isAfter(b, a)).toBe(true);
			expect(helpers.isAfter(a, b)).toBe(false);
			expect(helpers.isAfter(a, new Date(a))).toBe(false);
		});

		it('checks ranges with every inclusivity', function () {
			expect(helpers.isBetween(b, a, c)).toBe(true);
			expect(helpers.isBetween(a, a, c)).toBe(true);
			expect(helpers.isBetween(c, a, c)).toBe(true);
			expect(helpers.isBetween(a, a, c, '()')).toBe(false);
			expect(helpers.isBetween(c, a, c, '()')).toBe(false);
			expect(helpers.isBetween(b, a, c, '()')).toBe(true);
			expect(helpers.isBetween(a, a, c, '[)')).toBe(true);
			expect(helpers.isBetween(c, a, c, '[)')).toBe(false);
			expect(helpers.isBetween(a, a, c, '(]')).toBe(false);
			expect(helpers.isBetween(c, a, c, '(]')).toBe(true);
			expect(helpers.isBetween(a, b, c)).toBe(false);
			expect(helpers.isBetween(new Date(2024, 0, 4), a, c)).toBe(false);
			expect(helpers.isBetween(a, a, a)).toBe(true);
			expect(helpers.isBetween(a, a, a, '[)')).toBe(false);
		});

		it('rejects reversed ranges and unknown inclusivity', function () {
			expect(function () {
				helpers.isBetween(b, c, a);
			}).toThrow('start must not be after end');
			expect(function () {
				helpers.isBetween(b, a, c, '[[' as any);
			}).toThrow(RangeError);
		});
	});

	describe('compareAsc / compareDesc / minDate / maxDate', function () {
		const dates = [new Date(2024, 1, 1), new Date(2022, 5, 1), new Date(2023, 1, 1), new Date(2022, 5, 1)];

		it('sorts ascending and descending', function () {
			expect(dates.slice().sort(helpers.compareAsc).map(helpers.toISODateString)).toEqual(['2022-06-01', '2022-06-01', '2023-02-01', '2024-02-01']);
			expect(dates.slice().sort(helpers.compareDesc).map(helpers.toISODateString)).toEqual(['2024-02-01', '2023-02-01', '2022-06-01', '2022-06-01']);
			expect(helpers.compareAsc(1, 2)).toBe(-1);
			expect(helpers.compareAsc(2, 1)).toBe(1);
			expect(helpers.compareAsc(2, 2)).toBe(0);
			expect(helpers.compareDesc(1, 2)).toBe(1);
			expect(helpers.compareDesc(2, 2)).toBe(0);
		});

		it('finds the earliest / latest date as a new instance', function () {
			const earliest = helpers.minDate(dates);
			const latest = helpers.maxDate(new Set(dates));

			expect(earliest?.getTime()).toBe(dates[1].getTime());
			expect(earliest).not.toBe(dates[1]);
			expect(latest?.getTime()).toBe(dates[0].getTime());
			expect(latest).not.toBe(dates[0]);
			expect(helpers.minDate([5, new Date(3), 4])?.getTime()).toBe(3);
			expect(helpers.maxDate([5, new Date(3), 4])?.getTime()).toBe(5);
		});

		it('returns undefined for empty input', function () {
			expect(helpers.minDate([])).toBeUndefined();
			expect(helpers.maxDate(new Set<Date>())).toBeUndefined();
		});
	});

	describe('formatDate', function () {
		const date = new Date(2024, 0, 5, 14, 7, 9, 3);

		it('formats every token', function () {
			expect(helpers.formatDate(date, 'YYYY-MM-DD HH:mm:ss.SSS')).toBe('2024-01-05 14:07:09.003');
			expect(helpers.formatDate(date, 'YY M D H m s')).toBe('24 1 5 14 7 9');
			expect(helpers.formatDate(date, 'hh:mm A')).toBe('02:07 PM');
			expect(helpers.formatDate(date, 'h a')).toBe('2 pm');
			expect(helpers.formatDate(new Date(2024, 11, 25, 0, 5), 'h:mm A, hh a, DD/MM')).toBe('12:05 AM, 12 am, 25/12');
			expect(helpers.formatDate(new Date(2024, 11, 25, 12, 0), 'h A HH')).toBe('12 PM 12');
			expect(helpers.formatDate(new Date(2024, 11, 25, 23, 59, 59, 999), 'H h a SSS')).toBe('23 11 pm 999');
		});

		it('prefers the longest token', function () {
			expect(helpers.formatDate(date, 'YYYYY')).toBe('2024Y');
			expect(helpers.formatDate(date, 'MMM')).toBe('011');
			expect(helpers.formatDate(date, 'SSSS')).toBe('003S');
		});

		it('outputs bracketed text literally', function () {
			expect(helpers.formatDate(date, '[YYYY] YYYY')).toBe('YYYY 2024');
			expect(helpers.formatDate(date, '[Today is] dddd')).toBe('Today is dddd');
			expect(helpers.formatDate(date, "D/M/YY h:mm A [o'clock]")).toBe("5/1/24 2:07 PM o'clock");
			expect(helpers.formatDate(date, '[día] D [🎉]')).toBe('día 5 🎉');
			expect(helpers.formatDate(date, '[]')).toBe('');
			expect(helpers.formatDate(date, '[YYYY')).toBe('[2024');
			expect(helpers.formatDate(date, '')).toBe('');
		});

		it('replaces bare letters that are tokens', function () {
			expect(helpers.formatDate(date, 'Date: D')).toBe('5pmte: 5');
		});

		it('pads small and negative years', function () {
			const small = new Date(2000, 0, 1);
			const negative = new Date(2000, 0, 1);

			small.setFullYear(5);
			negative.setFullYear(-44);

			expect(helpers.formatDate(small, 'YYYY YY')).toBe('0005 05');
			expect(helpers.formatDate(negative, 'YYYY YY')).toBe('-0044 44');
		});
	});

	describe('toISODateString / parseISODate', function () {
		it('formats the LOCAL calendar date', function () {
			expect(helpers.toISODateString(new Date(2024, 0, 5, 23, 30))).toBe('2024-01-05');
			expect(helpers.toISODateString(new Date(2024, 11, 31, 0, 0))).toBe('2024-12-31');
		});

		it('parses valid dates at local midnight', function () {
			expect(parts(helpers.parseISODate('2024-02-29') as Date)).toEqual([2024, 1, 29, 0, 0, 0, 0]);
			expect(parts(helpers.parseISODate('1999-12-31') as Date)).toEqual([1999, 11, 31, 0, 0, 0, 0]);
			expect(parts(helpers.parseISODate('0050-06-15') as Date)).toEqual([50, 5, 15, 0, 0, 0, 0]);
		});

		it('rejects malformed or impossible dates', function () {
			['2023-02-29', '2023-02-30', '2023-04-31', '2023-13-01', '2023-00-10', '2023-01-00', '2023-1-01', ' 2023-01-01', '2023-01-01T00:00', '20230101', ''].forEach(
				function (value) {
					expect(helpers.parseISODate(value)).toBeUndefined();
				}
			);
			expect(helpers.parseISODate(20230101 as any)).toBeUndefined();
			expect(helpers.parseISODate(undefined as any)).toBeUndefined();
		});

		it('round-trips', function () {
			expect(helpers.toISODateString(helpers.parseISODate('2024-07-04') as Date)).toBe('2024-07-04');
		});
	});

	describe('getRelativeTime', function () {
		const base = new Date(2024, 0, 10, 12);

		it('picks a sensible unit', function () {
			expect(helpers.getRelativeTime(base, base)).toBe('now');
			expect(helpers.getRelativeTime(helpers.addSeconds(base, -30), base)).toBe('30 seconds ago');
			expect(helpers.getRelativeTime(helpers.addMinutes(base, 5), base)).toBe('in 5 minutes');
			expect(helpers.getRelativeTime(new Date(2024, 0, 10, 9), base)).toBe('3 hours ago');
			expect(helpers.getRelativeTime(new Date(2024, 0, 11, 11), base)).toBe('in 23 hours');
			expect(helpers.getRelativeTime(new Date(2024, 0, 11, 12), base)).toBe('tomorrow');
			expect(helpers.getRelativeTime(new Date(2024, 0, 9, 8), base)).toBe('yesterday');
			expect(helpers.getRelativeTime(new Date(2024, 0, 13, 12), base)).toBe('in 3 days');
			expect(helpers.getRelativeTime(new Date(2024, 0, 24, 12), base)).toBe('in 2 weeks');
			expect(helpers.getRelativeTime(new Date(2023, 11, 20, 12), base)).toBe('3 weeks ago');
			expect(helpers.getRelativeTime(new Date(2024, 3, 10, 12), base)).toBe('in 3 months');
			expect(helpers.getRelativeTime(new Date(2023, 6, 1), base)).toBe('6 months ago');
			expect(helpers.getRelativeTime(new Date(2022, 0, 1), base)).toBe('2 years ago');
			expect(helpers.getRelativeTime(new Date(2025, 0, 10, 12), base)).toBe('next year');
		});

		it('accepts a locale', function () {
			expect(helpers.getRelativeTime(new Date(2024, 0, 13, 12), base, 'es')).toBe('dentro de 3 días');
		});

		it('defaults the base date to now', function () {
			expect(helpers.getRelativeTime(Date.now() + 3 * 60 * 60 * 1000 + 30 * 60 * 1000)).toBe('in 3 hours');
		});

		it('uses hours for a 24h+ span within one long (DST fall-back) day', function () {
			// 23.5 hours in most zones; 24.5 hours where 2023-11-05 lasts 25 hours (e.g. America/New_York).
			expect(helpers.getRelativeTime(new Date(2023, 10, 5, 23, 30), new Date(2023, 10, 5, 0, 0))).toMatch(/^in 2[34] hours$/);
		});
	});

	describe('DST transitions (assertions hold in every time zone)', function () {
		it('addDays keeps the wall-clock time across the New York spring-forward (2023-03-12)', function () {
			expect(parts(helpers.addDays(new Date(2023, 2, 11, 12), 1))).toEqual([2023, 2, 12, 12, 0, 0, 0]);
			expect(parts(helpers.addDays(new Date(2023, 2, 11, 12), 2))).toEqual([2023, 2, 13, 12, 0, 0, 0]);
			expect(parts(helpers.addDays(new Date(2023, 2, 13, 0, 30), -1))).toEqual([2023, 2, 12, 0, 30, 0, 0]);
			expect(helpers.diffInDays(new Date(2023, 2, 13), new Date(2023, 2, 12))).toBe(1);
			expect(helpers.diffInDays(new Date(2023, 2, 12, 23, 59), new Date(2023, 2, 11, 0, 0))).toBe(1);
		});

		it('a non-existent wall-clock time still lands on the right calendar day', function () {
			const result = helpers.addDays(new Date(2023, 2, 11, 2, 30), 1);

			expect(ymd(result)).toEqual([2023, 2, 12]);
			expect([2, 3]).toContain(result.getHours());
			expect(result.getMinutes()).toBe(30);
		});

		it('addDays keeps the wall-clock time across the New York fall-back (2023-11-05)', function () {
			expect(parts(helpers.addDays(new Date(2023, 10, 4, 12), 1))).toEqual([2023, 10, 5, 12, 0, 0, 0]);
			expect(parts(helpers.addDays(new Date(2023, 10, 5, 23), 1))).toEqual([2023, 10, 6, 23, 0, 0, 0]);
			expect(parts(helpers.addDays(new Date(2023, 10, 6, 0, 0), -1))).toEqual([2023, 10, 5, 0, 0, 0, 0]);
			expect(helpers.diffInDays(new Date(2023, 10, 6), new Date(2023, 10, 5))).toBe(1);
			expect(helpers.diffInDays(new Date(2023, 10, 5, 23, 59), new Date(2023, 10, 5, 0, 0))).toBe(0);
		});

		it('start/end of day around the New York and Lord Howe transitions', function () {
			[new Date(2023, 2, 12, 12), new Date(2023, 10, 5, 12), new Date(2023, 3, 2, 12), new Date(2023, 9, 1, 12)].forEach(function (date) {
				expect(parts(helpers.startOfDay(date))).toEqual([...ymd(date), 0, 0, 0, 0]);
				expect(parts(helpers.endOfDay(date))).toEqual([...ymd(date), 23, 59, 59, 999]);
			});
		});

		it('every day of 2023 is exactly one calendar day after the previous one', function () {
			let day = new Date(2023, 0, 1, 12);

			for (let i = 1; i <= 365; i++) {
				const next = helpers.addDays(day, 1);

				expect(helpers.diffInDays(next, day)).toBe(1);
				expect(next.getHours()).toBe(12);
				expect(helpers.diffInDays(next, new Date(2023, 0, 1))).toBe(i);
				day = next;
			}

			expect(ymd(day)).toEqual([2024, 0, 1]);
		});

		it('addMonths and startOfWeek across transitions', function () {
			expect(parts(helpers.addMonths(new Date(2023, 1, 12, 12), 1))).toEqual([2023, 2, 12, 12, 0, 0, 0]);
			expect(parts(helpers.addMonths(new Date(2023, 9, 5, 1, 30), 1))).toEqual([2023, 10, 5, 1, 30, 0, 0]);
			expect(parts(helpers.startOfWeek(new Date(2023, 2, 15, 12)))).toEqual([2023, 2, 12, 0, 0, 0, 0]);
			expect(parts(helpers.endOfWeek(new Date(2023, 10, 1, 12), 1))).toEqual([2023, 10, 5, 23, 59, 59, 999]);
		});
	});
});
