# functions — equivalent mutants

- 52: `typeof fns[i] !== 'function'` → `true` — `assertFunction` repeats the check. The guard only avoids formatting the `fns[i]` name for valid elements.
- 52: `'function'` → `""` — same as above.
- 78: `args.length === 1 ? fn.call(...)` → `false ? …` — `forward` falls back to `fn.apply`, which makes the same call. The `call` form is only there because V8 optimises it better.
- 78: `args.length === 2 ? …` → `false ? …` — same as above.
- 198: `collected.length === 0 ? args : append(...)` → `false ? …` — with nothing collected yet, `append([], args)` is a copy of the fresh rest array, so the result is the same; the shortcut only saves the copy.
- 413: `i < args.length` → `i <= args.length` — the extra `undefined` argument sends `memoizeKey` to the general `JSON.stringify` serialiser, which (by design) produces the same key as the hand-written fast path.
- 413: `i++` → `i--` — `args[-1]` is `undefined`, so the general serialiser runs: same key.
- 417: `typeof value === 'string'` → `false` — strings go to the general serialiser: same key.
- 417: `'string'` → `""` — same as above.
- 418: `Number.isFinite(value) && !Object.is(value, -0)` → `false` — numbers go to the general serialiser: same key.
- 476: `resolver === defaultMemoizeKey` → `false` — the default resolver is called through `resolver.call` / `apply` instead of inline: same key.
- 490: `arguments.length === 1` → `false` — a one-argument call is copied into an array and keyed through `memoizeKey([first])`, which takes the same direct-key shortcut: same key and call.
- 495: `if (!single)` → `if (true)` — also copies the arguments for a single argument; that copy is never read.
- 501: `single && isDirectKey(first)` → `false` — `memoizeKey([first])` takes the same direct-key shortcut itself.
- 1109: `new Array<R>(n)` → `new Array()` — preallocation only (speed); every slot is assigned before the array is returned.
- 1191: `i < next.length` → `i <= next.length` — the lengths are equal, so the extra step compares `undefined` with `undefined`.

(The `let args: unknown[] = []` → `["Stryker was here"]` survivor is gone: the initial array was never read, since a single-argument call never uses `args`. It was replaced by a definite-assignment declaration, which also saves an allocation per call.)
