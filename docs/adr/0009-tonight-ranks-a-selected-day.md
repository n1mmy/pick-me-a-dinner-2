# Tonight ranks a Selected day, not only today

ADR-0003 anchored the Tonight ranking on `today`, with future Log entries
(Planned dinners) excluded so planning Friday could not make Friday's dish
look recently eaten today. ADR-0005 built the AI search snapshot to include
the household's near future (Planned dinners and Planned rejections) but
anchored the model on today. ADR-0007 ("expose every sensible control")
established that every place an item is shown carries every control that
makes sense for it.

We are now generalising Tonight to rank for a **Selected day** that defaults
to today and can be stepped forward to any future date. The entire screen —
the deterministic ranked list, AI search, the decided **Dinner** block, and
the live Reject control with its "Bring back" disclosure — re-points to the
Selected day. The navigation entry and the default H1 stay "Tonight" because
today is the dominant case; the H1 shows the day's name when the Selected
day is anything else. Picking on Selected day = D creates a Log entry dated
D — today's Pick is **Tonight's dinner**, a future Pick is a **Planned
dinner**. The deterministic Score uses every Log entry dated ≤ D, so Planned
dinners between today and D shape D's ranking (a week of planning will not
repeat itself); the recency cap and tie-break behaviour are unchanged. The
Selected day lives in the URL (`?day=YYYY-MM-DD`) so refresh, link-sharing,
and back/forward navigation preserve it.

Three choices are load-bearing:

- **One screen with a date stepper, not a second screen.** The Tonight
  ranking, AI search, decided block, and live Reject are one set of code
  with one anchor parameter — a second screen would duplicate all four.
- **Future + today only; past dates are not selectable.** The Selected day
  is a "what should we eat" anchor, not a history-editing one. Backfilling
  a forgotten dinner stays a Log job, where dated history already gets full
  edit and delete. The stepper's `min` is today, with no maximum.
- **The deterministic ranking for day D uses every Log entry dated ≤ D.**
  This generalises ADR-0003's "today" anchor: the "excluded as future"
  filter becomes "excluded as after the anchor day," so Planned dinners
  between today and D count toward recency for D.

## Considered options

- **A separate "Plan a future dinner" screen.** Rejected: it would duplicate
  the ranking, AI search, decided block, and Reject control. The
  interaction principle (ADR-0007) favours putting controls where the item
  is shown rather than enforcing journeys; here it favours one screen that
  takes any anchor over two screens that each take one.
- **Renaming the screen away from "Tonight."** Rejected: today is the
  dominant Selected day, and renaming the nav entry pessimises the common
  case for the uncommon one. The H1 shifting to the day's name when the
  Selected day is not today is enough.
- **Allowing past dates as the Selected day.** Rejected: the ranking has no
  useful meaning anchored to the past — you cannot Pick a dinner you have
  already eaten or skipped — and backfilling already lives on the Log,
  which manages dated history with full edit/delete and is the right home.
- **Filtering Log entries dated after the Selected day from the AI
  snapshot.** Rejected: ADR-0005's principle ("only this AI snapshot sees
  the future") holds — the snapshot just rotates its anchor. When picking
  Friday with Sunday's pizza already planned, the model should know;
  filtering > Selected day from the snapshot would weaken AI search the
  moment the household has any commitments beyond it.
- **Storing the Selected day in component or session state rather than the
  URL.** Rejected: a URL query parameter makes refresh, link-sharing, and
  back/forward work for free, and the Tonight route already runs through a
  server component that can read search params at the page boundary.

## Consequences

- The Tonight page reads `?day=YYYY-MM-DD` from the URL (defaulting to today
  when missing or invalid), passes it through every Tonight-side query and
  action that currently takes today, and shifts the H1 when it is not
  today. The decided block becomes day-aware copy ("Friday's dinner") and
  surfaces the Planned dinners for the Selected day; the "Rejected tonight"
  disclosure becomes day-aware ("Rejected for [day]") and "Bring back"
  undoes the Selected-day Rejection.
- The ranking engine in `lib/ranking.ts` is already date-pure —
  `rankTonight(options, entries, today)` is `rankTonight(options, entries,
  asOf)` in effect, and `lastEaten` / `lastTagUse` already filter `entry
  .eatenOn > today`. Only the parameter name and its doc comments are
  honesty work; no math changes. ADR-0003 is amended in spirit, not in
  math.
- The AI snapshot in `lib/ai-search.ts` rotates with the Selected day: its
  `today` field carries the Selected day so the model knows the target
  day-of-week, the candidate-drop rule keys on Selected-day Rejections, and
  the snapshot's Log and Rejections continue to carry the full dated
  history including rows after the Selected day. ADR-0005 holds.
- Rejections gain a third creation context: a live Reject on Tonight with a
  future Selected day dates the Rejection to that future day — previously
  reachable only by hand on the Log or the Option detail page. Suppression
  remains purely date-driven (ADR-0008), so the new path lights up no new
  behaviour beyond what already existed for Planned rejections.
- No schema change. `dinner_log.eaten_on` and `rejections.rejected_on` were
  always dated columns; the work is at the page, action, and snapshot
  layers.
