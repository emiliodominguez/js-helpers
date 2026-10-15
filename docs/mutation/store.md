# store — equivalent mutants

- 110: `if (notifying) subscriptions = subscriptions.slice()` → `if (true)` — always copying on subscribe (instead of only during a notification round) is the same snapshot semantics; copy-on-write only for speed.
- 117: same in the unsubscribe function — same reason.
- 196: `version++` → `version--` — `version` is only ever compared with `!==` to `notifiedVersion`, so either direction marks a change.

(The `let pending = false` → `true` survivor is gone: the initializer was dead, since `notify` sets `pending` before every read, and it was removed.)
