import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { escapeToCancel } from "./escape-to-cancel";

function keyEvent(overrides: Partial<KeyboardEvent<HTMLFormElement>> = {}) {
  return {
    key: "Escape",
    defaultPrevented: false,
    ...overrides,
  } as KeyboardEvent<HTMLFormElement>;
}

describe("escapeToCancel", () => {
  it("calls onCancel on a plain Escape", () => {
    const onCancel = vi.fn();
    escapeToCancel(onCancel, false)(keyEvent());
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("ignores every other key", () => {
    const onCancel = vi.fn();
    escapeToCancel(onCancel, false)(keyEvent({ key: "Enter" }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("defers to a nested handler that already claimed the key — an open Option/Tag dropdown's own Escape closes itself first", () => {
    const onCancel = vi.fn();
    escapeToCancel(onCancel, false)(keyEvent({ defaultPrevented: true }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("does nothing while a submit is in flight, matching Cancel's own disabled={pending}", () => {
    const onCancel = vi.fn();
    escapeToCancel(onCancel, true)(keyEvent());
    expect(onCancel).not.toHaveBeenCalled();
  });
});
