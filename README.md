![js-helpers: Small utilities. Solid foundations. Yellow, graphite and aluminum code-shaped building blocks.](https://raw.githubusercontent.com/emiliodominguez/js-helpers/main/docs/assets/js-helpers-banner.jpg)

[![CI](https://img.shields.io/github/actions/workflow/status/emiliodominguez/js-helpers/tests.yml?branch=main&style=for-the-badge&label=CI&labelColor=161b22&logo=githubactions&logoColor=white)](https://github.com/emiliodominguez/js-helpers/actions/workflows/tests.yml)
[![TypeScript: strict](https://img.shields.io/badge/TS-strict-3178c6?style=for-the-badge&labelColor=161b22&logo=typescript&logoColor=white)](./tsconfig.json)
[![Runtime dependencies: 0](https://img.shields.io/badge/deps-0-2ea44f?style=for-the-badge&labelColor=161b22&logo=npm&logoColor=white)](./package.json)
[![Property tests: fast-check](https://img.shields.io/badge/tests-fast--check-8250df?style=for-the-badge&labelColor=161b22&logo=jest&logoColor=white)](#testing-philosophy)
[![License: MIT](https://img.shields.io/badge/license-MIT-3da639?style=for-the-badge&labelColor=161b22&logo=opensourceinitiative&logoColor=white)](./LICENSE)

**Strictly typed utilities for everyday JavaScript.**

18 focused modules. Zero runtime dependencies. Import the helpers you need, with types and examples available in your editor.

[Install](#install) · [Quick start](#usage) · [Modules](#modules) · [Examples](#examples) · [API reference](./docs/API.md) · [Contributing](./CONTRIBUTING.md)

## Install

```bash
npm install @emiliodominguez/js-helpers
```

<details>
<summary>Using Yarn or pnpm?</summary>

```bash
yarn add @emiliodominguez/js-helpers
pnpm add @emiliodominguez/js-helpers
```

</details>

**Compatibility:** ESM-only. Node.js 20.19+, modern browsers, or a bundler. Node.js 20.19+ also supports loading this package with `require()`. `Intl.Segmenter` is used when available, with a code-point fallback.

## Usage

Import directly from a module so your bundler can keep only what you use:

```ts
import { chunk } from '@emiliodominguez/js-helpers/arrays';
import { isDefined } from '@emiliodominguez/js-helpers/guards';
import { round } from '@emiliodominguez/js-helpers/math';
import { toSlug } from '@emiliodominguez/js-helpers/strings';

chunk([1, 2, 3, 4, 5], 2); // [[1, 2], [3, 4], [5]]
[1, null, 2, undefined].filter(isDefined); // [1, 2], inferred as number[]
round(1.005, 2); // 1.01
toSlug('Café Society!'); // 'cafe-society'
```

<details>
<summary>Prefer namespaced imports?</summary>

The root entry groups helpers by module, avoiding name clashes such as `strings.isEmpty` and `objects.isEmpty`:

```ts
import { math, objects } from '@emiliodominguez/js-helpers';

math.round(1.005, 2); // 1.01 (naive Math.round(x * 100) / 100 gives 1)
objects.isEqual(new Map([[1, { a: [1] }]]), new Map([[1, { a: [1] }]])); // true
```

</details>

## Why js-helpers?

- **Types that follow your data.** Narrowing predicates, path-aware getters, tuple-typed `zip`, and typed `curry`, `compose` and `pipe`.
- **Care with the edge cases.** Unicode-aware strings, DST-safe date arithmetic, compensated summation, circular-reference support and prototype-pollution checks.
- **Small imports, complete docs.** Minified ESM modules with no runtime dependencies. Type declarations retain the JSDoc, so editor documentation stays useful.
- **Behavior you can verify.** Example tests, [fast-check](https://fast-check.dev) properties and executable JSDoc examples. Inputs stay unchanged unless mutation is part of the named operation.

## Modules

Start with the task. Each module links to its full API reference.

| What you need                                  | Modules                                                                                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transform collections and inspect data         | [`arrays`](./docs/API.md#arrays), [`iterables`](./docs/API.md#iterables), [`objects`](./docs/API.md#objects), [`guards`](./docs/API.md#guards)                             |
| Clean text, validate input and build URLs      | [`strings`](./docs/API.md#strings), [`validate`](./docs/API.md#validate), [`url`](./docs/API.md#url)                                                                       |
| Calculate, format and work with dates or color | [`math`](./docs/API.md#math), [`date`](./docs/API.md#date), [`format`](./docs/API.md#format), [`color`](./docs/API.md#color)                                               |
| Coordinate async work, functions and state     | [`async`](./docs/API.md#async), [`functions`](./docs/API.md#functions), [`cache`](./docs/API.md#cache), [`emitter`](./docs/API.md#emitter), [`store`](./docs/API.md#store) |
| Generate random values and decorate methods    | [`random`](./docs/API.md#random), [`decorators`](./docs/API.md#decorators)                                                                                                 |

<details>
<summary>Browse the helpers in all 18 modules</summary>

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
| [`format`](./docs/API.md#format)         | deterministic, cached Intl formatting: `formatCurrency`, `formatCompact`, `formatPercent`, `formatList`, `formatOrdinal`, …      |
| [`validate`](./docs/API.md#validate)     | ReDoS-safe type predicates: `isEmail`, `isUrl`, `isUuid`, `isIP`, `isSemver`/`compareSemver`, ISO dates, Luhn, base64            |
| [`color`](./docs/API.md#color)           | hex/RGB/HSL conversion, `mix`, `lighten`/`darken`, WCAG `contrastRatio`, `getReadableTextColor`, `meetsContrast`                 |
| [`url`](./docs/API.md#url)               | `buildQueryString`/`parseQueryString` (pollution-safe), `withQuery`, `joinUrl`, `getQueryParam`                                  |
| [`iterables`](./docs/API.md#iterables)   | lazy `map`/`filter`/`take`/`chunk`/`zip`/`windowed` over any (async) iterable, infinite sources, exact pull counts               |
| [`cache`](./docs/API.md#cache)           | O(1) `createLRUCache` with TTL, eviction reasons and an injectable clock; drop-in cache for `memoize`                            |
| [`emitter`](./docs/API.md#emitter)       | typed `createEmitter` with wildcard listeners, `once`, `waitFor` (timeout/abort) and error isolation                             |
| [`store`](./docs/API.md#store)           | `createStore` for `useSyncExternalStore`, with equality-gated updates and cached `select()` stores                               |
| [`random`](./docs/API.md#random)         | seeded `createRandom` (cross-platform deterministic), secure `randomId`/`randomUUID`/`randomBytes`, `weightedRandom`             |
| [`decorators`](./docs/API.md#decorators) | `@memoize`/`@once` (per instance), `@bound`, `@debounced`, `@throttled`, `@retryable`, `@timeout`, `@readonly`, `@deprecated`    |

</details>

**[Full API reference](./docs/API.md)** · Parameters, return values, errors and examples are also available through editor hover. Run `yarn docs` to generate a browsable TypeDoc site.

## Examples

Choose a recipe to see the imports and usage together.

<details>
<summary>Everyday helpers: typed data, retries, dates and formatting</summary>

These integration snippets use application-provided values such as `user`, `defaults`, `userInput`, `url`, `urls`, `input`, `fetchPage` and `persist`.

```ts
import { getFromObjectByKeys, deepMerge } from '@emiliodominguez/js-helpers/objects';
import { isDefined } from '@emiliodominguez/js-helpers/guards';
import { retry, withTimeout, mapWithConcurrency } from '@emiliodominguez/js-helpers/async';
import { debounce } from '@emiliodominguez/js-helpers/functions';
import { addMonths, formatDate } from '@emiliodominguez/js-helpers/date';
import { getReadableTextColor } from '@emiliodominguez/js-helpers/color';
import { formatCompact, formatCurrency } from '@emiliodominguez/js-helpers/format';
import { compareSemver, isEmail } from '@emiliodominguez/js-helpers/validate';
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

// Deterministic formatting (en-US / UTC by default, never the host locale) and safe validation.
formatCurrency(1234.5, 'EUR'); // '€1,234.50'
formatCompact(1_250_000); // '1.3M'
isEmail(input); // narrows `unknown` to `string`
['1.0.0', '1.0.0-rc.1', '0.9.9'].sort(compareSemver); // ['0.9.9', '1.0.0-rc.1', '1.0.0']
```

</details>

<details>
<summary>Application building blocks: caching, events, state and lazy iterables</summary>

The caching example wraps your application's `fetchUser` function. The remaining examples are self-contained.

```ts
import { createLRUCache } from '@emiliodominguez/js-helpers/cache';
import { createEmitter } from '@emiliodominguez/js-helpers/emitter';
import { memoize } from '@emiliodominguez/js-helpers/functions';
import { count, filter, map, take, toArray } from '@emiliodominguez/js-helpers/iterables';
import { createRandom } from '@emiliodominguez/js-helpers/random';
import { createStore } from '@emiliodominguez/js-helpers/store';

// Bounded, expiring memoization.
const getUser = memoize(fetchUser, { cache: createLRUCache({ max: 500, ttl: 60_000 }) });

// React-ready state: useSyncExternalStore(counter.subscribe, counter.getState)
const counter = createStore({ count: 0 });
counter.setState(function (state) {
	return { count: state.count + 1 };
});

// Typed events: payloads are checked, `void` events take no argument.
const events = createEmitter<{ login: { userId: string }; logout: void }>();
events.on('login', function ({ userId }) {
	console.log(userId);
});
events.emit('logout');

// Lazy pipelines over infinite sources: only 6 items are ever pulled.
const squares = map(count(1), function (n) {
	return n * n;
});
toArray(
	take(
		filter(squares, function (n) {
			return n % 2 === 0;
		}),
		3
	)
); // [4, 16, 36]

// Reproducible randomness (tests, simulations, procedural content).
const rng = createRandom('docs');
[rng.int(1, 6), rng.int(1, 6), rng.int(1, 6)]; // [3, 3, 5] on every platform
```

</details>

<details>
<summary>Decorators: memoize, debounce and bind class methods</summary>

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

</details>

## Size

**About 32 kB gzipped for all modules combined.** Deep imports and tree-shaking reduce that to the helpers your application actually uses. The package has no runtime dependencies, and `yarn check:size` enforces its size budget.

<details>
<summary>See the size of each module</summary>

Sizes below are for the minified ESM build.

| Module       | Minified | Gzipped |
| ------------ | -------: | ------: |
| `arrays`     |   7.1 kB |  2.6 kB |
| `async`      |   5.7 kB |  2.2 kB |
| `cache`      |   2.2 kB |  1.0 kB |
| `color`      |   3.5 kB |  1.6 kB |
| `date`       |  10.1 kB |  3.5 kB |
| `decorators` |   4.7 kB |  1.5 kB |
| `emitter`    |   2.1 kB |  1.0 kB |
| `format`     |   3.5 kB |  1.3 kB |
| `functions`  |   5.4 kB |  2.1 kB |
| `guards`     |   4.3 kB |  1.5 kB |
| `iterables`  |   5.5 kB |  1.8 kB |
| `math`       |   8.3 kB |  2.9 kB |
| `objects`    |  10.8 kB |  3.7 kB |
| `random`     |   5.1 kB |  2.2 kB |
| `store`      |   1.5 kB |  0.7 kB |
| `strings`    |   9.0 kB |  3.6 kB |
| `url`        |   2.8 kB |  1.3 kB |
| `validate`   |   5.6 kB |  2.3 kB |

</details>

## Testing philosophy

Example-based tests cover known edge cases. Property tests check algebraic laws and invariants over generated inputs. The JSDoc examples are executed too, with their documented results asserted by `yarn test:docs`.

The local validation suite runs tests in UTC, New York, Lord Howe and Kolkata. CI is configured for Node.js 20, 22, 24 and 26, with additional time-zone jobs on Node.js 22.

<details>
<summary>Explore the test strategy and commands</summary>

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
yarn test:tz         # the suite under UTC, New York, Lord Howe and Kolkata
yarn test:docs       # execute every JSDoc @example
yarn validate        # everything: lint, format, types, tests in 4 time zones, doctests, build, dist smoke test, size, exports
```

</details>

## Migrating from 1.x

Version 2 introduces ESM-only packaging, stricter types and corrected edge-case behavior. Review these changes before upgrading.

<details>
<summary>Read the 1.x to 2.x migration notes</summary>

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

</details>

## Contributing

Start with the [contributing guide](./CONTRIBUTING.md) for setup, code conventions and testing. Behavior changes should include a regression test and, where useful, a property test.

[Report a bug](https://github.com/emiliodominguez/js-helpers/issues) · [Read the changelog](./CHANGELOG.md)

## License

[MIT](./LICENSE) © Emilio Dominguez
