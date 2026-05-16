# 04 — Tonight: ranked list

Status: ready-for-agent
Type: AFK

## Parent

[PRD: Pick Me a Dinner — v1](../PRD.md)

## What to build

The Tonight screen — the home screen — showing the active Catalog ranked by
Score, read-only (the "Pick tonight" write path is issue 05).

Build the **ranking engine** as a deep, pure module per ADR-0003: interface
`(active options, option→tags, non-future Log entries, today) → Tonight list of
{option, Score, Explanation chip}` sorted descending by Score. Internals:
`daysSince(date | null)` (`null` → `CAP`, else `min(CAP, today − date)`);
`lastEaten` / `lastTagUse` (most-recent non-future `eaten_on`, `null` if none);
`optionScore = W_OPTION·anti_repeat + W_TAG·variety`, where `variety` is
`mean(tagDays)` for a tagged Option and equals `anti_repeat` for a tagless one.
Constants live in `ranking.config.ts` (`CAP = 60`, `W_OPTION = 1.0`,
`W_TAG = 1.0`, `OVERDUE_THRESHOLD = 14`).

Build the **local-day module** — a deep pure module converting a SQL `date` and
"now" into integer epoch-days in `APP_TZ`, so "today" is the Household's
calendar day. All recency subtraction goes through it; it must be correct across
a DST boundary.

The Explanation chip is derived deterministically: if the Option has Tags AND
`W_TAG·variety >= W_OPTION·anti_repeat`, name the single Tag with the largest
`daysSince` ("No fish in 18 days"); otherwise (option term dominates, or the
Option has no Tags) name the Option's own recency ("Last had 28 days ago"). A
tagless Option always uses the option branch even on a tie. If `lastEaten` is
`null`, the chip reads "Never eaten yet" — never a false "Last had 60 days ago".

The screen renders a **flat, uniform list** (no lead-option prominence, no
collapsed long tail): each row shows name, quiet Home/Restaurant badge, the
Explanation chip, and tag chips with per-Tag recency (`Nd`, capped `60d+`,
overdue tags in the accent color). Cold start (zero non-future Log entries) →
every Score ties, fall back to alphabetical order. Empty Catalog → "Add your
first meals →" linking to Catalog. The list is an `<ol>` (PRD §18).

## Acceptance criteria

- [ ] Tonight renders the active Catalog as a flat uniform list ranked
      descending by Score, with badges, Explanation chips, and tag-recency chips
- [ ] Ranking engine and local-day module are pure modules with no DB/React
      dependency
- [ ] Cold start falls back to alphabetical order; empty Catalog shows the
      "Add your first meals →" prompt
- [ ] Overdue tag chips render in the accent color at `daysSince >= 14`
- [ ] Unit tests cover: `daysSince` (null→CAP, normal, capped, future guard);
      epoch-day conversion across a DST boundary; `lastEaten`/`lastTagUse`
      (most-recent non-future, future excluded, null on no history);
      `optionScore` (tagged, tagless, cold start); `explanationChip` (tag
      branch, option branch, tagless-always-option-branch regression guard,
      null→"Never eaten yet"); overdue threshold; the sort with cold-start
      fallback

## Blocked by

- Issue 03 — Tags on Options (per-Tag recency and tag chips need Tags)
