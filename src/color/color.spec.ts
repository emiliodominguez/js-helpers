import * as helpers from '.';

describe('Color helpers', function () {
	describe('parseHex', function () {
		it('should parse 6 and 8 digit forms', function () {
			expect(helpers.parseHex('#ff8000')).toEqual({ r: 255, g: 128, b: 0, a: 1 });
			expect(helpers.parseHex('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 });
			expect(helpers.parseHex('#123456ff')).toEqual({ r: 0x12, g: 0x34, b: 0x56, a: 1 });
			expect(helpers.parseHex('#12345600')).toEqual({ r: 0x12, g: 0x34, b: 0x56, a: 0 });
		});

		it('should expand 3 and 4 digit forms', function () {
			expect(helpers.parseHex('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 1 });
			expect(helpers.parseHex('#abc8')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 0x88 / 255 });
		});

		it('should accept a missing # and any letter case', function () {
			expect(helpers.parseHex('0F0')).toEqual({ r: 0, g: 255, b: 0, a: 1 });
			expect(helpers.parseHex('FfA07A')).toEqual({ r: 255, g: 160, b: 122, a: 1 });
		});

		it('should throw a TypeError for invalid strings', function () {
			for (const value of ['', '#', '#ff', '#fffff', '#fffffff', '#fffffffff', '#ggg', ' #fff', '#fff ', '##fff', 'rgb(0,0,0)', '#ff 00 00']) {
				expect(function () {
					helpers.parseHex(value);
				}).toThrow(TypeError);
			}
		});

		it('should throw a TypeError for non-strings', function () {
			expect(function () {
				helpers.parseHex(123 as any);
			}).toThrow(TypeError);
		});
	});

	describe('toRgba', function () {
		it('should parse hex strings', function () {
			expect(helpers.toRgba('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
		});

		it('should clamp and round object channels and default alpha to 1', function () {
			expect(helpers.toRgba({ r: 300, g: 12.4, b: -5 })).toEqual({ r: 255, g: 12, b: 0, a: 1 });
			expect(helpers.toRgba({ r: 0.5, g: 254.5, b: Infinity, a: 2 })).toEqual({ r: 1, g: 255, b: 255, a: 1 });
			expect(helpers.toRgba({ r: -0.4, g: 0, b: 0, a: -1 })).toEqual({ r: 0, g: 0, b: 0, a: 0 });
			expect(Object.is(helpers.toRgba({ r: -0.4, g: 0, b: 0, a: -0 }).r, 0)).toBe(true);
			expect(Object.is(helpers.toRgba({ r: 0, g: 0, b: 0, a: -0 }).a, 0)).toBe(true);
			expect(helpers.toRgba({ r: 1, g: 2, b: 3, a: undefined } as any)).toEqual({ r: 1, g: 2, b: 3, a: 1 });
		});

		it('should return a fresh object without mutating the input', function () {
			const input = Object.freeze({ r: 1, g: 2, b: 3, a: 0.5 });
			const result = helpers.toRgba(input);
			expect(result).toEqual(input);
			expect(result).not.toBe(input);
		});

		it('should throw a TypeError for invalid inputs', function () {
			for (const value of [null, undefined, 42, true, { r: '1', g: 0, b: 0 }, { r: 0, g: 0 }, { r: 0, g: 0, b: 0, a: '1' }]) {
				expect(function () {
					helpers.toRgba(value as any);
				}).toThrow(TypeError);
			}
		});

		it('should throw a RangeError for NaN channels', function () {
			expect(function () {
				helpers.toRgba({ r: NaN, g: 0, b: 0 });
			}).toThrow(RangeError);
			expect(function () {
				helpers.toRgba({ r: 0, g: 0, b: 0, a: NaN });
			}).toThrow(RangeError);
		});
	});

	describe('toHex', function () {
		it('should format opaque colours as #rrggbb', function () {
			expect(helpers.toHex({ r: 255, g: 128, b: 0 })).toBe('#ff8000');
			expect(helpers.toHex({ r: 0, g: 10, b: 1, a: 1 })).toBe('#000a01');
			expect(helpers.toHex('#ABC')).toBe('#aabbcc');
		});

		it('should include alpha automatically for translucent colours', function () {
			expect(helpers.toHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080');
			expect(helpers.toHex({ r: 0, g: 0, b: 0, a: 0 })).toBe('#00000000');
		});

		it('should honour the alpha option', function () {
			expect(helpers.toHex('#ABC', { alpha: true })).toBe('#aabbccff');
			expect(helpers.toHex({ r: 0, g: 0, b: 0, a: 0.5 }, { alpha: false })).toBe('#000000');
		});

		it('should clamp and round channels', function () {
			expect(helpers.toHex({ r: 300, g: -20, b: 127.5 })).toBe('#ff0080');
			expect(helpers.toHex({ r: 0, g: 0, b: 0, a: 1.5 })).toBe('#000000');
		});

		it('should throw for invalid colours', function () {
			expect(function () {
				helpers.toHex('nope');
			}).toThrow(TypeError);
		});
	});

	describe('rgbToHsl', function () {
		it('should convert primary and secondary colours', function () {
			expect(helpers.rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
			expect(helpers.rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50 });
			expect(helpers.rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
			expect(helpers.rgbToHsl('#ffff00')).toEqual({ h: 60, s: 100, l: 50 });
			expect(helpers.rgbToHsl('#00ffff')).toEqual({ h: 180, s: 100, l: 50 });
			expect(helpers.rgbToHsl('#ff00ff')).toEqual({ h: 300, s: 100, l: 50 });
		});

		it('should keep the hue in [0, 360) for hues just below red', function () {
			const { h } = helpers.rgbToHsl('#ff0001');
			expect(h).toBeGreaterThanOrEqual(0);
			expect(h).toBeLessThan(360);
			expect(h).toBeCloseTo(359.76, 2);
		});

		it('should give greys hue 0 and saturation 0', function () {
			expect(helpers.rgbToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0 });
			expect(helpers.rgbToHsl('#ffffff')).toEqual({ h: 0, s: 0, l: 100 });
			expect(helpers.rgbToHsl('#808080')).toEqual({ h: 0, s: 0, l: (128 / 255) * 100 });
		});

		it('should compute saturation for light and dark colours', function () {
			const dark = helpers.rgbToHsl({ r: 0, g: 128, b: 0 });
			expect(dark.h).toBe(120);
			expect(dark.s).toBe(100);
			expect(dark.l).toBeCloseTo(25.1, 1);
			const pastel = helpers.rgbToHsl('#ffa07a');
			expect(pastel.h).toBeCloseTo(17.14, 2);
			expect(pastel.s).toBe(100);
			expect(pastel.l).toBeCloseTo(73.92, 2);
		});
	});

	describe('hslToRgb', function () {
		it('should convert standard colours', function () {
			expect(helpers.hslToRgb({ h: 0, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
			expect(helpers.hslToRgb({ h: 120, s: 100, l: 25 })).toEqual({ r: 0, g: 128, b: 0 });
			expect(helpers.hslToRgb({ h: 240, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 });
			expect(helpers.hslToRgb({ h: 0, s: 0, l: 50 })).toEqual({ r: 128, g: 128, b: 128 });
			expect(helpers.hslToRgb({ h: 200, s: 50, l: 100 })).toEqual({ r: 255, g: 255, b: 255 });
			expect(helpers.hslToRgb({ h: 200, s: 50, l: 0 })).toEqual({ r: 0, g: 0, b: 0 });
		});

		it('should normalize the hue and clamp saturation and lightness', function () {
			expect(helpers.hslToRgb({ h: -120, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 });
			expect(helpers.hslToRgb({ h: 600, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 });
			expect(helpers.hslToRgb({ h: 360, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
			expect(helpers.hslToRgb({ h: 0, s: 150, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
			expect(helpers.hslToRgb({ h: 0, s: 100, l: -10 })).toEqual({ r: 0, g: 0, b: 0 });
		});

		it('should throw for invalid input', function () {
			expect(function () {
				helpers.hslToRgb(null as any);
			}).toThrow(TypeError);
			expect(function () {
				helpers.hslToRgb('#fff' as any);
			}).toThrow(TypeError);
			expect(function () {
				helpers.hslToRgb({ h: '0', s: 0, l: 0 } as any);
			}).toThrow(TypeError);
			expect(function () {
				helpers.hslToRgb({ h: Infinity, s: 0, l: 0 });
			}).toThrow(RangeError);
			expect(function () {
				helpers.hslToRgb({ h: 0, s: NaN, l: 0 });
			}).toThrow(RangeError);
		});
	});

	describe('mix', function () {
		it('should interpolate sRGB channels, default to the midpoint', function () {
			expect(helpers.mix('#000000', '#ffffff')).toEqual({ r: 128, g: 128, b: 128, a: 1 });
			expect(helpers.mix('#ff0000', '#0000ff', 0.25)).toEqual({ r: 191, g: 0, b: 64, a: 1 });
		});

		it('should return the endpoints for weights 0 and 1', function () {
			expect(helpers.mix('#ff0000', '#0000ff', 0)).toEqual({ r: 255, g: 0, b: 0, a: 1 });
			expect(helpers.mix('#ff0000', '#0000ff', 1)).toEqual({ r: 0, g: 0, b: 255, a: 1 });
		});

		it('should interpolate alpha', function () {
			expect(helpers.mix({ r: 0, g: 0, b: 0, a: 0 }, '#000', 0.5)).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
			// Plain `(1 - w) * x + w * y` overshoots here (0.41960784313725497).
			expect(helpers.mix({ r: 0, g: 0, b: 0, a: 107 / 255 }, { r: 0, g: 0, b: 0, a: 106 / 255 }, 6.009343965836637e-16).a).toBe(107 / 255);
		});

		it('should throw a RangeError for weights outside [0, 1]', function () {
			for (const weight of [-0.1, 1.1, NaN]) {
				expect(function () {
					helpers.mix('#000', '#fff', weight);
				}).toThrow(RangeError);
			}
		});
	});

	describe('lighten / darken', function () {
		it('should adjust HSL lightness', function () {
			expect(helpers.lighten('#000000', 50)).toEqual({ r: 128, g: 128, b: 128, a: 1 });
			expect(helpers.lighten('#ff0000', 20)).toEqual({ r: 255, g: 102, b: 102, a: 1 });
			expect(helpers.darken('#ffffff', 50)).toEqual({ r: 128, g: 128, b: 128, a: 1 });
			expect(helpers.darken('#ff0000', 20)).toEqual({ r: 153, g: 0, b: 0, a: 1 });
		});

		it('should clamp the lightness at white and black', function () {
			expect(helpers.lighten('#ffffff', 10)).toEqual({ r: 255, g: 255, b: 255, a: 1 });
			expect(helpers.lighten('#336699', 100)).toEqual({ r: 255, g: 255, b: 255, a: 1 });
			expect(helpers.darken('#336699', 100)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
		});

		it('should keep alpha and return the normalized colour for amount 0', function () {
			expect(helpers.lighten({ r: 10, g: 20, b: 30, a: 0.25 }, 0)).toEqual({ r: 10, g: 20, b: 30, a: 0.25 });
			expect(helpers.darken('#33669980', 10).a).toBe(0x80 / 255);
		});

		it('should throw a RangeError for amounts outside [0, 100]', function () {
			for (const amount of [-1, 101, NaN]) {
				expect(function () {
					helpers.lighten('#000', amount);
				}).toThrow(RangeError);
				expect(function () {
					helpers.darken('#000', amount);
				}).toThrow(RangeError);
			}
		});
	});

	describe('withAlpha', function () {
		it('should replace the alpha channel', function () {
			expect(helpers.withAlpha('#ff0000', 0.5)).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
			expect(helpers.withAlpha({ r: 1, g: 2, b: 3, a: 0.1 }, 1)).toEqual({ r: 1, g: 2, b: 3, a: 1 });
			expect(Object.is(helpers.withAlpha('#000', -0).a, 0)).toBe(true);
		});

		it('should throw a RangeError for alpha outside [0, 1]', function () {
			for (const alpha of [-0.1, 1.1, NaN]) {
				expect(function () {
					helpers.withAlpha('#000', alpha);
				}).toThrow(RangeError);
			}
		});
	});

	describe('relativeLuminance', function () {
		it('should follow the WCAG 2.x definition', function () {
			expect(helpers.relativeLuminance('#ffffff')).toBe(1);
			expect(helpers.relativeLuminance('#000000')).toBe(0);
			expect(helpers.relativeLuminance('#ff0000')).toBeCloseTo(0.2126, 12);
			expect(helpers.relativeLuminance('#00ff00')).toBeCloseTo(0.7152, 12);
			expect(helpers.relativeLuminance('#0000ff')).toBeCloseTo(0.0722, 12);
			expect(helpers.relativeLuminance('#808080')).toBeCloseTo(0.2158605, 6);
			expect(helpers.relativeLuminance('#0a0a0a')).toBeCloseTo(10 / 255 / 12.92, 12);
		});

		it('should ignore alpha', function () {
			expect(helpers.relativeLuminance('#80808000')).toBe(helpers.relativeLuminance('#808080'));
		});
	});

	describe('contrastRatio', function () {
		it('should compute WCAG contrast ratios', function () {
			expect(helpers.contrastRatio('#000', '#fff')).toBe(21);
			expect(helpers.contrastRatio('#fff', '#000')).toBe(21);
			expect(helpers.contrastRatio('#777', '#fff')).toBeCloseTo(4.478, 3);
			expect(helpers.contrastRatio('#767676', '#fff')).toBeCloseTo(4.542, 3);
			expect(helpers.contrastRatio('#abc', '#abc')).toBe(1);
		});
	});

	describe('getReadableTextColor', function () {
		it('should pick the default candidate with more contrast', function () {
			expect(helpers.getReadableTextColor('#1e3a8a')).toBe('#ffffff');
			expect(helpers.getReadableTextColor('#fde68a')).toBe('#000000');
			expect(helpers.getReadableTextColor('#000')).toBe('#ffffff');
			expect(helpers.getReadableTextColor('#fff')).toBe('#000000');
		});

		it('should return custom candidates as given', function () {
			const light = { r: 238, g: 238, b: 238 };
			expect(helpers.getReadableTextColor('#222', { light, dark: '#333' })).toBe(light);
			expect(helpers.getReadableTextColor('#eee', { light: '#fff', dark: { r: 10, g: 10, b: 10 } })).toEqual({ r: 10, g: 10, b: 10 });
		});

		it('should prefer the dark candidate on ties', function () {
			expect(helpers.getReadableTextColor('#777', { light: '#123', dark: '#123' })).toBe('#123');
			expect(helpers.getReadableTextColor('#777', { light: '#000', dark: '#000000' })).toBe('#000000');
		});
	});

	describe('meetsContrast', function () {
		it('should check WCAG AA by default', function () {
			expect(helpers.meetsContrast('#767676', '#ffffff')).toBe(true);
			expect(helpers.meetsContrast('#777777', '#ffffff')).toBe(false);
		});

		it('should use the large-text thresholds', function () {
			expect(helpers.meetsContrast('#777777', '#ffffff', { largeText: true })).toBe(true);
			expect(helpers.meetsContrast('#959595', '#ffffff', { largeText: true })).toBe(false);
		});

		it('should check AAA', function () {
			expect(helpers.meetsContrast('#767676', '#ffffff', { level: 'AAA' })).toBe(false);
			expect(helpers.meetsContrast('#595959', '#ffffff', { level: 'AAA' })).toBe(true);
			expect(helpers.meetsContrast('#767676', '#ffffff', { level: 'AAA', largeText: true })).toBe(true);
		});

		it('should throw a RangeError for an unknown level', function () {
			expect(function () {
				helpers.meetsContrast('#000', '#fff', { level: 'A' as any });
			}).toThrow(RangeError);
		});
	});
});
