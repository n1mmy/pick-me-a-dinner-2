# Closed days are a property of the Restaurant, not a recurring Rejection

ADR-0006 stored Rejections flat as raw dated history and left it to the AI model
to decide which ones were standing — its worked example, carried verbatim into
the system prompt, was `"closed on Sundays"`. ADR-0008 then turned down
recurring Planned rejections as "real machinery — repeat rules, series editing,
end conditions", on the explicit grounds that ADR-0006 already had the model
infer a standing closure from flat Rejection history.

In practice the Household is still being offered Restaurants that are shut —
from the deterministic ranking, which never saw the Rejections at all, and from
AI search, which saw them and ranked the Restaurant anyway. We are therefore
adding **Closed day**: the set of weekdays a Restaurant is shut, stored on the
Restaurant itself. On a day it is closed, the Restaurant drops out of Tonight's
ranked list and out of AI search's candidate set.

The reframing is the point. Inference was never going to close this gap, for two
reasons that have nothing to do with how good the model is. First, the model
only ever sees the closures the Household happened to record — a Restaurant nobody
bothered to reject on a Sunday looks, in the data, exactly like one that is open
on Sundays. Second, a closure is not a decision at all: a **Rejection** is the
Household's judgement about one night, whereas being shut on Mondays is true
whether or not anyone considered the Restaurant. Asking flat Rejection history to
carry a fact about the restaurant's trading week was a category error, and the
"recurrence is heavy machinery" objection in ADR-0008 only holds against
*recurring Rejections* — a weekday set on the Restaurant has no repeat rule, no
series, and no end condition to edit.

## Considered options

- **Sharpen the prompt and record more "closed" Rejections** — the status quo,
  pursued harder. Rejected: it cannot fix the deterministic ranking, which does
  not read Rejections by design (ADR-0003), and it leaves the coverage problem
  untouched.
- **Recurring Rejections** — reopening ADR-0008. Rejected for the reasons
  ADR-0008 gave, which still stand; a Closed day avoids them entirely by not
  being a Rejection.
- **Full opening hours** (open/close times per weekday, sourced from Google
  Places). Rejected: the app decides one meal a day, so "is it open at dinner
  time" would require the app to hold an opinion about when dinner is. Weekday
  granularity is the whole real-world problem.
- **Specific closed dates** (holidays, the August shutdown) on the Restaurant.
  Rejected: a **Planned rejection** already covers "closed on this one known
  date", and giving the same fact two homes would be worse than either.
- **Zeroing or damping the Score on a closed day.** Rejected: suppression has
  never changed a Score (ADR-0003, ADR-0006, ADR-0008), and a Score-level hack
  would distort the affinity normalization and make a Restaurant's recency read
  differently depending on the day it was viewed.

## Consequences

- A `closed_days` integer-array column enters `options`, Sunday-indexed as `0`
  to match the `WEEKDAYS` table in `lib/snapshot-format.ts`. It is
  Restaurant-only, null/empty for a Home meal, and empty means open all week —
  so an unfilled field suppresses nothing and forgetting to fill it in is free.
- Suppression stays a presentation filter, derived from the **Selected day**'s
  weekday, applied after `rankTonight` in `app/page.tsx` alongside the existing
  Rejection filter. `lib/ranking.ts` never learns that closures exist.
- The rule is uniform across past, present and future Selected days. ADR-0008's
  "suppression stays purely date-driven" holds; a weekday rule with a
  today-or-later exception would be a second rule to carry forever.
- Suppressed Restaurants are not hidden — they collect in a **Closed
  disclosure** at the foot of Tonight, below the Rejected one, carrying the full
  picker-row controls (ADR-0007). A closure is the app's best information, not a
  veto: Pick is still one tap away for the night the data turns out to be wrong,
  and Reject-with-reason still records what was learned.
- The AI snapshot drops closed Restaurants from its candidate `options` exactly
  as it drops anchor-day-rejected ones, **and** each remaining candidate carries
  its `closedDays` as weekday names. The second half is not redundant: the
  prompt asks the model to find "Options or Tags that have quietly dropped out
  of rotation", and a Restaurant closed two days a week has a structurally
  thinner history that would otherwise read as waning interest.
- ADR-0006's `"closed on Sundays"` example — in its text and in the live system
  prompt — is no longer the right illustration of a standing Rejection and is
  replaced. The Rejections mechanism is otherwise untouched.
- Google Places can supply `regularOpeningHours`, from which closed days are
  derivable, but `lib/places.ts` does not request that field and autofill is
  deliberately deferred: the Catalog that hurts today is already saved, so every
  one of those Restaurants needs hand entry regardless, and Google's hours are
  wrong often enough that the field must stay editable in any case.
  *Amended 2026-09-23:* autofill has since landed (closed-days issue 05) — a
  Places match now requests `regularOpeningHours` and prefills the toggles,
  still editable, and still written once at the match rather than kept synced.
