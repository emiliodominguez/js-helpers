import { clamp, lerp, modulo } from '../math/index.js';
import { assertNumber, describe } from '../utils/assert.js';

/**
 * An sRGB colour with 8-bit channels (`0`–`255`). Values produced by this module are always integers in that range.
 */
export interface Rgb {
	/** Red channel, `0`–`255`. */
	r: number;
	/** Green channel, `0`–`255`. */
	g: number;
	/** Blue channel, `0`–`255`. */
	b: number;
}

/**
 * An sRGB colour with 8-bit channels and an alpha (opacity) channel.
 */
export interface Rgba extends Rgb {
	/** Alpha channel, `0` (transparent) – `1` (opaque). */
	a: number;
}

/**
 * A colour in the HSL model.
 */
export interface Hsl {
	/** Hue in degrees, `[0, 360)`. */
	h: number;
	/** Saturation in percent, `0`–`100`. */
	s: number;
	/** Lightness in percent, `0`–`100`. */
	l: number;
}

/**
 * Any colour accepted by the higher-level helpers of this module: an {@link Rgb} / {@link Rgba} object,
 * or a hex string understood by {@link parseHex} (`'#rgb'`, `'#rgba'`, `'#rrggbb'`, `'#rrggbbaa'`, with or without `#`).
 */
export type ColorInput = Rgb | Rgba | string;

/**
 * Options accepted by {@link toHex}.
 */
export interface ToHexOptions {
	/**
	 * `true` always appends the alpha byte (`#rrggbbaa`), `false` never does (`#rrggbb`).
	 * When omitted, the alpha byte is appended only for translucent colours (`a < 1`).
	 */
	alpha?: boolean;
}

/**
 * Options accepted by {@link getReadableTextColor}.
 * @template L - Type of the light option
 * @template D - Type of the dark option
 */
export interface ReadableTextColorOptions<L extends ColorInput, D extends ColorInput> {
	/**
	 * The light text colour candidate.
	 * @default '#ffffff'
	 */
	light?: L;
	/**
	 * The dark text colour candidate.
	 * @default '#000000'
	 */
	dark?: D;
}

/**
 * WCAG 2.x conformance level for {@link meetsContrast}.
 */
export type ContrastLevel = 'AA' | 'AAA';

/**
 * Options accepted by {@link meetsContrast}.
 */
export interface MeetsContrastOptions {
	/**
	 * The WCAG conformance level to check.
	 * @default 'AA'
	 */
	level?: ContrastLevel;
	/**
	 * Whether the text is "large" (at least 18pt, or 14pt bold), which lowers the required ratio.
	 * @default false
	 */
	largeText?: boolean;
}

const HEX_PATTERN = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Minimum contrast ratios from WCAG 2.x success criteria 1.4.3 (AA) and 1.4.6 (AAA). */
const CONTRAST_THRESHOLDS: Readonly<Record<ContrastLevel, { normal: number; large: number }>> = {
	AA: { normal: 4.5, large: 3 },
	AAA: { normal: 7, large: 4.5 }
};

/**
 * Reads a numeric colour channel, rejecting non-numbers and `NaN`.
 * @param {string} name - Function name for the error message
 * @param {string} channel - Channel name for the error message
 * @param {unknown} value - The channel value
 * @returns {number} The channel value
 * @throws {TypeError} when the value is not a number
 * @throws {RangeError} when the value is `NaN`
 * @example
 * readChannel('toRgba', 'input.r', 12); // => 12
 */
function readChannel(name: string, channel: string, value: unknown): number {
	assertNumber(name, channel, value, !Number.isNaN(value), 'a number other than NaN');
	return value;
}

/**
 * Clamps a channel to `[0, 255]` and rounds it to the nearest integer (`+ 0` normalizes `-0`).
 * @param {number} value - The channel value
 * @returns {number} An integer in `[0, 255]`
 * @example
 * toByte(255.6); // => 255
 */
function toByte(value: number): number {
	return Math.round(clamp(value, 0, 255)) + 0;
}

/**
 * Formats a byte as two lowercase hex digits.
 * @param {number} value - An integer in `[0, 255]`
 * @returns {string} Two hex digits
 * @example
 * hexByte(10); // => '0a'
 */
function hexByte(value: number): string {
	return value.toString(16).padStart(2, '0');
}

/**
 * Converts one 8-bit sRGB channel to linear light, as defined by WCAG 2.x.
 * @param {number} value - Channel in `[0, 255]`
 * @returns {number} Linear channel in `[0, 1]`
 * @example
 * linearChannel(255); // => 1
 */
function linearChannel(value: number): number {
	const unit = value / 255;
	return unit <= 0.04045 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
}

/**
 * Parses a CSS hex colour. Accepts the 3, 4, 6 and 8 digit forms (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), with or
 * without the leading `#`, in any letter case. Surrounding whitespace and other syntaxes are rejected.
 * @param {string} hex - The hex string
 * @returns {Rgba} The colour, with alpha `1` when the string has no alpha digits
 * @throws {TypeError} when `hex` is not a string or not a valid hex colour
 * @example
 * parseHex('#ff8000'); // => { r: 255, g: 128, b: 0, a: 1 }
 * parseHex('0F0'); // => { r: 0, g: 255, b: 0, a: 1 }
 * parseHex('#00000080'); // => { r: 0, g: 0, b: 0, a: 0.5019607843137255 }
 */
export function parseHex(hex: string): Rgba {
	if (typeof hex !== 'string') throw new TypeError(`parseHex: \`hex\` must be a string, got ${describe(hex)}`);
	const match = HEX_PATTERN.exec(hex);
	if (match === null) throw new TypeError(`parseHex: \`hex\` must be a valid hex colour, got ${JSON.stringify(hex)}`);
	let digits = match[1];
	if (digits.length <= 4) {
		digits = digits
			.split('')
			.map(function (digit) {
				return digit + digit;
			})
			.join('');
	}
	const alpha = digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1;
	return {
		r: parseInt(digits.slice(0, 2), 16),
		g: parseInt(digits.slice(2, 4), 16),
		b: parseInt(digits.slice(4, 6), 16),
		a: alpha
	};
}

/**
 * Normalizes any {@link ColorInput} to a fresh {@link Rgba} object: hex strings are parsed with {@link parseHex};
 * for objects, `r`, `g`, `b` are clamped to `[0, 255]` and rounded to integers, and `a` (default `1` when missing or `undefined`) is clamped to `[0, 1]`.
 * @param {ColorInput} input - A hex string or an `Rgb` / `Rgba` object
 * @returns {Rgba} A new normalized colour
 * @throws {TypeError} when `input` is neither a string nor an object, is an invalid hex string, or has a non-numeric channel
 * @throws {RangeError} when a channel is `NaN`
 * @example
 * toRgba('#fff'); // => { r: 255, g: 255, b: 255, a: 1 }
 * toRgba({ r: 300, g: 12.4, b: -5 }); // => { r: 255, g: 12, b: 0, a: 1 }
 * toRgba({ r: 0, g: 0, b: 0, a: 0.5 }); // => { r: 0, g: 0, b: 0, a: 0.5 }
 */
export function toRgba(input: ColorInput): Rgba {
	if (typeof input === 'string') return parseHex(input);
	if (typeof input !== 'object' || input === null) throw new TypeError(`toRgba: \`input\` must be a hex string or an { r, g, b } object, got ${describe(input)}`);
	const rawAlpha = (input as Partial<Rgba>).a;
	const alpha = rawAlpha === undefined ? 1 : readChannel('toRgba', 'input.a', rawAlpha);
	return {
		r: toByte(readChannel('toRgba', 'input.r', input.r)),
		g: toByte(readChannel('toRgba', 'input.g', input.g)),
		b: toByte(readChannel('toRgba', 'input.b', input.b)),
		a: clamp(alpha, 0, 1) + 0
	};
}

/**
 * Formats a colour as a lowercase CSS hex string. Channels are clamped and rounded (see {@link toRgba}).
 * @param {ColorInput} color - The colour
 * @param {ToHexOptions} [options={}] - `alpha`: `true` to always emit `#rrggbbaa`, `false` to always emit `#rrggbb`;
 * by default the alpha byte is emitted only when the colour is translucent
 * @returns {string} `'#rrggbb'` or `'#rrggbbaa'`
 * @throws {TypeError} when `color` is not a valid colour (see {@link toRgba})
 * @throws {RangeError} when a channel is `NaN`
 * @example
 * toHex({ r: 255, g: 128, b: 0 }); // => '#ff8000'
 * toHex({ r: 0, g: 0, b: 0, a: 0.5 }); // => '#00000080'
 * toHex('#ABC', { alpha: true }); // => '#aabbccff'
 * toHex({ r: 0, g: 0, b: 0, a: 0.5 }, { alpha: false }); // => '#000000'
 */
export function toHex(color: ColorInput, options: ToHexOptions = {}): string {
	const { r, g, b, a } = toRgba(color);
	const includeAlpha = options.alpha ?? a < 1;
	return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}${includeAlpha ? hexByte(Math.round(a * 255)) : ''}`;
}

/**
 * Converts an RGB colour to HSL using the standard (CSS Color 4) formulas. The result is not rounded.
 * Achromatic colours (greys) get hue `0` and saturation `0`. Alpha is ignored.
 * @param {ColorInput} color - The colour (channels are clamped and rounded first, see {@link toRgba})
 * @returns {Hsl} Hue in `[0, 360)`, saturation and lightness in `[0, 100]`
 * @throws {TypeError} when `color` is not a valid colour (see {@link toRgba})
 * @throws {RangeError} when a channel is `NaN`
 * @example
 * rgbToHsl({ r: 255, g: 0, b: 0 }); // => { h: 0, s: 100, l: 50 }
 * rgbToHsl('#808080'); // => { h: 0, s: 0, l: 50.19607843137255 }
 */
export function rgbToHsl(color: ColorInput): Hsl {
	const rgba = toRgba(color);
	const r = rgba.r / 255;
	const g = rgba.g / 255;
	const b = rgba.b / 255;
	const high = Math.max(r, g, b);
	const low = Math.min(r, g, b);
	const lightness = (high + low) / 2;
	const delta = high - low;
	if (delta === 0) return { h: 0, s: 0, l: lightness * 100 };

	const saturation = delta / (1 - Math.abs(2 * lightness - 1));
	let hue: number;
	if (high === r) hue = (g - b) / delta;
	else if (high === g) hue = (b - r) / delta + 2;
	else hue = (r - g) / delta + 4;
	return { h: modulo(hue * 60, 360), s: clamp(saturation * 100, 0, 100), l: lightness * 100 };
}

/**
 * Converts an HSL colour to RGB using the standard (CSS Color 4) formulas, rounding channels to integers.
 * The hue is normalized into `[0, 360)` (so `-120` and `600` both mean `240`); saturation and lightness are clamped to `[0, 100]`.
 * @param {Hsl} hsl - The colour in HSL
 * @returns {Rgb} The colour in RGB with integer channels in `[0, 255]`
 * @throws {TypeError} when `hsl` is not an object or a component is not a number
 * @throws {RangeError} when a component is `NaN` or the hue is infinite
 * @example
 * hslToRgb({ h: 0, s: 100, l: 50 }); // => { r: 255, g: 0, b: 0 }
 * hslToRgb({ h: 120, s: 100, l: 25 }); // => { r: 0, g: 128, b: 0 }
 * hslToRgb({ h: -120, s: 100, l: 50 }); // => { r: 0, g: 0, b: 255 }
 */
export function hslToRgb(hsl: Hsl): Rgb {
	if (typeof hsl !== 'object' || hsl === null) throw new TypeError(`hslToRgb: \`hsl\` must be an { h, s, l } object, got ${describe(hsl)}`);
	const hue = readChannel('hslToRgb', 'hsl.h', hsl.h);
	if (!Number.isFinite(hue)) throw new RangeError(`hslToRgb: \`hsl.h\` must be finite, got ${hue}`);
	const h = modulo(hue, 360);
	const s = clamp(readChannel('hslToRgb', 'hsl.s', hsl.s), 0, 100) / 100;
	const l = clamp(readChannel('hslToRgb', 'hsl.l', hsl.l), 0, 100) / 100;
	const chroma = s * Math.min(l, 1 - l);

	/**
	 * Computes one RGB channel from the CSS Color 4 `hslToRgb` helper.
	 * @param {number} offset - `0` for red, `8` for green, `4` for blue
	 * @returns {number} The channel as an integer in `[0, 255]`
	 * @example
	 * channel(0); // red
	 */
	function channel(offset: number): number {
		const k = (offset + h / 30) % 12;
		return toByte((l - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
	}

	return { r: channel(0), g: channel(8), b: channel(4) };
}

/**
 * Mixes two colours by plain linear interpolation of their sRGB channels and alpha (no gamma-correct or premultiplied
 * blending). `weight` is the proportion of `colorB`: `0` gives `colorA`, `1` gives `colorB`, `0.5` the midpoint.
 * (Note: this is the opposite convention from Sass's `mix`, whose weight is the proportion of the first colour.)
 * @param {ColorInput} colorA - The colour at `weight = 0`
 * @param {ColorInput} colorB - The colour at `weight = 1`
 * @param {number} [weight=0.5] - Proportion of `colorB`, in `[0, 1]`
 * @returns {Rgba} The mixed colour (channels rounded to integers, alpha interpolated)
 * @throws {TypeError} when a colour is invalid (see {@link toRgba})
 * @throws {TypeError} when `weight` is not a number
 * @throws {RangeError} when `weight` is not in `[0, 1]` or a channel is `NaN`
 * @example
 * mix('#000000', '#ffffff'); // => { r: 128, g: 128, b: 128, a: 1 }
 * mix('#ff0000', '#0000ff', 0.25); // => { r: 191, g: 0, b: 64, a: 1 }
 * mix({ r: 0, g: 0, b: 0, a: 0 }, '#000', 0.5); // => { r: 0, g: 0, b: 0, a: 0.5 }
 */
export function mix(colorA: ColorInput, colorB: ColorInput, weight = 0.5): Rgba {
	assertNumber('mix', 'weight', weight, weight >= 0 && weight <= 1, 'a number in [0, 1]');
	const a = toRgba(colorA);
	const b = toRgba(colorB);
	return {
		r: toByte(lerp(a.r, b.r, weight)),
		g: toByte(lerp(a.g, b.g, weight)),
		b: toByte(lerp(a.b, b.b, weight)),
		// Clamp to the inputs: `(1 - w) * x + w * y` can overshoot max(x, y) by one ulp.
		a: clamp(lerp(a.a, b.a, weight), Math.min(a.a, b.a), Math.max(a.a, b.a))
	};
}

/**
 * Shifts the HSL lightness of a colour by `delta` percentage points (clamped to `[0, 100]`), keeping hue, saturation and alpha.
 * @param {ColorInput} color - The colour
 * @param {number} delta - Lightness change, in `[-100, 100]`
 * @returns {Rgba} The adjusted colour
 * @example
 * shiftLightness('#808080', 10); // lighter grey
 */
function shiftLightness(color: ColorInput, delta: number): Rgba {
	const rgba = toRgba(color);
	if (delta === 0) return rgba;
	const hsl = rgbToHsl(rgba);
	const rgb = hslToRgb({ h: hsl.h, s: hsl.s, l: clamp(hsl.l + delta, 0, 100) });
	return { r: rgb.r, g: rgb.g, b: rgb.b, a: rgba.a };
}

/**
 * Validates the `amount` argument of {@link lighten} and {@link darken}.
 * @param {string} name - Function name for the error message
 * @param {number} amount - The amount to validate
 * @returns {void}
 * @throws {TypeError} when `amount` is not a number
 * @throws {RangeError} when `amount` is not in `[0, 100]`
 * @example
 * assertAmount('lighten', 10); // ok
 */
function assertAmount(name: string, amount: number): void {
	assertNumber(name, 'amount', amount, amount >= 0 && amount <= 100, 'a number in [0, 100]');
}

/**
 * Makes a colour lighter by adding `amount` percentage points to its HSL lightness (the result is clamped at `100`, white).
 * Hue, saturation and alpha are kept. `lighten(color, 0)` returns the (normalized) colour unchanged.
 * @param {ColorInput} color - The colour
 * @param {number} amount - Lightness points to add, in `[0, 100]`
 * @returns {Rgba} The lighter colour
 * @throws {TypeError} when `color` is invalid (see {@link toRgba}), or `amount` is not a number
 * @throws {RangeError} when `amount` is not in `[0, 100]` or a channel is `NaN`
 * @example
 * lighten('#000000', 50); // => { r: 128, g: 128, b: 128, a: 1 }
 * lighten('#ff0000', 20); // => { r: 255, g: 102, b: 102, a: 1 }
 * lighten('#ffffff', 10); // => { r: 255, g: 255, b: 255, a: 1 }
 */
export function lighten(color: ColorInput, amount: number): Rgba {
	assertAmount('lighten', amount);
	return shiftLightness(color, amount);
}

/**
 * Makes a colour darker by subtracting `amount` percentage points from its HSL lightness (the result is clamped at `0`, black).
 * Hue, saturation and alpha are kept. `darken(color, 0)` returns the (normalized) colour unchanged.
 * @param {ColorInput} color - The colour
 * @param {number} amount - Lightness points to subtract, in `[0, 100]`
 * @returns {Rgba} The darker colour
 * @throws {TypeError} when `color` is invalid (see {@link toRgba}), or `amount` is not a number
 * @throws {RangeError} when `amount` is not in `[0, 100]` or a channel is `NaN`
 * @example
 * darken('#ffffff', 50); // => { r: 128, g: 128, b: 128, a: 1 }
 * darken('#ff0000', 20); // => { r: 153, g: 0, b: 0, a: 1 }
 */
export function darken(color: ColorInput, amount: number): Rgba {
	assertAmount('darken', amount);
	return shiftLightness(color, -amount);
}

/**
 * Returns a copy of a colour with the given alpha.
 * @param {ColorInput} color - The colour
 * @param {number} alpha - The new alpha, in `[0, 1]`
 * @returns {Rgba} The colour with its alpha replaced
 * @throws {TypeError} when `color` is invalid (see {@link toRgba}), or `alpha` is not a number
 * @throws {RangeError} when `alpha` is not in `[0, 1]` or a channel is `NaN`
 * @example
 * withAlpha('#ff0000', 0.5); // => { r: 255, g: 0, b: 0, a: 0.5 }
 */
export function withAlpha(color: ColorInput, alpha: number): Rgba {
	assertNumber('withAlpha', 'alpha', alpha, alpha >= 0 && alpha <= 1, 'a number in [0, 1]');
	const rgba = toRgba(color);
	return { r: rgba.r, g: rgba.g, b: rgba.b, a: alpha + 0 };
}

/**
 * Computes the WCAG 2.x relative luminance of a colour: `0.2126 R + 0.7152 G + 0.0722 B` over the linearized sRGB channels.
 * Alpha is ignored (composite translucent colours over their background first, e.g. with {@link mix}).
 * @param {ColorInput} color - The colour
 * @returns {number} The relative luminance, in `[0, 1]` (`0` for black, `1` for white)
 * @throws {TypeError} when `color` is invalid (see {@link toRgba})
 * @throws {RangeError} when a channel is `NaN`
 * @example
 * relativeLuminance('#ffffff'); // => 1
 * relativeLuminance('#000000'); // => 0
 * relativeLuminance('#ff0000'); // => 0.2126
 */
export function relativeLuminance(color: ColorInput): number {
	const { r, g, b } = toRgba(color);
	return Math.min(1, 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b));
}

/**
 * Computes the WCAG 2.x contrast ratio `(L1 + 0.05) / (L2 + 0.05)` between two colours, where `L1` is the larger relative luminance.
 * The ratio is symmetric and ranges from `1` (identical luminance) to `21` (black on white). Alpha is ignored.
 * @param {ColorInput} a - First colour
 * @param {ColorInput} b - Second colour
 * @returns {number} The contrast ratio, in `[1, 21]`
 * @throws {TypeError} when a colour is invalid (see {@link toRgba})
 * @throws {RangeError} when a channel is `NaN`
 * @example
 * contrastRatio('#000', '#fff'); // => 21
 * contrastRatio('#777', '#fff').toFixed(4); // => '4.4781'
 * contrastRatio('#abc', '#abc'); // => 1
 */
export function contrastRatio(a: ColorInput, b: ColorInput): number {
	const first = relativeLuminance(a);
	const second = relativeLuminance(b);
	return clamp((Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05), 1, 21);
}

/**
 * Picks whichever of two text colours has the higher WCAG contrast against a background (the dark one on ties).
 * The chosen option is returned exactly as given (same string or object).
 * @template L - Type of the light option
 * @template D - Type of the dark option
 * @param {ColorInput} background - The background colour
 * @param {ReadableTextColorOptions<L, D>} [options={}] - `light` (default `'#ffffff'`) and `dark` (default `'#000000'`) candidates
 * @returns {L | D} The candidate with the better contrast
 * @throws {TypeError} when a colour is invalid (see {@link toRgba})
 * @throws {RangeError} when a channel is `NaN`
 * @example
 * getReadableTextColor('#1e3a8a'); // => '#ffffff'
 * getReadableTextColor('#fde68a'); // => '#000000'
 * getReadableTextColor('#222', { light: '#eee', dark: '#333' }); // => '#eee'
 */
export function getReadableTextColor<L extends ColorInput = '#ffffff', D extends ColorInput = '#000000'>(
	background: ColorInput,
	options: ReadableTextColorOptions<L, D> = {}
): L | D {
	const light = options.light ?? ('#ffffff' as L);
	const dark = options.dark ?? ('#000000' as D);
	return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}

/**
 * Checks whether a foreground/background pair meets a WCAG 2.x contrast requirement:
 * AA needs `4.5:1` (`3:1` for large text), AAA needs `7:1` (`4.5:1` for large text). The ratio is not rounded before comparing.
 * @param {ColorInput} foreground - The text colour
 * @param {ColorInput} background - The background colour
 * @param {MeetsContrastOptions} [options={}] - `level` (`'AA'` (default) or `'AAA'`) and `largeText` (default `false`)
 * @returns {boolean} `true` if the contrast ratio is at least the required threshold
 * @throws {TypeError} when a colour is invalid (see {@link toRgba})
 * @throws {RangeError} when `level` is not `'AA'` or `'AAA'`, or a channel is `NaN`
 * @example
 * meetsContrast('#767676', '#ffffff'); // => true // 4.54:1
 * meetsContrast('#777777', '#ffffff'); // => false // 4.48:1
 * meetsContrast('#777777', '#ffffff', { largeText: true }); // => true
 * meetsContrast('#767676', '#ffffff', { level: 'AAA' }); // => false
 */
export function meetsContrast(foreground: ColorInput, background: ColorInput, options: MeetsContrastOptions = {}): boolean {
	const { level = 'AA', largeText = false } = options;
	if (level !== 'AA' && level !== 'AAA') throw new RangeError(`meetsContrast: \`level\` must be 'AA' or 'AAA', got ${String(level)}`);
	const threshold = largeText ? CONTRAST_THRESHOLDS[level].large : CONTRAST_THRESHOLDS[level].normal;
	return contrastRatio(foreground, background) >= threshold;
}
