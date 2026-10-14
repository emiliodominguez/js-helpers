import fc from 'fast-check';
import * as helpers from '.';

const unit = fc.double({ min: 0, max: 1, noNaN: true });
// Dyadic rationals k / 2^20: `1 - t` is exact, so reflections compare the same points (the expo and elastic formulas are pinned
// at exactly 0 and 1 and jump by up to 2^-10 next to them, which a rounded `1 - t` would hit).
const dyadic = fc.integer({ min: 0, max: 2 ** 20 }).map(function (k) {
	return k / 2 ** 20;
});
const families = ['Quad', 'Cubic', 'Quart', 'Quint', 'Sine', 'Expo', 'Circ', 'Back', 'Elastic', 'Bounce'] as const;
const all = helpers as unknown as Record<string, helpers.EasingFunction>;
const family = fc.constantFrom(...families);
const control = fc.double({ min: 0, max: 1, noNaN: true });
// Control points on a 1/1000 grid: avoids end tangents that overflow (e.g. y1 / x1 with a subnormal x1).
const gridControl = fc.integer({ min: 0, max: 1000 }).map(function (k) {
	return k / 1000;
});
const overshoot = fc.double({ min: -2, max: 3, noNaN: true });
const stepPosition = fc.constantFrom<helpers.StepPosition>('jump-start', 'jump-end', 'jump-none', 'jump-both', 'start', 'end');

/** Bernstein form of a coordinate of the CSS cubic Bézier at parameter s. */
function bezier(p1: number, p2: number, s: number): number {
	return 3 * p1 * s * (1 - s) ** 2 + 3 * p2 * s * s * (1 - s) + s ** 3;
}

/** Derivative of {@link bezier} with respect to s. */
function bezierSlope(p1: number, p2: number, s: number): number {
	return 3 * p1 * (1 - s) ** 2 + 6 * (p2 - p1) * s * (1 - s) + 3 * (1 - p2) * s * s;
}

describe('Easing helpers (property-based)', function () {
	describe('named easings', function () {
		it('should define Out as the point reflection of In', function () {
			fc.assert(
				fc.property(family, dyadic, function (name, t) {
					expect(all[`easeOut${name}`](t)).toBeCloseTo(1 - all[`easeIn${name}`](1 - t), 12);
				})
			);
		});

		it('should make every InOut symmetric: g(1 - t) = 1 - g(t)', function () {
			fc.assert(
				fc.property(family, dyadic, function (name, t) {
					const g = all[`easeInOut${name}`];
					expect(g(1 - t)).toBeCloseTo(1 - g(t), 12);
				})
			);
		});

		it('should be non-decreasing on [0, 1] for the non-overshooting families', function () {
			fc.assert(
				fc.property(
					fc.constantFrom('Quad', 'Cubic', 'Quart', 'Quint', 'Sine', 'Expo', 'Circ'),
					fc.constantFrom('easeIn', 'easeOut', 'easeInOut'),
					unit,
					unit,
					function (name, kind, a, b) {
						const f = all[`${kind}${name}`];
						expect(f(Math.min(a, b))).toBeLessThanOrEqual(f(Math.max(a, b)) + 1e-15);
					}
				)
			);
		});

		it('should make easeOut an involution', function () {
			fc.assert(
				fc.property(family, dyadic, function (name, t) {
					const f = all[`easeIn${name}`];
					expect(helpers.easeOut(helpers.easeOut(f))(t)).toBeCloseTo(f(t), 12);
				})
			);
		});
	});

	describe('cubicBezier', function () {
		it('should be the identity (to 1e-9) for control points on the diagonal, i.e. solve x(s) = t accurately', function () {
			fc.assert(
				fc.property(control, control, unit, function (a, b, t) {
					expect(Math.abs(helpers.cubicBezier(a, a, b, b)(t) - t)).toBeLessThanOrEqual(1e-9);
				})
			);
		});

		it('should agree with the parametric curve: f(x(s)) = y(s)', function () {
			fc.assert(
				fc.property(control, overshoot, control, overshoot, unit, function (x1, y1, x2, y2, s) {
					const slope = bezierSlope(x1, x2, s);
					fc.pre(slope > 1e-3);
					const tolerance = 1e-9 * (1 + Math.abs(bezierSlope(y1, y2, s) / slope));
					expect(Math.abs(helpers.cubicBezier(x1, y1, x2, y2)(bezier(x1, x2, s)) - bezier(y1, y2, s))).toBeLessThanOrEqual(tolerance);
				})
			);
		});

		it('should be monotonic when y1, y2 are in [0, 1]', function () {
			fc.assert(
				fc.property(control, control, control, control, unit, unit, function (x1, y1, x2, y2, a, b) {
					const f = helpers.cubicBezier(x1, y1, x2, y2);
					expect(f(Math.min(a, b))).toBeLessThanOrEqual(f(Math.max(a, b)) + 1e-9);
				})
			);
		});

		it('should satisfy the reflection identity f(t) = 1 - f*(1 - t) with mirrored control points', function () {
			// Dyadic t: `1 - t` must be exact (near a vertical tangent, the curve is too steep for a rounded 1 - t to compare the same point).
			fc.assert(
				fc.property(control, overshoot, control, overshoot, dyadic, function (x1, y1, x2, y2, t) {
					const f = helpers.cubicBezier(x1, y1, x2, y2);
					const mirrored = helpers.cubicBezier(1 - x2, 1 - y2, 1 - x1, 1 - y1);
					const tolerance = 1e-7 * (1 + Math.abs(y1) + Math.abs(y2));
					expect(Math.abs(f(t) - (1 - mirrored(1 - t)))).toBeLessThanOrEqual(tolerance);
				})
			);
		});

		it('should extrapolate linearly outside [0, 1]', function () {
			fc.assert(
				fc.property(gridControl, overshoot, gridControl, overshoot, fc.double({ min: 1e-3, max: 100, noNaN: true }), function (x1, y1, x2, y2, d) {
					const f = helpers.cubicBezier(x1, y1, x2, y2);
					const before = 2 * f(-d);
					const after = 2 * (f(1 + d) - 1);
					expect(Math.abs(f(-2 * d) - before)).toBeLessThanOrEqual(1e-12 * (1 + Math.abs(before)));
					expect(Math.abs(f(1 + 2 * d) - 1 - after)).toBeLessThanOrEqual(1e-12 * (1 + Math.abs(after)));
				})
			);
		});
	});

	describe('steps', function () {
		it('should output non-decreasing multiples of 1/jumps in [0, 1], from the CSS start value to 1', function () {
			fc.assert(
				fc.property(fc.integer({ min: 2, max: 20 }), stepPosition, unit, unit, function (count, at, a, b) {
					const f = helpers.steps(count, at);
					const jumps = count + (at === 'jump-none' ? -1 : at === 'jump-both' ? 1 : 0);
					const low = f(Math.min(a, b));
					const high = f(Math.max(a, b));
					expect(low).toBeLessThanOrEqual(high);
					for (const value of [low, high]) {
						expect(value).toBeGreaterThanOrEqual(0);
						expect(value).toBeLessThanOrEqual(1);
						expect(Math.abs(value * jumps - Math.round(value * jumps))).toBeLessThan(1e-9);
					}
					expect(f(0)).toBe(at === 'jump-start' || at === 'start' || at === 'jump-both' ? 1 / jumps : 0);
					expect(f(1)).toBe(1);
				})
			);
		});

		it('should take the value (k + offset) / jumps in the middle of step k', function () {
			fc.assert(
				fc.property(fc.integer({ min: 2, max: 50 }), stepPosition, fc.nat(49), function (count, at, k) {
					fc.pre(k < count);
					const offset = at === 'jump-start' || at === 'start' || at === 'jump-both' ? 1 : 0;
					const jumps = count + (at === 'jump-none' ? -1 : at === 'jump-both' ? 1 : 0);
					expect(helpers.steps(count, at)((k + 0.5) / count)).toBe(Math.min(k + offset, jumps) / jumps);
				})
			);
		});
	});

	describe('spring', function () {
		const options = fc.record({
			stiffness: fc.double({ min: 10, max: 1000, noNaN: true }),
			damping: fc.double({ min: 1, max: 100, noNaN: true }),
			mass: fc.double({ min: 0.1, max: 10, noNaN: true }),
			velocity: fc.double({ min: -20, max: 20, noNaN: true })
		});

		it('should agree with a numerical (RK4) integration of m·x″ = -k·x - c·x′', function () {
			fc.assert(
				fc.property(options, function ({ stiffness, damping, mass, velocity }) {
					const { position } = helpers.spring({ stiffness, damping, mass, velocity });
					function acceleration(x: number, v: number): number {
						return (-stiffness * x - damping * v) / mass;
					}
					let x = -1;
					let v = velocity;
					const dt = 1e-4;
					for (let step = 1; step <= 2000; step++) {
						const k1x = v;
						const k1v = acceleration(x, v);
						const k2x = v + (dt / 2) * k1v;
						const k2v = acceleration(x + (dt / 2) * k1x, v + (dt / 2) * k1v);
						const k3x = v + (dt / 2) * k2v;
						const k3v = acceleration(x + (dt / 2) * k2x, v + (dt / 2) * k2v);
						const k4x = v + dt * k3v;
						const k4v = acceleration(x + dt * k3x, v + dt * k3v);
						x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
						v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
						if (step % 500 === 0) expect(position(step * dt)).toBeCloseTo(1 + x, 6);
					}
				}),
				{ numRuns: 50 }
			);
		});

		it('should stay within restDelta of the target after duration', function () {
			fc.assert(
				fc.property(options, fc.double({ min: 1e-4, max: 0.1, noNaN: true }), fc.double({ min: 0, max: 10, noNaN: true }), function (spec, restDelta, extra) {
					const { position, duration, easing } = helpers.spring({ ...spec, restDelta });
					expect(duration).toBeGreaterThan(0);
					expect(Math.abs(position(duration * (1 + extra)) - 1)).toBeLessThanOrEqual(restDelta * (1 + 1e-9));
					expect(easing(0)).toBe(0);
					expect(easing(1)).toBe(1);
				})
			);
		});
	});

	describe('interpolate', function () {
		it('should hit the end points exactly and equal from + (to - from)·easing(t) in between', function () {
			const finite = fc.double({ min: -1e6, max: 1e6, noNaN: true });
			fc.assert(
				fc.property(finite, finite, unit, family, function (from, to, t, name) {
					const easing = all[`easeInOut${name}`];
					expect(helpers.interpolate(from, to, 0, easing)).toBe(from);
					expect(helpers.interpolate(from, to, 1, easing)).toBe(to);
					expect(helpers.interpolate(from, to, t, easing)).toBeCloseTo(from + (to - from) * easing(t), 6);
				})
			);
		});
	});
});
