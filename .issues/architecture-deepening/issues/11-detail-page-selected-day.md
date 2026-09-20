# 11 — A Reject from the Option detail page always records today

Status: needs-triage
Type: AFK

Split out of [07](./07-action-envelope.md), which found it but deliberately
left the behaviour alone: the fix needs a product decision, not a refactor.

## The defect

`app/catalog/[id]/option-controls.tsx:69` calls
`rejectOption(option.id, reason)` with no day. `rejectOption` falls back to
`today()`, so a **Rejection** taken on an Option detail page is always dated
today — even when the Household reached that page from Friday's **Tonight**,
in the middle of planning Friday. The Option stays on Friday's list and
disappears from tonight's instead.

The same gap applies to the detail page's **Pick** control if it shares the
fallback; confirm before fixing.

## Why it is not a one-line fix

The detail page has no notion of the **Selected day**. Threading it through
means:

- adding `?day=` to the detail-page links in `app/tonight-row.tsx:145`,
  `app/tonights-dinner-block.tsx:144`, and `app/log/log-entry-row.tsx:103`
  (the Log link would need a day of its own, or none);
- deciding what the detail page *shows* for a non-today day — its ranking
  block and recency are computed against `today()` at
  `app/catalog/[id]/page.tsx:62-71`, and ADR-0009 deliberately scoped the
  Selected day to the Tonight screen;
- deciding whether the detail page's controls should say which day they act
  on, per ADR-0007's "expose every sensible control".

## Options

1. **Thread the Selected day through** — the detail page becomes day-aware like
   Tonight. Most consistent with ADR-0009; the largest change.
2. **Label, don't thread** — leave the write dated today, but have the detail
   page's Reject and Pick controls say "today" explicitly so the Household is
   never surprised. Cheapest; keeps ADR-0009's scope.
3. **Leave it** — accept that detail-page writes are today-dated and record
   that in `CONTEXT.md` under **Selected day**.

Needs a call before it is ready for an agent.
