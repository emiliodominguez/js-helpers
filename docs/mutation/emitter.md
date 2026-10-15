# emitter — equivalent mutants

All 11 come from copy-on-write and bookkeeping that is only there for speed or memory, so no observable behaviour changes:

- 151: `listeners.emitting > 0` → `true` — always copying the list on `add`, instead of only during an emit, is the same snapshot semantics but slower.
- 151: `emitting > 0` → `>= 0` — same as above (emitting is never negative).
- 172: `listeners.emitting > 0 ? [] : list` → `true ? [] : list` — always filtering into a new array instead of in place; same result.
- 172: `> 0` → `>= 0` — same as above.
- 172: `[]` → `["Stryker was here"]` — slot 0 is overwritten by the first kept registration, or popped by the `kept.length > count` trim when none is kept.
- 182: `if (count === 0) registry.delete(event)` → `if (false)` — leaves an empty entry in the registry. That only costs memory; `listenerCount` and `emit` behave the same.
- 182: `registry.delete(event)` → removed — same as above.
- 276: `if (listeners !== undefined) listeners.emitting--` → `if (false)` — a counter left too high only makes later `add`/`remove` copy instead of mutating in place (copy-on-write fallback); same behaviour.
- 276: `emitting--` → `emitting++` — same as above.
- 277: same pair for the wildcard listeners (`if (false)`, `emitting++`) — same reason.
