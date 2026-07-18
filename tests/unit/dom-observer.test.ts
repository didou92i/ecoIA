// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { subscribeToScopedMutations } from "../../src/adapters/dom-observer";

describe("scoped DOM observer", () => {
  afterEach(() => vi.useRealTimers());

  it("coalesces mutations to at most two notifications per second", async () => {
    vi.useFakeTimers();
    const root = document.createElement("main");
    document.body.append(root);
    const listener = vi.fn();
    const cleanup = subscribeToScopedMutations(root, listener, 500);

    root.append(document.createElement("p"));
    await vi.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledTimes(1);
    root.append(document.createElement("p"), document.createElement("p"));
    await vi.advanceTimersByTimeAsync(499);
    expect(listener).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(listener).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("stops observers and scheduled callbacks on cleanup", async () => {
    vi.useFakeTimers();
    const root = document.createElement("main");
    const listener = vi.fn();
    const cleanup = subscribeToScopedMutations(root, listener, 500);
    root.append(document.createElement("p"));
    cleanup();
    await vi.runAllTimersAsync();
    expect(listener).not.toHaveBeenCalled();
  });
});
