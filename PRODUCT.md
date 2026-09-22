# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One **Household** — the single group of people who share the app and its one
password. There are no accounts, no per-person identity, and no second tenant
(ADR-0002).

The Household's use breaks into three situations, each with its own device
pattern (confirmed by the user, 2026-09-22):

- **Deciding tonight** — phone, laptop, or desktop; all three are used
  regularly. No single layout is *the* pressure case.
- **Planning ahead for the week** — a second main use case in its own right,
  not a corollary of deciding tonight: usually desktop, occasionally mobile.
- **Catalog and Log maintenance** — desktop, and comparatively infrequent.

Deciding tonight breaks into three jobs, all real:

1. **Kill the stall.** Get from "I don't know, what do you want?" to a settled
   answer — easily takes more than a quick minute, especially once AI search
   is in the mix.
2. **Break the rut.** Stop cycling the same six things — surface what is both
   wanted *and* overdue.
3. **Remember last time.** Never re-order the thing that disappointed; carry
   what the Household learned into the next decision.

Planning ahead for the week is its own job: stepping the Selected day forward
and recording Planned dinners, so the app doubles as light meal planning.

## Product Purpose

Put the right context in front of the decider, fast, and let the human still
decide. The app keeps one **Catalog** of **Options** (Home meals and
Restaurants as first-class equals) and one **Log** of every Dinner. **Tonight**
ranks the active Catalog by **Score** for a **Selected day**; **Pick** is one
tap and *is* the logging.

Success is the decision getting made quickly and the household eating a wider
range of food it actually likes, with last time's verdict visible at the moment
of choosing. It is explicitly *not* a recipe app, a grocery-list app, or a
weekly meal planner — the friction being solved is the **choosing**, and
existing apps over-solve it with machinery this Household does not want.

## Positioning

A sharp personal instrument for one household, not a consumer product. Three
things a neighboring app could not truthfully copy:

- **Pick = log.** There is no separate "pick" entity. Deciding and recording are
  the same act, which is why the history is complete enough to rank from — the
  Household never has to maintain a log as a chore.
- **Preference is inferred, never entered.** **Affinity** is a
  recency-weighted eat-*frequency* derived from the Log — no ratings, no stars,
  no new schema. **Score = Affinity × Readiness**, multiplicative so low
  affinity can cancel high staleness.
- **Home meals and Restaurants rank against each other in one list.** A single
  unified `options` table (ADR-0001), so "cook or go out" is one decision, not
  two apps.

## Operating Context

- **Primary device:** deciding tonight happens on phone, laptop, or desktop,
  all regularly; planning ahead for the week is usually desktop, occasionally
  mobile; Catalog/Log maintenance is desktop and infrequent. No one layout
  owns the pressure moment.
- **Ritual:** open Tonight → AI search is the primary lens the Household
  scans the list through — a query, or an empty one to surface habits and
  rhythms — with the plain deterministic ranking underneath consulted less
  often, on its own → Pick (or Reject with a reason) → optionally add a Note
  about how it went.
- **Deployment:** self-hosted — Docker image, Postgres, k8s Secrets for
  `APP_PASSWORD` / `APP_SECRET` / `DATABASE_URL`. Online-only: installable as a
  PWA (standalone) with **no service worker**, because the app is auth-gated and
  a stale cache would only add risk.
- **Timezone:** the Household's local calendar day comes from `APP_TZ`, not the
  server's clock.

## Capabilities and Constraints

Confirmed functionality (see `CONTEXT.md` for the canonical vocabulary and
`docs/adr/` for the decisions behind it):

- **Catalog** — Options of two kinds (Home meal / Restaurant), free-form Tags,
  standing Option notes, Google Places autofill for Restaurants (optional; the
  box hides when `GOOGLE_PLACES_API_KEY` is unset), Closed days on Restaurants,
  Archive and constrained hard-delete.
- **Tonight** — deterministic ranking of active Options by Score for a
  **Selected day** (any past or future date), Pick, Reject-with-reason, the
  Rejected and Closed disclosures, the decided "Tonight's dinner" block, and
  optional AI search.
- **Log** — full editable history of Log entries and Rejections, grouped by
  date, plus an Upcoming section for Planned dinners and Planned rejections.
- **Option detail page** — everything about one Option: fields, ranking data,
  Log history, Rejections, and every control that makes sense for it (ADR-0007).

Durable constraints future work must preserve (confirmed by the user,
2026-09-22 — all four are locked, not incidental):

- **Single household, one shared password, no accounts** (ADR-0002). Password
  compared in plaintext with a constant-time compare; the threat model is
  "trusted infrastructure, low-value target". Do not "fix" this with hashed
  credentials or a users table — per-person identity would be a new decision
  that supersedes ADR-0002, not a patch.
- **Ranking stays a pure TypeScript function**, not SQL (ADR-0003). The Catalog
  is tens of Options and hundreds of Log entries, so the testability is worth
  more than any query speedup.
- **AI search stays additive and optional** (ADR-0004). It is triggered,
  ephemeral, and never the default *view* — the deterministic ranking is
  still what loads on its own and the floor AI search fails back to, and the
  feature is simply absent when `ANTHROPIC_API_KEY` is unset. This is an
  architectural floor, not a usage pattern: in practice the Household reaches
  for AI search on most visits (see Operating Context, "Ritual") — that does
  not change what this constraint protects.
- **Self-hosted Postgres on k8s** is the target, not an incidental detail.

Terminology is governed by `CONTEXT.md` and is binding on code, issues, tests,
and UI copy alike (friendly copy may say "meal" where the glossary says Option).

## Brand Commitments

- **Name:** Pick Me a Dinner.
- **Identity mark:** the PWA icon — a solid white fork-and-knife on a two-tone
  field split by an offset diagonal seam, deep teal `kind-home` meeting muted
  plum `kind-restaurant`. A sanctioned extension of the two meal-kind hues into
  brand identity; do not "correct" it back to a neutral lettermark.
- **Voice:** plain, factual, unfussy — a tool that reports rather than
  cheerleads. Day-aware copy ("Closed tonight" / "Closed on Friday") is written
  out rather than genericized.
- The visual world is already committed in `DESIGN.md` ("a sharp instrument")
  and is design authority, not product truth. This file does not restate it.

## Evidence on Hand

- **Real data:** the Household's actual Catalog and eating history, loaded by
  the v1 data-import script. Ranking behavior has been eyeballed against real
  data, not fixtures.
- **Documented decisions:** ten ADRs in `docs/adr/`, six feature PRDs under
  `.issues/`, and `docs/design-review-2026-09-21.md` (a measured contrast and
  drift audit).
- **Absences future work must not fabricate:** there are no users beyond this
  one Household, no testimonials, no customers, no pricing, no benchmarks, no
  press, and no marketing surface of any kind. Nothing here is public-facing —
  every screen sits behind the password gate.

## Product Principles

1. **The app removes guesswork; the human decides.** Never auto-pick, never
   hide an Option, never collapse the long tail. Show the numbers behind the
   order and let the Household overrule them.
2. **Expose every sensible control** (ADR-0007). Every place an item is shown
   carries every control that makes sense for that item; the only bound is
   screen space, and where a row cannot fit everything the cut is deliberate.
3. **The app's data is its best information, not a veto.** A Closed Restaurant
   keeps its Pick button; a low-ranked Option keeps its place in the list. The
   Household may know better than the record.
4. **One job, done sharply.** Recipes, groceries, and full meal planning are
   non-goals. New capability must survive the question "does this help someone
   decide dinner at 5:37pm?"
5. **Degrade to the floor, never to broken.** Optional integrations (Places, AI
   search) are *absent* when unconfigured, and the deterministic ranking is
   always what loads on its own.

## Accessibility & Inclusion

WCAG AA as the working bar — the standard the project holds itself to
informally rather than a legal requirement (confirmed by the user, 2026-09-22).
In practice: 4.5:1 for text and button labels in the role a token actually
renders (the 2026-09-21 token retune), and a 44px minimum tap target for
controls where a mis-tap costs something. The exceptions documented in
`DESIGN.md` — the Tonight header's 36px stops, the seven Closed-day toggles, the
Last-note tap line, the decided row's note editor — stand as reasoned
exceptions, each paid for with a stated rationale, not as drift.

The real usage condition is part of the requirement: a bright kitchen or a
glare-lit room, on whichever device is at hand, and someone who is hungry and
in a hurry.
