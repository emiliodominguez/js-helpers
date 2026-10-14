# Contributing

## Setup

```bash
yarn install   # also installs the husky pre-commit hook (lint-staged)
yarn validate  # lint + typecheck + tests + build + dist smoke test + size budget — the same gates CI runs
```

## Module layout

Each module lives in `src/<module>/` and follows the same shape:

| File                        | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `index.ts`                  | Public API. The only file exporting runtime code.               |
| `<module>.spec.ts`          | Example-based unit tests (edge cases, regressions).             |
| `<module>.property.spec.ts` | Property-based tests with [fast-check](https://fast-check.dev). |

New modules must be re-exported as a namespace from `src/index.ts`; deep imports (`@emiliodominguez/js-helpers/<module>`) work automatically through the `exports` map.

## Code rules

ESLint enforces most of these:

- **No arrow functions.** Use function declarations, or `function () {}` expressions for callbacks.
- **Full JSDoc** on every function: summary, `@template`, `@param`, `@returns`, `@throws`, `@example`.
- **No `any`** in source code: use `unknown`, generics and the type guards from `guards`.
- **Pure by default.** Anything that mutates its input says so in its name or JSDoc.
- **Fail loudly.** Invalid arguments that would otherwise produce garbage, infinite loops or stack overflows throw a `RangeError`/`TypeError`.
- **Deterministic randomness.** Functions that use randomness take an optional `random` generator (defaults to `Math.random`).
- **ESM-ready imports.** Relative imports use explicit `.js` extensions (`'../guards/index.js'`).

## Tests

- Every bug fix comes with a regression test.
- Every non-trivial function gets at least one meaningful **property**: an invariant, an algebraic law, a round-trip, or equivalence with a naive reference implementation. A property that only checks "it doesn't throw" isn't enough.
- Date tests must pass in any time zone; CI runs them under `UTC`, `America/New_York` and `Australia/Lord_Howe`.

```bash
yarn test                         # all suites
yarn test src/strings             # a single module
yarn test:coverage                # with coverage thresholds
TZ=Australia/Lord_Howe yarn test src/date
```

### Executable examples

Every `@example` of the exported API is run by `yarn test:docs` (`scripts/doctest.mjs`, optionally restricted to modules: `yarn test:docs strings date`) against the current sources, so examples can't drift from the code:

```ts
chunk([1, 2, 3], 2); // => [[1, 2], [3]]
square(3); // => 9 // anything after a second `//` is a note
const copy = deepClone(original); // => original
await withTimeout(Promise.resolve(1), 100); // => 1
range(0, 1, 0); // throws RangeError
```

- `expr; // => expected` asserts that `expr` deep-equals the JS expression `expected`: `Object.is` for primitives (`NaN` matches, `-0` ≠ `0`), structural comparison for arrays, objects, `Map`, `Set`, `Date`, `RegExp` and typed arrays (null-prototype objects match object literals). `await` works: each block runs in its own async function, in strict mode.
- `expr; // throws ErrorName` asserts that `expr` throws (with `await`, rejects) an error with that `name`.
- Any other comment is prose and isn't checked: use it for random values or the current time.
- The module's exports are in scope; use `import { x } from '@emiliodominguez/js-helpers/<module>'` lines for other modules. `@decorator` syntax works (TC39 standard decorators).
- Blocks must be self-contained. Dates use local constructors (`new Date(2024, 0, 31)`) so examples pass in every time zone. A block that can't run (DOM, network, placeholders) starts with `// doctest: skip`.
