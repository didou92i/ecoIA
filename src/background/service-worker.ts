import { registerToolbarAction } from "../action/action";
import { createBrowserApi, type BrowserApi } from "../browser/browser-api";
import { validateNumericInteractionEvent, validateResetSessionMessage } from "../shared/validation";
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
    const resetValidation = validateResetSessionMessage(message);
    if (resetValidation.ok) {
      void store
        .resetSession(resetValidation.value.tabSessionId)
        .then(() => sendResponse({ ok: true, status: "reset" }))
        .catch(() => sendResponse({ ok: false, error: "PROCESSING_FAILED" }));
      return true;
    }
    const validation = validateNumericInteractionEvent(message);
    if (!validation.ok) {
      sendResponse({ ok: false, error: validation.error });
      return false;
    }
    void store
      .processEvent(validation.value)
      .then(async (result) => {
        const [session, day] = await Promise.all([
          store.getSessionAggregate(validation.value.tabSessionId),
          store.getDayAggregate(),
        ]);
        sendResponse({ ok: true, ...result, session, day });
      })
      .catch(() => sendResponse({ ok: false, error: "PROCESSING_FAILED" }));
    return true;
  });
}

const extensionGlobal = globalThis as unknown as Record<string, unknown>;
if ("browser" in extensionGlobal || "chrome" in extensionGlobal) {
  registerServiceWorker(createBrowserApi());
  registerToolbarAction();
}
