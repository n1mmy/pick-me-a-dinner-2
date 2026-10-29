# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One **Household** — the people who share the app and its one password. No
accounts, no per-person identity, no second tenant (ADR-0002).

Three situations, each with its own devices:

- **Deciding tonight** — phone, laptop, or desktop, all used regularly; no
  single layout is *the* pressure case.
- **Planning ahead for the week** — a main use case in its own right: usually
  desktop, occasionally mobile.
- **Catalog and Log maintenance** — desktop, and infrequent.

Deciding tonight is three jobs:

1. **Kill the stall.** From "I don't know, what do you want?" to a settled
   answer.
2. **Break the rut.** Stop cycling the same six things — surface what is both
   wanted *and* overdue.
3. **Remember last time.** Never re-order the thing that disappointed.

Planning ahead is stepping the Selected day forward and recording Planned
dinners, so the app doubles as light meal planning.

## Product Purpose

Put the right context in front of the decider, fast, and let the human still
decide. One **Catalog** of **Options** (Home meals and Restaurants as equals)
and one **Log** of every Dinner; **Tonight** ranks the active Catalog for a
**Selected day**, and **Pick** is one tap and *is* the logging.

Success is the decision made quickly and the household eating a wider range of
food it actually likes, with last time's verdict visible at the moment of
choosing. Not a recipe app, a grocery-list app, or a weekly meal planner: the
friction being solved is the **choosing**.

## Positioning

A sharp personal instrument for one household, not a consumer product. Three
things a neighbouring app could not truthfully copy:

- **Pick = log.** Deciding and recording are the same act, which is why the
  history is complete enough to rank from — the Log is never a chore.
- **Preference is inferred, never entered.** **Affinity** is a recency-weighted
  eat-frequency derived from the Log — no ratings, no stars. **Score =
  Affinity × Readiness**, multiplicative so low affinity can cancel high
  staleness.
- **Home meals and Restaurants rank in one list.** One unified `options` table
  (ADR-0001), so "cook or go out" is one decision.

## Operating Context

- **Ritual:** open Tonight → read the Prepared note's brief and ranking when
  there is one → AI search, with a query or an empty one, for a different lens
  → Pick, or Reject with a reason → optionally a Note on how it went. The
  deterministic ranking is consulted less often, on its own.
- **Deployment:** self-hosted — Docker image, Postgres, k8s Secrets for
  `APP_PASSWORD` / `APP_SECRET` / `DATABASE_URL`. Online-only: installable as a
  PWA with no service worker, because the app is auth-gated and a stale cache
  would only add risk.
- **Timezone:** the Household's calendar day comes from `APP_TZ`, not the
  server's clock.

## Capabilities and Constraints

Four screens, in `CONTEXT.md`'s vocabulary: **Catalog** (Options of two kinds,
Tags, Option notes, Closed days, Google Places autofill, Archive and
constrained hard-delete), **Tonight** (the layered ranking for a Selected day,
Pick, Reject with reason, the Rejected and Closed disclosures, the decided
block, AI search), **Log** (editable history of Log entries and Rejections by
date, plus Upcoming), and the **Option detail page** (everything about one
Option, with every control that makes sense for it, ADR-0007).

Durable constraints, each locked by an ADR:

- **Single household, one shared password, no accounts** (ADR-0002). Not to be
  "fixed" with hashed credentials or a users table; per-person identity would
  be a new decision, not a patch.
- **Ranking is a pure TypeScript function**, not SQL (ADR-0003).
- **AI is additive and optional** (ADR-0004, ADR-0011). The deterministic
  ranking is the floor every AI layer falls back to, and each AI feature is
  absent, not broken, when its env is unset — however often the Household
  reaches for the AI layers in practice.
- **Self-hosted Postgres on k8s** is the target, not an incidental detail.

Terminology is governed by `CONTEXT.md` and binds code, issues, tests, and UI
copy alike (friendly copy may say "meal" where the glossary says Option).

## Brand Commitments

- **Name:** Pick Me a Dinner.
- **Identity mark:** the PWA icon — a white fork-and-knife on a two-tone field
  split by an offset diagonal seam, `kind-home` teal meeting `kind-restaurant`
  plum. A sanctioned extension of the two meal-kind hues into brand identity;
  do not "correct" it to a neutral lettermark.
- **Voice:** plain, factual, unfussy — a tool that reports rather than
  cheerleads. Day-aware copy ("Closed tonight" / "Closed on Friday") is written
  out, not genericized.
- The visual world is committed in `DESIGN.md`, which is design authority.
  This file does not restate it.

## Evidence on Hand

- **Real data:** the Household's actual Catalog and eating history, imported
  from the prior app; ranking behaviour has been eyeballed against it, not
  fixtures.
- **Documented decisions:** `docs/adr/`, the PRDs under `.issues/`, and the
  design review in `docs/`.
- **Absences not to fabricate:** no users beyond this Household, no
  testimonials, customers, pricing, benchmarks, press, or marketing surface.
  Every screen sits behind the password gate.

## Product Principles

1. **The app removes guesswork; the human decides.** Never auto-pick, never
   hide an Option, never collapse the long tail. Show the numbers behind the
   order and let the Household overrule them.
2. **Expose every sensible control** (ADR-0007). Every place an item is shown
   carries every control that makes sense for that item; the only bound is
   screen space, and where a row cannot fit everything the cut is deliberate.
3. **The app's data is its best information, not a veto.** A Closed Restaurant
   keeps its Pick button; a low-ranked Option keeps its place in the list.
4. **One job, done sharply.** Recipes, groceries, and full meal planning are
   non-goals. New capability must survive the question "does this help someone
   decide dinner at 5:37pm?"
5. **Degrade to the floor, never to broken.** Optional integrations are
   *absent* when unconfigured, and the deterministic ranking is always what
   the screen falls back to.

## Accessibility & Inclusion

WCAG AA as the working bar: 4.5:1 for text and button labels in the role a
token actually renders, and a 44px minimum tap target where a mis-tap costs
something. `DESIGN.md` records the reasoned exceptions. The usage condition is
part of the requirement: a bright kitchen or a glare-lit room, whichever device
is at hand, and someone hungry and in a hurry.
