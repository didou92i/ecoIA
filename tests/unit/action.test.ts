import { describe, expect, it, vi } from "vitest";

import { registerToolbarAction } from "../../src/action/action";

type ClickListener = (tab: { id?: number }) => void;

function createPromiseApi() {
  let listener: ClickListener | null = null;
  const sendMessage = vi.fn(async () => undefined);
  const root = {
    browser: {
      action: {
        onClicked: {
          addListener(nextListener: ClickListener) {
            listener = nextListener;
          },
          removeListener(nextListener: ClickListener) {
            if (listener === nextListener) listener = null;
          },
        },
      },
      tabs: { sendMessage },
    },
  };
  return {
    root,
    sendMessage,
    click: (tab: { id?: number }) => listener?.(tab),
    hasListener: () => listener !== null,
  };
}

describe("toolbar action", () => {
  it("toggles the widget in the clicked tab through the promise API", async () => {
    const { root, sendMessage, click } = createPromiseApi();
    registerToolbarAction(root);

    click({ id: 42 });
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(42, { version: 1, kind: "toggle-widget" }),
    );
  });

  it("ignores tabs without an identifier and removes its listener", () => {
    const { root, sendMessage, click, hasListener } = createPromiseApi();
    const cleanup = registerToolbarAction(root);

    click({});
    expect(sendMessage).not.toHaveBeenCalled();
    cleanup();
    expect(hasListener()).toBe(false);
  });

  it("supports callback-based Chrome APIs without surfacing unsupported pages", async () => {
    const listeners: ClickListener[] = [];
    const sendMessage = vi.fn(
      (_tabId: number, _message: unknown, callback: (response?: unknown) => void) => callback(),
    );
    const root = {
      chrome: {
        runtime: { lastError: { message: "Receiving end does not exist" } },
        action: {
          onClicked: {
            addListener(nextListener: ClickListener) {
              listeners.push(nextListener);
            },
            removeListener: vi.fn(),
          },
        },
        tabs: { sendMessage },
      },
    };

    registerToolbarAction(root);
    const activeListener = listeners.at(0);
    if (!activeListener) throw new Error("MISSING_ACTION_LISTENER");
    activeListener({ id: 7 });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());
  });
});
