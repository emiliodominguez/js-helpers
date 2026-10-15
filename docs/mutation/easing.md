# easing — equivalent mutants

86: `x < 1` → `x <= 1` — the bounce arcs meet continuously: at x = 1 both arcs give exactly 1 (exact binary fractions).
88: `x < 2` → `x <= 2` — at x = 2 both neighbouring arcs give exactly 1.
88: `x < 2.5` → `x <= 2.5` — at x = 2.5 both neighbouring arcs give exactly 1.
396: `i < 64` → `i <= 64` — iteration cap of solveBezier: Newton/bisection stops on the step test long before (the cap only binds for t < ~1e-19 at a vertical tangent, where both results are equally inaccurate).
396: `i++` → `i--` — same cap, never reached for representable inputs: the step test always ends the loop.
399: `>= BEZIER_EPSILON` → `> BEZIER_EPSILON` — a step of exactly 1e-12 does not occur; one more step would only refine s further.
400: `error < 0` → `error <= 0` — error === 0 gives step 0 (or NaN) and the loop has already stopped at the step test.
402: `s -= step` → `s += step` — a wrong-direction Newton step leaves the bracket and is replaced by bisection: same root, more iterations.
403: `if (!(s > low && s < high))` → `if (true)` — pure bisection: converges to the same root (to ~1e-12), only slower.
403: `!(s > low && s < high)` → `!(false)` — same as above (always bisect).
403: `s > low && …` → `true && …` — only the lower-bracket check is lost; out-of-bracket steps below are rare and the safeguarded iteration still converges to the same root (≤ 1.5e-11 difference at the ill-conditioned flat point, within that point's conditioning).
403: `s > low` → `s >= low` — landing exactly on the bracket end is harmless (bisection continues); same root.
403: `s > low` → `s <= low` — bisects whenever Newton stays in the bracket: same root, slower.
403: `s < high` → `s <= high` — landing exactly on the bracket end is harmless; same root.
454: `t <= 0.5` → `t < 0.5` — at exactly t = 0.5 both the curve and its mirror give the solution to ~1e-12; which half solves the midpoint is arbitrary.
553: `[0]` → `[]` — `speed[0]` is always written by `displacement` before `settled` reads it (the array exists to keep the double unboxed).
581: `-omega * (zeta + √(ζ²-1))` → `-omega / (…)` — since (ζ+√(ζ²-1))(ζ-√(ζ²-1)) = 1 the mutant computes the other root and r1 = ω²/r2 the first one: the two roots swap, and the solution is symmetric in them.
600: `<= stiffness·restDelta²` → `<` — the energy is never exactly at the threshold at a float time (the bisection ends on adjacent floats either way).
619: `i < 64` → `i <= 64` — after 64 halvings the bisection bracket has already collapsed to adjacent floats; a 65th step changes nothing.
