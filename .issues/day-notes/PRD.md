# Spec: Day notes

Status: done

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — **Day note** (new, added by this
spec), **Note**, **Option notes**, **Last note**, **Dinner**, **Log entry**,
**Planned dinner**, **Rejection**, **Selected day**, **Tonight**, **Log**,
**Household**, and **AI search** govern this spec. Respects
[`docs/adr/0007-expose-every-sensible-control.md`](../../docs/adr/0007-expose-every-sensible-control.md)
(a control behaves identically wherever it is placed) and
[`docs/adr/0009-tonight-ranks-a-selected-day.md`](../../docs/adr/0009-tonight-ranks-a-selected-day.md)
(everything on Tonight anchors on the Selected day). Feeding Day notes to AI
search follows the precedent of
[`docs/adr/0006-rejections-feed-ai-search.md`](../../docs/adr/0006-rejections-feed-ai-search.md);
no new ADR.

---

## Problem Statement

The Household often knows something about an upcoming evening that has nothing
to do with any Option — "Jen won't be around this night", "guests over", "late
back from the airport". The app has nowhere to put it. A Log entry's **Note**
needs a Log entry, which doesn't exist until something is Picked, and it
describes that Option's eating, not the evening. **Option notes** describe an
Option, not a date. So the fact lives in someone's head: whoever decides dinner
that night — and AI search — never sees it, and looking back, the Log can't
explain why an evening went the way it did.

## Solution

A **Day note**: one optional, single-line free-text note attached to a calendar
date, independent of any Log entry, Rejection, or Pick.

- **On Tonight**, the Selected day's Day note sits directly under the heading and
  day stepper, in every mode — before a Pick, after a Pick, and when every
  Option is unavailable. Tapping it edits it in place. With no Day note, a quiet
  text button sits there instead: "+ Note for tonight" when the Selected day is
  today, "+ Note for Friday" otherwise. Writing a note for a future night is:
  step Tonight forward, add it.
- **On the Log**, a date's Day note shows as a muted line directly under that
  date group's header, above its Log entries and Rejections, editable in place.
  A date group without one offers "+ Add a note" beside "Add a dinner" and "Add
  a rejection". A date that has only a Day note still gets its own date group,
  in Upcoming or History.
- **AI search** reads every Day note, past and future, as dated history, and
  treats the Selected day's own Day note as current context for this search.
- Clearing the text deletes the Day note.

A Day note never changes any Score or suppression, never switches Tonight into
its decided mode, is never a **Last note**, and never appears on a Tonight row
or the Option detail page.

## User Stories

1. As the Household, I want to step Tonight forward to Friday and write "Jen
   won't be around", so that whoever decides Friday's dinner knows.
2. As the Household, I want to add a Day note for tonight itself, so that I can
   record something I just learned about this evening.
3. As the Household, I want to see the Selected day's Day note under the heading
   on Tonight before anything is Picked, so that it informs the decision.
4. As the Household, I want the Day note to stay visible after I Pick, so that
   it isn't lost once the evening is decided.
5. As the Household, I want the Day note to show even when every Option is
   rejected or closed for the day, so that the context is never hidden by an
   empty list.
6. As the Household, I want the add button on Tonight to name the day ("+ Note
   for Friday"), so that I know which night I'm writing about.
7. As the Household, I want the add button to say "+ Note for tonight" when the
   Selected day is today, so that it reads naturally.
8. As the Household, I want to tap an existing Day note to edit it in place, so
   that fixing it doesn't take a separate screen.
9. As the Household, I want Escape to cancel an edit, so that I can back out
   without changing the note.
10. As the Household, I want clearing the text and saving to remove the Day
    note, so that I don't need a separate delete control.
11. As the Household, I want a note that is only whitespace to count as no note,
    so that an accidental space doesn't leave a blank line on the screen.
12. As the Household, I want at most one Day note per date, so that there's one
    obvious place to read and edit it.
13. As the Household, I want saving a Day note on a date that already has one to
    replace it, so that I never end up with duplicates.
14. As the Household, I want to see Friday's Day note in the Log's Upcoming
    section even when nothing is planned for Friday, so that I see it while
    planning the week.
15. As the Household, I want a future Day note to move into the Log's History
    when its date passes, so that it reads like every other dated record.
16. As the Household, I want a past evening's Day note to stay visible in the
    Log, so that I can see later why we ordered pizza that night.
17. As the Household, I want a date's Day note to sit above that date's Log
    entries and Rejections in the Log, so that it reads as context for the whole
    evening.
18. As the Household, I want to add a Day note to any date already shown in the
    Log, so that I can backfill one I forgot.
19. As the Household, I want to edit a Day note from the Log just as I can on
    Tonight, so that the control behaves the same everywhere.
20. As the Household, I want a Log that holds only Day notes to not show "No
    dinners logged yet", so that the empty state isn't wrong.
21. As the Household, I want AI search to take the Selected day's Day note into
    account, so that "Jen's away" can steer the suggestions.
22. As the Household, I want AI search to see past Day notes, so that it can
    learn patterns like "guests over" tending to mean a takeaway.
23. As the Household, I want AI search to see future Day notes, so that it can
    plan around what's coming, just as it sees Planned dinners.
24. As the Household, I want the model to understand that a Day note is about
    the evening and not about any Option, so that it doesn't treat "Jen won't be
    around" as feedback on a restaurant.
25. As the Household, I want a Day note to never move an Option up or down the
    deterministic list, so that the default ranking stays predictable.
26. As the Household, I want a Day note to never be shown as an Option's Last
    note, so that the evening's context never reads as feedback on a dish.
27. As the Household, I want Day notes kept off the Option detail page, so that
    the page stays about the Option.

## Implementation Decisions

- **Schema.** A new `day_notes` table: an id, a `noted_on` date that is unique
  and not null, a `note` text that is not null, and the created/updated
  timestamps the other dated tables carry. The unique constraint enforces "one
  per date". An absent Day note is an absent row, never an empty string. A
  Drizzle migration adds the table.
- **Write module.** One server action, `setDayNote(date, text)`, goes through
  the existing authed-action envelope and returns the same action-result shape
  as the other write actions. It trims the text with the same normalization a
  Log entry's Note uses. Non-empty text upserts on `noted_on`. Empty or
  whitespace-only text deletes the row for that date, and does nothing if there
  isn't one. It revalidates Tonight and the Log. Both screens call this one
  action, so the control behaves the same in both places (ADR-0007).
- **Constraints.** Same as a Note: free text on a single line, trimmed, with
  empty meaning absent. There's no length cap beyond what a Note has.
- **Tonight read.** The data Tonight loads for the Selected day (alongside its
  Log rows and Rejections) gains that day's Day note, or null if there isn't
  one.
- **Log read.** A new query returns every Day note as `{ notedOn, note }`.
- **Day grouping.** The Log's day-grouping function takes Day notes as a third
  input. Each `DayRecord` gains an optional `dayNote`. A date that has only a
  Day note forms its own record. Upcoming vs History placement uses the same
  date rule as Log entries and Rejections. A note-only Upcoming date counts
  toward the Upcoming cap.
- **Log empty state.** The Log counts Day notes along with Log entries and
  Rejections when deciding whether it is empty.
- **AI snapshot.** The snapshot builder takes Day notes as an extra input. The
  snapshot gains a dated `dayNotes` list (past and future, newest first, the
  same order as the `log` list) and the anchor day's Day note as its own field,
  or null. There's no cap on how far back it goes, matching the full Log. The
  system prompt says a Day note is a fact about the Household's evening, not
  about any Option, and that the anchor day's one is current context.
- **Untouched.** The ranking (Score, Readiness, Affinity), the day suppressions,
  the Last note derivation, and the Option detail page don't change.
- **Tonight placement.** A new Day note line sits between the heading/stepper
  row and the main content, rendered in every Tonight mode. Its day-aware copy
  reuses the day label Tonight already computes for the Rejected and Closed
  disclosures.
- **Design.** The Day note text is muted body text. The absent-state button uses
  the borderless style of the Log's per-date add buttons. Inline editing follows
  the existing in-place edit pattern for a Note, with Escape cancelling. Read
  `DESIGN.md` before building, and add the Day note rule to it in the same
  commit.
- **Glossary.** Add **Day note** to `CONTEXT.md`: its definition, the
  relationship "a date carries zero or one Day note", and an _Avoid_ entry
  keeping it separate from **Note** and **Option notes**. Update the **AI
  search** entry to mention that it reads Day notes.

## Testing Decisions

- A good test drives behavior through a module's public interface and checks
  what a caller sees: rows read back through the real queries, the snapshot
  object, the grouped records, and what's rendered on screen. It never checks
  how the internals get there. Four existing seams, no new ones.
- **The write action and queries (real database).** Call `setDayNote` and read
  back through the queries Tonight and the Log use. Cover: insert; overwrite on
  the same date; empty clears; whitespace-only clears; clearing a date with no
  note does nothing; one row per date; and a Day note on a date does not change
  that date's Log entries or Rejections. Prior art: the existing database tests
  for the Log actions, which use the same truncate-and-seed setup.
- **The AI snapshot builder (pure).** Past and future Day notes appear dated and
  newest first. The anchor day's note is surfaced separately, and is null when
  absent. The candidate set and numbering are the same with or without Day
  notes. Prior art: the Rejections and Selected-day sections of the snapshot
  builder's tests.
- **Day grouping (pure).** A note-only date forms a record. A Day note attaches
  to a date that already has entries or Rejections. A note on today, the past,
  or the future lands in History or Upcoming correctly. Prior art: the existing
  interleaved Log entries and Rejections tests.
- **The Tonight screen (simulated browser, write actions mocked).** The Day note
  renders in picker mode, decided mode, and the all-filtered state. The absent
  state shows "+ Note for tonight" or "+ Note for Friday". Editing and saving
  calls `setDayNote` with the Selected day and the text. Escape cancels. Prior
  art: the existing Tonight screen tests, which already mock every write action
  module.
- The Log screen gets no render test of its own: day grouping covers what it
  groups, and the editing control is the one the Tonight tests exercise. The
  existing ranking tests pass unchanged.

## Out of Scope

- More than one Day note per date, or any per-person attribution (the
  Household has no per-person identity).
- Multi-line or rich-text notes.
- Recurring Day notes ("Jen's away every Tuesday").
- A day-stepper marker showing which other days have a Day note.
- A top-of-Log "Add a note" control. Any date can be reached through Tonight's
  stepper.
- Day notes on the Option detail page or on any Tonight row.
- Any effect on the deterministic ranking or on suppressions.

## Further Notes

- The design came out of a `/grill-me` session on 2026-10-10.
- "Day note" is the glossary term; UI copy says "Note for Friday" or "Add a
  note". Code, issues, and tests use "Day note" so it is never confused with a
  Log entry's Note.
