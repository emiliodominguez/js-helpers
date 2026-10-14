import fc from 'fast-check';
import * as helpers from '.';

const byte = fc.integer({ min: 0, max: 255 });
const rgb = fc.record({ r: byte, g: byte, b: byte });
const rgba = fc.record({
	r: byte,
	g: byte,
	b: byte,
	a: byte.map(function (value) {
		return value / 255;
	})
});
const weight = fc.double({ min: 0, max: 1, noNaN: true });
const amount = fc.double({ min: 0, max: 100, noNaN: true });
const channelName = fc.constantFrom<'r' | 'g' | 'b'>('r', 'g', 'b');

describe('Color helpers (property-based)', function () {
	describe('parseHex / toHex', function () {
		it('parseHex(toHex(c)) should round-trip colours with 8-bit channels', function () {
			fc.assert(
				fc.property(rgba, function (color) {
					expect(helpers.parseHex(helpers.toHex(color, { alpha: true }))).toEqual(color);
					expect(helpers.parseHex(helpers.toHex(color))).toEqual(helpers.toHex(color).length === 7 ? { ...color, a: 1 } : color);
				})
			);
		});

		it('toHex(parseHex(s)) should give back the lowercase 8-digit form', function () {
			fc.assert(
				fc.property(fc.stringMatching(/^[0-9a-fA-F]{8}$/), fc.boolean(), function (digits, withHash) {
					expect(helpers.toHex(helpers.parseHex(withHash ? `#${digits}` : digits), { alpha: true })).toBe(`#${digits.toLowerCase()}`);
				})
			);
		});

		it('short forms should equal their doubled long forms', function () {
			fc.assert(
				fc.property(fc.stringMatching(/^[0-9a-f]{3,4}$/), function (digits) {
					const doubled = digits
						.split('')
						.map(function (digit) {
							return digit + digit;
						})
						.join('');
					expect(helpers.parseHex(digits)).toEqual(helpers.parseHex(doubled));
				})
			);
		});

		it('toHex should always produce a valid lowercase hex colour, even for out-of-range channels', function () {
			fc.assert(
				fc.property(fc.double({ noNaN: true }), fc.double({ noNaN: true }), fc.double({ noNaN: true }), fc.double({ noNaN: true }), function (r, g, b, a) {
					expect(helpers.toHex({ r, g, b, a })).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
				})
			);
		});
	});

	describe('rgbToHsl / hslToRgb', function () {
		it('hslToRgb(rgbToHsl(c)) should round-trip within ±1 per channel', function () {
			fc.assert(
				fc.property(rgb, function (color) {
					const back = helpers.hslToRgb(helpers.rgbToHsl(color));
					expect(Math.abs(back.r - color.r)).toBeLessThanOrEqual(1);
					expect(Math.abs(back.g - color.g)).toBeLessThanOrEqual(1);
					expect(Math.abs(back.b - color.b)).toBeLessThanOrEqual(1);
				})
			);
		});

		it('rgbToHsl should stay within its documented ranges', function () {
			fc.assert(
				fc.property(rgb, function (color) {
					const { h, s, l } = helpers.rgbToHsl(color);
					expect(h).toBeGreaterThanOrEqual(0);
					expect(h).toBeLessThan(360);
					expect(s).toBeGreaterThanOrEqual(0);
					expect(s).toBeLessThanOrEqual(100);
					expect(l).toBeGreaterThanOrEqual(0);
					expect(l).toBeLessThanOrEqual(100);
				})
			);
		});

		it('hslToRgb should be periodic in the hue and produce integer channels in [0, 255]', function () {
			fc.assert(
				fc.property(
					fc.double({ min: -720, max: 720, noNaN: true }),
					fc.double({ min: -10, max: 110, noNaN: true }),
					fc.double({ min: -10, max: 110, noNaN: true }),
					fc.integer({ min: -3, max: 3 }),
					function (h, s, l, turns) {
						const color = helpers.hslToRgb({ h, s, l });
						for (const value of [color.r, color.g, color.b]) {
							expect(Number.isInteger(value)).toBe(true);
							expect(value).toBeGreaterThanOrEqual(0);
							expect(value).toBeLessThanOrEqual(255);
						}
						const shifted = helpers.hslToRgb({ h: h + turns * 360, s, l });
						for (const key of ['r', 'g', 'b'] as const) expect(Math.abs(shifted[key] - color[key])).toBeLessThanOrEqual(1);
					}
				)
			);
		});
	});

	describe('relativeLuminance / contrastRatio', function () {
		it('contrastRatio should be symmetric, within [1, 21], and 1 for identical colours', function () {
			fc.assert(
				fc.property(rgb, rgb, function (a, b) {
					const ratio = helpers.contrastRatio(a, b);
					expect(ratio).toBe(helpers.contrastRatio(b, a));
					expect(ratio).toBeGreaterThanOrEqual(1);
					expect(ratio).toBeLessThanOrEqual(21);
					expect(helpers.contrastRatio(a, a)).toBe(1);
				})
			);
		});

		it('relativeLuminance should be in [0, 1] and monotonic in each channel', function () {
			fc.assert(
				fc.property(rgb, channelName, byte, function (color, channel, other) {
					const lower = { ...color, [channel]: Math.min(color[channel], other) };
					const higher = { ...color, [channel]: Math.max(color[channel], other) };
					expect(helpers.relativeLuminance(lower)).toBeLessThanOrEqual(helpers.relativeLuminance(higher));
					expect(helpers.relativeLuminance(color)).toBeGreaterThanOrEqual(0);
					expect(helpers.relativeLuminance(color)).toBeLessThanOrEqual(1);
				})
			);
		});

		it('contrast against black and white should be complementary: max(black, white) >= sqrt(21)', function () {
			fc.assert(
				fc.property(rgb, function (color) {
					expect(Math.max(helpers.contrastRatio(color, '#000'), helpers.contrastRatio(color, '#fff'))).toBeGreaterThanOrEqual(Math.sqrt(21) - 1e-9);
				})
			);
		});
	});

	describe('mix', function () {
		it('should return a at weight 0, b at weight 1, and a when mixing a with itself', function () {
			fc.assert(
				fc.property(rgba, rgba, weight, function (a, b, w) {
					expect(helpers.mix(a, b, 0)).toEqual(a);
					expect(helpers.mix(a, b, 1)).toEqual(b);
					expect(helpers.mix(a, a, w)).toEqual(a);
				})
			);
		});

		it('should keep every channel between the two inputs, and be symmetric under swapping with 1 - weight', function () {
			fc.assert(
				fc.property(rgba, rgba, weight, function (a, b, w) {
					const mixed = helpers.mix(a, b, w);
					for (const key of ['r', 'g', 'b', 'a'] as const) {
						expect(mixed[key]).toBeGreaterThanOrEqual(Math.min(a[key], b[key]));
						expect(mixed[key]).toBeLessThanOrEqual(Math.max(a[key], b[key]));
						expect(Math.abs(helpers.mix(b, a, 1 - w)[key] - mixed[key])).toBeLessThanOrEqual(key === 'a' ? 1e-9 : 1);
					}
				})
			);
		});
	});

	describe('lighten / darken', function () {
		it('lighten(c, 0) and darken(c, 0) should return c', function () {
			fc.assert(
				fc.property(rgba, function (color) {
					expect(helpers.lighten(color, 0)).toEqual(color);
					expect(helpers.darken(color, 0)).toEqual(color);
				})
			);
		});

		it('lightness should be monotonic in the amount and preserve alpha', function () {
			fc.assert(
				fc.property(rgba, amount, amount, function (color, x, y) {
					const [small, large] = x <= y ? [x, y] : [y, x];
					const lightness = helpers.rgbToHsl(color).l;
					const lighter = helpers.lighten(color, small);
					const lightest = helpers.lighten(color, large);
					const darker = helpers.darken(color, small);
					const darkest = helpers.darken(color, large);
					expect(helpers.rgbToHsl(lighter).l).toBeGreaterThanOrEqual(lightness - 1e-9);
					expect(helpers.rgbToHsl(lightest).l).toBeGreaterThanOrEqual(helpers.rgbToHsl(lighter).l - 1e-9);
					expect(helpers.rgbToHsl(darker).l).toBeLessThanOrEqual(lightness + 1e-9);
					expect(helpers.rgbToHsl(darkest).l).toBeLessThanOrEqual(helpers.rgbToHsl(darker).l + 1e-9);
					expect(lightest.a).toBe(color.a);
					expect(darkest.a).toBe(color.a);
				})
			);
		});
	});

	describe('withAlpha', function () {
		it('should only replace the alpha channel', function () {
			fc.assert(
				fc.property(rgba, weight, function (color, alpha) {
					expect(helpers.withAlpha(color, alpha)).toEqual({ ...color, a: alpha });
				})
			);
		});
	});

	describe('getReadableTextColor / meetsContrast', function () {
		it('the chosen text colour should contrast at least as much as the other option', function () {
			fc.assert(
				fc.property(rgb, rgb, rgb, function (background, light, dark) {
					const chosen = helpers.getReadableTextColor(background, { light, dark });
					const other = chosen === light ? dark : light;
					expect(helpers.contrastRatio(background, chosen)).toBeGreaterThanOrEqual(helpers.contrastRatio(background, other));
				})
			);
		});

		it('AAA should imply AA, and normal text should imply large text', function () {
			fc.assert(
				fc.property(rgb, rgb, function (foreground, background) {
					if (helpers.meetsContrast(foreground, background, { level: 'AAA' })) expect(helpers.meetsContrast(foreground, background)).toBe(true);
					if (helpers.meetsContrast(foreground, background)) expect(helpers.meetsContrast(foreground, background, { largeText: true })).toBe(true);
					expect(helpers.meetsContrast(foreground, background)).toBe(helpers.contrastRatio(foreground, background) >= 4.5);
				})
			);
		});
	});
});
