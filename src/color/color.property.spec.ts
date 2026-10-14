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
/** Colours with 8-bit channels and an alpha in 0.01 steps. */
const cssRgba = fc.record({
	r: byte,
	g: byte,
	b: byte,
	a: fc.integer({ min: 0, max: 100 }).map(function (value) {
		return value / 100;
	})
});
/** Optional CSS whitespace. */
const space = fc.constantFrom('', ' ', '  ', '\t', '\n');

/**
 * Checks that a value is a normalized Rgba colour: integer channels in [0, 255] and an alpha in [0, 1].
 */
function expectNormalized(color: helpers.Rgba): void {
	for (const channel of [color.r, color.g, color.b]) {
		expect(Number.isInteger(channel) && channel >= 0 && channel <= 255).toBe(true);
	}
	expect(color.a >= 0 && color.a <= 1).toBe(true);
}

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
	describe('parseColor / toCssRgb / toCssHsl', function () {
		it('parseColor(toCssRgb(c)) should round-trip 8-bit channels and alpha in 0.01 steps', function () {
			fc.assert(
				fc.property(cssRgba, function (color) {
					expect(helpers.parseColor(helpers.toCssRgb(color))).toEqual(color);
				})
			);
		});

		it('parseColor(toCssHsl(c)) should round-trip 8-bit channels and alpha in 0.01 steps', function () {
			fc.assert(
				fc.property(cssRgba, function (color) {
					expect(helpers.parseColor(helpers.toCssHsl(color))).toEqual(color);
				})
			);
		});

		it('parseColor should agree with parseHex on every hex string', function () {
			fc.assert(
				fc.property(fc.stringMatching(/^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/), function (hex) {
					expect(helpers.parseColor(hex)).toEqual(helpers.parseHex(hex));
					expect(helpers.toRgba(hex)).toEqual(helpers.parseHex(hex));
				})
			);
		});

		it('parseColor should accept everything parseHex accepts, with the same result', function () {
			fc.assert(
				fc.property(fc.string({ unit: fc.constantFrom('#', 'a', 'F', '0', '9', 'g', ' '), maxLength: 10 }), function (text) {
					let expected: helpers.Rgba | undefined;
					try {
						expected = helpers.parseHex(text);
					} catch {
						return;
					}
					expect(helpers.parseColor(text)).toEqual(expected);
				})
			);
		});

		it('the legacy and modern rgb() syntaxes should agree', function () {
			fc.assert(
				fc.property(cssRgba, space, function ({ r, g, b, a }, ws) {
					const modern = helpers.parseColor(`rgb(${ws}${r} ${g} ${b}${ws}/${ws}${a * 100}%${ws})`);
					expect(helpers.parseColor(`rgba(${r},${ws}${g}${ws},${b}, ${a})`)).toEqual(modern);
					expect(modern).toEqual({ r, g, b, a });
				})
			);
		});

		it('percentage channels should scale to 255 and be rounded', function () {
			fc.assert(
				fc.property(fc.double({ min: -50, max: 150, noNaN: true }), function (percent) {
					const text = String(percent);
					// String(percent) is a valid CSS number except for a few exotic forms; skip anything else.
					fc.pre(/^-?\d+(\.\d+)?(e[+-]\d+)?$/.test(text));
					const { r } = helpers.parseColor(`rgb(${text}% 0 0)`);
					expect(r).toBe(helpers.toRgba({ r: (percent * 255) / 100, g: 0, b: 0 }).r);
				})
			);
		});

		it('hsl() should match hslToRgb, in both syntaxes and every hue unit', function () {
			fc.assert(
				fc.property(fc.integer({ min: -720, max: 720 }), fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), function (h, s, l) {
					const expected = { ...helpers.hslToRgb({ h, s, l }), a: 1 };
					expect(helpers.parseColor(`hsl(${h}, ${s}%, ${l}%)`)).toEqual(expected);
					expect(helpers.parseColor(`hsl(${h}deg ${s} ${l}%)`)).toEqual(expected);
					expect(helpers.parseColor(`hsla(${h + 360} ${s}% ${l} / 1)`)).toEqual(expected);
					// Hues that are exact in turns (multiples of 9 degrees = 0.025 turn) must give the same colour.
					if (h % 9 === 0) expect(helpers.parseColor(`hsl(${h / 360}turn ${s}% ${l}%)`)).toEqual(expected);
				})
			);
		});

		it('parseColor should ignore surrounding whitespace and letter case', function () {
			fc.assert(
				fc.property(cssRgba, space, space, fc.boolean(), function (color, before, after, upper) {
					const css = helpers.toCssHsl(color);
					expect(helpers.parseColor(`${before}${upper ? css.toUpperCase() : css}${after}`)).toEqual(helpers.parseColor(css));
				})
			);
		});

		it('parseColor should either throw a TypeError or return a normalized colour', function () {
			const token = fc.constantFrom('rgb(', 'rgba(', 'hsl(', 'hsla(', ')', ',', '/', ' ', '%', 'deg', 'turn', 'none', '-', '.', 'e', '1', '50', '255', '#', 'f');
			fc.assert(
				fc.property(fc.array(token, { maxLength: 14 }), function (tokens) {
					let color: helpers.Rgba;
					try {
						color = helpers.parseColor(tokens.join(''));
					} catch (error) {
						expect(error).toBeInstanceOf(TypeError);
						return;
					}
					expectNormalized(color);
				})
			);
		});
	});
});
