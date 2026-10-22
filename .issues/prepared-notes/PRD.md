# Spec: Prepared notes

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) — **Prepared note** (new, added by
this spec), its **brief** and **Prepared ranking**, **AI search**, **AI
rationale**, **Day note**, **Selected day**, **Pick**, **Log entry**,
**Rejection**, **Tonight**, and **Household** govern this spec. Decided in
[`docs/adr/0011-prepared-notes-from-a-local-model.md`](../../docs/adr/0011-prepared-notes-from-a-local-model.md),
which amends
[`docs/adr/0004-ai-search.md`](../../docs/adr/0004-ai-search.md). The input is
the AI search snapshot, so
[`docs/adr/0005-ai-search-reasons-about-habits.md`](../../docs/adr/0005-ai-search-reasons-about-habits.md) (no pre-computed
recency) applies unchanged. The build plan, with files per slice, is
[`plans/prepared-notes.md`](../../plans/prepared-notes.md).

---

## Problem Statement

AI search is the Household's best view of what to eat, but it is slow and
thin. Every call goes to the metered Anthropic API, so it has to be pressed on
purpose, takes 50–90 seconds, and is held to one-line rationales because output
length drives both the bill and the wait. When Tonight opens, the Household
sees the deterministic list and has to wait for anything that reasons about
their habits, the evening's Day note, or what has been disappointing lately.

The Household now runs a local LLM, Strata, that costs nothing per call. It is
too slow for a live search (about 25 tok/s of output, minutes per answer), but
free tokens and spare time are exactly what writing ahead needs.

## Solution

A **Prepared note**: for each undecided date from today through today+6, the
local model writes, in the background and ahead of time:

- a **brief**: 150–300 words of plain prose about that evening, covering its
  context (the Day note, weekday habits, the last few days' eating), two or
  three standout suggestions with reasons, and what to watch out for (recent
  disappointments, Rejections, Restaurants closed that day); and
- a **Prepared ranking**: every candidate Option, each with an AI rationale,
  two or three sentences for the strong picks tapering to a short line for the
  tail.

On Tonight, the Selected day's brief sits under the heading and Day note line,
and the Prepared ranking is what the list shows on load. Display stacks in
layers: a Claude AI search result on top of the Prepared ranking, on top of the
deterministic list. Clear removes the top layer.

Notes are regenerated when their input changes and **freeze** once the date
has a Pick, so a decided date shows what the model said before the Household
decided ("The note ranked Katsu curry #4"). Claude AI search is unchanged.

## User Stories

1. As the Household, I want a ranked, reasoned list ready the moment Tonight
   opens, so that I don't wait a minute for AI search before deciding.
2. As the Household, I want a short written brief about tonight, so that I get
   the context (who's around, what we've eaten lately, what's closed) at a
   glance.
3. As the Household, I want the brief to name two or three standouts with
   reasons, so that the decision often ends at the brief.
4. As the Household, I want the brief to warn me about recent disappointments,
   Rejections, and Restaurants closed that day, so that I don't Pick something
   we've just gone off.
5. As the Household, I want the brief to take the Selected day's Day note into
   account, so that "Jen's away" shapes the suggestions.
6. As the Household, I want every candidate Option ranked, not a shortlist, so
   that the whole Catalog is still in front of me through the AI lens.
7. As the Household, I want the strong picks to carry two or three sentences of
   reasoning, so that I understand why they're on top.
8. As the Household, I want the Prepared ranking to look like an AI result, but
   distinguishable from a live Claude result, so that I know which one I'm
   reading.
9. As the Household, I want to step Tonight forward to Friday and see Friday's
   note, so that I can plan ahead across the week.
10. As the Household, I want notes for today through six days ahead, so that
    the coming week is covered.
11. As the Household, I want the brief labelled with when it was prepared, so
    that I know how fresh it is.
12. As the Household, I want an undecided date's note marked out of date when
    something has changed since it was written, so that I don't trust stale
    advice blindly.
13. As the Household, I want a note to rewrite itself after I Pick, Reject,
    edit a Day note or Note, or change the Catalog, so that I never have to ask
    for a refresh.
14. As the Household, I want an Option I've since Picked, Rejected, or that is
    Closed to disappear from the Prepared ranking, so that a stale note never
    offers something unavailable.
15. As the Household, I want candidates the note didn't name to still appear
    after its ranking, so that no Option goes missing.
16. As the Household, I want Clear to step back from the Prepared ranking to the
    deterministic list, so that the Score ranking is always one action away.
17. As the Household, I want Clear on a Claude result to return me to the
    Prepared ranking, not the deterministic list, so that layers peel off one
    at a time.
18. As the Household, I want Claude AI search, with or without a query, to work
    exactly as it does today, so that the better model is still there when I
    want it.
19. As the Household, I want the brief shown in full on a wide screen and
    clamped to two lines with "Read more" on a phone, so that it doesn't push
    the list off a small screen.
20. As the Household, I want the note on a decided date to stay as it was
    before I Picked, so that I can see what the model said before reality
    happened.
21. As the Household, I want a decided date to show where the note ranked what
    we actually ate ("The note ranked Katsu curry #4", or "The note didn't rank
    Katsu curry"), so that I get a feel for how good the model's advice is.
22. As the Household, I want removing a Pick to let that date's note be
    rewritten, so that an undecided night gets fresh advice again.
23. As the Household, I want a frozen note never marked out of date, so that a
    record of the past isn't flagged as a problem.
24. As the Household, I want the last good note kept when the local model is
    down or replies with something unreadable, so that an outage never blanks
    the screen.
25. As the Household, I want a date with no note to look exactly like Tonight
    does today, so that the feature is invisible until it has something to say.
26. As the Household, I want the feature absent when the local model isn't
    configured, so that a dev or self-hosted copy without Strata works as
    before.
27. As the Household, I want Prepared notes to never change any Score or
    suppression, so that the deterministic list stays predictable.
28. As the operator, I want each generation to log its date, model, latency,
    outcome, token usage, and row count, so that I can watch the first sweeps
    and spot failures.
29. As the operator, I want the two production replicas never to generate the
    same date at once, so that the one GPU isn't asked for duplicate work.
30. As the operator, I want dev servers never to run the loop, so that a dev
    environment doesn't compete with production for the GPU.
31. As the operator, I want a script that prints the prompt, Strata's raw reply,
    and the parsed brief and ranking for a given day, so that I can tune the
    prompt for free.

## Implementation Decisions

- **Model boundary.** Claude stays on live AI search (query and empty-query).
  The local model only writes Prepared notes. The Prepared path reuses the
  existing snapshot (`snapshotForDay` with an empty query) and the shared
  ranking-row parser (`parseRankingText`) without changing them. The ranking
  module, the snapshot builders, the Claude client, and the AI search route are
  not modified.
- **Schema.** A new `prepared_notes` table: `prepared_for` date, unique and not
  null; nullable `brief` text; `ranking` jsonb holding `{ id, reason }[]` in
  rank order; `input_hash`; `model`; `prepared_at`; `claimed_until`; plus the
  created/updated timestamps the other dated tables carry. One row per date,
  only the latest (or frozen) version kept. Migration `0006`.
- **Local model module (deep).** One module, modelled on the existing AI search
  and Places clients, exposes:
  - an enabled check: true when `LOCAL_AI_BASE_URL` and `LOCAL_AI_MODEL` are
    both set;
  - a prompt-version constant and a system-prompt builder. The prompt asks for
    the brief, then an exact marker line, then `<number>|<rationale>` rows
    ranking **every** candidate. It reuses the Claude prompt's wording for the
    rhythm-claim rule and for household-text and Day-note framing, but not its
    token-economy instructions, which are the opposite of what's wanted here;
  - a reply parser: split on the marker, trim the brief, parse the rows. A
    missing marker, an empty brief, or zero rows means unavailable;
  - a client whose `prepare(snapshot, idByIndex)` makes one OpenAI-compatible
    `/chat/completions` POST with a generous `max_tokens` (Strata is a reasoning
    model, so the budget must cover reasoning plus answer; start at 16k), a
    ~15-minute timeout, reads only `choices[0].message.content`, collapses every
    failure to `{ ok: false }`, and writes one JSON log line per call.
- **Job module.** Pure `eligibleDays(today, decidedDates)`: today through +6 in
  the app timezone, minus dates with a Log entry, today first. Pure
  `inputHash(snapshot, model)`: SHA-256 over the serialized snapshot, the model
  id, and the prompt version. `claimDay(date)` is one atomic upsert that sets a
  20-minute `claimed_until` lease only if none is live and returns the stored
  hash; no row back means another replica holds it. `storeNote` writes the note
  and clears the claim; `releaseClaim` clears only the claim and keeps the
  previous note. `runSweep()` walks eligible days one at a time: build the
  snapshot, hash it, skip if unchanged, otherwise claim, prepare, then store or
  release.
- **Freshness.** No per-action hooks. Every Pick, Rejection, Day note, Note, or
  Catalog edit changes the snapshot and therefore the hash; the loop notices on
  its next tick.
- **Freezing.** Falls out of eligibility: a decided date is never swept, so its
  row keeps the last pre-decision version. Removing the Pick makes it eligible
  again. Past dates are never generated.
- **The loop.** Started from the existing `instrumentation.ts` Node branch,
  after the boot checks, only when `NODE_ENV === "production"` and the feature
  is enabled: one immediate run, then about every 10 minutes, with an
  in-process flag so ticks never overlap. Both replicas run it; the per-date
  claim is the only coordination. No CronJob, queue, retry backoff, or leader
  election.
- **Config.** `LOCAL_AI_BASE_URL`, `LOCAL_AI_API_KEY`, `LOCAL_AI_MODEL`,
  documented in `.env.example` beside the `AI_*` block. Optional, so not added
  to the required-env check. The key is never committed: `.env.local` locally,
  a k8s Secret in production.
- **Tonight read.** The Selected-day data gains the date's Prepared note. For an
  undecided date the page also hashes the current snapshot to compute
  `outOfDate` (one extra full-Log read on load; acceptable at this size). The
  screen receives `{ brief, ranking, preparedAt, outOfDate } | null` and the
  enabled flag.
- **Tonight layers.** Beside the existing AI-result state, a
  `preparedDismissed` flag. Rows shown are the Claude result if set, else the
  Prepared ranking if present and not dismissed, else the deterministic list.
  Clear removes the Claude result if there is one, otherwise dismisses the
  Prepared ranking. Changing the Selected day un-dismisses (and loads that
  date's note); Claude-result behaviour across a day change is unchanged. The
  Prepared ranking renders through the AI-result row path, with the same
  render-time filtering of since-Picked/Rejected/Closed Options and the same
  append of unnamed candidates. Screen-reader status copy covers the new mode.
- **Brief component.** A new component below the Day note line, in every
  Tonight mode: prepared-time label, out-of-date marker (undecided dates only),
  full on wide screens, two-line clamp with "Read more" on narrow ones.
- **Decided-day comparison.** On a date with Log entries, the brief block adds
  one line per entry from a small pure helper: "The note ranked {name} #{n}"
  from the entry's position in the frozen ranking, or "The note didn't rank
  {name}".
- **Design gate.** Before any UI code, run `/plan-design-review` over the brief
  block, its label and out-of-date marker, the narrow-screen clamp, how a
  Prepared-ranking row differs from a Claude-result row, and the comparison
  line. Record the resulting rules in `DESIGN.md` in the same commit as the
  Tonight UI.
- **Prompt tuning.** A script, modelled on the AI search eval script, prints the
  built prompt, Strata's raw reply, and the parsed brief and ranking for a
  `--day` against the dev DB. Strata is free, so the billed-call rule doesn't
  apply to it; the Anthropic eval script remains billed and needs approval.
- **Glossary and ADRs.** `CONTEXT.md` gains **Prepared note** and updates
  **Tonight**, **AI search**, and **AI rationale**; ADR-0011 is added and
  ADR-0004 amended. These edits already exist on this branch and land with the
  first slice.

## Testing Decisions

- A good test drives a module through its public interface and checks what a
  caller sees (the parsed note, the chosen dates, rows read back through real
  queries, the rendered screen), never the internals. No test calls Strata. The
  existing ranking and AI search tests pass unchanged.
- **Pure.** The reply parser (marker missing, empty brief, zero rows, a good
  reply), `eligibleDays` (timezone edge, decided dates excluded, today first),
  `inputHash` (changes with snapshot, model, and prompt version; stable
  otherwise), and the decided-day comparison helper.
- **Stubbed `fetch`.** The local client's success path and each failure path
  (HTTP error, timeout, missing content, unparseable reply), plus the log line.
  Prior art: the Places client tests.
- **Real database.** Two simultaneous `claimDay` calls produce one winner; an
  expired claim can be retaken; `storeNote` writes and clears the claim;
  `releaseClaim` keeps the previous note. Prior art: the `*.db.test.ts` files.
- **Tonight screen (simulated browser).** The three layers and Clear stepping
  through them; a Selected-day change; the brief, its label, and the clamp; the
  out-of-date marker on undecided dates only; the decided-day comparison lines;
  nothing rendered without a note or with the feature disabled. Prior art: the
  existing Tonight screen tests.
- **Manual.** Run the tuning script for today and +3 and record output quality
  and latency in the commit. On the dev server with the loop forced on, confirm
  rows land and a second tick skips unchanged days. Check 1280px and 375px
  layouts against `DESIGN.md`. Pick, confirm the note stops regenerating;
  remove the Pick, confirm it resumes.

## Out of Scope

- Using the local model for live AI search.
- Prepared notes on the Log or the Option detail page.
- Keeping every regenerated version.
- Dates beyond today+6, and past dates.
- Any effect on the Score or on suppressions.
- A CronJob, queue, retry backoff, or leader election.
- Tracking the local model's hit rate across dates.

## Further Notes

- The design came out of a `/grill-me` session on 2026-10-22.
- Facts measured that day: Strata serves `qwen3.8-flash-next-iq3_s` with a 131k
  context, emits `reasoning_content` before `content` (a 400-token probe ran out
  before writing any answer), and runs at about 390 tok/s prompt / 25 tok/s
  output. One generation is roughly 2–4 minutes; a 7-day sweep 15–25 minutes.
- A note can lag a change by one loop interval plus generation time, and a
  history edit invalidates all seven dates. Accepted: the note is labelled out
  of date meanwhile and live Claude search is always available.
- Deploy: create the Secret and env vars; confirm an app pod (not just the dev
  container) can reach Strata's ClusterIP; apply migration `0006` out of band
  before rolling the image; watch the first sweep's log lines.
