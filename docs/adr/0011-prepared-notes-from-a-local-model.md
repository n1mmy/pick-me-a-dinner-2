# Prepared notes: a local model writes ahead, and its ranking loads by default

_Amended by ADR-0012: the snapshot shared with AI search now carries timing
facts per Option and per Tag._

ADR-0004 added **AI search** as a triggered, additive layer. The deterministic
ranking was what loaded, and every AI result was a deliberate, uncached,
one-off call to the metered Anthropic API. That framing came from cost and
latency: each call costs money and takes 50–90 seconds, so it could never sit
on the page load, and every token of output had to earn its place (one-line
rationales, integer ids, compact rows).

The Household now runs a local LLM, Strata (an OpenAI-compatible server), that
costs nothing per call. It is slow: about 25 tok/s of output, so a long answer
over the full snapshot takes minutes. It is also probably weaker than Claude.
Being free changes what is worth generating. Being slow changes when it can
happen. So we are adding the **Prepared note**: for today and each of the next
six days, the local model writes a brief about the evening and a ranking of
every candidate Option with fuller rationales. The notes are written in the
background, stored, and shown when Tonight opens. **The Prepared ranking is now
what loads on Tonight when a note exists.** The deterministic ranking is still
the floor, one Clear away, and Claude AI search is untouched.

## Considered options

- **Keep ADR-0004 as is**, with AI only on demand. Rejected: free tokens can buy
  a written-ahead brief and multi-sentence rationales that a per-call budget
  never could, and the Household's ritual already starts with an AI-ranked list.
- **Pre-generate with Claude.** Rejected: it costs money every time the inputs
  change, across seven days, for notes that are mostly never opened. The
  billed-call rule in `CLAUDE.md` exists to avoid exactly that.
- **Move live AI search to the local model.** Rejected: minutes per call is far
  too slow for a triggered search, and Claude is likely the better ranker. Both
  the query search and the empty-query search stay on Claude.
- **Prepared brief only, with no ranking, over the deterministic list.**
  Rejected: the Household wants the whole list ranked through the AI lens on
  load, not a shortlist and not prose on its own.
- **Generate when the page is requested.** Impossible at this speed. Generation
  has to be ahead of time and stored.

## Decision

- A Prepared note is generated only for an **undecided** date from today through
  today+6. Its input is the same snapshot Claude AI search uses, with an empty
  query, so ADR-0005 applies unchanged: the model reasons about habits from
  dated history and timing facts (ADR-0012), with no sort key. It is
  regenerated when a hash of that snapshot, the model id, and the prompt
  version changes.
- **A note freezes once its date has a Pick.** It keeps the last version written
  before the Household decided, and past dates are never generated. A stored
  note is therefore a record of what the model said before reality happened,
  and Tonight shows it alongside what was actually eaten. Removing the Pick
  makes the date undecided again and lets the note regenerate. A note also
  freezes once its date has passed, decided or not: the sweep never returns to
  it, so it is never labelled out of date.
- The generator is a loop inside the Next.js server, started from
  `instrumentation.ts` in production. Both replicas run it and coordinate only
  through an atomic per-date claim, a `claimed_until` lease on the note's row
  that is longer than the call timeout. There is no CronJob, no queue, and no
  leader election: two replicas and one GPU don't need more.
- On Tonight the display stacks in layers: a Claude result over the Prepared
  ranking over the deterministic list. Clear removes the top layer.
- Failure keeps the last good note. A note that has not frozen and was built
  from older inputs is labelled out of date. A date with no note shows nothing.

## Consequences

- ADR-0004's "the deterministic ranking is what loads" no longer holds when a
  Prepared note exists. Its other commitments still stand: the deterministic
  ranking is the offline-proof fallback, `lib/ranking.ts` and ADR-0003 are
  untouched, and Claude AI search is triggered, ephemeral, and uncached.
- A second model provider and three optional env vars enter the system:
  `LOCAL_AI_BASE_URL`, `LOCAL_AI_API_KEY`, and `LOCAL_AI_MODEL`. As with
  `ANTHROPIC_API_KEY`, the feature is absent, not broken, when they are unset.
- The token discipline of ADR-0004 and `lib/ai-search.ts` does not carry over to
  the local path. Output length is limited only by readability, so the strong
  picks get two or three sentences. The **rhythm claim** rule for an **AI
  rationale** still applies.
- A new stored table, `prepared_notes`, holds one row per date. AI output is now
  persisted, which it never was under ADR-0004. Only the latest, or the frozen,
  version per date is kept.
- A note can lag a change by up to one loop interval plus the generation time.
  A history edit invalidates all seven dates, and a full sweep takes on the
  order of an hour, longer when Strata is serving other clients. That is
  accepted: the note is labelled out of date in the meantime, and live Claude
  search is always available.
- Dev servers don't run the loop, so a dev environment never competes with
  production for the GPU.
