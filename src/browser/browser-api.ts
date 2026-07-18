export type ExtensionMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => unknown;

export interface ExtensionStorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface BrowserApi {
  runtime: {
    sendMessage(message: unknown): Promise<unknown>;
    onMessage(listener: ExtensionMessageListener): () => void;
  };
  storage: {
    local: ExtensionStorageArea;
    session: ExtensionStorageArea | null;
  };
}

interface RawListenerEvent {
  addListener(listener: ExtensionMessageListener): void;
  removeListener(listener: ExtensionMessageListener): void;
}

interface RawStorageArea {
  get: (...arguments_: never[]) => unknown;
  set: (...arguments_: never[]) => unknown;
  remove: (...arguments_: never[]) => unknown;
}

interface RawExtensionApi {
  runtime: {
    lastError?: unknown;
    sendMessage: (...arguments_: never[]) => unknown;
    onMessage: RawListenerEvent;
  };
  storage: {
    local: RawStorageArea;
    session?: RawStorageArea;
  };
}

interface ApiRoot {
  browser?: RawExtensionApi;
  chrome?: RawExtensionApi;
}

function asPromise<T>(value: unknown): Promise<T> | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  ) {
    return value as Promise<T>;
  }
  return null;
}

function callRaw(operation: (...arguments_: never[]) => unknown, arguments_: unknown[]): unknown {
  return (operation as (...arguments_: unknown[]) => unknown)(...arguments_);
}

function callbackCall<T>(
  api: RawExtensionApi,
  operation: (...arguments_: never[]) => unknown,
  arguments_: unknown[],
): Promise<T> {
  return new Promise((resolve, reject) => {
    const callback = (result: T) => {
      if (api.runtime.lastError) {
        reject(new Error("EXTENSION_API_ERROR"));
        return;
      }
      resolve(result);
    };
    callRaw(operation, [...arguments_, callback]);
  });
}

function createStorageArea(
  api: RawExtensionApi,
  rawArea: RawStorageArea,
  usesPromiseApi: boolean,
): ExtensionStorageArea {
  return {
    get(keys = null) {
      if (usesPromiseApi) {
        const result = callRaw(rawArea.get.bind(rawArea), [keys]);
        const promise = asPromise<Record<string, unknown>>(result);
        if (promise) return promise;
      }
      return callbackCall<Record<string, unknown>>(api, rawArea.get.bind(rawArea), [keys]);
    },
    set(values) {
      if (usesPromiseApi) {
        const result = callRaw(rawArea.set.bind(rawArea), [values]);
        const promise = asPromise<void>(result);
        if (promise) return promise;
      }
      return callbackCall<void>(api, rawArea.set.bind(rawArea), [values]);
    },
    remove(keys) {
      if (usesPromiseApi) {
        const result = callRaw(rawArea.remove.bind(rawArea), [keys]);
        const promise = asPromise<void>(result);
        if (promise) return promise;
      }
      return callbackCall<void>(api, rawArea.remove.bind(rawArea), [keys]);
    },
  };
}

export function createBrowserApi(root: ApiRoot = globalThis as unknown as ApiRoot): BrowserApi {
  const api = root.browser ?? root.chrome;
  if (!api?.runtime?.sendMessage || !api.runtime.onMessage || !api.storage?.local) {
    throw new Error("EXTENSION_API_UNAVAILABLE");
  }
  const usesPromiseApi = api === root.browser;

  return {
    runtime: {
      sendMessage(message) {
        if (usesPromiseApi) {
          const result = callRaw(api.runtime.sendMessage.bind(api.runtime), [message]);
          const promise = asPromise<unknown>(result);
          if (promise) return promise;
        }
        return callbackCall<unknown>(api, api.runtime.sendMessage.bind(api.runtime), [message]);
      },
      onMessage(listener) {
        api.runtime.onMessage.addListener(listener);
        return () => api.runtime.onMessage.removeListener(listener);
      },
    },
    storage: {
      local: createStorageArea(api, api.storage.local, usesPromiseApi),
      session: api.storage.session
        ? createStorageArea(api, api.storage.session, usesPromiseApi)
        : null,
    },
  };
}
