import { lerp } from '../math/index.js';
import { assertFunction, assertInteger, assertNumber, describe as typeName } from '../utils/assert.js';

/**
 * An easing function: maps animation progress `t` (`0` at the start, `1` at the end) to eased progress.
 *
 * Every easing of this module returns exactly `0` for `t = 0` and exactly `1` for `t = 1`. Outside `[0, 1]` they extrapolate their
 * formula (e.g. `easeInQuad(2) === 4`; the circular easings return `NaN` beyond `±1`), and `NaN` gives `NaN`.
 */
export type EasingFunction = (t: number) => number;

/**
 * A CSS `steps()` jump position; `'start'` and `'end'` are the CSS aliases of `'jump-start'` and `'jump-end'`.
 */
export type StepPosition = 'jump-start' | 'jump-end' | 'jump-none' | 'jump-both' | 'start' | 'end';

/**
 * Options accepted by {@link spring}.
 */
export interface SpringOptions {
	/**
	 * Spring stiffness `k` (N/m), a finite number > 0.
	 * @default 100
	 */
	stiffness?: number;
	/**
	 * Damping coefficient `c` (N·s/m), a finite number > 0.
	 * @default 10
	 */
	damping?: number;
	/**
	 * Mass `m` (kg), a finite number > 0.
	 * @default 1
	 */
	mass?: number;
	/**
	 * Initial velocity, in distance units per second (the distance from start to target is `1`; positive means towards the target).
	 * @default 0
	 */
	velocity?: number;
	/**
	 * Distance from the target below which the spring counts as settled (see {@link Spring.duration}), in `(0, 1)`.
	 * @default 0.001
	 */
	restDelta?: number;
}

/**
 * A solved spring, returned by {@link spring}.
 */
export interface Spring {
	/**
	 * Exact position of the spring at `time` seconds after release, moving from `0` towards the target `1` (it may overshoot).
	 * Returns `0` for `time <= 0` and `1` for `time === Infinity`.
	 * @param {number} time - Seconds since the start
	 * @returns {number} The position
	 */
	position(time: number): number;
	/** Settle time in seconds: from then on the spring stays within `restDelta` of the target (its energy is below that of a `restDelta` displacement). */
	duration: number;
	/** `position(t * duration)` as an easing function of normalized time; returns exactly `1` for `t >= 1`. */
	easing: EasingFunction;
}

/** Overshoot constant of the "back" easings (overshoots by about 10%). */
const BACK = 1.70158;
/** Precision of the Newton–Raphson step of {@link cubicBezier}, in x units. */
const BEZIER_EPSILON = 1e-12;
/** Value of a `steps()` position: `[added to the current step, added to the number of steps to get the number of jumps]`. */
const STEP_POSITIONS: Record<StepPosition, readonly [number, number]> = {
	'jump-start': [1, 0],
	start: [1, 0],
	'jump-end': [0, 0],
	end: [0, 0],
	'jump-none': [0, -1],
	'jump-both': [1, 1]
};

/**
 * Builds the ease-in power curve `t ** exponent`.
 * @param {number} exponent - The power
 * @returns {EasingFunction} `t => t ** exponent`
 */
function power(exponent: number): EasingFunction {
	return function (t) {
		return t ** exponent;
	};
}

/**
 * The base (ease-out) bounce curve: four parabolic arcs of decreasing height (Robert Penner's constants, written with exact binary fractions).
 * @param {number} t - Progress
 * @returns {number} Eased progress
 */
function bounce(t: number): number {
	const x = 2.75 * t;
	if (x < 1) return x * x;
	const [center, halfWidth] = x < 2 ? [1.5, 0.5] : x < 2.5 ? [2.25, 0.25] : [2.625, 0.125];
	return (x - center) ** 2 + 1 - halfWidth * halfWidth;
}

/**
 * Turns an ease-in function into its ease-out counterpart by point reflection: `t => 1 - easing(1 - t)`.
 * Applying it twice gives back the original curve (so it also turns an ease-out into an ease-in).
 * @param {EasingFunction} easing - The ease-in function
 * @returns {EasingFunction} The reflected (ease-out) function
 * @throws {TypeError} when `easing` is not a function
 * @example
 * const easeOutSquare = easeOut(function (t) { return t * t; });
 * easeOutSquare(0.5); // => 0.75
 * easeOutSquare(1); // => 1
 */
export function easeOut(easing: EasingFunction): EasingFunction {
	assertFunction('easeOut', 'easing', easing);
	return function (t) {
		return 1 - easing(1 - t);
	};
}

/**
 * Builds a symmetric ease-in-out function from an ease-in function: the first half runs `easing` at double speed, the second
 * half its reflection, so that `g(1 - t) === 1 - g(t)` and `g(0.5) === 0.5`.
 * @param {EasingFunction} easing - The ease-in function
 * @returns {EasingFunction} `t => t < 0.5 ? easing(2t) / 2 : 1 - easing(2 - 2t) / 2`
 * @throws {TypeError} when `easing` is not a function
 * @example
 * const easeInOutSquare = easeInOut(function (t) { return t * t; });
 * easeInOutSquare(0.25); // => 0.125
 * easeInOutSquare(0.5); // => 0.5
 * easeInOutSquare(0.75); // => 0.875
 */
export function easeInOut(easing: EasingFunction): EasingFunction {
	assertFunction('easeInOut', 'easing', easing);
	return function (t) {
		return t < 0.5 ? easing(2 * t) / 2 : 1 - easing(2 - 2 * t) / 2;
	};
}

/**
 * No easing: `t => t`.
 * @param {number} t - Progress
 * @returns {number} `t`
 * @example
 * linear(0.3); // => 0.3
 */
export function linear(t: number): number {
	return t;
}

/**
 * Quadratic ease-in: `t²`. The `Out` / `InOut` variants are built with {@link easeOut} / {@link easeInOut}, like all named easings.
 * @example
 * easeInQuad(0.5); // => 0.25
 */
export const easeInQuad: EasingFunction = /* @__PURE__ */ power(2);
/**
 * Quadratic ease-out.
 * @example
 * easeOutQuad(0.5); // => 0.75
 */
export const easeOutQuad: EasingFunction = /* @__PURE__ */ easeOut(easeInQuad);
/**
 * Quadratic ease-in-out.
 * @example
 * easeInOutQuad(0.25); // => 0.125
 */
export const easeInOutQuad: EasingFunction = /* @__PURE__ */ easeInOut(easeInQuad);

/**
 * Cubic ease-in: `t³`.
 * @example
 * easeInCubic(0.5); // => 0.125
 */
export const easeInCubic: EasingFunction = /* @__PURE__ */ power(3);
/**
 * Cubic ease-out.
 * @example
 * easeOutCubic(0.5); // => 0.875
 */
export const easeOutCubic: EasingFunction = /* @__PURE__ */ easeOut(easeInCubic);
/**
 * Cubic ease-in-out.
 * @example
 * easeInOutCubic(0.25); // => 0.0625
 */
export const easeInOutCubic: EasingFunction = /* @__PURE__ */ easeInOut(easeInCubic);

/**
 * Quartic ease-in: `t⁴`.
 * @example
 * easeInQuart(0.5); // => 0.0625
 */
export const easeInQuart: EasingFunction = /* @__PURE__ */ power(4);
/**
 * Quartic ease-out.
 * @example
 * easeOutQuart(0.5); // => 0.9375
 */
export const easeOutQuart: EasingFunction = /* @__PURE__ */ easeOut(easeInQuart);
/**
 * Quartic ease-in-out.
 * @example
 * easeInOutQuart(0.25); // => 0.03125
 */
export const easeInOutQuart: EasingFunction = /* @__PURE__ */ easeInOut(easeInQuart);

/**
 * Quintic ease-in: `t⁵`.
 * @example
 * easeInQuint(0.5); // => 0.03125
 */
export const easeInQuint: EasingFunction = /* @__PURE__ */ power(5);
/**
 * Quintic ease-out.
 * @example
 * easeOutQuint(0.5); // => 0.96875
 */
export const easeOutQuint: EasingFunction = /* @__PURE__ */ easeOut(easeInQuint);
/**
 * Quintic ease-in-out.
 * @example
 * easeInOutQuint(0.25); // => 0.015625
 */
export const easeInOutQuint: EasingFunction = /* @__PURE__ */ easeInOut(easeInQuint);

/**
 * Sinusoidal ease-in: `1 - cos(t·π/2)`.
 * @param {number} t - Progress
 * @returns {number} Eased progress
 * @example
 * easeInSine(0); // => 0
 * easeInSine(1); // => 1
 * Math.abs(easeInSine(0.5) - 0.2928932188134524) < 1e-15; // => true
 */
export function easeInSine(t: number): number {
	return t === 1 ? 1 : 1 - Math.cos((t * Math.PI) / 2);
}
/**
 * Sinusoidal ease-out (`sin(t·π/2)`).
 * @example
 * Math.abs(easeOutSine(0.5) - Math.SQRT1_2) < 1e-15; // => true
 */
export const easeOutSine: EasingFunction = /* @__PURE__ */ easeOut(easeInSine);
/**
 * Sinusoidal ease-in-out (`(1 - cos(t·π)) / 2`).
 * @example
 * easeInOutSine(0.5); // => 0.5
 */
export const easeInOutSine: EasingFunction = /* @__PURE__ */ easeInOut(easeInSine);

/**
 * Exponential ease-in: `2^(10t - 10)`, pinned to `0` at `t = 0`.
 * @param {number} t - Progress
 * @returns {number} Eased progress
 * @example
 * easeInExpo(0); // => 0
 * easeInExpo(0.5); // => 0.03125
 */
export function easeInExpo(t: number): number {
	return t === 0 ? 0 : 2 ** (10 * t - 10);
}
/**
 * Exponential ease-out.
 * @example
 * easeOutExpo(0.5); // => 0.96875
 */
export const easeOutExpo: EasingFunction = /* @__PURE__ */ easeOut(easeInExpo);
/**
 * Exponential ease-in-out.
 * @example
 * easeInOutExpo(0.25); // => 0.015625
 */
export const easeInOutExpo: EasingFunction = /* @__PURE__ */ easeInOut(easeInExpo);

/**
 * Circular ease-in: `1 - √(1 - t²)` (`NaN` for `|t| > 1`).
 * @param {number} t - Progress
 * @returns {number} Eased progress
 * @example
 * Math.abs(easeInCirc(0.6) - 0.2) < 1e-15; // => true
 * easeInCirc(2); // => NaN
 */
export function easeInCirc(t: number): number {
	return 1 - Math.sqrt(1 - t * t);
}
/**
 * Circular ease-out (`√(1 - (1 - t)²)`).
 * @example
 * Math.abs(easeOutCirc(0.4) - 0.8) < 1e-15; // => true
 */
export const easeOutCirc: EasingFunction = /* @__PURE__ */ easeOut(easeInCirc);
/**
 * Circular ease-in-out.
 * @example
 * Math.abs(easeInOutCirc(0.3) - 0.1) < 1e-15; // => true
 */
export const easeInOutCirc: EasingFunction = /* @__PURE__ */ easeInOut(easeInCirc);

/**
 * "Back" ease-in: pulls back slightly (about 10%) before moving forward: `t²·((c + 1)t - c)` with `c = 1.70158`.
 * @param {number} t - Progress
 * @returns {number} Eased progress
 * @example
 * easeInBack(0.5) < 0; // => true
 * easeInBack(1); // => 1
 */
export function easeInBack(t: number): number {
	return t * t * (t + BACK * (t - 1)) + 0; // `+ 0` turns -0 into 0
}
/**
 * "Back" ease-out: overshoots the target slightly before settling.
 * @example
 * easeOutBack(0.5) > 1; // => true
 */
export const easeOutBack: EasingFunction = /* @__PURE__ */ easeOut(easeInBack);
/**
 * "Back" ease-in-out.
 * @example
 * easeInOutBack(0.5); // => 0.5
 */
export const easeInOutBack: EasingFunction = /* @__PURE__ */ easeInOut(easeInBack);

/**
 * Elastic ease-in: a growing oscillation, `-2^(10t - 10)·sin((10t - 10.75)·2π/3)`, pinned to `0` and `1` at the ends.
 *
 * Note: as for all named easings, the `Out` and `InOut` variants are exact reflections (see {@link easeOut}), which differ slightly
 * from the hand-tuned elastic out / in-out curves of easings.net.
 * @param {number} t - Progress
 * @returns {number} Eased progress
 * @example
 * easeInElastic(0); // => 0
 * easeInElastic(1); // => 1
 */
export function easeInElastic(t: number): number {
	return t === 0 || t === 1 ? t : -(2 ** (10 * t - 10)) * Math.sin((10 * t - 10.75) * ((2 * Math.PI) / 3));
}
/**
 * Elastic ease-out: overshoots and oscillates around the target.
 * @example
 * easeOutElastic(1); // => 1
 */
export const easeOutElastic: EasingFunction = /* @__PURE__ */ easeOut(easeInElastic);
/**
 * Elastic ease-in-out.
 * @example
 * easeInOutElastic(0.5); // => 0.5
 */
export const easeInOutElastic: EasingFunction = /* @__PURE__ */ easeInOut(easeInElastic);

/**
 * Bounce ease-out: falls to the target and bounces three times (base curve of the bounce family).
 * @example
 * easeOutBounce(1); // => 1
 * easeOutBounce(0.5); // => 0.765625
 */
export const easeOutBounce: EasingFunction = bounce;
/**
 * Bounce ease-in (reflection of {@link easeOutBounce}).
 * @example
 * easeInBounce(0.5); // => 0.234375
 */
export const easeInBounce: EasingFunction = /* @__PURE__ */ easeOut(bounce);
/**
 * Bounce ease-in-out.
 * @example
 * easeInOutBounce(0.5); // => 0.5
 */
export const easeInOutBounce: EasingFunction = /* @__PURE__ */ easeInOut(easeInBounce);

/**
 * Creates an easing function equivalent to CSS `cubic-bezier(x1, y1, x2, y2)`: the curve from `(0, 0)` to `(1, 1)` with control
 * points `(x1, y1)` and `(x2, y2)`, evaluated by solving `x(s) = t` for the curve parameter `s` (Newton–Raphson, with a bisection
 * fallback that is always correct because `x` is monotonic when `x1, x2 ∈ [0, 1]`; the result is accurate to ~1e-12), then returning `y(s)`.
 *
 * Like browsers, inputs outside `[0, 1]` are extrapolated linearly along the tangent at the nearest end point.
 * @param {number} x1 - x of the first control point, in `[0, 1]`
 * @param {number} y1 - y of the first control point (any finite number; outside `[0, 1]` the curve overshoots)
 * @param {number} x2 - x of the second control point, in `[0, 1]`
 * @param {number} y2 - y of the second control point (any finite number)
 * @returns {EasingFunction} The easing function (exactly `0` at `0` and `1` at `1`)
 * @throws {TypeError} when an argument is not a number
 * @throws {RangeError} when `x1` or `x2` is outside `[0, 1]`, or `y1` / `y2` is not finite
 * @example
 * const ease = cubicBezier(0.25, 0.1, 0.25, 1);
 * Math.abs(ease(0.5) - 0.8024033877399112) < 1e-9; // => true // Chrome's value for CSS `ease`
 * Math.abs(cubicBezier(0, 0, 1, 1)(0.3) - 0.3) < 1e-12; // => true // control points on the diagonal: linear
 * cubicBezier(0.42, 0, 1, 1)(-1); // => 0 // extrapolated along the (horizontal) start tangent
 * cubicBezier(0.25, 0.1, 0.25, 1)(-1); // => -0.4
 * cubicBezier(1.5, 0, 0, 1); // throws RangeError
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
	assertNumber('cubicBezier', 'x1', x1, x1 >= 0 && x1 <= 1, 'a number between 0 and 1');
	assertNumber('cubicBezier', 'y1', y1, Number.isFinite(y1), 'a finite number');
	assertNumber('cubicBezier', 'x2', x2, x2 >= 0 && x2 <= 1, 'a number between 0 and 1');
	assertNumber('cubicBezier', 'y2', y2, Number.isFinite(y2), 'a finite number');

	// Polynomial coefficients: x(s) = ((ax·s + bx)·s + cx)·s, same for y.
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;
	// End-point tangents for extrapolation (same rules as Chromium's gfx::CubicBezier).
	const startGradient = x1 > 0 ? y1 / x1 : !y1 && x2 > 0 ? y2 / x2 : !y1 && !y2 ? 1 : 0;
	const endGradient = x2 < 1 ? (y2 - 1) / (x2 - 1) : y2 === 1 && x1 < 1 ? (y1 - 1) / (x1 - 1) : y2 === 1 && y1 === 1 ? 1 : 0;

	/**
	 * Evaluates x(s) of the curve.
	 * @param {number} s - Curve parameter
	 * @returns {number} x(s)
	 */
	function sampleX(s: number): number {
		return ((ax * s + bx) * s + cx) * s;
	}

	return function (t) {
		// `+ 0` turns -0 into 0; t = 0 and t = 1 are returned as-is (a gradient may overflow to Infinity, and Infinity · 0 is NaN).
		if (!(t > 0 && t < 1)) return t < 0 ? startGradient * t + 0 : t > 1 ? 1 + endGradient * (t - 1) : t + 0;
		let s = t;
		for (let i = 0; i < 8 && s >= 0 && s <= 1; i++) {
			const error = sampleX(s) - t;
			if (Math.abs(error) < BEZIER_EPSILON) return ((ay * s + by) * s + cy) * s;
			s -= error / ((3 * ax * s + 2 * bx) * s + cx);
		}
		let low = 0;
		let high = 1;
		for (let i = 0; i < 64; i++) {
			s = (low + high) / 2;
			if (sampleX(s) < t) low = s;
			else high = s;
		}
		return ((ay * s + by) * s + cy) * s;
	};
}

/**
 * CSS `ease`: `cubic-bezier(0.25, 0.1, 0.25, 1)` (the default `transition-timing-function`).
 * @example
 * Math.abs(cssEase(0.5) - 0.8024033877399112) < 1e-9; // => true
 */
export const cssEase: EasingFunction = /* @__PURE__ */ cubicBezier(0.25, 0.1, 0.25, 1);
/**
 * CSS `ease-in`: `cubic-bezier(0.42, 0, 1, 1)`.
 * @example
 * cssEaseIn(1); // => 1
 */
export const cssEaseIn: EasingFunction = /* @__PURE__ */ cubicBezier(0.42, 0, 1, 1);
/**
 * CSS `ease-out`: `cubic-bezier(0, 0, 0.58, 1)`.
 * @example
 * cssEaseOut(0); // => 0
 */
export const cssEaseOut: EasingFunction = /* @__PURE__ */ cubicBezier(0, 0, 0.58, 1);
/**
 * CSS `ease-in-out`: `cubic-bezier(0.42, 0, 0.58, 1)`.
 * @example
 * Math.abs(cssEaseInOut(0.5) - 0.5) < 1e-12; // => true
 */
export const cssEaseInOut: EasingFunction = /* @__PURE__ */ cubicBezier(0.42, 0, 0.58, 1);

/**
 * Creates a step easing function equivalent to CSS `steps(count, position)`: the output jumps between `jumps + 1` evenly spaced
 * levels `0, 1/jumps, ..., 1`, where `jumps` is `count` (`jump-start` / `jump-end`), `count - 1` (`jump-none`) or `count + 1` (`jump-both`).
 * Inputs outside `[0, 1]` follow the CSS algorithm (`floor(t·count)` is not clamped there).
 * @param {number} count - Number of steps: an integer >= 1 (>= 2 for `'jump-none'`)
 * @param {StepPosition} [position='jump-end'] - Where the jumps happen: `'jump-start'` (at the start of each step), `'jump-end'` (at
 * the end), `'jump-none'` (neither at `0` nor at `1`), `'jump-both'` (both); `'start'` / `'end'` are aliases
 * @returns {EasingFunction} The step function
 * @throws {TypeError} when `count` is not a number or `position` is not a string
 * @throws {RangeError} when `count` is not a valid integer or `position` is not a step position
 * @example
 * [0, 0.2, 0.25, 0.5, 0.99, 1].map(steps(4)); // => [0, 0, 0.25, 0.5, 0.75, 1]
 * [0, 0.2, 0.25, 0.5, 0.99, 1].map(steps(4, 'jump-start')); // => [0.25, 0.25, 0.5, 0.75, 1, 1]
 * [0, 0.4, 0.5, 1].map(steps(2, 'jump-none')); // => [0, 0, 1, 1]
 * [0, 0.4, 0.5, 1].map(steps(2, 'jump-both')); // => [1 / 3, 1 / 3, 2 / 3, 1]
 * steps(1, 'jump-none'); // throws RangeError
 */
export function steps(count: number, position: StepPosition = 'jump-end'): EasingFunction {
	const config = typeof position === 'string' && Object.hasOwn(STEP_POSITIONS, position) ? STEP_POSITIONS[position] : undefined;
	if (config === undefined) {
		const message = `steps: \`position\` must be one of ${Object.keys(STEP_POSITIONS).join(', ')}, got ${typeof position === 'string' ? `'${position}'` : typeName(position)}`;
		throw typeof position === 'string' ? new RangeError(message) : new TypeError(message);
	}
	const [offset, extra] = config;
	assertInteger('steps', 'count', count, extra < 0 ? 2 : 1);
	const jumps = count + extra;

	return function (t) {
		// CSS also clamps negative steps to 0 for t >= 0, which only matters with its "before flag" (not modelled here).
		const step = Math.floor(t * count) + offset;
		return (t <= 1 && step > jumps ? jumps : step) / jumps;
	};
}

/**
 * Solves a damped harmonic oscillator (mass `m` on a spring of stiffness `k` with damping `c`) released at position `0` with initial
 * `velocity` towards a target at `1`, in closed form (under-, critically and over-damped cases), like the physics springs of
 * SwiftUI, Framer Motion or React Spring. Use `position(seconds)` to drive a time-based animation, or `easing` together with `duration`
 * (e.g. to generate CSS `linear()` keyframes or Web Animations).
 *
 * `duration` is the exact time after which the oscillator's energy `(k·x² + m·v²) / 2` stays below that of a `restDelta` displacement
 * at rest (energy never increases in a damped oscillator, so the spring then stays within `restDelta` of the target for good).
 * @param {SpringOptions} [options={}] - `stiffness` (default `100`), `damping` (`10`), `mass` (`1`), `velocity` (`0`), `restDelta` (`0.001`)
 * @returns {Spring} The solved spring: `position(time)`, settle `duration` (seconds) and normalized `easing`
 * @throws {TypeError} when an option is not a number
 * @throws {RangeError} when `stiffness`, `damping` or `mass` is not a finite number > 0, `velocity` is not finite, `restDelta` is not
 * in `(0, 1)`, or the spring would not settle within a representable time
 * @example
 * const bouncy = spring({ stiffness: 100, damping: 10 });
 * bouncy.position(0); // => 0
 * bouncy.position(0.3) > 1; // => true // under-damped: overshoots
 * Math.abs(bouncy.position(bouncy.duration) - 1) <= 0.001; // => true
 * bouncy.easing(1); // => 1
 * @example
 * const smooth = spring({ stiffness: 100, damping: 20 }); // critically damped: never overshoots
 * smooth.position(0.5) < 1; // => true
 * spring({ damping: 0 }); // throws RangeError
 */
export function spring(options: SpringOptions = {}): Spring {
	const { stiffness = 100, damping = 10, mass = 1, velocity = 0, restDelta = 0.001 } = options;
	assertNumber('spring', 'stiffness', stiffness, stiffness > 0 && stiffness < Infinity, 'a finite number > 0');
	assertNumber('spring', 'damping', damping, damping > 0 && damping < Infinity, 'a finite number > 0');
	assertNumber('spring', 'mass', mass, mass > 0 && mass < Infinity, 'a finite number > 0');
	assertNumber('spring', 'velocity', velocity, Number.isFinite(velocity), 'a finite number');
	assertNumber('spring', 'restDelta', restDelta, restDelta > 0 && restDelta < 1, 'a number between 0 and 1 (exclusive)');

	const omega = Math.sqrt(stiffness / mass);
	const zeta = damping / (2 * Math.sqrt(stiffness) * Math.sqrt(mass));
	/** Returns the displacement from the target `x = position - 1` (`x(0) = -1`, `x'(0) = velocity`) and its velocity at `time`. */
	let state: (time: number) => [number, number];

	if (zeta < 1) {
		// Under-damped: x = e^(-ζωt)·(B·sin(ωd·t) - cos(ωd·t)).
		const decay = zeta * omega;
		const omegaD = omega * Math.sqrt(1 - zeta * zeta);
		const b = (velocity - decay) / omegaD;
		state = function (time) {
			const envelope = Math.exp(-decay * time);
			const sin = Math.sin(omegaD * time);
			const cos = Math.cos(omegaD * time);
			const x = envelope * (b * sin - cos);
			return [x, -decay * x + envelope * omegaD * (sin + b * cos)];
		};
	} else if (zeta === 1) {
		// Critically damped: x = e^(-ωt)·(B·t - 1).
		const b = velocity - omega;
		state = function (time) {
			const envelope = Math.exp(-omega * time);
			const x = envelope * (b * time - 1);
			return [x, envelope * b - omega * x];
		};
	} else {
		// Over-damped: x = C1·e^(r1·t) + C2·e^(r2·t); r1 = ω²/r2 avoids cancellation for large ζ.
		const r2 = -omega * (zeta + Math.sqrt(zeta * zeta - 1));
		const r1 = (omega * omega) / r2;
		const c2 = (velocity + r1) / (r2 - r1);
		const c1 = -1 - c2;
		state = function (time) {
			const e1 = c1 * Math.exp(r1 * time);
			const e2 = c2 * Math.exp(r2 * time);
			return [e1 + e2, r1 * e1 + r2 * e2];
		};
	}

	/**
	 * Whether the spring has settled at `time` (its energy is below that of a `restDelta` displacement).
	 * @param {number} time - Seconds since the start
	 * @returns {boolean} `true` once settled (and forever after)
	 */
	function settled(time: number): boolean {
		const [x, v] = state(time);
		return stiffness * x * x + mass * v * v <= stiffness * restDelta * restDelta;
	}

	/**
	 * Position of the spring at `time` seconds.
	 * @param {number} time - Seconds since the start
	 * @returns {number} The position
	 */
	function position(time: number): number {
		return time <= 0 ? 0 : time === Infinity ? 1 : 1 + state(time)[0];
	}

	let high = 1 / omega;
	while (!settled(high)) {
		high *= 2;
		// Also catches `omega` overflowing to Infinity (high === 0) or underflowing to 0.
		if (!(high > 0 && high < Infinity)) throw new RangeError('spring: the spring does not settle within a representable time; check `stiffness`, `damping` and `mass`');
	}
	let low = 0;
	for (let i = 0; i < 64; i++) {
		const middle = (low + high) / 2;
		if (settled(middle)) high = middle;
		else low = middle;
	}
	const duration = high;

	return {
		position,
		duration,
		easing: function (t) {
			return t >= 1 ? 1 : position(t * duration);
		}
	};
}

/**
 * Interpolates between two numbers with an easing function: `lerp(from, to, easing(t))`.
 * @param {number} from - Value at `t = 0`
 * @param {number} to - Value at `t = 1`
 * @param {number} t - Progress (usually in `[0, 1]`)
 * @param {EasingFunction} [easing=linear] - The easing applied to `t`
 * @returns {number} The eased value
 * @throws {TypeError} when `easing` is not a function
 * @example
 * interpolate(0, 100, 0.5); // => 50
 * interpolate(0, 100, 0.5, easeInQuad); // => 25
 * interpolate(10, 20, 1, easeOutBack); // => 20
 */
export function interpolate(from: number, to: number, t: number, easing: EasingFunction = linear): number {
	assertFunction('interpolate', 'easing', easing);
	return lerp(from, to, easing(t));
}
