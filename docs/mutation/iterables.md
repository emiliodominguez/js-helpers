# iterables — equivalent mutants

- 66: `iterable[Symbol.iterator] === ARRAY_ITERATOR` → `false` — fast path: an array is then wrapped by `awaitedItems`, which yields the same awaited items (the built-in array iterator has no `return` to call, so closing behaviour is identical); only skips a generator layer.
- 570: `new Array<unknown>(iterators.length)` → `new Array()` — preallocation only: every slot is assigned before the tuple is yielded (an incomplete tuple is discarded).
- 776: `Array.isArray(iterable)` → `true` — spread copies any iterable exactly like the `for...of` loop (holes read as `undefined` either way); the check only picks the faster copy.
- 776: `Array.isArray(iterable)` → `false` — the `for...of` loop copies arrays exactly like spread; fast path only.
