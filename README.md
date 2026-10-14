# js-helpers

[![CI](https://github.com/emiliodominguez/js-helpers/actions/workflows/tests.yml/badge.svg)](https://github.com/emiliodominguez/js-helpers/actions/workflows/tests.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![Tested with fast-check](https://img.shields.io/badge/property--tested-fast--check-ff69b4)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Strictly-typed, zero-dependency TypeScript utilities, verified with property-based tests.

**300+ functions** across 11 modules: `arrays`, `objects`, `guards`, `strings`, `math`, `functions`, `async`, `date`, `color`, `url` and `decorators`.

- **Correct first.** Unicode-aware strings, DST-safe dates, compensated summation, injection-safe string replacement, a deep merge that blocks prototype pollution, and deep clone/equality that handle circular references.
- **Typed for real.** Type predicates that narrow, path-aware getters (`'user.posts.0.title'` resolves to `string | undefined`), tuple-typed `zip`, typed `curry`/`compose`/`pipe`, and a left-to-right `Merge` type.
- **Property-tested.** Every non-trivial function is checked against algebraic laws, invariants or a naive reference implementation with [fast-check](https://fast-check.dev), on top of example-based edge-case tests. The suite is 1,500+ tests at 100% coverage, run in CI on Node 20–26 and in time zones with awkward DST rules.
- **Pure and predictable.** Nothing mutates its input unless the name says so. Bad arguments throw a descriptive `RangeError`/`TypeError` instead of returning garbage, looping forever or overflowing the stack.
- **Ultra lightweight.** Zero runtime dependencies. The ESM-only build ships one minified, unbundled file per module, so deep imports and tree-shaking keep only what you use. Every function combined is about 23 kB gzipped; a typical module is 1.5–3.5 kB (see [Size](#size)). JSDoc lives in the `.d.ts` files, so editor hover docs stay complete, and a size budget is enforced in CI.

## Install

```bash
npm install @emiliodominguez/js-helpers
# or
yarn add @emiliodominguez/js-helpers
```

The package is ESM-only and requires Node 20.19+ (where `require()` of ES modules works too), any modern browser, or a bundler. `Intl.Segmenter` is used when available, with a code-point fallback.

## Usage

Import a module directly. This is the best option for tree-shaking:

```ts
import { chunk, groupBy, sortBy } from '@emiliodominguez/js-helpers/arrays';
import { toKebabCase, toSlug } from '@emiliodominguez/js-helpers/strings';

chunk([1, 2, 3, 4, 5], 2); // [[1, 2], [3, 4], [5]]
toKebabCase('XMLHttpRequest'); // 'xml-http-request'
toSlug('Café Society!'); // 'cafe-society'
```

Or use the namespaced root entry. Namespaces avoid name clashes such as `strings.isEmpty` vs `objects.isEmpty`:

```ts
import { arrays, math, objects } from '@emiliodominguez/js-helpers';

math.round(1.005, 2); // 1.01 (naive Math.round(x * 100) / 100 gives 1)
objects.isEqual(new Map([[1, { a: [1] }]]), new Map([[1, { a: [1] }]])); // true
```

## Modules

| Module                                   | Highlights                                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [`arrays`](./docs/API.md#arrays)         | `chunk`, `groupBy`, `partition`, `sortBy` (stable), `windowed`, `binarySearch`, `cartesianProduct`, `minBy`/`maxBy`, set algebra |
| [`objects`](./docs/API.md#objects)       | `deepClone`, `deepMerge`, `isEqual`, `diff`, `flattenObject`/`unflattenObject`, `pick`/`omit`, type-safe path get/set            |
| [`guards`](./docs/API.md#guards)         | 35+ narrowing predicates (`isPlainObject`, `isNonEmptyArray`, `isOneOf`, `isArrayOf`, …) and `assert`/`assertNever`              |
| [`strings`](./docs/API.md#strings)       | every case style, `toSlug`, `dedent` tag, `wordWrap`, `levenshtein`, `mask`, `escapeHtml`, grapheme-aware `reverse`/`truncate`   |
| [`math`](./docs/API.md#math)             | precise `sum`/`round`, `quantile`, `variance`, `clamp`/`lerp`/`mapRange`, `formatBytes`, `ordinal`, `gcd`/`lcm`, `isPrime`       |
| [`functions`](./docs/API.md#functions)   | `debounce`/`throttle` with `cancel`/`flush`, `memoize`, `memoizeLast`, `curry`, `compose`/`pipe`, `once`, `attempt`              |
| [`async`](./docs/API.md#async)           | `retry` with backoff, `withTimeout`, `createLimiter`, `mapWithConcurrency`, `pollUntil`, `promiseAllObject`, `debounceAsync`     |
| [`date`](./docs/API.md#date)             | DST-safe `addDays`/`addMonths`/`addBusinessDays`, ISO weeks, quarters, `getAge`, `formatDate`, `formatDuration`/`parseDuration`  |
| [`color`](./docs/API.md#color)           | hex/RGB/HSL conversion, `mix`, `lighten`/`darken`, WCAG `contrastRatio`, `getReadableTextColor`, `meetsContrast`                 |
| [`url`](./docs/API.md#url)               | `buildQueryString`/`parseQueryString` (pollution-safe), `withQuery`, `joinUrl`, `getQueryParam`                                  |
| [`decorators`](./docs/API.md#decorators) | `@memoize`/`@once` (per instance), `@bound`, `@debounced`, `@throttled`, `@retryable`, `@timeout`, `@readonly`, `@deprecated`    |

📖 **[Full API reference →](./docs/API.md)**. Every export is listed there with its summary. The JSDoc on each function documents its parameters, return value, thrown errors and examples, so your editor shows them on hover. Run `yarn docs` to get a browsable TypeDoc site.

## A taste

```ts
import { getFromObjectByKeys, deepMerge } from '@emiliodominguez/js-helpers/objects';
import { isDefined } from '@emiliodominguez/js-helpers/guards';
import { retry, withTimeout, mapWithConcurrency } from '@emiliodominguez/js-helpers/async';
import { debounce } from '@emiliodominguez/js-helpers/functions';
import { addMonths, formatDate } from '@emiliodominguez/js-helpers/date';
import { getReadableTextColor } from '@emiliodominguez/js-helpers/color';
import { withQuery } from '@emiliodominguez/js-helpers/url';

// Type-safe deep access: the return type is inferred from the path.
const city = getFromObjectByKeys(user, 'address.city', 'Unknown'); // string

// Narrowing filters.
const ids = [1, null, 2, undefined].filter(isDefined); // number[]

// Ignores __proto__ / constructor / prototype keys, so it is safe on untrusted JSON.
const config = deepMerge(defaults, JSON.parse(userInput));

// Resilient I/O.
const data = await retry(
	function () {
		return withTimeout(fetch(url), 5_000);
	},
	{ retries: 3, delay: 200, jitter: true }
);
const pages = await mapWithConcurrency(urls, fetchPage, 4); // at most 4 requests in flight, order preserved

// Rate limiting with control.
const save = debounce(persist, 300, { maxWait: 2_000 });
save.flush(); // run now, e.g. on beforeunload

// Calendar math that respects month lengths and DST.
formatDate(addMonths(new Date(2024, 0, 31), 1), 'YYYY-MM-DD'); // '2024-02-29'

// Accessible colors and clean URLs.
getReadableTextColor('#1e3a8a'); // '#ffffff'
withQuery('/search?page=2#results', { q: 'café', page: 3 }); // '/search?q=caf%C3%A9&page=3#results'
```

### Decorators

The decorators detect at runtime which decorator style they were applied with. They work with all three:

- TypeScript `experimentalDecorators`.
- Babel's legacy plugin.
- TC39 standard decorators (TypeScript 5+ without `experimentalDecorators`).

```ts
import { memoize, bound, debounced, readonly } from '@emiliodominguez/js-helpers/decorators';

class SearchBox {
	@readonly id = crypto.randomUUID(); // write-once: reassigning throws TypeError

	@debounced(250) // separate timer per instance
	search(query: string): void {}

	@bound // safe to pass as a callback
	onInput(event: Event): void {}

	@memoize // separate cache per instance
	score(term: string): number {}
}
```

> `@readonly` with `experimentalDecorators` requires `useDefineForClassFields: false`. That is the default for targets below ES2022. With define semantics the class field shadows the decorator's accessor.

## Size

Zero dependencies. Sizes are for the minified ESM build; bundlers only include the functions you import.

| Module       | Minified | Gzipped |
| ------------ | -------: | ------: |
| `arrays`     |   7.1 kB |  2.6 kB |
| `async`      |   5.7 kB |  2.2 kB |
| `color`      |   3.5 kB |  1.6 kB |
| `date`       |  10.1 kB |  3.5 kB |
| `decorators` |   4.7 kB |  1.5 kB |
| `functions`  |   5.4 kB |  2.1 kB |
| `guards`     |   4.3 kB |  1.5 kB |
| `math`       |   8.3 kB |  2.9 kB |
| `objects`    |  10.8 kB |  3.7 kB |
| `strings`    |   9.0 kB |  3.6 kB |
| `url`        |   2.8 kB |  1.3 kB |

All modules together are about 23 kB gzipped. CI enforces the total with `yarn check:size`.

## Testing philosophy

Every module has two test files:

- `*.spec.ts`: example-based tests for documented behaviour, edge cases (empty input, `NaN`, unicode, invalid arguments) and regressions.
- `*.property.spec.ts`: [fast-check](https://fast-check.dev) properties, for example:
    - `deepClone(x)` is `isEqual` to `x` and shares no references with it;
    - `unescapeHtml(escapeHtml(s)) === s`;
    - `diffInDays(addDays(d, n), d) === n` in every time zone;
    - `compose(...fs)` is the same as `pipe(...fs.reverse())`;
    - `mapWithConcurrency` never exceeds its concurrency and matches `Array#map`;
    - `chunk(xs, n).flat()` round-trips;
    - `isPrime` agrees with a naive reference.

```bash
yarn test            # all suites
yarn test:coverage   # with coverage thresholds
yarn validate        # lint + typecheck + tests + build (what CI runs)
```

## Migrating from 1.x

2.0 fixes a number of bugs, and some of those fixes change behaviour. Here is what to check:

**arrays**

- `first`/`last` are now typed `T | undefined`.
- `contains` now finds `NaN`.

**objects**

- `clone` keeps arrays as arrays (it used to turn them into objects).
- `hasProperty` only checks **own** properties. `hasProperty({}, 'toString')` is now `false`.
- `getFromObjectByKeys` no longer throws on missing paths, and accepts an optional default value. Its second generic parameter is now the path, so let TypeScript infer it instead of writing `getFromObjectByKeys<T, R>(…)`.
- The `is*` type checks moved to `guards` and are now real type predicates. They are still re-exported from `objects`.

**strings**

- `replace` and `countSubString` treat the search text literally. They no longer build a regex from it.
- `countSubString` is now case-sensitive. Pass `{ ignoreCase: true }` for the old behaviour.
- `toSnakeCase`/`toCamelCase` now split camelCase, acronyms and punctuation, not just single spaces.
- `toNumber('')` returns `NaN`, not `0`.
- `toBoolean` also accepts `'1'`, `'yes'`, `'y'` and `'on'`.

**math**

- `modulo` is now a true floored modulo: `modulo(-1, 3) === 2`. The old `%` behaviour is available as `remainder`.
- `round` rounds halves away from zero, so `round(-2.5) === -3`.
- `factorial`, `round`, `randomIntBetween` and similar functions throw `RangeError` on invalid input instead of overflowing the stack or returning `NaN`.

**functions**

- All wrappers preserve `this`.
- `memoize` now caches falsy results.
- `debounce`/`throttle` return the latest result and expose `cancel()`.

**decorators**

- `@memoize` keeps a separate cache per instance. Previously all instances shared one cache.
- `@readonly` now works.

**Imports**

- The root entry exports namespaces (`import { strings } from …`). Use deep imports to get individual functions.
- The package is ESM-only and requires Node 20.19+. CommonJS code on those versions can still `require()` it.
- `guards` checks for built-ins (`isMap`, `isDate`, …) verify internal slots, so objects built with `Object.create(Map.prototype)`, and proxies of real instances, are no longer accepted.
- `memoize` cache keys now tell `NaN`, `Infinity`, `-0` and `undefined` apart. Previously they collided.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). In short: no arrow functions, full JSDoc, no `any`, and every behaviour change ships with a regression test and, where it makes sense, a property.

## License

[MIT](./LICENSE) © Emilio Dominguez
