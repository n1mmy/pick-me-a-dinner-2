# Prepared notes — plan

Status: **approved design, not started** (2026-10-22). The design came out of a
`/grill-me` session.

This plan is the source of truth for the feature: what to build, in what order,
the files each slice touches, and how each slice is verified.

Domain terms: `CONTEXT.md` (**Prepared note**, its **brief** and **Prepared
ranking**, **AI search**, **AI rationale**, **Selected day**, **Pick**).
Architecture decision: `docs/adr/0011-prepared-notes-from-a-local-model.md`,
which amends ADR-0004.

## What it is

AI search runs live: the Household hits the button, waits 50–90 seconds, and
gets one-line rationales, because each call is billed and output length drives
the wait. The Household now runs a local LLM, Strata, which costs nothing per
call. A **Prepared note** uses it to write ahead of time, so something is ready
the moment Tonight opens, and with free tokens it can say more.

Decisions settled in the grill:

1. **Contents.** For one date, two parts:
   - A **brief**: 150–300 words of plain prose covering the evening's context
     (the Day note, weekday habits, the last few days' eating), two or three
     standout suggestions with reasons, and what to watch out for (recent
     disappointments, Rejections, Restaurants closed that day).
   - A **Prepared ranking**: every candidate Option, not a shortlist, each with
     an AI rationale. The strong picks get two or three sentences, tapering to
     a short line for the tail.
2. **Which dates.** Today through today+6, and only while the date is
   undecided (has no Log entry). Past dates are never generated.
3. **Claude is unchanged.** Both the query search and the empty-query search
   button still call Claude live. The local model only writes Prepared notes.
4. **Freshness.** The note is regenerated when its input changes: the date's AI
   snapshot, the model, or the prompt version. A loop checks every ~10 minutes,
   today first. Any Pick, Rejection, Day note, Note, or Catalog edit flows
   through the snapshot, so there's no per-action hook.
5. **Two replicas.** Both run the loop. A per-date claim (a lease on the
   note's row) makes sure only one generates a given date at a time.
6. **On Tonight.**
   - The brief sits under the heading and Day note line, in every mode,
     labelled with when it was prepared. It shows in full on wide screens and
     is clamped to two lines with "Read more" on narrow ones.
   - The Prepared ranking is what the list shows on load, rendered like an AI
     result.
   - Clear steps back one layer at a time: Claude result → Prepared ranking →
     deterministic list. A Selected-day change loads that date's note again.
7. **Freezing.** Once the date has a Pick, its note stops regenerating and
   keeps the last version written before the decision. On a decided date the
   brief stays visible above the Dinner block with one line per Log entry: "The
   note ranked Katsu curry #4", or "The note didn't rank Katsu curry". Removing
   the Pick makes the date undecided again, and its note regenerates.
8. **Staleness and failure.**
   - If Strata is down or its reply can't be read, the last good note stays.
   - An undecided date's note built from older inputs is labelled out of date.
     A frozen note never is.
   - Options since Picked, Rejected, or Closed are filtered out when the page
     renders. Candidates the ranking doesn't name are appended.
   - A date with no note shows nothing, and the feature is absent when the env
     vars are unset.

**Out of scope:**
- Using the local model for live AI search.
- Prepared notes on the Log or the Option detail page.
- Keeping every regenerated version.
- Dates beyond +6.
- Any effect on the Score or suppressions.
- A CronJob or queue.
- Tracking the local model's hit rate across dates.

## Ground rules for the implementer

- Read `CLAUDE.md`, `CONTEXT.md`, ADR-0004, ADR-0005, ADR-0011, and `DESIGN.md`
  first. `DESIGN.md` is binding for every visual decision.
- **Don't touch** `lib/ranking.ts`, `buildSnapshot`, `snapshotForDay`, the Claude
  AI search route (`app/api/ai-search/route.ts`), or the Claude client in
  `lib/ai-search.ts`. The Prepared path reuses them and doesn't change them.
  The one shared function it calls from `lib/ai-search.ts` is
  `parseRankingText`.
- Calling Strata is **free**, so the billed-call rule in `CLAUDE.md` doesn't
  apply to it. Running the real snapshot through the local model to tune the
  prompt is fine. The Anthropic eval script (`scripts/ai-search-eval.ts`) is
  still billed and still needs approval.
- Strata's endpoint and key for local work are in the operator's
  `~/.omp/agent/models.yml` (provider `strata`). Never commit the key: it goes
  in `.env.local` locally and in a k8s Secret in production.
- Scope (from `CLAUDE.md`): nothing beyond the per-date claim for replica
  coordination. No queue, no retry backoff, no CronJob, no version history.

## Facts the design rests on (measured 2026-10-22)

- Strata serves `qwen3.8-flash-next-iq3_s` with a 131k context window. It is a
  reasoning model: `message.reasoning_content` comes first and
  `message.content` holds the answer, so `max_tokens` must cover both. The
  400-token probe ran out of tokens before it wrote any content.
- Speed is about 390 tok/s for the prompt and about 25 tok/s for output. One
  generation (snapshot, reasoning, brief, and whole-Catalog ranking) is roughly
  2–4 minutes, and a 7-day sweep is roughly 15–25 minutes, run one day at a
  time.
- There are two replicas of the Next.js server in production (standalone
  output, `NODE_ENV=production`, set by the `Dockerfile`).
- In decided mode, Tonight already keeps the ranked picker open below the
  decided block, so a decided date has a list for the Prepared ranking to fill.

## Slice 1 — Generate and store (headless)

Ends with notes appearing in the database, and nothing on screen.

1. **Schema + migration.** `db/schema.ts` gets `prepared_notes`:
   `prepared_for date unique not null`, nullable `brief text`, `ranking jsonb`
   (`{ id: uuid, reason: string }[]` in rank order), `input_hash text`,
   `model text`, `prepared_at timestamptz`, `claimed_until timestamptz`, plus
   the created/updated timestamps the other dated tables have. Run
   `pnpm db:generate` to make migration `0006`. The startup schema check picks
   it up from the bundled migrations.
2. **The local model module, `lib/prepared-note.ts`.** A deep module modeled on
   `lib/ai-search.ts` and `lib/places.ts`:
   - `preparedNotesEnabled()`: true when `LOCAL_AI_BASE_URL` and
     `LOCAL_AI_MODEL` are both non-empty.
   - `PREPARED_PROMPT_VERSION` constant, and `buildPreparedSystemPrompt()`. The
     prompt asks for: the brief (150–300 words of plain prose covering the
     evening's context, two or three standouts, and things to watch out for);
     then the exact marker line; then `<number>|<rationale>` rows ranking
     **every** candidate, two or three sentences for the strong picks and
     tapering to a short line. Carry over the rhythm-claim rule and the
     household-text and Day-note framing from `buildSystemPrompt` by reusing
     its wording. Don't import the Claude prompt as a whole: its token-economy
     instructions are the opposite of what we want here.
   - `parsePreparedReply(text, idByIndex)`: split on the marker, trim the
     brief, and run the remainder through `parseRankingText`. A missing marker,
     an empty brief, or zero rows means unavailable.
   - `createPreparedNoteClient({ baseUrl, apiKey, model }).prepare(snapshot,
     idByIndex)`: one `fetch` POST to `/chat/completions` with a system and a
     user message (the serialized snapshot), and a generous `max_tokens` (start
     at 16k and tune). It uses an `AbortController` timeout of about 15 minutes
     and reads only `choices[0].message.content`. Every failure collapses to
     `{ ok: false }`. Each call writes one JSON log line: date, model, latency,
     outcome, usage, and row count.
3. **Eligibility, hash, claim, store, in `lib/prepared-notes-job.ts`** (or
   beside the queries if that reads better):
   - `eligibleDays(today, datesWithLogEntries)` is pure: today through +6 in
     `APP_TZ` (use `lib/local-day.ts`), minus decided dates, today first.
   - `inputHash(snapshot, model)` is pure: SHA-256 over
     `JSON.stringify(snapshot)`, the model, and `PREPARED_PROMPT_VERSION`.
   - `claimDay(date)` is one statement: `INSERT … ON CONFLICT (prepared_for) DO
     UPDATE SET claimed_until = now() + interval '20 minutes' WHERE
     claimed_until IS NULL OR claimed_until < now() RETURNING input_hash`. No
     row back means another replica has it, so skip it.
   - `storeNote(date, note)` writes the note and clears the claim.
     `releaseClaim(date)` clears only the claim and keeps the previous note.
   - `runSweep()`: for each eligible day, build `snapshotForDay({ asOf: day,
     query: "" })` and hash it. If the hash matches the stored one, skip the
     day. Otherwise claim it, call `prepare`, then store or release. Days run
     one at a time.
4. **The loop.** In `instrumentation.ts`, inside the existing `nodejs` branch
   and after the boot checks: if `NODE_ENV === "production"` and
   `preparedNotesEnabled()`, start a `setInterval` of about 10 minutes, plus one
   immediate run, guarded by an in-process "running" flag so ticks never
   overlap. Import it dynamically, the way the boot checks are imported.
5. **Config docs.** Add the three vars to `.env.example` with comments in the
   style of the `AI_*` block. Don't add them to `lib/check-env.ts`: they're
   optional.
6. **Prompt tuning, `scripts/prepared-note-eval.ts`.** Prints the built prompt
   and Strata's raw reply plus the parsed brief and ranking for a given
   `--day`, against the dev DB. It is free, so iterate on the prompt until the
   brief reads well and the ranking covers every candidate. Model it on
   `scripts/ai-search-eval.ts`.

**Verify:** unit tests (see Testing below) and `pnpm test:db` pass. Run the
script against Strata for today and +3, and record the output quality and
latency in the commit message. Run the dev server with the loop temporarily
forced on, and check that rows land in `prepared_notes` and that a second tick
skips unchanged days.

## Slice 2 — Design review (before any UI code)

Run `/plan-design-review` on the brief block (placement under the heading and
the Day note line), its "Prepared 2:14pm" label and out-of-date marker, the
narrow-screen two-line clamp with "Read more", how a Prepared-ranking row is
told apart from a Claude-result row, and the decided-day comparison line.
Record the resulting rules in `DESIGN.md`, committed with slice 3.

## Slice 3 — Tonight shows the note

1. **Read.** `db/queries.ts` gains `getPreparedNote(date)`. `app/page.tsx`
   loads it with the other Selected-day data. For an undecided date it also
   computes `outOfDate` by hashing the current `snapshotForDay` (one extra
   full-Log read on page load; acceptable at this size). It passes
   `preparedNote: { brief, ranking, preparedAt, outOfDate } | null` and
   `preparedNotesEnabled()` to the screen.
2. **Layers.** In `app/tonight-screen.tsx`, next to `aiResults`, add
   `preparedDismissed` state. The rows on show are `aiResults` if set,
   otherwise `preparedNote.ranking` if it exists and isn't dismissed,
   otherwise the deterministic list. `clearSearch` clears `aiResults` if one is
   set, otherwise it sets `preparedDismissed`. A Selected-day change resets
   `preparedDismissed`. The Claude-result behavior across a day change stays as
   it is. The Prepared ranking renders through the same AI-result row path, with
   the same suppression filtering and omitted-candidate append. Update the
   screen-reader status copy for the new mode.
3. **Brief.** A new `app/prepared-brief.tsx` sits below the Day note line in
   every mode. It shows the label (prepared time and out-of-date marker) and
   the clamp from slice 2.

**Verify:** screen tests pass. On the dev server with a seeded note, check the
1280px and 375px layouts against `DESIGN.md`.

## Slice 4 — Decided-day comparison

On a date with Log entries, the brief block adds one line per entry: "The note
ranked {name} #{n}", from that entry's position in the frozen ranking, or "The
note didn't rank {name}". Make this a small pure helper so it can be unit
tested. Out of date is never shown on a decided date.

**Verify:** screen test for the decided mode. Pick on the dev server and check
that the note stops regenerating on the next tick. Remove the Pick and check
that it starts regenerating again.

## Testing

A good test drives a module through its public interface and checks what a
caller sees (rows read back through real queries, the parsed note, the chosen
dates, the rendered screen), never the internals.
- Pure: `parsePreparedReply`, `eligibleDays`, `inputHash`, the comparison-line
  helper.
- Stubbed `fetch`: the client's success path and each failure path, plus the log
  line. Prior art: the Places client tests.
- Real DB: two simultaneous `claimDay` calls produce one winner, an expired
  claim can be re-taken, and store and release behave as specified. Prior art:
  the `*.db.test.ts` files.
- Screen: the layers and Clear, the day change, the brief and clamp, the
  out-of-date marker, the decided comparison, and nothing rendered without a
  note. Prior art: `app/tonight-screen.test.tsx`.
- No test calls Strata. The existing ranking and AI search tests pass unchanged.

## Deploy notes

- Create a k8s Secret for `LOCAL_AI_API_KEY` and set `LOCAL_AI_BASE_URL` and
  `LOCAL_AI_MODEL` on the deployment. Confirm that a pod in the app's namespace
  can reach Strata's ClusterIP: it was reachable from the dev container, but
  that hasn't been checked from the app pods.
- Apply migration `0006` out of band before rolling the image (the runner never
  migrates).
- After the rollout, watch the generation log lines for the first full sweep's
  latency and outcomes.
