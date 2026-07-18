import { describe, expect, it, vi } from "vitest";

import { createBrowserApi } from "../../src/browser/browser-api";

describe("browser API adapter", () => {
  it("uses promise-based WebExtension APIs", async () => {
    const sendMessage = vi.fn(async (message: unknown) => ({ echoed: message }));
    const get = vi.fn(async () => ({ theme: "dark" }));
    const set = vi.fn(async () => undefined);
    const root = {
      browser: {
        runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
        storage: {
          local: { get, set, remove: vi.fn(async () => undefined) },
          session: { get, set, remove: vi.fn(async () => undefined) },
        },
      },
    };

    const api = createBrowserApi(root);
    await expect(api.runtime.sendMessage({ kind: "ping" })).resolves.toEqual({
      echoed: { kind: "ping" },
    });
    await expect(api.storage.local.get("theme")).resolves.toEqual({ theme: "dark" });
    await api.storage.local.set({ theme: "light" });
    expect(set).toHaveBeenCalledWith({ theme: "light" });
  });

  it("promisifies callback-based Chrome APIs", async () => {
    const root = {
      chrome: {
        runtime: {
          lastError: undefined,
          sendMessage: (message: unknown, callback: (result: unknown) => void) =>
            callback({ echoed: message }),
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        },
        storage: {
          local: {
            get: (_keys: unknown, callback: (result: unknown) => void) =>
              callback({ theme: "dark" }),
            set: (_values: unknown, callback: () => void) => callback(),
            remove: (_keys: unknown, callback: () => void) => callback(),
          },
        },
      },
    };

    const api = createBrowserApi(root);
    await expect(api.runtime.sendMessage({ kind: "ping" })).resolves.toEqual({
      echoed: { kind: "ping" },
    });
    await expect(api.storage.local.get(["theme"])).resolves.toEqual({ theme: "dark" });
    expect(api.storage.session).toBeNull();
  });

  it("exposes listener cleanup and rejects a missing extension runtime", () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const api = createBrowserApi({
      browser: {
        runtime: { sendMessage: vi.fn(), onMessage: { addListener, removeListener } },
        storage: {
          local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
        },
      },
    });
    const listener = vi.fn();
    const cleanup = api.runtime.onMessage(listener);
    expect(addListener).toHaveBeenCalledWith(listener);
    cleanup();
    expect(removeListener).toHaveBeenCalledWith(listener);

    expect(() => createBrowserApi({})).toThrow("EXTENSION_API_UNAVAILABLE");
  });
});
