import fc from 'fast-check';
import * as helpers from '.';

const LOCALES = ['en-US', 'en-GB', 'de-DE', 'es-ES', 'fr-FR', 'ja-JP', 'ar-EG', 'hi-IN', 'pt-BR'];

const finiteDouble = fc.double({ min: -1e15, max: 1e15, noNaN: true, noDefaultInfinity: true });
const locale = fc.constantFrom(...LOCALES);

/** Random valid fraction-digit options (min <= max). */
const fractionDigits = fc.tuple(fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 8 })).map(function ([a, b]) {
	return { minimumFractionDigits: Math.min(a, b), maximumFractionDigits: Math.max(a, b) };
});

const numberOptions = fc.record(
	{
		fraction: fractionDigits,
		useGrouping: fc.boolean(),
		signDisplay: fc.constantFrom('auto', 'always', 'never', 'exceptZero') as fc.Arbitrary<Intl.NumberFormatOptions['signDisplay']>,
		notation: fc.constantFrom('standard', 'scientific', 'engineering', 'compact') as fc.Arbitrary<Intl.NumberFormatOptions['notation']>
	},
	{ requiredKeys: ['fraction'] }
);

describe('Format helpers (property-based)', function () {
	describe('formatNumber', function () {
		it('should match a freshly constructed Intl.NumberFormat for random numbers, locales and options', function () {
			fc.assert(
				fc.property(finiteDouble, locale, numberOptions, function (value, tag, { fraction, ...rest }) {
					const options: Intl.NumberFormatOptions = { ...fraction, ...rest };
					expect(helpers.formatNumber(value, { ...options, locale: tag })).toBe(new Intl.NumberFormat([tag, 'en-US'], options).format(value));
				})
			);
		});

		it('should format bigints like Intl.NumberFormat', function () {
			fc.assert(
				fc.property(fc.bigInt({ min: -(10n ** 30n), max: 10n ** 30n }), locale, function (value, tag) {
					expect(helpers.formatNumber(value, { locale: tag })).toBe(new Intl.NumberFormat(tag).format(value));
				})
			);
		});
	});

	describe('formatter cache', function () {
		it('should return the same output on repeated (cached) calls as an uncached formatter', function () {
			fc.assert(
				fc.property(fc.array(fc.tuple(finiteDouble, fractionDigits), { minLength: 1, maxLength: 80 }), function (calls) {
					// Many distinct option sets force evictions; every result must still equal the uncached reference.
					for (const [value, fraction] of calls) {
						const reference = new Intl.NumberFormat('en-US', fraction).format(value);
						expect(helpers.formatNumber(value, fraction)).toBe(reference);
						expect(helpers.formatNumber(value, fraction)).toBe(reference);
					}
				})
			);
		});

		it('should never hand out a formatter built for another (locale list, options) pair', function () {
			const tag = fc.constantFrom('en', 'en-US', 'de', 'de-DE', 'fr', 'fr-CH', 'ar-EG', 'hi-IN', 'ja');
			const options = fc.record(
				{
					useGrouping: fc.constantFrom(true, false, 'always', 'min2'),
					signDisplay: fc.constantFrom('auto', 'always', 'never', 'exceptZero'),
					maximumFractionDigits: fc.integer({ min: 0, max: 3 }),
					notation: fc.constantFrom('standard', 'scientific', 'compact')
				},
				{ requiredKeys: [] }
			);
			fc.assert(
				fc.property(fc.array(fc.tuple(fc.array(tag, { minLength: 1, maxLength: 3 }), options), { minLength: 1, maxLength: 30 }), function (calls) {
					for (const [locales, rest] of calls) {
						const reference = new Intl.NumberFormat([...locales, 'en-US'], rest as Intl.NumberFormatOptions).format(-1234.5678);
						expect(helpers.formatNumber(-1234.5678, { ...(rest as Intl.NumberFormatOptions), locale: locales })).toBe(reference);
					}
				})
			);
		});

		it('should match uncached Intl output for currencies, units, compact numbers and dates', function () {
			fc.assert(
				fc.property(
					finiteDouble,
					fc.constantFrom('USD', 'EUR', 'JPY', 'GBP'),
					fc.constantFrom('meter', 'kilometer-per-hour', 'celsius', 'megabyte'),
					fc.integer({ min: -8.64e15, max: 8.64e15 }),
					function (value, currency, unit, time) {
						expect(helpers.formatCurrency(value, currency)).toBe(new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value));
						expect(helpers.formatUnit(value, unit)).toBe(new Intl.NumberFormat('en-US', { style: 'unit', unit }).format(value));
						expect(helpers.formatCompact(value)).toBe(new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value));
						expect(helpers.formatDateTime(time, { dateStyle: 'full', timeStyle: 'long' })).toBe(
							new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'long', timeZone: 'UTC' }).format(time)
						);
					}
				)
			);
		});
	});

	describe('formatPercent', function () {
		it('should parse back to the original ratio within the rounding tolerance', function () {
			fc.assert(
				fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.integer({ min: 0, max: 6 }), function (ratio, decimals) {
					const text = helpers.formatPercent(ratio, { decimals, useGrouping: false });
					expect(text.endsWith('%')).toBe(true);
					const parsed = Number(text.slice(0, -1)) / 100;
					// Half a unit in the last displayed digit, plus a little slack for binary floating point.
					expect(Math.abs(parsed - ratio)).toBeLessThanOrEqual(0.5 * 10 ** -(decimals + 2) * (1 + 1e-9) + Math.abs(ratio) * 1e-12);
				})
			);
		});

		it('should always show exactly `decimals` fraction digits', function () {
			fc.assert(
				fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.integer({ min: 1, max: 6 }), function (ratio, decimals) {
					const text = helpers.formatPercent(ratio, { decimals });
					expect(text).toMatch(new RegExp(`\\.\\d{${decimals}}%$`));
				})
			);
		});
	});

	describe('formatList', function () {
		it('should contain every item, in order', function () {
			fc.assert(
				fc.property(
					fc.array(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 10 }),
					locale,
					fc.constantFrom('conjunction', 'disjunction', 'unit') as fc.Arbitrary<Intl.ListFormatType>,
					fc.constantFrom('long', 'short', 'narrow') as fc.Arbitrary<Intl.ListFormatStyle>,
					function (items, tag, type, style) {
						const text = helpers.formatList(items, { locale: tag, type, style });
						let position = 0;
						for (const item of items) {
							const index = text.indexOf(item, position);
							expect(index).toBeGreaterThanOrEqual(position);
							position = index + item.length;
						}
					}
				)
			);
		});

		it('should return the single item unchanged', function () {
			fc.assert(
				fc.property(fc.string(), locale, function (item, tag) {
					expect(helpers.formatList([item], { locale: tag })).toBe(item);
				})
			);
		});
	});

	describe('formatOrdinal', function () {
		it('should agree with an English ordinal reference implementation', function () {
			fc.assert(
				fc.property(fc.integer({ min: -1_000_000, max: 1_000_000 }), function (n) {
					const lastTwo = Math.abs(n) % 100;
					const last = lastTwo % 10;
					const suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th' : last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th';
					expect(helpers.formatOrdinal(n)).toBe(`${n.toLocaleString('en-US')}${suffix}`);
				})
			);
		});

		it('should be the formatted number followed by the suffix of its ordinal category', function () {
			const suffixes = { zero: 'Z', one: 'O', two: 'T', few: 'F', many: 'M', other: 'X' };
			fc.assert(
				fc.property(fc.integer({ min: 0, max: 100_000 }), locale, function (n, tag) {
					const category = new Intl.PluralRules([tag, 'en-US'], { type: 'ordinal' }).select(n);
					expect(helpers.formatOrdinal(n, { locale: tag, suffixes })).toBe(`${helpers.formatNumber(n, { locale: tag })}${suffixes[category]}`);
				})
			);
		});
	});

	describe('pluralRule', function () {
		it('should match Intl.PluralRules', function () {
			fc.assert(
				fc.property(finiteDouble, locale, fc.constantFrom('cardinal', 'ordinal') as fc.Arbitrary<Intl.PluralRuleType>, function (count, tag, type) {
					expect(helpers.pluralRule(count, { locale: tag, type })).toBe(new Intl.PluralRules(tag, { type }).select(count));
				})
			);
		});

		it('should be consistent with formatRelativeTime pluralization in English', function () {
			fc.assert(
				fc.property(fc.integer({ min: 2, max: 1_000_000 }), function (n) {
					expect(helpers.pluralRule(n)).toBe('other');
					expect(helpers.formatRelativeTime(n, 'day')).toBe(`in ${helpers.formatNumber(n)} days`);
				})
			);
		});
	});
});
