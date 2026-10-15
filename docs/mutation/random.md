# random — equivalent mutants

- 406: `accepted < count` → `true` — the extra iterations only write past the end of the `Uint8Array` (ignored), and the batch of random bytes has already been drawn, so the same random stream is used.
- 406: `accepted < count` → `<=` — same as above.
- 415: `typeof Decoder === 'function'` → `false` — turns off the TextDecoder ASCII fast path; the string-concatenation path builds the same id.
- 415: `'function'` → `""` — same as above (`ascii` starts as false).
- 421: `ascii = code < 128` → `false` — same as above.
- 423: `if (ascii)` → `if (false)` — same as above.
- 423: fast-path block emptied — same as above.
- 424: `Decoder !== decoderClass` → `true` — recreates the cached TextDecoder on every call; same output.
- 429: `i < count` → `i <= count` — the extra write lands past the end of the `Uint8Array` and is ignored.
- 451: `alphabet === cachedAlphabet` → `false` — turns off the last-alphabet cache; the alphabet is split and validated again with the same result.
- 500: `i < lastPositive` → `i <= lastPositive` — if the loop does not return at `lastPositive`, the code after it returns `items[lastPositive]` anyway.
