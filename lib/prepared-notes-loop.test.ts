import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPreparedNotesLoop } from "./prepared-notes-loop";

const TEN_MINUTES = 10 * 60_000;

let stop: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("LOCAL_AI_BASE_URL", "http://strata.local/v1");
  vi.stubEnv("LOCAL_AI_MODEL", "qwen");
});

afterEach(() => {
  stop?.();
  stop = null;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("startPreparedNotesLoop", () => {
  it("does not start outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const run = vi.fn(async () => {});

    stop = startPreparedNotesLoop(run);
    await vi.advanceTimersByTimeAsync(3 * TEN_MINUTES);

    expect(stop).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("does not start when Prepared notes aren't configured", async () => {
    vi.stubEnv("LOCAL_AI_MODEL", "");
    const run = vi.fn(async () => {});

    stop = startPreparedNotesLoop(run);
    await vi.advanceTimersByTimeAsync(3 * TEN_MINUTES);

    expect(stop).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("logs one line when it starts, naming the model", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    stop = startPreparedNotesLoop(vi.fn(async () => {}));

    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      event: "prepared_notes_loop_started",
      model: "qwen",
      intervalMinutes: 10,
    });
  });

  it("runs once straight away, then every ten minutes", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const run = vi.fn(async () => {});

    stop = startPreparedNotesLoop(run);
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(TEN_MINUTES);
    expect(run).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(TEN_MINUTES);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("skips a tick that lands while the previous sweep is still running", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    let finish = () => {};
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    stop = startPreparedNotesLoop(run);
    // A full sweep can outlast the interval: two ticks pass mid-run.
    await vi.advanceTimersByTimeAsync(2 * TEN_MINUTES);
    expect(run).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(TEN_MINUTES);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("keeps going after a sweep fails", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValue(undefined);

    stop = startPreparedNotesLoop(run);
    await vi.advanceTimersByTimeAsync(TEN_MINUTES);

    expect(run).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
