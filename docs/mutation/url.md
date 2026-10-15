# url — equivalent mutants

318: `if (body.includes('//'))` → `if (true)` — fast path: replacing `//+` in a body without `//` is a no-op; the guard makes joinUrl ~20% faster (A/B 274 ns vs 334 ns), so it stays.
318: `body.includes('//')` → `body.includes("")` — same guard (always true): same output, slower.
