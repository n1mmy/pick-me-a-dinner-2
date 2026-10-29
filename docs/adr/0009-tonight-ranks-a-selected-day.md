# Tonight ranks a Selected day, not only today

_Amended 2026-06-17 (any date is selectable, not only today and the future),
2026-09-08 (the day name resets to today) and 2026-09-22 (an AI search
survives a day change). All three are folded in below; git history has the
narrative._

ADR-0003 anchored the Tonight ranking on `today`, with future Log entries
(Planned dinners) excluded so planning Friday could not make Friday's dish
look recently eaten today. ADR-0008 put the Household's near future (Planned
dinners and Planned rejections) into the AI search snapshot but anchored the
model on today. ADR-0007 ("expose every sensible control") established that
every place an item is shown carries every control that makes sense for it.

We generalise Tonight to rank for a **Selected day** that defaults to today
and can be stepped to any date, past or future. The entire screen — the
deterministic ranked list, AI search, the decided **Dinner** block, and the
live Reject control with its "Bring back" disclosure — re-points to the
Selected day. The navigation entry and the default H1 stay "Tonight" because
today is the dominant case; the H1 shows the day's name when the Selected
day is anything else. Picking on Selected day D creates a Log entry dated D:
today's Pick is **Tonight's dinner**, a future Pick is a **Planned dinner**,
a past Pick backfills that night. The Selected day lives in the URL
(`?day=YYYY-MM-DD`) so refresh, link-sharing, and back/forward navigation
preserve it; a missing or malformed value falls back to today.

Five choices are load-bearing:

- **One screen with a date stepper, not a second screen.** The Tonight
  ranking, AI search, decided block, and live Reject are one set of code
  with one anchor parameter — a second screen would duplicate all four.
- **Any date is selectable.** The first version allowed today and the future
  only, reasoning that backfilling belongs on the Log. That contradicted
  ADR-0007 the moment the decided block showed a past night: a Pick's note,
  an accidental Pick to remove, and a forgotten dinner to backfill are all
  things the Household wants to do where the night's dinner is shown. The
  Selected day is a single anchor with no clamp: a Pick on a past day
  backfills a Log entry dated that day rather than silently mis-dating it to
  today. AI search stays available on a past day — pointless but harmless,
  and hiding it would be a special case against the single anchor.
- **The deterministic ranking for day D uses every Log entry dated ≤ D.**
  This generalises ADR-0003's "today" anchor: the "excluded as future"
  filter becomes "excluded as after the anchor day," so Planned dinners
  between today and D count toward recency for D (a week of planning will
  not repeat itself), and for a past D the ranking reads as it stood that
  night. The recency cap and tie-break behaviour are unchanged.
- **The day name is the reset to today.** Returning to today from a distant
  Selected day cost as many taps as reaching it, and the common case — a tab
  left open on a future date — had no one-gesture answer. We add no control:
  tapping the H1 returns the Selected day to today, always, including when it
  already reads "Tonight". A dedicated "Today" button was rejected because the
  phone header's width is already spent by the H1 and the stepper; reusing the
  H1 costs nothing. The affordance is invisible, which a
  discoverability-sensitive product could not accept; a single Household
  learns it once. The day name is nonetheless a real button inside the
  heading, visually unstyled: invisible to the eye is fine, invisible to the
  keyboard and to assistive tech is not. The reset **deletes `?day=`** rather
  than setting today's date: any today value a client control could read is
  baked in at render, so a tab left open past midnight would reset to the
  wrong day. Dropping the parameter lets the server resolve today fresh, and a
  bare `/` was already exactly the today case.
- **An AI search survives a Selected-day change.** The query, the result, the
  search error, any search still in flight, and the Search button's elapsed
  count and done badge all carry over, even when the day change switches
  Tonight between picker and decided mode. A search that lands after the day
  changed is shown. Only Cancel, Clear, or a newer search stops one landing.
  An earlier rule cleared the search on every day change so that Friday's
  rationales never sat under today's heading; in practice it threw away a
  50–90 s search, in-flight ones included, while the Household did other
  things. The result is resolved against the new day's picker rows, so an
  Option that is Picked, rejected, or closed on that day drops out. Two costs
  are accepted: the rationales can name the day the search ran under a
  different heading, and an Option that was not a candidate on the searched
  day is absent even from an open query's result, and so appears nowhere
  while the result hides the ranked list. Clearing and re-running covers
  both. The Tag and kind filters are day-agnostic and never clear.

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
- **Filtering Log entries dated after the Selected day from the AI
  snapshot.** Rejected: ADR-0008's principle ("only the AI snapshot sees
  the future") holds — the snapshot just rotates its anchor. When picking
  Friday with Sunday's pizza already planned, the model should know;
  filtering rows after the Selected day would weaken AI search the moment
  the Household has any commitments beyond it.
- **Storing the Selected day in component or session state rather than the
  URL.** Rejected: a URL query parameter makes refresh, link-sharing, and
  back/forward work for free, and the Tonight route already runs through a
  server component that can read search params at the page boundary.

## Consequences

- The Tonight page reads the Selected day from the URL, passes it through
  every Tonight-side query and action that once took today, and shifts the
  H1 when it is not today. The decided block uses day-aware copy ("Friday's
  dinner"); the "Rejected tonight" disclosure becomes "Rejected for [day]"
  and "Bring back" undoes the Selected-day Rejection.
- The ranking engine was already date-pure: its anchor parameter was only
  ever called `today`. No math changes. ADR-0003 is amended in spirit, not in
  math.
- The AI snapshot rotates with the Selected day: its `today` field carries
  the Selected day so the model knows the target day-of-week, the
  candidate-drop rule keys on Selected-day Rejections, and the snapshot's Log
  and Rejections carry the full dated history including rows after the
  Selected day. ADR-0008 holds.
- Rejections gain a third creation context: a live Reject on Tonight with a
  non-today Selected day dates the Rejection to that day. Suppression remains
  purely date-driven (ADR-0008), so this path lights up no new behaviour.
- No schema change. `dinner_log.eaten_on` and `rejections.rejected_on` were
  always dated columns; the work is at the page, action, and snapshot layers.
- The phone header is laid out so the H1 and the stepper share a row with the
  stepper pinned right: it holds still as the day name changes length, and a
  long day name shortens the H1 instead of clipping the forward arrow. The
  full date stays visible in the stepper at every breakpoint, so a bare
  weekday in the H1 is unambiguous. Fitting a whole day name on a narrow
  phone makes this header the one place in the app where controls sit below
  the 44px touch target; the sizes and the rule live in DESIGN.md. The
  native date input's width is browser- and OS-dependent and was measured in
  Chromium; a browser that renders it wider ellipsizes the day name rather
  than clipping anything, the graceful failure the layout is built for.
- Accepted limitation: a tab left on today and returned to the next day
  shows the stale day, with the H1 reading "Tonight" when it is no longer
  tonight. A reload fixes it. Detecting the rollover client-side is
  deliberately not attempted — the whole page's data is stale in that case,
  not just the date.
