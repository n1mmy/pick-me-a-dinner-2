# 01 — A Day note on Tonight

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Day notes](../PRD.md)

## What to build

The end-to-end path for a **Day note**: storage, the one write action, and
reading and editing it on Tonight for the Selected day. Issues 02 (Log) and 03
(AI search) build on this one.

- **Schema.** A new `day_notes` table in `db/schema.ts` with `id`, `noted_on`
  (`date`, not null, unique), `note` (`text`, not null), and the timestamps the
  `dinner_log` / `rejections` tables carry. Generate the Drizzle migration. An
  absent Day note is an absent row.
- **Write action.** `setDayNote(date, text)` behind the authed-action envelope
  (`lib/authed-action.ts`), returning the shared action-result shape. Trim the
  text with the same `trimToNull` a Log entry's Note uses (`app/log/actions.ts`).
  Non-empty text upserts on `noted_on`. Empty or whitespace-only text deletes
  that date's row, and does nothing if there isn't one. Revalidate Tonight and
  the Log (`app/revalidate.ts`).
- **Tonight read.** `getTonightData` (`db/queries.ts`) also returns the Selected
  day's Day note, or null.
- **Tonight UI.** In `app/tonight-screen.tsx`, a Day note line sits between the
  H1/stepper row and the main content, rendered in every mode: picker, decided,
  and the "No Options are available" state. With a note, it shows muted body
  text, and tapping it edits it in place. With no note, a borderless text
  button reads "+ Note for tonight" when the Selected day is today, and "+ Note
  for {dayLabel}" otherwise. Saving calls `setDayNote(selectedDay, text)`.
  Escape cancels (`app/escape-to-cancel.ts`). Build the line as its own
  component, because issue 02 reuses it on the Log.
- **Docs.** Read `DESIGN.md` first, and add the Day note rule to it. Add **Day
  note** to `CONTEXT.md`: the definition, the relationship "a date carries zero
  or one Day note", and an _Avoid_ entry keeping it separate from **Note** and
  **Option notes**.

A Day note never affects ranking, suppressions, decided mode, or Last notes.

## Acceptance criteria

- [ ] Migration adds `day_notes` with the unique `noted_on`
- [ ] DB tests: insert; overwrite on the same date; empty clears; whitespace-only
      clears; clearing an absent note does nothing; one row per date; that
      date's Log entries and Rejections are untouched
- [ ] `getTonightData` returns the Selected day's Day note, or null when absent
      (DB test)
- [ ] Tonight screen tests: the note renders in picker mode, decided mode, and
      the all-filtered state; the absent state shows "+ Note for tonight" or
      "+ Note for Friday"; saving calls `setDayNote` with the Selected day and
      text; Escape cancels
- [ ] Existing ranking and Last note tests pass unchanged
- [ ] `DESIGN.md` and `CONTEXT.md` updated in the same commit
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green
