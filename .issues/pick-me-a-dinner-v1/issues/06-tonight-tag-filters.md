# 06 — Tri-state tag filters on Tonight

Status: done
Type: AFK

## Parent

[PRD: Pick Me a Dinner — v1](../PRD.md)

## What to build

The sticky filter zone on the Tonight screen.

An **All/Home/Restaurant** segment narrows the list by Option kind. Below it,
tappable **tag filter chips** each cycle **off → include → exclude → off**: an
include chip (leading `+`) shows only Options carrying that Tag; an exclude chip
(leading `−`, with a strikethrough) hides Options carrying it.

The kind segment and all tag filters **AND together** — an Option shows only if
it satisfies the kind filter *and* every include Tag *and* none of the exclude
Tags. A hint line states the active filter in words.

Per PRD §18: chip state must be legible without color (the `+` / `−` prefixes
and strikethrough carry it), every chip exposes its state to assistive tech via
its accessible name ("pasta, included"), and every tap target is at least
44×44px.

## Acceptance criteria

- [x] The All/Home/Restaurant segment filters the Tonight list by Option kind
- [x] Tag chips cycle off → include → exclude → off; include shows only matching
      Options, exclude hides matching Options
- [x] Kind segment and tag filters AND together; a hint line states the active
      filter in words
- [x] Chip state is distinguishable in grayscale (`+`/`−` + strikethrough) and
      announced to screen readers; tap targets are ≥ 44×44px
- [x] Tests cover the off → include → exclude cycle and that the kind segment
      and tag filters AND together

## Blocked by

- Issue 04 — Tonight: ranked list
