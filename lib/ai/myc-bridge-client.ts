export type MYCBridgeJsonPrompt = Record<string, unknown>;

export type MYCBridgeMetadata = {
  source?: string;
  action?: string;
  [key: string]: unknown;
};

export type MYCBridgeSendPayload = {
  requestId: string;
  jsonPrompt: MYCBridgeJsonPrompt;
  metadata: MYCBridgeMetadata;
};

export type MYCBridgeResponse = {
  requestId?: string;
  raw?: string;
  jsonValid?: boolean;
  json?: unknown;
  error?: string;
  metadata?: MYCBridgeMetadata;
};

export type MYCBridgeState = {
  status?: string;
  mode?: "manual" | "auto" | string;
  queueLength?: number;
  queue?: unknown[];
  hasChatGPTTab?: boolean;
  pendingManualRequestId?: string | null;
  lastError?: string | null;
  lastResult?: unknown;
};

export function sendToMYCChatGPTBridge(jsonPrompt: MYCBridgeJsonPrompt, metadata: MYCBridgeMetadata = {}) {
  if (typeof window === "undefined") {
    throw new Error("MYC ChatGPT Bridge solo funciona en el navegador.");
  }

  const requestId = `myc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const detail: MYCBridgeSendPayload = {
    requestId,
    jsonPrompt,
    metadata,
  };

  window.dispatchEvent(new CustomEvent("MYCBridgeSendPrompt", { detail }));

  return requestId;
}

export function onMYCBridgeResponse(callback: (response: MYCBridgeResponse) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    if (event instanceof CustomEvent) {
      callback(readBridgeResponse(event.detail));
    }
  };

  window.addEventListener("MYCBridgeResponse", handler);

  return () => {
    window.removeEventListener("MYCBridgeResponse", handler);
  };
}

export function onMYCBridgeState(callback: (state: MYCBridgeState) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    if (event instanceof CustomEvent) {
      callback(readBridgeState(event.detail));
    }
  };

  window.addEventListener("MYCBridgeState", handler);

  return () => {
    window.removeEventListener("MYCBridgeState", handler);
  };
}

function readBridgeResponse(value: unknown): MYCBridgeResponse {
  if (!isRecord(value)) {
    return { raw: String(value), jsonValid: false };
  }

  return {
    requestId: readOptionalString(value.requestId),
    raw: readOptionalString(value.raw),
    jsonValid: typeof value.jsonValid === "boolean" ? value.jsonValid : undefined,
    json: value.json,
    error: readOptionalString(value.error),
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  };
}

function readBridgeState(value: unknown): MYCBridgeState {
  if (!isRecord(value)) {
    return {};
  }

  return {
    status: readOptionalString(value.status),
    mode: readOptionalString(value.mode),
    queueLength: typeof value.queueLength === "number" ? value.queueLength : undefined,
    queue: Array.isArray(value.queue) ? value.queue : undefined,
    hasChatGPTTab: typeof value.hasChatGPTTab === "boolean" ? value.hasChatGPTTab : undefined,
    pendingManualRequestId:
      typeof value.pendingManualRequestId === "string" || value.pendingManualRequestId === null ? value.pendingManualRequestId : undefined,
    lastError: typeof value.lastError === "string" || value.lastError === null ? value.lastError : undefined,
    lastResult: value.lastResult,
  };
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
