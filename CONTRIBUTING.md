# Contributing

## Setup

```bash
yarn install   # also installs the husky pre-commit hook (lint-staged)
yarn validate  # lint + typecheck + tests + build — the same gates CI runs
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
