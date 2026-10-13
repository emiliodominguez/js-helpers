# API reference

> Generated from the JSDoc in `src/*/index.ts` by `yarn docs:api` — do not edit by hand.
> Every function documents its parameters, return value, thrown errors and examples in its JSDoc, so your editor shows the full details on hover.
> For a browsable HTML version run `yarn docs` (TypeDoc, output in `docs/reference`).

[`arrays`](#arrays) · [`objects`](#objects) · [`guards`](#guards) · [`strings`](#strings) · [`math`](#math) · [`functions`](#functions) · [`async`](#async) · [`date`](#date) · [`decorators`](#decorators)

## arrays

Collection helpers: set algebra, grouping, chunking, sorting, sampling.

```ts
import { … } from '@emiliodominguez/js-helpers/arrays';
```

| Export                | Description                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `contains`            | Check if an array contains a value, using SameValueZero equality (so `NaN` is found and `0` matches `-0`).                   |
| `first`               | Get the first item in an array.                                                                                              |
| `last`                | Get the last item in an array.                                                                                               |
| `flatten`             | Flatten an array by exactly one level, like `Array.prototype.flat()` (holes in sparse arrays are skipped).                   |
| `flattenDeep`         | Recursively flatten nested arrays of any depth, like `Array.prototype.flat(Infinity)` (holes are skipped).                   |
| `removeDuplicates`    | Remove duplicates from an iterable (SameValueZero equality), keeping the first occurrence of each value.                     |
| `union`               | Get the union of two iterables: every distinct value from `a`, then every distinct value of `b` not already in `a`.          |
| `intersection`        | Get the intersection of two iterables: the distinct values of `a` that also appear in `b`.                                   |
| `difference`          | Get the difference of two iterables: the distinct values of `a` that do not appear in `b`.                                   |
| `symmetricDifference` | Get the symmetric difference of two iterables: the distinct values that appear in exactly one of them.                       |
| `isSubset`            | Check whether every value of `subset` also appears in `superset` (SameValueZero equality).                                   |
| `chunk`               | Split an array into consecutive chunks of `size` items; only the last chunk may be shorter.                                  |
| `compact`             | Remove every falsy value (`false`, `null`, `undefined`, `0`, `-0`, `NaN`, `''`, `0n`) from an array.                         |
| `range`               | Create an array of numbers progressing from `start` up to, but not including, `end`, with Python `range` semantics.          |
| `zip`                 | Combine arrays element-wise into tuples, truncating to the length of the shortest array.                                     |
| `groupBy`             | Group the items of an array by the key returned by `keyFn`, preserving input order within each group.                        |
| `keyBy`               | Index the items of an array by the key returned by `keyFn`; when several items share a key, the last one wins.               |
| `countBy`             | Count the items of an array per key returned by `keyFn`.                                                                     |
| `partition`           | Split an array in two: the items matching a type-guard `predicate`, and the others.                                          |
| `uniqueBy`            | Remove items whose key (as returned by `keyFn`, compared with SameValueZero) was already seen, keeping the first occurrence. |
| `sortBy`              | Return a sorted copy of an array, ordered by the key `selector` returns for each item.                                       |
| `shuffle`             | Return a shuffled copy of an array using the Fisher–Yates algorithm (the input is not mutated).                              |
| `sample`              | Pick a random item from an array.                                                                                            |
| `take`                | Return the first `n` items of an array (or all of them when it is shorter).                                                  |
| `drop`                | Return an array without its first `n` items.                                                                                 |

## objects

Shallow/deep cloning, merging, equality, path access and object reshaping.

```ts
import { … } from '@emiliodominguez/js-helpers/objects';
```

| Export                | Description                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge`               | Shallowly merges one or more source objects into a NEW object, left to right (later keys win, like `{ ...target, ...a, ...b }`).                               |
| `clone`               | Creates a shallow copy of a value.                                                                                                                             |
| `hasProperty`         | Determines whether an object has an OWN property with the given key (inherited properties such as `toString` do not count).                                    |
| `getProperty`         | Gets the value of a property of an object.                                                                                                                     |
| `setProperty`         | Sets the value of a property of an object.                                                                                                                     |
| `deleteProperty`      | Deletes a property from an object.                                                                                                                             |
| `getPropertyNames`    | Gets the names of ALL own string-keyed properties of an object (`Object.getOwnPropertyNames`), including NON-enumerable ones (e.g. arrays include `'length'`). |
| `isEmpty`             | Determines whether a value is empty.                                                                                                                           |
| `pick`                | Creates a new object with only the given keys.                                                                                                                 |
| `omit`                | Creates a new object with every own enumerable (string and symbol) property except the given keys.                                                             |
| `mapValues`           | Creates a new object with the same own enumerable (string and symbol) keys, whose values are the results of `fn`.                                              |
| `mapKeys`             | Creates a new object with the same values, whose keys are the results of `fn`.                                                                                 |
| `invert`              | Creates a new object whose keys are the values of `object` and whose values are the (string) keys.                                                             |
| `getFromObjectByKeys` | Safely reads a nested value through a dot-separated path (array elements are addressed with numeric segments: `'list.0.id'`).                                  |
| `setInObjectByKeys`   | Sets a nested value through a dot-separated path.                                                                                                              |
| `deepClone`           | Creates a deep copy of a value without using `structuredClone`.                                                                                                |
| `deepMerge`           | Deeply merges plain objects into a NEW object, left to right (later sources win).                                                                              |
| `isEqual`             | Deep structural equality.                                                                                                                                      |
| `deepFreeze`          | Recursively freezes an object and every object reachable through its own (string and symbol) data properties, as well as `Map` keys/values and `Set` members.  |

## guards

Runtime type predicates that narrow `unknown` values.

```ts
import { … } from '@emiliodominguez/js-helpers/guards';
```

| Export            | Description                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isObject`        | Checks whether a value is a non-null object (`typeof value === 'object'`).                                                                                                 |
| `isArray`         | Checks whether a value is an array (works across realms, uses `Array.isArray`).                                                                                            |
| `isFunction`      | Checks whether a value is callable (functions, arrow functions, classes, async and generator functions).                                                                   |
| `isString`        | Checks whether a value is a primitive string (boxed `String` objects are not strings here).                                                                                |
| `isNumber`        | Checks whether a value is a primitive number.                                                                                                                              |
| `isBoolean`       | Checks whether a value is a primitive boolean.                                                                                                                             |
| `isUndefined`     | Checks whether a value is `undefined`.                                                                                                                                     |
| `isNull`          | Checks whether a value is `null`.                                                                                                                                          |
| `isSymbol`        | Checks whether a value is a symbol.                                                                                                                                        |
| `isBigInt`        | Checks whether a value is a bigint.                                                                                                                                        |
| `isPromise`       | Checks whether a value is promise-like: a native `Promise` OR any thenable (an object or function with a callable `then` property), which is what `await` accepts.         |
| `isRegExp`        | Checks whether a value is a `RegExp`.                                                                                                                                      |
| `isError`         | Checks whether a value is an `Error` (including subclasses such as `TypeError`).                                                                                           |
| `isDate`          | Checks whether a value is a `Date` instance.                                                                                                                               |
| `isMap`           | Checks whether a value is a `Map` (cross-realm maps are recognised via a tag + brand check).                                                                               |
| `isSet`           | Checks whether a value is a `Set` (cross-realm sets are recognised via a tag + brand check).                                                                               |
| `isWeakMap`       | Checks whether a value is a `WeakMap` (cross-realm weak maps are recognised via a tag + brand check).                                                                      |
| `isWeakSet`       | Checks whether a value is a `WeakSet` (cross-realm weak sets are recognised via a tag + brand check).                                                                      |
| `isNil`           | Checks whether a value is `null` or `undefined`.                                                                                                                           |
| `isDefined`       | Checks whether a value is neither `null` nor `undefined`, narrowing `T` to `NonNullable<T>`.                                                                               |
| `isPlainObject`   | Checks whether a value is a plain object: an object whose prototype is exactly `Object.prototype` or `null` (object literals, `Object.create(null)`, `JSON.parse` output). |
| `isPrimitive`     | Checks whether a value is a primitive (`string`, `number`, `bigint`, `boolean`, `symbol`, `null` or `undefined`).                                                          |
| `isIterable`      | Checks whether a value implements the iterable protocol (`value[Symbol.iterator]` is a function).                                                                          |
| `isAsyncIterable` | Checks whether a value implements the async iterable protocol (`value[Symbol.asyncIterator]` is a function).                                                               |
| `isFiniteNumber`  | Checks whether a value is a finite number (excludes `NaN` and `±Infinity`).                                                                                                |
| `isInteger`       | Checks whether a value is an integer number (finite, no fractional part).                                                                                                  |

## strings

Unicode-aware transformations, case conversion, escaping and templating.

```ts
import { … } from '@emiliodominguez/js-helpers/strings';
```

| Export                | Description                                                                                                                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reverse`             | Reverses a string by user-perceived characters (grapheme clusters), so emoji, surrogate pairs and combining marks are kept intact.                                                                                                                                                                       |
| `capitalize`          | Upper-cases the first user-perceived character (grapheme cluster) of a string and leaves the rest untouched.                                                                                                                                                                                             |
| `uncapitalize`        | Lower-cases the first user-perceived character (grapheme cluster) of a string and leaves the rest untouched.                                                                                                                                                                                             |
| `substring`           | Extracts a substring from a string based on start and end indices (UTF-16 code units, like `String.prototype.substring`).                                                                                                                                                                                |
| `includes`            | Checks if a string contains a specified substring (case-sensitive).                                                                                                                                                                                                                                      |
| `replace`             | Replaces all occurrences of a substring with a replacement string.                                                                                                                                                                                                                                       |
| `truncate`            | Truncates a string to `length` user-perceived characters (grapheme clusters) and appends a suffix when it was longer.                                                                                                                                                                                    |
| `repeat`              | Repeats a string a specified number of times (wraps `String.prototype.repeat`).                                                                                                                                                                                                                          |
| `trim`                | Removes whitespace (and line terminators) from both ends of a string.                                                                                                                                                                                                                                    |
| `toTitleCase`         | Converts a string to title case: in every whitespace-separated word the first letter is upper-cased and everything else is lower-cased.                                                                                                                                                                  |
| `toSnakeCase`         | Converts a string to snake_case.                                                                                                                                                                                                                                                                         |
| `toKebabCase`         | Converts a string to kebab-case, using the same word detection as `toSnakeCase`.                                                                                                                                                                                                                         |
| `toConstantCase`      | Converts a string to CONSTANT_CASE (SCREAMING_SNAKE_CASE), using the same word detection as `toSnakeCase`.                                                                                                                                                                                               |
| `toCamelCase`         | Converts a string to camelCase, using the same word detection as `toSnakeCase`.                                                                                                                                                                                                                          |
| `toPascalCase`        | Converts a string to PascalCase, using the same word detection as `toSnakeCase`.                                                                                                                                                                                                                         |
| `removeDiacritics`    | Removes diacritical marks (accents, umlauts, cedillas...) from a string: it is decomposed (NFD), the combining diacritical marks are stripped and the result is recomposed (NFC).                                                                                                                        |
| `toSlug`              | Converts a string to a URL-friendly slug: compatibility-decomposed (NFKD), diacritics removed, a few common Latin letters transliterated (`ß` → `ss`, `æ` → `ae`, `ø` → `o`...), lower-cased, every run of characters outside `[a-z0-9]` replaced by a single `-`, and leading/trailing hyphens removed. |
| `toBoolean`           | Converts a string to a boolean, which is handy for environment variables and query parameters.                                                                                                                                                                                                           |
| `toNumber`            | Converts a string to a number with `Number()` semantics, except that blank strings (empty or whitespace only) give `NaN` instead of `0`.                                                                                                                                                                 |
| `startsWith`          | Checks if a string starts with a given substring (case-sensitive).                                                                                                                                                                                                                                       |
| `endsWith`            | Checks if a string ends with a given substring (case-sensitive).                                                                                                                                                                                                                                         |
| `countSubString`      | Counts the non-overlapping, literal occurrences of a substring, scanning left to right (`countSubString('aaaa', 'aa')` is `2`).                                                                                                                                                                          |
| `isEmpty`             | Checks if a string is empty or contains only whitespace characters.                                                                                                                                                                                                                                      |
| `getWords`            | Extracts the words of a string.                                                                                                                                                                                                                                                                          |
| `isPalindrome`        | Checks if a string reads the same backwards (grapheme-aware, see `reverse`).                                                                                                                                                                                                                             |
| `escapeRegExp`        | Escapes every character that has a special meaning in a regular expression (`. * + ? ^ $ { } ( ) \| [ ] \`), so the result matches the input literally.                                                                                                                                                  |
| `escapeHtml`          | Escapes the HTML-significant characters `&`, `<`, `>`, `"` and `'` so the string can be safely embedded in HTML text or quoted attributes.                                                                                                                                                               |
| `unescapeHtml`        | Reverses `escapeHtml`: decodes `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&#x27;`, `&apos;` and `&amp;`.                                                                                                                                                                                                        |
| `normalizeWhitespace` | Trims a string and collapses every run of whitespace (spaces, tabs, line breaks, non-breaking spaces...) into a single space.                                                                                                                                                                            |
| `interpolate`         | Replaces `{key}` and `{nested.key}` placeholders (whitespace inside the braces is ignored) with values from an object.                                                                                                                                                                                   |

## math

Precise arithmetic, statistics, number theory and random numbers.

```ts
import { … } from '@emiliodominguez/js-helpers/math';
```

| Export              | Description                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sum`               | Calculates the sum of an array of numbers using Neumaier (improved Kahan–Babuška) compensated summation, which keeps the rounding error independent of the number of elements and makes the result (practically) independent of their order.          |
| `round`             | Rounds a number to a given number of decimal places, using its decimal representation so that values like `1.005` round as written (`round(1.005, 2) === 1.01`).                                                                                      |
| `average`           | Calculates the arithmetic mean of an array of numbers (using the compensated `sum`).                                                                                                                                                                  |
| `factorial`         | Calculates the factorial of a non-negative integer, iteratively.                                                                                                                                                                                      |
| `max`               | Finds the maximum value in an array of numbers, with the same semantics as `Math.max` (`-Infinity` for an empty array, `NaN` if any element is `NaN`, `0` preferred over `-0`), but without spreading the array, so it works on arrays of any length. |
| `min`               | Finds the minimum value in an array of numbers, with the same semantics as `Math.min` (`Infinity` for an empty array, `NaN` if any element is `NaN`, `-0` preferred over `0`), but without spreading the array, so it works on arrays of any length.  |
| `abs`               | Finds the absolute value of a number.                                                                                                                                                                                                                 |
| `sqrt`              | Finds the square root of a number.                                                                                                                                                                                                                    |
| `pow`               | Raises a base to an exponent.                                                                                                                                                                                                                         |
| `log`               | Returns the logarithm of a number in the given base.                                                                                                                                                                                                  |
| `ceil`              | Returns the smallest integer greater than or equal to a number.                                                                                                                                                                                       |
| `floor`             | Returns the largest integer less than or equal to a number.                                                                                                                                                                                           |
| `modulo`            | Mathematical (floored) modulo: the result always has the sign of the `divisor` (so for a positive divisor it lies in `[0, divisor)`), unlike the JavaScript `%` operator (see `remainder`).                                                           |
| `remainder`         | Truncated remainder, identical to the JavaScript `%` operator: the result has the sign of the `dividend`.                                                                                                                                             |
| `randomBetween`     | Generates a random floating-point number in the half-open range `[minimum, maximum)`.                                                                                                                                                                 |
| `randomIntBetween`  | Returns a random integer between `minimum` and `maximum`, both inclusive.                                                                                                                                                                             |
| `toRadians`         | Converts degrees to radians.                                                                                                                                                                                                                          |
| `toDegrees`         | Converts radians to degrees.                                                                                                                                                                                                                          |
| `clamp`             | Restricts a value to the inclusive range `[minimum, maximum]`.                                                                                                                                                                                        |
| `lerp`              | Linear interpolation between `start` and `end`.                                                                                                                                                                                                       |
| `inverseLerp`       | Inverse of `lerp`: the factor `t` for which `lerp(start, end, t) === value`.                                                                                                                                                                          |
| `mapRange`          | Linearly maps a value from the range `[inMin, inMax]` to `[outMin, outMax]` (not clamped).                                                                                                                                                            |
| `inRange`           | Checks whether a value lies in the half-open range `[start, end)`.                                                                                                                                                                                    |
| `product`           | Multiplies all numbers of an array together.                                                                                                                                                                                                          |
| `median`            | Finds the median of an array of numbers (the mean of the two middle values for even lengths).                                                                                                                                                         |
| `mode`              | Finds the most frequent value(s) of an array of numbers.                                                                                                                                                                                              |
| `variance`          | Computes the variance of an array of numbers using Welford's numerically stable online algorithm.                                                                                                                                                     |
| `standardDeviation` | Computes the standard deviation (square root of `variance`) of an array of numbers.                                                                                                                                                                   |
| `gcd`               | Greatest common divisor of two integers (Euclid's algorithm).                                                                                                                                                                                         |
| `lcm`               | Least common multiple of two integers.                                                                                                                                                                                                                |
| `isPrime`           | Checks whether a number is a prime, using 6k ± 1 trial division.                                                                                                                                                                                      |
| `isEven`            | Checks whether a number is an even integer.                                                                                                                                                                                                           |
| `isOdd`             | Checks whether a number is an odd integer.                                                                                                                                                                                                            |
| `percentage`        | Expresses `value` as a percentage of `total` (`value / total * 100`).                                                                                                                                                                                 |

## functions

Function composition, currying, memoization and rate limiting.

```ts
import { … } from '@emiliodominguez/js-helpers/functions';
```

| Export              | Description                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bind`              | Creates a function that always invokes `fn` with `thisArg` as `this`, regardless of how it is called.                                                                                            |
| `partial`           | Creates a function that invokes `fn` with `args` prepended to the arguments it receives.                                                                                                         |
| `curry`             | Curries `fn`: the returned function collects arguments (one or several at a time) until `arity` of them have been supplied, then invokes `fn` with all of them and the `this` of the final call. |
| `compose`           | Composes functions from right to left: `compose(f, g, h)(...args)` is `f(g(h(...args)))`.                                                                                                        |
| `pipe`              | Composes functions from left to right: `pipe(f, g, h)(...args)` is `h(g(f(...args)))`.                                                                                                           |
| `defaultMemoizeKey` | The default cache-key resolver used by `memoize` (and the `memoize` decorator).                                                                                                                  |
| `memoize`           | Creates a function that caches the results of `fn` by key (see `defaultMemoizeKey`).                                                                                                             |
| `throttle`          | Creates a throttled function that invokes `fn` at most once per `wait` milliseconds.                                                                                                             |
| `debounce`          | Creates a debounced function that delays invoking `fn` until `wait` milliseconds have elapsed since the last call.                                                                               |
| `once`              | Creates a function that invokes `fn` only on its first call and returns that first result on every later call.                                                                                   |
| `before`            | Creates a function that invokes `fn` only while it has been called fewer than `n` times; later calls return the last result.                                                                     |
| `after`             | Creates a function that invokes `fn` only once it has been called at least `n` times (from the `n`-th call on); earlier calls return `undefined`.                                                |
| `negate`            | Creates a predicate that returns the boolean negation of `predicate`.                                                                                                                            |
| `identity`          | Returns its argument unchanged.                                                                                                                                                                  |
| `noop`              | Does nothing and returns `undefined`, whatever the arguments.                                                                                                                                    |

## async

Promise utilities: sleeping, timeouts, retries and bounded concurrency.

```ts
import { … } from '@emiliodominguez/js-helpers/async';
```

| Export                   | Description                                                                                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AbortError` _(class)_   | Error used to reject operations cancelled through an abort signal that carries no `reason`.                                                                                                                             |
| `TimeoutError` _(class)_ | Error used by `withTimeout` when the wrapped promise does not settle in time.                                                                                                                                           |
| `createDeferred`         | Creates a promise that can be resolved or rejected from the outside.                                                                                                                                                    |
| `sleep`                  | Resolves after `ms` milliseconds.                                                                                                                                                                                       |
| `withTimeout`            | Races `promise` against a timer: resolves/rejects like `promise` if it settles within `ms` milliseconds, otherwise rejects with a `TimeoutError`.                                                                       |
| `retry`                  | Calls `fn` until it succeeds, retrying up to `options.retries` times with exponential backoff: the delay before retry `k` (1-based) is `min(delay * factor^(k - 1), maxDelay)`, optionally randomised with full jitter. |
| `mapWithConcurrency`     | Maps `items` with an async `mapper`, running at most `concurrency` mappers at the same time, and resolves with the results in input order.                                                                              |

## date

DST-safe, non-mutating local-time date arithmetic, formatting and parsing.

```ts
import { … } from '@emiliodominguez/js-helpers/date';
```

| Export            | Description                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isValidDate`     | Checks whether a value is a `Date` instance holding a valid time (i.e. not `new Date(NaN)`).                                                                                                                                                                                                                                                                             |
| `addDays`         | Adds a number of calendar days (local time).                                                                                                                                                                                                                                                                                                                             |
| `addWeeks`        | Adds a number of weeks (7 calendar days each, local time).                                                                                                                                                                                                                                                                                                               |
| `addMonths`       | Adds a number of calendar months (local time).                                                                                                                                                                                                                                                                                                                           |
| `addYears`        | Adds a number of calendar years (local time).                                                                                                                                                                                                                                                                                                                            |
| `addHours`        | Adds an absolute number of hours (3 600 000 ms each); unlike `addDays`, this is not wall-clock based.                                                                                                                                                                                                                                                                    |
| `addMinutes`      | Adds an absolute number of minutes.                                                                                                                                                                                                                                                                                                                                      |
| `addSeconds`      | Adds an absolute number of seconds.                                                                                                                                                                                                                                                                                                                                      |
| `addMilliseconds` | Adds an absolute number of milliseconds.                                                                                                                                                                                                                                                                                                                                 |
| `diffInDays`      | Returns the signed number of calendar days between two dates (local time), ignoring the time of day: `diffInDays(Jan 2 00:01, Jan 1 23:59) === 1`.                                                                                                                                                                                                                       |
| `diffInHours`     | Returns the signed number of whole hours between two dates, truncated toward zero (absolute time).                                                                                                                                                                                                                                                                       |
| `diffInMinutes`   | Returns the signed number of whole minutes between two dates, truncated toward zero (absolute time).                                                                                                                                                                                                                                                                     |
| `diffInSeconds`   | Returns the signed number of whole seconds between two dates, truncated toward zero (absolute time).                                                                                                                                                                                                                                                                     |
| `diffInMonths`    | Returns the signed number of COMPLETE calendar months between two dates (date-fns `differenceInMonths` semantics): for `later >= earlier` it is the largest `n` such that `addMonths(earlier, n) <= later` (time of day included, with end-of-month clamping, so Jan 31 → Feb 28 counts as one full month); for `later < earlier` it is `-diffInMonths(earlier, later)`. |
| `startOfDay`      | Returns the start of the local day (00:00:00.000).                                                                                                                                                                                                                                                                                                                       |
| `endOfDay`        | Returns the last millisecond of the local day (23:59:59.999).                                                                                                                                                                                                                                                                                                            |
| `startOfMonth`    | Returns the first day of the local month at 00:00:00.000.                                                                                                                                                                                                                                                                                                                |
| `endOfMonth`      | Returns the last day of the local month at 23:59:59.999.                                                                                                                                                                                                                                                                                                                 |
| `startOfWeek`     | Returns the start (00:00:00.000, local) of the week containing `date`.                                                                                                                                                                                                                                                                                                   |
| `endOfWeek`       | Returns the end (23:59:59.999, local) of the week containing `date`.                                                                                                                                                                                                                                                                                                     |
| `startOfYear`     | Returns January 1st of the local year at 00:00:00.000.                                                                                                                                                                                                                                                                                                                   |
| `endOfYear`       | Returns December 31st of the local year at 23:59:59.999.                                                                                                                                                                                                                                                                                                                 |
| `isSameDay`       | Checks whether two dates fall on the same local calendar day.                                                                                                                                                                                                                                                                                                            |
| `isSameMonth`     | Checks whether two dates fall in the same local calendar month (of the same year).                                                                                                                                                                                                                                                                                       |
| `isSameYear`      | Checks whether two dates fall in the same local calendar year.                                                                                                                                                                                                                                                                                                           |
| `isLeapYear`      | Checks whether a year (or the local year of a date) is a Gregorian leap year.                                                                                                                                                                                                                                                                                            |
| `daysInMonth`     | Returns the number of days in a month.                                                                                                                                                                                                                                                                                                                                   |
| `getDaysInMonth`  | Returns the number of days in the local month of a date.                                                                                                                                                                                                                                                                                                                 |
| `isWeekend`       | Checks whether a date falls on a Saturday or a Sunday (local time).                                                                                                                                                                                                                                                                                                      |
| `isBefore`        | Checks whether `a` is strictly before `b`.                                                                                                                                                                                                                                                                                                                               |
| `isAfter`         | Checks whether `a` is strictly after `b`.                                                                                                                                                                                                                                                                                                                                |
| `isBetween`       | Checks whether a date lies within a range.                                                                                                                                                                                                                                                                                                                               |
| `compareAsc`      | Ascending comparator, usable with `Array#sort`.                                                                                                                                                                                                                                                                                                                          |
| `compareDesc`     | Descending comparator, usable with `Array#sort`.                                                                                                                                                                                                                                                                                                                         |
| `minDate`         | Returns a copy of the earliest date.                                                                                                                                                                                                                                                                                                                                     |
| `maxDate`         | Returns a copy of the latest date.                                                                                                                                                                                                                                                                                                                                       |
| `formatDate`      | Formats a date (local time) with a token pattern.                                                                                                                                                                                                                                                                                                                        |
| `toISODateString` | Returns the LOCAL calendar date as `'YYYY-MM-DD'`.                                                                                                                                                                                                                                                                                                                       |
| `parseISODate`    | Parses a strict `'YYYY-MM-DD'` string into a date at LOCAL midnight (unlike `new Date('YYYY-MM-DD')`, which is UTC).                                                                                                                                                                                                                                                     |
| `getRelativeTime` | Describes `date` relative to `baseDate` in words, e.g. `'in 3 days'`, `'2 hours ago'`, `'yesterday'`, `'now'`, using `Intl.RelativeTimeFormat` with `numeric: 'auto'`.                                                                                                                                                                                                   |

## decorators

Class decorators for TypeScript (legacy and TC39 standard) and Babel.

```ts
import { … } from '@emiliodominguez/js-helpers/decorators';
```

| Export       | Description                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `readonly`   | Makes a class field write-once: the value assigned by the field initializer (or the first assignment) is kept, and the instance gets an enumerable, non-writable, non-configurable own property. |
| `log`        | Logs every call of the decorated method with `console.log`: `"<name> method called with arguments:" args`, then `"<name> method returned:" result`.                                              |
| `memoize`    | Caches the results of the decorated method, separately for every instance (instances never see each other's results, and caches are garbage-collected with their instance).                      |
| `bound`      | Auto-binds the decorated method to its instance, so it can be passed around as a callback (`button.onclick = obj.method`).                                                                       |
| `debounced`  | Creates a method decorator that debounces the method with `debounce`, with separate timers for every instance.                                                                                   |
| `throttled`  | Creates a method decorator that throttles the method with `throttle`, with separate windows for every instance.                                                                                  |
| `deprecated` | Creates a method decorator that emits a deprecation warning with `console.warn` the first time the method is called (once per decorated method, not once per call or per instance).              |
