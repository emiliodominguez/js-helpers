import { clamp, lerp, modulo, round } from '../math/index.js';
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
 * or a CSS colour string understood by {@link parseColor}: hex (`'#rgb'`, `'#rgba'`, `'#rrggbb'`, `'#rrggbbaa'`, with or without `#`),
 * `rgb()` / `rgba()`, `hsl()` / `hsla()` or `'transparent'`.
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

/** A CSS colour function call: its name and its (trimmed) argument list. */
const CSS_FUNCTION_PATTERN = /^(rgba?|hsla?)\(\s*([^()]*?)\s*\)$/i;

/** One argument of a CSS colour function: a CSS `<number>`, optionally followed by `%` or an angle unit. */
const CSS_COMPONENT_PATTERN = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)(%|deg|grad|rad|turn)?$/i;

/** How many of each CSS angle unit make a full turn (`''` is a unitless hue, which means degrees). */
const UNITS_PER_TURN: Readonly<Record<string, number>> = { '': 360, deg: 360, grad: 400, rad: 2 * Math.PI, turn: 1 };

/**
 * A parsed argument of a CSS colour function.
 */
interface CssComponent {
	/** The numeric value (`0` for `none`). */
	value: number;
	/** The lowercase unit: `''` (plain number or `none`), `'%'` or an angle unit. */
	unit: string;
}

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
 * Clamps a channel to `[0, 255]` and rounds it to the nearest integer (never `-0`: clamping turns `-0` into `0`).
 * @param {number} value - The channel value
 * @returns {number} An integer in `[0, 255]`
 * @example
 * toByte(255.6); // => 255
 */
function toByte(value: number): number {
	return Math.round(clamp(value, 0, 255));
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

/** Cache of {@link linearChannel} results, indexed by channel value (filled on first use, at most 256 entries). */
const LINEAR_CHANNELS: number[] = [];

/**
 * Converts one 8-bit sRGB channel to linear light, as defined by WCAG 2.x.
 * @param {number} value - Integer channel in `[0, 255]`
 * @returns {number} Linear channel in `[0, 1]`
 * @example
 * linearChannel(255); // => 1
 */
function linearChannel(value: number): number {
	let linear = LINEAR_CHANNELS[value];
	if (linear === undefined) {
		const unit = value / 255;
		linear = unit <= 0.04045 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
		LINEAR_CHANNELS[value] = linear;
	}
	return linear;
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
	return hexToRgba(match[1]);
}

/**
 * Converts the 3, 4, 6 or 8 hex digits of a colour (already validated) to an {@link Rgba} colour.
 * The digits are parsed as a single integer (at most 32 bits) whose channels are then extracted with bit shifts.
 * @param {string} digits - The hex digits, without `#`
 * @returns {Rgba} The colour, with alpha `1` when there are no alpha digits
 * @example
 * hexToRgba('f80'); // => { r: 255, g: 136, b: 0, a: 1 }
 */
function hexToRgba(digits: string): Rgba {
	const value = parseInt(digits, 16);
	// Bits per channel: one hex digit (expanded by `* 17`, so `f` → `ff`) in the short forms, two digits otherwise.
	const width = digits.length <= 4 ? 4 : 8;
	const end = digits.length * 4;
	return {
		r: hexChannel(value, end - width, width),
		g: hexChannel(value, end - 2 * width, width),
		b: hexChannel(value, end - 3 * width, width),
		a: end > 3 * width ? hexChannel(value, 0, width) / 255 : 1
	};
}

/**
 * Extracts one channel of a parsed hex colour and scales it to `[0, 255]`.
 * @param {number} value - The parsed hex digits
 * @param {number} shift - Bit offset of the channel
 * @param {number} width - Bits per channel: `4` (one digit) or `8` (two digits)
 * @returns {number} The channel, an integer in `[0, 255]`
 * @example
 * hexChannel(0xf80, 8, 4); // => 255
 */
function hexChannel(value: number, shift: number, width: number): number {
	const mask = (1 << width) - 1;
	return ((value >>> shift) & mask) * (255 / mask);
}

/**
 * Parses one argument of a CSS colour function.
 * @param {string} token - The argument text, without surrounding whitespace
 * @param {boolean} legacy - Whether the comma-separated syntax is used (where `none` is not allowed)
 * @returns {CssComponent | undefined} The value and unit, or `undefined` when the token is not valid
 * @example
 * parseComponent('50%', false); // => { value: 50, unit: '%' }
 */
function parseComponent(token: string, legacy: boolean): CssComponent | undefined {
	if (!legacy && token.toLowerCase() === 'none') return { value: 0, unit: '' };
	const match = CSS_COMPONENT_PATTERN.exec(token);
	if (match === null) return undefined;
	const value = Number(match[1]);
	return Number.isFinite(value) ? { value, unit: (match[2] ?? '').toLowerCase() } : undefined;
}

/**
 * Whether every component has one of the allowed units.
 * @param {CssComponent[]} components - The parsed components
 * @param {string[]} units - The allowed units
 * @returns {boolean} `true` when all units are allowed
 * @example
 * hasUnits([{ value: 1, unit: '%' }], ['', '%']); // => true
 */
function hasUnits(components: CssComponent[], units: string[]): boolean {
	return components.every(function (component) {
		return units.includes(component.unit);
	});
}

/**
 * Parses the arguments of an `rgb()`, `rgba()`, `hsl()` or `hsla()` call (CSS Color 4 grammar, legacy and modern syntaxes).
 * @param {string} name - The lowercase function name
 * @param {string} args - The text between the parentheses, trimmed
 * @returns {Rgba | undefined} The colour, or `undefined` when the arguments are not valid
 * @example
 * parseCssFunction('rgb', '255 0 0 / 50%'); // => { r: 255, g: 0, b: 0, a: 0.5 }
 */
function parseCssFunction(name: string, args: string): Rgba | undefined {
	const legacy = args.includes(',');
	// Legacy: `r, g, b[, a]`. Modern: `r g b[ / a]` (exactly three space-separated components before the optional slash).
	const parts = args.split(legacy ? /\s*,\s*/ : /\s*\/\s*/);
	const tokens = legacy ? parts : parts[0].split(/\s+/);
	if (tokens.length !== 3 && !(legacy && tokens.length === 4)) return undefined;
	if (!legacy) tokens.push(...parts.slice(1));
	if (tokens.length > 4) return undefined;

	const components: CssComponent[] = [];
	for (const token of tokens) {
		const component = parseComponent(token, legacy);
		if (component === undefined) return undefined;
		components.push(component);
	}

	const [first, second, third, alpha = { value: 1, unit: '' }] = components;
	if (!hasUnits([alpha], ['', '%'])) return undefined;
	const a = clamp(alpha.unit === '%' ? alpha.value / 100 : alpha.value, 0, 1);
	const channels = [first, second, third];

	if (name.startsWith('rgb')) {
		// Legacy syntax: all three channels are numbers, or all three are percentages.
		if (!hasUnits(channels, ['', '%']) || (legacy && !hasUnits(channels, [first.unit]))) return undefined;
		const [r, g, b] = channels.map(function (channel) {
			return toByte(channel.unit === '%' ? (channel.value * 255) / 100 : channel.value);
		});
		return { r, g, b, a };
	}

	// Legacy syntax requires percentages for saturation and lightness; the modern one also accepts plain numbers.
	if (first.unit === '%' || !hasUnits([second, third], legacy ? ['%'] : ['', '%'])) return undefined;
	// Reduce the hue in its own unit first, so huge values cannot overflow when converted to degrees.
	const perTurn = UNITS_PER_TURN[first.unit];
	const { r, g, b } = hslToRgb({ h: (modulo(first.value, perTurn) * 360) / perTurn, s: second.value, l: third.value });
	return { r, g, b, a };
}

/**
 * Parses a CSS colour string for `caller`.
 * @param {string} caller - Name of the public function, used in the error message
 * @param {string} name - Name of the validated parameter
 * @param {string} input - The string to parse
 * @returns {Rgba} The colour
 * @throws {TypeError} when `input` is not a supported CSS colour
 * @example
 * parseCssColor('toRgba', 'input', 'transparent'); // => { r: 0, g: 0, b: 0, a: 0 }
 */
function parseCssColor(caller: string, name: string, input: string): Rgba {
	const text = input.trim();
	const hex = HEX_PATTERN.exec(text);
	if (hex !== null) return hexToRgba(hex[1]);
	if (text.toLowerCase() === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
	const match = CSS_FUNCTION_PATTERN.exec(text);
	const color = match === null ? undefined : parseCssFunction(match[1].toLowerCase(), match[2]);
	if (color === undefined) {
		throw new TypeError(`${caller}: \`${name}\` must be a CSS colour (hex, rgb(), hsl() or 'transparent'), got ${JSON.stringify(input)}`);
	}
	return color;
}

/**
 * Parses a CSS colour string (CSS Color 4) into an {@link Rgba} colour. Supported forms:
 * - hex: everything {@link parseHex} accepts (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, with or without `#`), with the same result;
 * - `rgb()` / `rgba()` (aliases): legacy comma syntax `rgb(r, g, b[, a])` (channels all numbers or all percentages) and modern
 *   space syntax `rgb(r g b[ / a])` (numbers and percentages may be mixed, `none` means `0`);
 * - `hsl()` / `hsla()` (aliases): legacy `hsl(h, s%, l%[, a])` and modern `hsl(h s l[ / a])` (saturation and lightness as
 *   percentages or plain numbers, `none` means `0`); the hue is a number (degrees) or an angle in `deg`, `grad`, `rad` or `turn`;
 * - `transparent` (transparent black).
 *
 * Function names, units and keywords are case-insensitive, and whitespace around the string and the arguments is ignored.
 * The alpha is a number or a percentage. Out-of-range values are clamped as in CSS: channels to `[0, 255]`, saturation and
 * lightness to `[0%, 100%]`, alpha to `[0, 1]`; the hue wraps around. Channels are then rounded to integers (alpha is not rounded).
 * Numbers too large for a double (e.g. `1e999`) are rejected.
 * Named colours (`red`, `rebeccapurple`, ...), `currentcolor`, `calc()` and the other colour functions (`hwb()`, `lab()`,
 * `color()`, ...) are deliberately not supported, to keep the bundle small.
 * @param {string} input - The CSS colour string
 * @returns {Rgba} A new colour object with integer channels
 * @throws {TypeError} when `input` is not a string, or not one of the supported colour syntaxes
 * @example
 * parseColor('#ff8000'); // => { r: 255, g: 128, b: 0, a: 1 }
 * parseColor('rgba(255, 0, 0, 0.5)'); // => { r: 255, g: 0, b: 0, a: 0.5 }
 * parseColor('rgb(100% 50% 0% / 25%)'); // => { r: 255, g: 128, b: 0, a: 0.25 }
 * parseColor('hsl(120deg 100% 25%)'); // => { r: 0, g: 128, b: 0, a: 1 }
 * parseColor('hsla(0.5turn, 100%, 50%, .8)'); // => { r: 0, g: 255, b: 255, a: 0.8 }
 * parseColor('transparent'); // => { r: 0, g: 0, b: 0, a: 0 }
 * parseColor('rgb(300 -20 0)'); // => { r: 255, g: 0, b: 0, a: 1 }
 * parseColor('red'); // throws TypeError
 */
export function parseColor(input: string): Rgba {
	if (typeof input !== 'string') throw new TypeError(`parseColor: \`input\` must be a string, got ${describe(input)}`);
	return parseCssColor('parseColor', 'input', input);
}

/**
 * Normalizes any {@link ColorInput} to a fresh {@link Rgba} object: strings are parsed with {@link parseColor} (so every hex
 * string gives the same result as {@link parseHex}); for objects, `r`, `g`, `b` are clamped to `[0, 255]` and rounded to integers,
 * and `a` (default `1` when missing or `undefined`) is clamped to `[0, 1]`.
 * @param {ColorInput} input - A CSS colour string (see {@link parseColor}) or an `Rgb` / `Rgba` object
 * @returns {Rgba} A new normalized colour
 * @throws {TypeError} when `input` is neither a string nor an object, is an unsupported colour string, or has a non-numeric channel
 * @throws {RangeError} when a channel is `NaN`
 * @example
 * toRgba('#fff'); // => { r: 255, g: 255, b: 255, a: 1 }
 * toRgba({ r: 300, g: 12.4, b: -5 }); // => { r: 255, g: 12, b: 0, a: 1 }
 * toRgba({ r: 0, g: 0, b: 0, a: 0.5 }); // => { r: 0, g: 0, b: 0, a: 0.5 }
 * toRgba('hsl(0 100% 50% / 0.5)'); // => { r: 255, g: 0, b: 0, a: 0.5 }
 */
export function toRgba(input: ColorInput): Rgba {
	if (typeof input === 'string') return parseCssColor('toRgba', 'input', input);
	if (typeof input !== 'object' || input === null) throw new TypeError(`toRgba: \`input\` must be a colour string or an { r, g, b } object, got ${describe(input)}`);
	const rawAlpha = (input as Partial<Rgba>).a;
	const alpha = rawAlpha === undefined ? 1 : readChannel('toRgba', 'input.a', rawAlpha);
	return {
		r: toByte(readChannel('toRgba', 'input.r', input.r)),
		g: toByte(readChannel('toRgba', 'input.g', input.g)),
		b: toByte(readChannel('toRgba', 'input.b', input.b)),
		a: clamp(alpha, 0, 1)
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
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}${includeAlpha ? hexByte(Math.round(a * 255)) : ''}`;
}

/**
 * Formats an alpha value as the ` / a` suffix of a modern CSS colour function, rounded to 3 decimals (enough to keep every
 * 8-bit alpha byte distinct). Returns `''` for (rounded) opaque colours.
 * @param {number} alpha - Alpha in `[0, 1]`
 * @returns {string} `' / a'` or `''`
 * @example
 * cssAlpha(0.5); // => ' / 0.5'
 */
function cssAlpha(alpha: number): string {
	const rounded = round(alpha, 3);
	return rounded < 1 ? ` / ${rounded}` : '';
}

/**
 * Formats a colour as a CSS `rgb()` string in the modern space-separated syntax: `'rgb(r g b)'`, or `'rgb(r g b / a)'` for
 * translucent colours. Channels are clamped and rounded (see {@link toRgba}); alpha is rounded to 3 decimals and omitted when it
 * rounds to `1`. The result is understood by {@link parseColor} and by all current browsers.
 * @param {ColorInput} color - The colour
 * @returns {string} The CSS colour string
 * @throws {TypeError} when `color` is not a valid colour (see {@link toRgba})
 * @throws {RangeError} when a channel is `NaN`
 * @example
 * toCssRgb('#ff8000'); // => 'rgb(255 128 0)'
 * toCssRgb({ r: 0, g: 0, b: 0, a: 0.5 }); // => 'rgb(0 0 0 / 0.5)'
 * toCssRgb('#00000080'); // => 'rgb(0 0 0 / 0.502)'
 */
export function toCssRgb(color: ColorInput): string {
	const { r, g, b, a } = toRgba(color);
	return `rgb(${r} ${g} ${b}${cssAlpha(a)})`;
}

/**
 * Formats a colour as a CSS `hsl()` string in the modern space-separated syntax: `'hsl(h s% l%)'`, or `'hsl(h s% l% / a)'` for
 * translucent colours. Hue (degrees, at most `359.8` for 8-bit channels), saturation and lightness are rounded to 1 decimal, which is enough for every
 * 8-bit colour to convert back to exactly the same channels (`parseColor(toCssHsl(c))` round-trips); alpha is rounded to 3 decimals
 * and omitted when it rounds to `1`.
 * @param {ColorInput} color - The colour (channels are clamped and rounded first, see {@link toRgba})
 * @returns {string} The CSS colour string
 * @throws {TypeError} when `color` is not a valid colour (see {@link toRgba})
 * @throws {RangeError} when a channel is `NaN`
 * @example
 * toCssHsl('#ff0000'); // => 'hsl(0 100% 50%)'
 * toCssHsl('#808080'); // => 'hsl(0 0% 50.2%)'
 * toCssHsl({ r: 51, g: 102, b: 153, a: 0.25 }); // => 'hsl(210 50% 40% / 0.25)'
 */
export function toCssHsl(color: ColorInput): string {
	const rgba = toRgba(color);
	const { h, s, l } = rgbToHsl(rgba);
	return `hsl(${round(h, 1)} ${round(s, 1)}% ${round(l, 1)}%${cssAlpha(rgba.a)})`;
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
	// No shortcut is needed for `delta = 0`: the HSL round trip is exact for every 8-bit colour.
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
