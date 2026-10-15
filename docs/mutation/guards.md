# guards — equivalent mutants

- 31 (×4, `isForeign`): `typeof value === 'object' && value !== null && …` with either check removed or `&&` → `||` — every caller then runs a brand check (or `getTag`) that throws (and is caught), or returns false, for primitives, `null` and functions of another realm. The pre-checks only avoid paying for an exception on the hot path.
- 697 (×4, `isArrayBuffer`): the same `typeof value === 'object' && value !== null` pre-checks (removed / `||`) — `arrayBufferByteLengthGetter.call` throws for any non-ArrayBuffer, which the `try` turns into `false`. The pre-checks only avoid an exception for primitives.
