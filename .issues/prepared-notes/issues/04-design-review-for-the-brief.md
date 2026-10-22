# 04 — Design review for the brief and Prepared ranking

Status: ready-for-human
Type: HITL

## Parent

[Spec: Prepared notes](../PRD.md)

## What to build

Settle the visual rules before any UI code. HITL because `/plan-design-review`
is interactive.

Run `/plan-design-review` on:

- the brief block, sitting under the H1 and the Day note line in every Tonight
  mode;
- its "Prepared 2:14pm" label and the out-of-date marker;
- the narrow-screen two-line clamp with "Read more" (full on wide screens);
- how a Prepared-ranking row is told apart from a Claude AI search row, given
  both render through the same AI-result row path;
- the decided-day comparison line ("The note ranked Katsu curry #4" / "The note
  didn't rank Katsu curry");
- the screen-reader status copy for the Prepared-ranking mode.

Record the resulting rules in `DESIGN.md`, each as a statement of the current
system with its reason. Commit `DESIGN.md` here so issues 05 and 06 build
against it. (The plan said to commit it with the UI; a serial Ralph worker on
05 needs the rules already in the tree.)

## Acceptance criteria

- [ ] `/plan-design-review` run over every item above
- [ ] `DESIGN.md` has a rule for each, written in place with its reason
- [ ] No UI code in this issue

## Blocked by

- None (can run alongside 01–03)

## Comments
