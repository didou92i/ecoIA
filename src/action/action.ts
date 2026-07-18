interface ClickedTab {
  id?: number;
}

interface ToggleWidgetMessage {
  readonly version: 1;
  readonly kind: "toggle-widget";
}

type ToolbarClickListener = (tab: ClickedTab) => void;

interface RawToolbarApi {
  runtime?: { lastError?: unknown };
  action: {
    onClicked: {
      addListener(listener: ToolbarClickListener): void;
      removeListener(listener: ToolbarClickListener): void;
    };
  };
  tabs: {
    sendMessage: (...arguments_: never[]) => unknown;
  };
}

interface ToolbarApiRoot {
  browser?: RawToolbarApi;
  chrome?: RawToolbarApi;
}

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function sendToggleMessage(api: RawToolbarApi, usesPromiseApi: boolean, tabId: number): void {
  const message: ToggleWidgetMessage = { version: 1, kind: "toggle-widget" };
  if (usesPromiseApi) {
    const result = (
      api.tabs.sendMessage as unknown as (tabId: number, message: ToggleWidgetMessage) => unknown
    )(tabId, message);
    if (isPromise(result)) void result.catch(() => undefined);
    return;
  }

  const callback = () => {
    // Reading lastError prevents Chrome from logging an expected error on unsupported pages.
    void api.runtime?.lastError;
  };
  (
    api.tabs.sendMessage as unknown as (
      tabId: number,
      message: ToggleWidgetMessage,
      callback: () => void,
    ) => void
  )(tabId, message, callback);
}

export function registerToolbarAction(
  root: ToolbarApiRoot = globalThis as unknown as ToolbarApiRoot,
): () => void {
  const api = root.browser ?? root.chrome;
  if (!api?.action?.onClicked || !api.tabs?.sendMessage) return () => undefined;
  const usesPromiseApi = api === root.browser;
  const listener: ToolbarClickListener = (tab) => {
    if (!Number.isInteger(tab.id) || (tab.id ?? -1) < 0) return;
    sendToggleMessage(api, usesPromiseApi, tab.id as number);
  };
  api.action.onClicked.addListener(listener);
  return () => api.action.onClicked.removeListener(listener);
}
