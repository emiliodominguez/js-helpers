# date — equivalent mutants

## Equivalent only in the UTC sandbox (killed in a DST zone)

Stryker runs in the container's time zone (UTC), where no hour repeats. A targeted run with `TZ=America/New_York` on lines 465, 506 and 1228 killed all 16 mutants (score 100%), so these are pinned by the existing DST tests in `date.spec.ts` ("DST transitions (assertions hold in every time zone)"):

- 465: `if (amount === 0) return result` → `false` (`addDays`) — killed under New York: re-setting the date moves an instant in the repeated fall-back hour to its first occurrence.
- 506: same in `addMonths` — killed under New York.
- 1228: `|| days === 0` → `|| false` (`getRelativeTime`) — killed under New York (a 24h+ delta inside the 25-hour fall-back day).

## Genuinely equivalent

- 1106: `value === undefined` → `true` (`cached`) — recomputes on every call (cache off); `create` is pure, so the result is the same.
- 1108: `cache.size >= MAX_CACHE_ENTRIES` → `false` — the cache is never cleared: unbounded memory, but the same results.
- 1108: `>= MAX` → `true` — clears on every insert; the results are still the same.
- 1108: `>=` → `>` — the bound moves by one entry.
- 1108: `>=` → `<` — clears while the cache is small; same results.
- 1108: `cache.clear()` → removed — same as `false` above.
- 1109: `cache.set(key, value)` → removed — nothing is cached; same results.
- 1409: `sign > 0` → `sign >= 0` (`addBusinessDays`) — `sign` is ±1: `amount === 0` returned earlier.
- 1411: same as 1409.
- 1574: `ms < 0` → `ms <= 0` (`formatDuration`) — `ms = ±0` gives no parts and returned earlier.

(The `localMidnight` survivor `setHours(12, …)` → `setMinutes(12, …)` is gone: the intermediate noon is now built directly as `new Date(2000, 0, 1, 12)`, which is 2 bytes smaller with no measurable speed change.)
