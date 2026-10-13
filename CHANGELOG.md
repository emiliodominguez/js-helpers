# Changelog

## 2.0.0

Full review and rewrite: every module is strictly typed, documented with complete JSDoc, and covered by example-based and property-based tests.

### Added

- **New modules:** `guards`, `async` and `date`. The `date` module replaces an empty stub.
- **~120 new utilities.** See [docs/API.md](./docs/API.md).
- **Packaging:**
    - dual ESM/CJS build;
    - `exports` map with per-module deep imports;
    - namespaced root entry;
    - declaration maps.
- **Docs:** API reference generated from the JSDoc (`yarn docs:api`) and a TypeDoc site (`yarn docs`).
- **CI:** runs on Node 18–24, in DST-heavy time zones, and checks type resolution with are-the-types-wrong.

### Fixed

**arrays**

- `contains` never found `NaN`.
- `flatten` had the wrong types and was quadratic.

**objects**

- `merge` didn't compile for objects with different keys.
- `clone` turned arrays into objects.
- `hasProperty` matched inherited keys.
- `getFromObjectByKeys` threw on missing paths.

**strings**

- `replace` and `countSubString` built a regex from the search text, which allowed regex injection.
- `reverse` and `capitalize` broke emoji and surrogate pairs.
- The case converters only split on single spaces.
- `toSlug` dropped accented letters.

**math**

- `round` returned `NaN` for numbers written in exponential notation.
- `factorial` overflowed the stack on negative input.
- `max` and `min` threw on large arrays.
- `log(1000, 10)` returned 2.9999999999999996.

**functions**

- `compose()` threw when given no functions.
- `memoize` never served cached falsy results.
- Every wrapper lost `this`.

**decorators**

- `@memoize` shared one cache across all instances.
- `@readonly` did nothing.

### Changed (breaking)

See [Migrating from 1.x](./README.md#migrating-from-1x).

- The package is renamed to `@emiliodominguez/js-helpers`, because `js-helpers` is taken on npm.
- **Behaviour:**
    - `modulo` is now a floored modulo;
    - `countSubString` is case-sensitive;
    - `hasProperty` only checks own properties;
    - `round` rounds halves away from zero.
