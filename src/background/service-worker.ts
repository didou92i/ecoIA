import { createBrowserApi, type BrowserApi } from "../browser/browser-api";
import { validateNumericInteractionEvent } from "../shared/validation";
import { AggregateStore } from "../storage/aggregate-store";

interface ServiceWorkerOptions {
  now?: () => number;
  localDate?: () => string;
}

export function registerServiceWorker(
  api: BrowserApi,
  options: ServiceWorkerOptions = {},
): () => void {
  const store = new AggregateStore({
    local: api.storage.local,
    session: api.storage.session,
    ...(options.now ? { now: options.now } : {}),
    ...(options.localDate ? { localDate: options.localDate } : {}),
  });
  return api.runtime.onMessage((message, _sender, sendResponse) => {
    const validation = validateNumericInteractionEvent(message);
    if (!validation.ok) {
      sendResponse({ ok: false, error: validation.error });
      return false;
    }
    void store
      .processEvent(validation.value)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch(() => sendResponse({ ok: false, error: "PROCESSING_FAILED" }));
    return true;
  });
}

const extensionGlobal = globalThis as unknown as Record<string, unknown>;
if ("browser" in extensionGlobal || "chrome" in extensionGlobal) {
  registerServiceWorker(createBrowserApi());
}
