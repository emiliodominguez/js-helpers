# validate — equivalent mutants

593: `if (digit > 9)` → `if (digit >= 9)` — a doubled digit is even, so it is never exactly 9.
595: `sum += digit` → `sum -= digit` — only `sum % 10 === 0` is observed, and negating the sum preserves divisibility by 10.
