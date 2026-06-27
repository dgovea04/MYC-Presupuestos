/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readHistoryScope,
  isSameHistoryScope,
  clearPendingBridgeTimeout,
  readBridgeAiResult,
  toBackendProvider,
  mapActionToKhipuTask,
  subscribeBridgeEvents,
} from "@/components/ai/controller-providers";
import type { AiHistoryEntry, AiResultWithHistory } from "@/components/ai/use-ai-assistant-controller";

// Plain variables to capture bridge callbacks (avoiding mockImplementation quirk)
let bridgeResponseCallback: ((response: { requestId?: string; error?: string; jsonValid?: boolean; json?: unknown; raw?: string }) => void) | null = null;
let bridgeStateCallback: ((state: { status?: string }) => void) | null = null;

const { mockResponseUnsub, mockStateUnsub } = vi.hoisted(() => ({
  mockResponseUnsub: { fn: vi.fn() },
  mockStateUnsub: { fn: vi.fn() },
}));

vi.mock("@/lib/ai/myc-bridge-client", () => ({
  onMYCBridgeResponse: (cb: (response: { requestId?: string; error?: string; jsonValid?: boolean; json?: unknown; raw?: string }) => void) => {
    bridgeResponseCallback = cb;
    return mockResponseUnsub.fn;
  },
  onMYCBridgeState: (cb: (state: { status?: string }) => void) => {
    bridgeStateCallback = cb;
    return mockStateUnsub.fn;
  },
  sendToMYCChatGPTBridge: vi.fn().mockReturnValue("req-mock-1"),
  MYCBridgeResponse: {} as never,
}));

vi.mock("@/lib/ai/prompts", () => ({
  APU_OUTPUT_JSON_SHAPE: { type: "apu_shape" },
  REVIEW_OUTPUT_JSON_SHAPE: { type: "review_shape" },
}));

vi.mock("@/lib/ai/task-payloads", () => ({
  buildBridgeTaskPayload: vi.fn(({ action, payload }: { action: string; payload: Record<string, unknown> }) => ({
    action,
    payload,
    output: {},
  })),
}));

// ─── Helpers ────────────────────────────────────────────────────

function createApiResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

// ─── readHistoryScope ──────────────────────────────────────────

describe("readHistoryScope", () => {
  it("returns project scope when projectId is provided", () => {
    expect(readHistoryScope("proj-1")).toEqual({ mode: "project", projectId: "proj-1" });
  });

  it("returns session scope when projectId is undefined", () => {
    expect(readHistoryScope(undefined)).toEqual({ mode: "session" });
  });
});

// ─── isSameHistoryScope ────────────────────────────────────────

describe("isSameHistoryScope", () => {
  it("returns true for two session scopes", () => {
    expect(isSameHistoryScope({ mode: "session" }, { mode: "session" })).toBe(true);
  });

  it("returns true for same project scopes", () => {
    expect(isSameHistoryScope({ mode: "project", projectId: "p1" }, { mode: "project", projectId: "p1" })).toBe(true);
  });

  it("returns false for different project scopes", () => {
    expect(isSameHistoryScope({ mode: "project", projectId: "p1" }, { mode: "project", projectId: "p2" })).toBe(false);
  });

  it("returns false for session vs project", () => {
    expect(isSameHistoryScope({ mode: "session" }, { mode: "project", projectId: "p1" })).toBe(false);
  });
});

// ─── clearPendingBridgeTimeout ─────────────────────────────────

describe("clearPendingBridgeTimeout", () => {
  it("clears timeout and sets ref to null", () => {
    const ref = { current: 42 as number | null };
    const clearSpy = vi.spyOn(window, "clearTimeout");
    clearPendingBridgeTimeout(ref);
    expect(clearSpy).toHaveBeenCalledWith(42);
    expect(ref.current).toBeNull();
  });

  it("does nothing when ref is already null", () => {
    const ref = { current: null as number | null };
    const clearSpy = vi.spyOn(window, "clearTimeout");
    clearPendingBridgeTimeout(ref);
    expect(clearSpy).not.toHaveBeenCalled();
  });
});

// ─── readBridgeAiResult ────────────────────────────────────────

describe("readBridgeAiResult", () => {
  it("extracts answer from valid JSON response", () => {
    const result = readBridgeAiResult({ raw: "raw",  jsonValid: true, json: { answer: "ok" } });
    expect(result.answer).toBe("ok");
    expect(result.model).toBe("ChatGPT Bridge");
  });

  it("falls back to raw text when JSON is invalid", () => {
    const result = readBridgeAiResult({ raw: "plain text",  jsonValid: false, json: null });
    expect(result.answer).toBe("plain text");
    expect(result.warnings).toContain("La respuesta de ChatGPT Bridge no parece JSON valido.");
  });

  it("falls back to raw when JSON has no answer field", () => {
    const result = readBridgeAiResult({ raw: "fallback",  jsonValid: true, json: { other: "x" } });
    expect(result.answer).toBe("fallback");
  });
});

// ─── toBackendProvider ─────────────────────────────────────────

describe("toBackendProvider", () => {
  it("converts chatgpt-bridge to chatgpt_bridge", () => {
    expect(toBackendProvider("chatgpt-bridge")).toBe("chatgpt_bridge");
  });
  it.each(["ollama", "openai", "gemini", "openrouter"] as const)("passes through %s unchanged", (p) => {
    expect(toBackendProvider(p)).toBe(p);
  });
});

// ─── mapActionToKhipuTask ──────────────────────────────────────

describe("mapActionToKhipuTask", () => {
  it("maps chat → chat", () => expect(mapActionToKhipuTask("chat")).toBe("chat"));
  it("maps apu → generate_apu", () => expect(mapActionToKhipuTask("apu")).toBe("generate_apu"));
  it("maps review → review_budget", () => expect(mapActionToKhipuTask("review")).toBe("review_budget"));
  it("maps autocomplete → autocomplete", () => expect(mapActionToKhipuTask("autocomplete")).toBe("autocomplete"));
});

// ─── subscribeBridgeEvents ─────────────────────────────────────

describe("subscribeBridgeEvents", () => {
  let bridgeRequestRef: { current: { request: { action: string; payload: Record<string, unknown> }; historyScope: { mode: "session" } | { mode: "project"; projectId: string } } | null };
  let contextRef: { current: { project?: string; module?: string } };
  let historyScopeRef: { current: { mode: "session" } | { mode: "project"; projectId: string } };
  let requestIdRef: { current: string | null };
  let timeoutRef: { current: number | null };
  let bridgeState: { status?: string } | null;
  let lastError: string;
  let history: AiHistoryEntry[];
  let loading: boolean;
  let lastResult: AiResultWithHistory | null;

  function createParams() {
    return {
      latestBridgeRequest: bridgeRequestRef,
      latestContext: contextRef,
      latestHistoryScope: historyScopeRef,
      pendingBridgeRequestId: requestIdRef,
      pendingBridgeTimeoutId: timeoutRef,
      setBridgeState: (state: { status?: string } | null) => { bridgeState = state; },
      setError: (err: string) => { lastError = err; },
      setHistory: (updater: unknown) => {
        if (typeof updater === "function") {
          history = (updater as (prev: AiHistoryEntry[]) => AiHistoryEntry[])(history);
        }
      },
      setLoading: (l: boolean) => { loading = l; },
      setResult: (r: AiResultWithHistory | null) => { lastResult = r; },
    };
  }

  beforeEach(() => {
    bridgeRequestRef = { current: null };
    contextRef = { current: { project: "Test Project", module: "Presupuestos" } };
    historyScopeRef = { current: { mode: "session" } };
    requestIdRef = { current: null };
    timeoutRef = { current: null };
    bridgeState = null;
    lastError = "";
    history = [];
    loading = false;
    lastResult = null;
    bridgeResponseCallback = null;
    bridgeStateCallback = null;
    mockResponseUnsub.fn.mockClear();
    mockStateUnsub.fn.mockClear();
  });

  it("subscribes to both bridge response and state events", () => {
    const unsub = subscribeBridgeEvents(createParams());
    expect(bridgeResponseCallback).not.toBeNull();
    expect(bridgeStateCallback).not.toBeNull();
    expect(typeof unsub).toBe("function");
  });

  it("sets error when bridge response has error", () => {
    subscribeBridgeEvents(createParams());
    bridgeResponseCallback!({ error: "Bridge connection failed" });
    expect(lastError).toBe("Bridge connection failed");
    expect(bridgeRequestRef.current).toBeNull();
  });

  it("sets result when bridge response is valid without scoped request", () => {
    subscribeBridgeEvents(createParams());
    bridgeResponseCallback!({ raw: "A",  jsonValid: true, json: { answer: "Bridge structured" } });
    expect(lastResult).not.toBeNull();
    expect(lastResult!.answer).toBe("Bridge structured");
    expect(loading).toBe(false);
  });

  it("creates history entry for session scope matching request", () => {
    subscribeBridgeEvents(createParams());
    bridgeRequestRef.current = { request: { action: "chat", payload: { message: "Test" } }, historyScope: { mode: "session" } };
    requestIdRef.current = "req-1";

    bridgeResponseCallback!({ requestId: "req-1", raw: "A",  jsonValid: true, json: { answer: "Bridge answer" } });

    expect(history).toHaveLength(1);
    expect(history[0].action).toBe("chat");
    expect(history[0].context).toEqual({ project: "Test Project", module: "Presupuestos" });
    expect(lastResult!.historyEntry).toBeDefined();
  });

  it("skips history entry for project scope", () => {
    subscribeBridgeEvents(createParams());
    bridgeRequestRef.current = { request: { action: "chat", payload: { message: "T" } }, historyScope: { mode: "project", projectId: "p-1" } };
    historyScopeRef.current = { mode: "project", projectId: "p-1" };
    requestIdRef.current = "req-1";

    bridgeResponseCallback!({ requestId: "req-1", raw: "A",  jsonValid: true, json: { answer: "A" } });

    expect(history).toHaveLength(0);
    expect(lastResult!.historyEntry).toBeUndefined();
  });

  it("skips response when requestId mismatches", () => {
    subscribeBridgeEvents(createParams());
    requestIdRef.current = "expected";
    bridgeResponseCallback!({ requestId: "other", raw: "X",  jsonValid: true, json: { answer: "ignored" } });
    expect(lastResult).toBeNull();
  });

  it("unsubscribes all listeners on cleanup", () => {
    const unsub = subscribeBridgeEvents(createParams());
    unsub();
    expect(mockResponseUnsub.fn).toHaveBeenCalled();
    expect(mockStateUnsub.fn).toHaveBeenCalled();
  });

  it("propagates bridge state", () => {
    subscribeBridgeEvents(createParams());
    bridgeStateCallback!({ status: "connected" });
    expect(bridgeState).toEqual({ status: "connected" });
  });

  it("clears pending timeout on response", () => {
    const clearSpy = vi.spyOn(window, "clearTimeout");
    timeoutRef.current = 123 as unknown as number;
    subscribeBridgeEvents(createParams());
    bridgeResponseCallback!({ raw: "A",  jsonValid: true, json: { answer: "A" } });
    expect(clearSpy).toHaveBeenCalledWith(123);
    expect(requestIdRef.current).toBeNull();
  });
});

// ─── submitCloudRequest ─────────────────────────────────────────

describe("submitCloudRequest", () => {
  let lastError: string;
  let history: AiHistoryEntry[];
  let loading: boolean;
  let lastResult: AiResultWithHistory | null;

  beforeEach(() => {
    lastError = "";
    history = [];
    loading = false;
    lastResult = null;
  });

  it("sends correctly-shaped request to /api/ai/execute and processes result", async () => {
    const { submitCloudRequest } = await import("@/components/ai/controller-providers");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/ai/execute");
      const body = JSON.parse(init?.body as string);
      expect(body.provider).toBe("openai");
      expect(body.task).toBe("chat");
      expect(body.payload.message).toBe("Hello");
      return createApiResponse({
        answer: "Cloud response",
        model: "gpt-4",
        requestedModel: "gpt-4",
        fallbackUsed: false,
        warnings: [],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await submitCloudRequest({
      context: { module: "Test" },
      latestHistoryScope: { current: { mode: "session" } },
      provider: "openai",
      request: { action: "chat", payload: { message: "Hello" } },
      requestHistoryScope: { mode: "session" },
      setError: (e: string) => { lastError = e; },
      setHistory: (u: unknown) => { if (typeof u === "function") history = (u as (p: AiHistoryEntry[]) => AiHistoryEntry[])(history); },
      setLoading: (l: boolean) => { loading = l; },
      setResult: (r: AiResultWithHistory | null) => { lastResult = r; },
    });

    expect(lastResult).not.toBeNull();
    expect(lastResult!.answer).toBe("Cloud response");
    expect(history).toHaveLength(1); // session mode creates history entry
    expect(history[0].action).toBe("chat");
    expect(history[0].context.module).toBe("Test");
    expect(loading).toBe(false); // reset in finally
  });

  it("does not create history entry for project scope", async () => {
    const { submitCloudRequest } = await import("@/components/ai/controller-providers");

    const fetchMock = vi.fn(() => createApiResponse({
      answer: "OK", model: "gpt-4", requestedModel: "gpt-4", fallbackUsed: false, warnings: [],
    }));
    vi.stubGlobal("fetch", fetchMock);

    await submitCloudRequest({
      context: { project: "P" },
      latestHistoryScope: { current: { mode: "project", projectId: "p-1" } },
      provider: "openai",
      request: { action: "review", payload: { budgetSummary: "Rev" } },
      requestHistoryScope: { mode: "project", projectId: "p-1" },
      setError: (e: string) => { lastError = e; },
      setHistory: (u: unknown) => { if (typeof u === "function") history = (u as (p: AiHistoryEntry[]) => AiHistoryEntry[])(history); },
      setLoading: (l: boolean) => { loading = l; },
      setResult: (r: AiResultWithHistory | null) => { lastResult = r; },
    });

    expect(history).toHaveLength(0);
    expect(lastResult!.historyEntry).toBeUndefined();
    expect(loading).toBe(false);
  });

  it("sets error on non-ok response", async () => {
    const { submitCloudRequest } = await import("@/components/ai/controller-providers");

    const fetchMock = vi.fn(() => createApiResponse({ error: "Rate limited" }, 429));
    vi.stubGlobal("fetch", fetchMock);

    await submitCloudRequest({
      context: {},
      latestHistoryScope: { current: { mode: "session" } },
      provider: "gemini",
      request: { action: "apu", payload: { description: "Test" } },
      requestHistoryScope: { mode: "session" },
      setError: (e: string) => { lastError = e; },
      setHistory: () => {},
      setLoading: (l: boolean) => { loading = l; },
      setResult: (r: AiResultWithHistory | null) => { lastResult = r; },
    });

    expect(lastError).toBe("Rate limited");
    expect(loading).toBe(false);
  });

  it("maps apu action to generate_apu task in request body", async () => {
    const { submitCloudRequest } = await import("@/components/ai/controller-providers");

    let capturedBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return createApiResponse({ answer: "APU", model: "gpt-4", requestedModel: "gpt-4", fallbackUsed: false, warnings: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await submitCloudRequest({
      context: {},
      latestHistoryScope: { current: { mode: "session" } },
      provider: "openai",
      request: { action: "apu", payload: { description: "Concreto" } },
      requestHistoryScope: { mode: "session" },
      setError: () => {},
      setHistory: () => {},
      setLoading: () => {},
      setResult: () => {},
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.provider).toBe("openai");
    expect(capturedBody!.task).toBe("generate_apu");
  });

  it("includes projectId in body for project scope", async () => {
    const { submitCloudRequest } = await import("@/components/ai/controller-providers");

    let capturedBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return createApiResponse({ answer: "OK", model: "gpt-4", requestedModel: "gpt-4", fallbackUsed: false, warnings: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await submitCloudRequest({
      context: {},
      latestHistoryScope: { current: { mode: "project", projectId: "proj-1" } },
      provider: "openrouter",
      request: { action: "chat", payload: { message: "Hi" } },
      requestHistoryScope: { mode: "project", projectId: "proj-1" },
      setError: () => {},
      setHistory: () => {},
      setLoading: () => {},
      setResult: () => {},
    });

    expect(capturedBody!.projectId).toBe("proj-1");
  });

  it("handles fetch throwing an error gracefully", async () => {
    const { submitCloudRequest } = await import("@/components/ai/controller-providers");

    const fetchMock = vi.fn(() => Promise.reject(new Error("Network error")));
    vi.stubGlobal("fetch", fetchMock);

    await submitCloudRequest({
      context: {},
      latestHistoryScope: { current: { mode: "session" } },
      provider: "openai",
      request: { action: "chat", payload: { message: "Hi" } },
      requestHistoryScope: { mode: "session" },
      setError: (e: string) => { lastError = e; },
      setHistory: () => {},
      setLoading: (l: boolean) => { loading = l; },
      setResult: () => {},
    });

    expect(lastError).toBe("Network error");
    expect(loading).toBe(false);
  });
});
