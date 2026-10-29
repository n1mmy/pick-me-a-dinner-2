/**
 * The in-process loop that runs the Prepared notes sweep (ADR-0011). Started
 * from `instrumentation.ts`; every replica runs one, and the per-date claim
 * keeps them from generating the same date.
 */

import { preparedNotesEnabled } from "./prepared-note";

/** How often the sweep comes round. */
const INTERVAL_MS = 10 * 60_000;

/**
 * Start calling `run` now and every ten minutes after, in production with
 * Prepared notes configured — dev servers never start it, so they never
 * compete with production for the GPU. Returns a stop function, or `null` when
 * the loop didn't start.
 */
export function startPreparedNotesLoop(
  run: () => Promise<void>,
): (() => void) | null {
  if (process.env.NODE_ENV !== "production" || !preparedNotesEnabled()) {
    return null;
  }
  // A full sweep (an hour or more) can outlast the interval; a tick that lands
  // mid-sweep is skipped rather than starting a second one.
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await run();
    } catch (error) {
      // A thrown sweep (the database unreachable, say) must not end the loop
      // or surface as an unhandled rejection; the next tick tries again.
      console.error("Prepared notes sweep failed", error);
    } finally {
      running = false;
    }
  };
  void tick();
  const interval = setInterval(() => void tick(), INTERVAL_MS);
  return () => clearInterval(interval);
}
