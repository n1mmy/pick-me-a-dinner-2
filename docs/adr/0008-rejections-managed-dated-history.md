# Rejections become managed dated history; the AI snapshot includes the future

_Amended by ADR-0009: Tonight's anchor is the Selected day, so a live Reject
dates to that day and suppression keys on it. Amended by ADR-0010: a weekly
closure is a Closed day on the Restaurant, not a recurring Rejection._

ADR-0006 introduced **Rejections** as a live, Tonight-only action: a member of
the Household turns an Option down in the moment, `rejected_on` is forced to
today, and managing the historical Rejection log was left as the next feature.
ADR-0005 built the AI search snapshot as plain dated *history*: the non-future
Log only.

We are now building that next feature. From the **Log** screen — and, per
ADR-0007, the **Option detail page** — the Household can create, edit, and
delete a Rejection for any **deliberately chosen date**: a past date backfills a
night that was never recorded live; a future date is a **Planned rejection**, a
pre-emptive "skip this Option that night" (e.g. "Aji Ichi is closed this coming
Sunday"). The Log screen interleaves Rejections into its per-date groups, so
each date shows what the Household ate *and* what they turned down.

Three choices are load-bearing:

- A Rejection's date is freely chosen — past, today, or future — rather than
  always today.
- **Suppression stays purely date-driven.** A Rejection removes its Option from
  Tonight only on the day its `rejected_on` equals the day being ranked,
  regardless of where or when the row was created. A Planned rejection
  therefore "activates" on its own date with no special handling, and a
  backfilled past Rejection never suppresses anything.
- **The AI snapshot is fed the whole picture** — every Rejection and every Log
  entry, future-dated ones included — and the model reads the dates itself,
  rather than the app pre-digesting the future into a separate signal.

## Considered options

- **Recurring Planned rejections.** A Planned rejection could repeat ("every
  Sunday"). Rejected: recurrence is real machinery — repeat rules, series
  editing, end conditions — and the app is deliberately lean. A one-off
  Planned rejection covers one known date; the recurring case that motivated
  the idea, a weekly closure, is a **Closed day** on the Restaurant
  (ADR-0010).
- **A separate "Rejections" list on the Log, parallel to the Log entries.**
  Rejected in favour of interleaving by date — the Household wants the night's
  full story (what was ordered, what was considered) in one place, and a
  separate list would not give a date its complete record.
- **Excluding future-dated rows from the AI snapshot** (snapshot stays strictly
  past history). Rejected: a planned dinner and a Planned rejection are both
  genuine signal the model should see when ranking tonight. Feeding them in,
  each carrying its real date, lets the model tell plan from history itself.
- **A third snapshot group for Planned rejections.** Rejected as needless
  structure: a future-dated Rejection already falls into the existing
  not-anchor-day group, and the model reads its date. The group is labelled
  date-neutral instead.

## Consequences

- A `UNIQUE(option_id, rejected_on)` constraint enters the schema, with its own
  out-of-band migration; a duplicate add or edit is reported inline, mirroring
  the Log entry's `(option_id, eaten_on)` collision. ADR-0006 needed no such
  constraint because a rejected Option left the picker and could not be
  re-rejected the same day; manual entry invalidates that.
- The AI snapshot's Rejections block keeps two groups — anchor day (Options
  dropped from the candidate set) and all others (still candidates) — and the
  second group now also carries future-dated rows. The snapshot's Log now
  includes future entries too. This **extends ADR-0005**: the snapshot is no
  longer strictly past history — it carries the Household's near-future plans,
  and the model, given the anchor date, distinguishes plan from history.
- The deterministic ranking (ADR-0003) is untouched and still excludes Log
  rows after the day being ranked — only the AI snapshot sees the future.
  Suppression remains a presentation filter and never changes a Score
  (ADR-0006 holds).
- "Bring back" on Tonight's Rejected disclosure is a quick-undo for the day
  being ranked. Full edit and delete of *any* Rejection — past, today, or
  future — lives on the Log screen and the Option detail page.
