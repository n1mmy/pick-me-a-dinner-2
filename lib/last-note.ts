/**
 * Last-note module — a deep, pure reduction of the Log to one **Last note** per
 * Option. No DB, no React: given Log entries and the anchor day it answers
 * "what did we say about this Option last time?" for every Option at once.
 *
 * The anchor day is the Tonight screen's **Selected day** (ADR-0009). Only
 * entries dated *strictly before* it count, so the Selected day's own Pick is
 * never its own Last note — that entry's Note is already shown and edited on
 * the decided row. A picker row cannot have a Selected-day entry at all
 * (`splitTonight` moves any such Option into the decided block), so the one
 * strict rule serves both sides of the screen.
 *
 * The Score ignores Note text entirely; this module is display-only and
 * deliberately lives outside `lib/ranking`, which takes only recency-relevant
 * fields.
 */
import { CAP } from "./ranking.config";

/** A Log entry as this module reads it: dated, attributed, possibly noted. */
export type NotedLogEntry = {
  optionId: string;
  /** `eaten_on` as an **epoch-day** (see `lib/local-day`). */
  eatenOn: number;
  /** Row creation time — breaks a tie between two entries on the same date. */
  createdAt: Date;
  /** The entry's Note, or `null` when none was written. */
  note: string | null;
};

/** An Option's Last note: the text, and how long before the anchor day it was written. */
export type LastNote = {
  /** The Note text, trimmed. Never empty — an empty Note is not a Last note. */
  text: string;
  /** Whole days from the entry's date to the anchor day. Always at least 1. */
  daysAgo: number;
};

/**
 * A Note's age, in the shortest honest form: `18d` up to the recency `CAP`,
 * then months (`14mo`), then years (`3y`).
 *
 * The Recency chip stops at `60d+` because the *ranking* saturates there — a
 * more-overdue Option is no more overdue for scoring purposes. A Note's age has
 * no such ceiling: "two months ago" and "two years ago" say very different
 * things about whether the note still holds, and collapsing them to `60d+`
 * would quietly present a stale note as a fresh one. So the cap is where the
 * unit changes, not where the number stops.
 */
export function noteAge(daysAgo: number): string {
  if (daysAgo < CAP) return `${daysAgo}d`;
  const months = Math.round(daysAgo / 30.44);
  if (months < 24) return `${months}mo`;
  return `${Math.round(daysAgo / 365.25)}y`;
}

/**
 * The Last note of every Option that has one, keyed by Option id. An Option
 * with no non-empty Note before `anchorDay` is simply absent from the Map —
 * its Tonight row shows no note line at all rather than a placeholder.
 *
 * "Non-empty" is judged after trimming: the Option form trims a Note to `null`
 * on save, but imported history need not be that clean, and a row of spaces is
 * not something the Household said about a dinner.
 *
 * Ties are broken by `createdAt`, matching how the decided block already orders
 * a multi-Option Dinner by pick order. It only bites when one Option was logged
 * twice on one date with a Note each time.
 */
export function lastNotesByOption(
  entries: NotedLogEntry[],
  anchorDay: number,
): Map<string, LastNote> {
  type Candidate = { eatenOn: number; createdAt: Date; text: string };
  const newest = new Map<string, Candidate>();

  for (const entry of entries) {
    if (entry.eatenOn >= anchorDay) continue;
    const text = entry.note?.trim();
    if (!text) continue;

    const held = newest.get(entry.optionId);
    if (
      !held ||
      entry.eatenOn > held.eatenOn ||
      (entry.eatenOn === held.eatenOn &&
        entry.createdAt.getTime() > held.createdAt.getTime())
    ) {
      newest.set(entry.optionId, {
        eatenOn: entry.eatenOn,
        createdAt: entry.createdAt,
        text,
      });
    }
  }

  const lastNotes = new Map<string, LastNote>();
  for (const [optionId, candidate] of newest) {
    lastNotes.set(optionId, {
      text: candidate.text,
      daysAgo: anchorDay - candidate.eatenOn,
    });
  }
  return lastNotes;
}
