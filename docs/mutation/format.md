# format — equivalent mutants

240: `createMemo()` → `{}` — an empty memo also matches nothing (`formatter` undefined); the full literal only keeps the memos' hidden class stable.
350: `if (language === undefined)` → `if (true)` — the per-formatter cache of `resolvedOptions().locale` is a pure speed cache (same value recomputed).
352: `resolvedLanguages.set(rules, language)` removed — same cache, never filled: same value recomputed every call.
416: `'number'` → `""` — cache-key prefix: keys of the other kinds start with a letter and a blank-kind key with a digit (a locale field), so a single blanked kind can never collide; it only stops sharing formatters with the other `'number'` call sites (different options anyway).
445: `'number'` → `""` — same reason (cache-key prefix of formatCurrency).
476: `'number'` → `""` — same reason (formatPercent).
498: `'number'` → `""` — same reason (formatCompact).
523: `'number'` → `""` — same reason (formatUnit).
553: `'list'` → `""` — same reason (formatList).
588: `'date'` → `""` — same reason (formatDateTime).
613: `'relative'` → `""` — same reason (formatRelativeTime).
644: `'plural'` → `""` — same reason (formatOrdinal).
670: `'plural'` → `""` — same reason (pluralRule).
