# 01 — Store and prepare a Prepared note

Status: ready-for-agent
Type: AFK

## Parent

[Spec: Prepared notes](../PRD.md)

## What to build

The storage for a **Prepared note** and the deep module that asks the local
model for one. Nothing calls it yet; issue 02 adds the sweep and the loop.

- **Schema.** `db/schema.ts` gains `prepared_notes`: `prepared_for` (`date`,
  unique, not null), `brief` (`text`, nullable), `ranking` (`jsonb`,
  `{ id: uuid, reason: string }[]` in rank order), `input_hash` (`text`),
  `model` (`text`), `prepared_at` (`timestamptz`), `claimed_until`
  (`timestamptz`), plus the created/updated timestamps `day_notes` carries.
  Generate migration `0006` with `pnpm db:generate`; the startup schema check
  (`lib/schema-check.ts`) picks it up from the bundled migrations.
- **`lib/prepared-note.ts`**, modelled on `lib/ai-search.ts` and
  `lib/places.ts`:
  - `preparedNotesEnabled()`: true when `LOCAL_AI_BASE_URL` and
    `LOCAL_AI_MODEL` are both non-empty.
  - `PREPARED_PROMPT_VERSION` and `buildPreparedSystemPrompt()`. The prompt asks
    for the brief (150–300 words of plain prose: the evening's context, two or
    three standouts with reasons, what to watch out for), then an exact marker
    line, then `<number>|<rationale>` rows ranking **every** candidate — two or
    three sentences for the strong picks, tapering to a short line. Reuse
    `buildSystemPrompt`'s wording for the rhythm-claim rule and for the
    household-text and Day-note framing. Do **not** import the Claude prompt
    whole: its token-economy instructions are the opposite of what's wanted.
  - `parsePreparedReply(text, idByIndex)`: split on the marker, trim the brief,
    run the remainder through `parseRankingText` from `lib/ai-search.ts`. A
    missing marker, an empty brief, a `null` parse, or zero rows (including the
    `NONE` sentinel) means unavailable.
  - `createPreparedNoteClient({ baseUrl, apiKey, model }).prepare(snapshot,
    idByIndex)`: one `fetch` POST to `{baseUrl}/chat/completions` with a system
    message and a user message holding the serialized snapshot, `max_tokens`
    16000 (Strata is a reasoning model; the budget covers reasoning and
    answer), and an `AbortController` timeout of about 15 minutes. Read only
    `choices[0].message.content`. Every failure collapses to `{ ok: false }`.
    Each call writes one JSON log line: date, model, latency, outcome, usage,
    and row count.
- **Config.** Add `LOCAL_AI_BASE_URL`, `LOCAL_AI_API_KEY`, `LOCAL_AI_MODEL` to
  `.env.example` with comments in the style of the `AI_*` block. Do **not** add
  them to `lib/check-env.ts`: they're optional.
- **Domain docs.** The `CONTEXT.md` edits, the ADR-0004 amendment, and ADR-0011
  already exist on the branch (along with `plans/prepared-notes.md` and this
  PRD). Commit them with this issue if they aren't committed yet.

**Don't touch** `lib/ranking.ts`, `buildSnapshot`, `snapshotForDay`,
`app/api/ai-search/route.ts`, or the Claude client in `lib/ai-search.ts`.

## Acceptance criteria

- [ ] Migration `0006` adds `prepared_notes` with the unique `prepared_for`
- [ ] `preparedNotesEnabled()` is false when either required var is unset or
      empty, true when both are set (unit test)
- [ ] `parsePreparedReply` tests: a good reply yields the trimmed brief and rows
      in order; missing marker, empty brief, no parseable rows, and a `NONE`
      body each yield unavailable
- [ ] Client tests with a stubbed `fetch` (prior art: `lib/places.test.ts`):
      success; non-2xx; network error; timeout; missing `content`;
      unparseable reply — each failure returns `{ ok: false }`; the request
      carries the model, both messages, `max_tokens`, and the bearer key when
      set; one log line is written per call
- [ ] The built prompt contains the marker instruction, the rhythm-claim rule,
      and no Claude token-economy instruction (unit test)
- [ ] No test calls Strata; existing ranking and AI search tests pass unchanged
- [ ] `.env.example` documents the three vars; `lib/check-env.ts` unchanged
- [ ] `corepack pnpm typecheck`, `lint`, `test`, `build` all green

## Comments
