/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readStoredHistory,
  persistStoredHistory,
  readStoredFeedback,
  persistStoredFeedback,
  isFeedbackType,
  createEmptyFeedbackSummary,
  summarizeFeedbackState,
  updateFeedbackSummary,
  readFeedbackEntryForResult,
  readFeedbackSummary,
  readFeedbackErrorMessage,
  loadProjectHistory,
  loadProjectFeedbackSummary,
  loadProjectLatestFeedback,
} from "@/components/ai/controller-history";
import type { AiHistoryEntry, AiResultWithHistory } from "@/components/ai/use-ai-assistant-controller";

function createResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function createValidHistoryEntry(overrides?: Partial<AiHistoryEntry>): AiHistoryEntry {
  return {
    id: "entry-1",
    action: "chat",
    summary: "Test entry",
    timestamp: "2026-06-01T00:00:00.000Z",
    context: { module: "Test" },
    result: {
      answer: "OK",
      model: "llama3",
      requestedModel: "llama3",
      fallbackUsed: false,
      warnings: [],
    },
    ...overrides,
  };
}

function createValidResult(overrides?: Partial<AiResultWithHistory>): AiResultWithHistory {
  return {
    answer: "Result",
    model: "llama3",
    requestedModel: "llama3",
    fallbackUsed: false,
    warnings: [],
    ...overrides,
  };
}

// ─── readStoredHistory ─────────────────────────────────────────

describe("readStoredHistory", () => {
  afterEach(() => {
    window.localStorage.removeItem("myc-ai-session-history");
  });

  it("returns empty array when nothing stored", () => {
    expect(readStoredHistory()).toEqual([]);
  });

  it("parses valid stored history entries", () => {
    const entries = [createValidHistoryEntry()];
    window.localStorage.setItem("myc-ai-session-history", JSON.stringify(entries));
    expect(readStoredHistory()).toHaveLength(1);
    expect(readStoredHistory()[0].id).toBe("entry-1");
  });

  it("returns empty for invalid JSON", () => {
    window.localStorage.setItem("myc-ai-session-history", "not-json");
    expect(readStoredHistory()).toEqual([]);
  });

  it("returns empty for non-array stored value", () => {
    window.localStorage.setItem("myc-ai-session-history", JSON.stringify({ not: "array" }));
    expect(readStoredHistory()).toEqual([]);
  });
});

// ─── persistStoredHistory ──────────────────────────────────────

describe("persistStoredHistory", () => {
  afterEach(() => {
    window.localStorage.removeItem("myc-ai-session-history");
  });

  it("stores history entries", () => {
    persistStoredHistory([createValidHistoryEntry()]);
    const stored = window.localStorage.getItem("myc-ai-session-history");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
  });

  it("caps at 8 entries", () => {
    const entries = Array.from({ length: 12 }, (_, i) => createValidHistoryEntry({ id: `entry-${i}` }));
    persistStoredHistory(entries);
    const stored = window.localStorage.getItem("myc-ai-session-history");
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(8);
    expect(parsed[0].id).toBe("entry-0");
  });
});

// ─── readStoredFeedback ─────────────────────────────────────────

describe("readStoredFeedback", () => {
  afterEach(() => {
    window.localStorage.removeItem("myc-ai-session-feedback");
  });

  it("returns empty object when nothing stored", () => {
    expect(readStoredFeedback()).toEqual({});
  });

  it("parses valid feedback entries", () => {
    window.localStorage.setItem("myc-ai-session-feedback", JSON.stringify({ "entry-a": "APPLIED", "entry-b": "EDITED" }));
    expect(readStoredFeedback()).toEqual({ "entry-a": "APPLIED", "entry-b": "EDITED" });
  });

  it("filters out invalid feedback types", () => {
    window.localStorage.setItem("myc-ai-session-feedback", JSON.stringify({ "entry-a": "APPLIED", "entry-b": "INVALID" }));
    const result = readStoredFeedback();
    expect(result["entry-a"]).toBe("APPLIED");
    expect(result["entry-b"]).toBeUndefined();
  });

  it("returns empty for invalid JSON", () => {
    window.localStorage.setItem("myc-ai-session-feedback", "garbage");
    expect(readStoredFeedback()).toEqual({});
  });
});

// ─── persistStoredFeedback ─────────────────────────────────────

describe("persistStoredFeedback", () => {
  afterEach(() => {
    window.localStorage.removeItem("myc-ai-session-feedback");
  });

  it("stores feedback state", () => {
    persistStoredFeedback({ "entry-1": "APPLIED" });
    expect(window.localStorage.getItem("myc-ai-session-feedback")).toBe(JSON.stringify({ "entry-1": "APPLIED" }));
  });

  it("stores empty feedback", () => {
    persistStoredFeedback({});
    expect(window.localStorage.getItem("myc-ai-session-feedback")).toBe("{}");
  });
});

// ─── isFeedbackType ─────────────────────────────────────────────

describe("isFeedbackType", () => {
  it.each(["APPLIED", "EDITED", "DISMISSED"] as const)("accepts %s", (type) => {
    expect(isFeedbackType(type)).toBe(true);
  });

  it("rejects invalid strings", () => {
    expect(isFeedbackType("UNKNOWN")).toBe(false);
    expect(isFeedbackType("")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isFeedbackType(42)).toBe(false);
    expect(isFeedbackType(null)).toBe(false);
  });
});

// ─── createEmptyFeedbackSummary ────────────────────────────────

describe("createEmptyFeedbackSummary", () => {
  it("returns all zeros", () => {
    expect(createEmptyFeedbackSummary()).toEqual({ applied: 0, edited: 0, dismissed: 0 });
  });
});

// ─── summarizeFeedbackState ─────────────────────────────────────

describe("summarizeFeedbackState", () => {
  it("counts feedback types", () => {
    const state = { a: "APPLIED" as const, b: "APPLIED" as const, c: "EDITED" as const, d: "DISMISSED" as const };
    expect(summarizeFeedbackState(state)).toEqual({ applied: 2, edited: 1, dismissed: 1 });
  });

  it("returns zeros for empty state", () => {
    expect(summarizeFeedbackState({})).toEqual({ applied: 0, edited: 0, dismissed: 0 });
  });
});

// ─── updateFeedbackSummary ─────────────────────────────────────

describe("updateFeedbackSummary", () => {
  it("adds a new feedback type", () => {
    const result = updateFeedbackSummary({ applied: 1, edited: 0, dismissed: 0 }, undefined, "EDITED");
    expect(result.applied).toBe(1);
    expect(result.edited).toBe(1);
  });

  it("replaces previous feedback (undo previous, apply next)", () => {
    // Previous: EDITED. Next: APPLIED.
    const result = updateFeedbackSummary({ applied: 0, edited: 1, dismissed: 0 }, "EDITED", "APPLIED");
    expect(result.applied).toBe(1);
    expect(result.edited).toBe(0);
  });

  it("removes feedback when next is undefined (undo only)", () => {
    const result = updateFeedbackSummary({ applied: 1, edited: 1, dismissed: 0 }, "APPLIED", undefined);
    expect(result.applied).toBe(0);
    expect(result.edited).toBe(1);
  });

  it("does not go below zero", () => {
    const result = updateFeedbackSummary({ applied: 0, edited: 0, dismissed: 0 }, "APPLIED", undefined);
    expect(result.applied).toBe(0);
  });

  it("preserves total when set", () => {
    const result = updateFeedbackSummary({ applied: 0, edited: 0, dismissed: 0, total: 10 }, undefined, "APPLIED");
    expect(result.total).toBe(10);
  });
});

// ─── readFeedbackEntryForResult ────────────────────────────────

describe("readFeedbackEntryForResult", () => {
  it("returns historyEntry from result directly", () => {
    const entry = createValidHistoryEntry();
    const result = createValidResult({ historyEntry: entry });
    expect(readFeedbackEntryForResult(result, [])).toBe(entry);
  });

  it("finds entry in history by result reference", () => {
    const entry = createValidHistoryEntry();
    expect(readFeedbackEntryForResult(createValidResult({ answer: entry.result.answer }), [entry])).toBeNull(); // not same reference
  });

  it("finds entry by same result reference", () => {
    const entry = createValidHistoryEntry();
    expect(readFeedbackEntryForResult(entry.result, [entry])).toBe(entry);
  });

  it("returns null when no match", () => {
    const result = createValidResult();
    expect(readFeedbackEntryForResult(result, [])).toBeNull();
  });
});

// ─── readFeedbackSummary ───────────────────────────────────────

describe("readFeedbackSummary", () => {
  it("reads full summary", () => {
    expect(readFeedbackSummary({ applied: 5, edited: 3, dismissed: 2, total: 10 }))
      .toEqual({ applied: 5, edited: 3, dismissed: 2, total: 10 });
  });

  it("defaults missing fields to zero", () => {
    expect(readFeedbackSummary({}))
      .toEqual({ applied: 0, edited: 0, dismissed: 0, total: undefined });
  });

  it("filters non-number fields", () => {
    expect(readFeedbackSummary({ applied: "5" }))
      .toEqual({ applied: 0, edited: 0, dismissed: 0, total: undefined });
  });
});

// ─── readFeedbackErrorMessage ──────────────────────────────────

describe("readFeedbackErrorMessage", () => {
  it("extracts error from payload", () => {
    expect(readFeedbackErrorMessage({ error: "Feedback failed" })).toBe("Feedback failed");
  });

  it("returns default for non-object", () => {
    expect(readFeedbackErrorMessage("raw")).toBe("No se pudo registrar la metrica de calidad.");
  });

  it("returns default when no error field", () => {
    expect(readFeedbackErrorMessage({ ok: true })).toBe("No se pudo registrar la metrica de calidad.");
  });
});

// ─── loadProjectHistory ────────────────────────────────────────

describe("loadProjectHistory", () => {
  it("loads and validates entries from API", async () => {
    const entry = createValidHistoryEntry();
    const fetchMock = vi.fn(() => createResponse({ entries: [entry] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadProjectHistory("proj-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("entry-1");
  });

  it("returns empty array when response is not ok", async () => {
    const fetchMock = vi.fn(() => createResponse({}, 500));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadProjectHistory("proj-1")).toEqual([]);
  });

  it("returns empty array when fetch throws", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("Offline")));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadProjectHistory("proj-1")).toEqual([]);
  });

  it("returns empty when payload has no entries array", async () => {
    const fetchMock = vi.fn(() => createResponse({ not_entries: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadProjectHistory("proj-1")).toEqual([]);
  });

  it("filters out invalid entries via readHistoryEntry", async () => {
    const valid = createValidHistoryEntry();
    const invalid = { id: "bad", action: "chat", summary: "Bad", timestamp: "2026", result: {} };
    const fetchMock = vi.fn(() => createResponse({ entries: [valid, invalid] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadProjectHistory("proj-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("entry-1");
  });

  it("returns empty when all entries are invalid", async () => {
    const fetchMock = vi.fn(() => createResponse({ entries: [{ id: "bad", result: {} }] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadProjectHistory("proj-1")).toEqual([]);
  });

  it("calls correct URL with project ID", async () => {
    const fetchMock = vi.fn(() => createResponse({ entries: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await loadProjectHistory("proj-xyz");
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/proj-xyz/ai-history");
  });
});

// ─── loadProjectFeedbackSummary ────────────────────────────────

describe("loadProjectFeedbackSummary", () => {
  it("returns summary on success", async () => {
    const fetchMock = vi.fn(() => createResponse({ summary: { applied: 3, edited: 1, dismissed: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadProjectFeedbackSummary("proj-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.applied).toBe(3);
    }
  });

  it("returns ok:false on non-ok response", async () => {
    const fetchMock = vi.fn(() => createResponse({}, 500));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadProjectFeedbackSummary("proj-1")).toEqual({ ok: false });
  });

  it("returns ok:false when payload has no summary", async () => {
    const fetchMock = vi.fn(() => createResponse({ not_summary: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadProjectFeedbackSummary("proj-1")).toEqual({ ok: false });
  });

  it("returns ok:false on fetch throw", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("Offline")));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadProjectFeedbackSummary("proj-1")).toEqual({ ok: false });
  });
});

// ─── loadProjectLatestFeedback ─────────────────────────────────

describe("loadProjectLatestFeedback", () => {
  it("returns empty for empty entry IDs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadProjectLatestFeedback("proj-1", [])).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads and validates feedback from API", async () => {
    const fetchMock = vi.fn(() => createResponse({
      feedbackByHistoryId: { "entry-a": "APPLIED", "entry-b": "EDITED" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadProjectLatestFeedback("proj-1", ["entry-a", "entry-b"]);
    expect(result).toEqual({ "entry-a": "APPLIED", "entry-b": "EDITED" });
  });

  it("filters invalid feedback types", async () => {
    const fetchMock = vi.fn(() => createResponse({
      feedbackByHistoryId: { "entry-a": "APPLIED", "entry-b": "INVALID" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadProjectLatestFeedback("proj-1", ["entry-a", "entry-b"]);
    expect(result["entry-a"]).toBe("APPLIED");
    expect(result["entry-b"]).toBeUndefined();
  });

  it("returns empty on non-ok response", async () => {
    const fetchMock = vi.fn(() => createResponse({}, 500));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadProjectLatestFeedback("proj-1", ["entry-a"])).toEqual({});
  });

  it("returns empty on fetch throw", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("Offline")));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadProjectLatestFeedback("proj-1", ["entry-a"])).toEqual({});
  });

  it("returns empty when payload has no feedbackByHistoryId", async () => {
    const fetchMock = vi.fn(() => createResponse({ not_feedback: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadProjectLatestFeedback("proj-1", ["entry-a"])).toEqual({});
  });

  it("builds correct query string with multiple IDs", async () => {
    const fetchMock = vi.fn(() => createResponse({ feedbackByHistoryId: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await loadProjectLatestFeedback("proj-1", ["id-1", "id-2"]);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/api/projects/proj-1/ai-feedback/latest");
    expect(url).toContain("historyEntryId=id-1");
    expect(url).toContain("historyEntryId=id-2");
  });
});
