# color — equivalent mutants

- 139: `value >= 255` → `value > 255` — at exactly 255 the other branch returns `Math.round(255)`, the same 255.
- 155: `linear === undefined` → `true` — disables the `LINEAR_CHANNELS` cache only; the recomputed value is identical.
- 157: `unit <= 0.04045` → `<` — `unit = value / 255` for an integer byte never equals 0.04045 (0.04045 × 255 = 10.31…).
- 247: `i < 4` → `i <= 4` — a fifth pass reads capture groups past the end of the match (`undefined`) and writes nothing.
- 289: `text.length === 11 &&` → `true &&` — length pre-check that skips `toLowerCase()`; only 'transparent' (11 chars) matches anyway.
- 490: `{ r: 0, g: 0, b: 0 }` → `{}` — `hslValuesToRgb` writes r, g, b in that order; the literal only fixes the object shape (hidden class) for speed.
- 508: `hue >= 0 && hue < 360 ? hue : modulo(...)` → `false ? …` — skips the slow `%` for in-range hues; `modulo` returns the same hue.
- 508: `hue >= 0` → `hue > 0` — hue 0 goes through `modulo(0, 360)`, which is 0.
- 508: `hue < 360` → `hue <= 360` — h = 360 gives k = offset + 12, reduced by the `k >= 12` step to the same k as h = 0.
- 530: `k >= 12` → `k > 12` — k = 12 and k = 0 give the same channel (`max(-1, min(k - 3, 9 - k, 1))` is -1 for both).
- 711: `ratio >= threshold` → `>` — an exhaustive search over all 2^24 luminances found no colour pair whose ratio is exactly 3, 4.5 or 7, so equality never happens.
