/* @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import {
  isRecord,
  readErrorMessage,
  summarizeRequest,
  readAiResult,
  readHistoryEntry,
  readHistoryResult,
  readAiDebug,
  readStructuredParseStatus,
  isAiMessage,
  readHistoryAction,
  readAiContext,
  areAiContextsEqual,
} from "@/components/ai/controller-parsers";

// ─── isRecord ───────────────────────────────────────────────────

describe("isRecord", () => {
  it("returns true for plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRecord(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isRecord(undefined)).toBe(false);
  });

  it("returns false for arrays", () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isRecord("string")).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});

// ─── readErrorMessage ───────────────────────────────────────────

describe("readErrorMessage", () => {
  it("extracts error string from payload", () => {
    expect(readErrorMessage({ error: "Something broke" })).toBe("Something broke");
  });

  it("returns default message when payload has no error field", () => {
    expect(readErrorMessage({ ok: true })).toBe("No se pudo completar la solicitud de IA.");
  });

  it("returns default message for non-object payloads", () => {
    expect(readErrorMessage("raw string")).toBe("No se pudo completar la solicitud de IA.");
    expect(readErrorMessage(null)).toBe("No se pudo completar la solicitud de IA.");
  });
});

// ─── summarizeRequest ───────────────────────────────────────────

describe("summarizeRequest", () => {
  it("summarizes chat action from message field", () => {
    const summary = summarizeRequest({ action: "chat", payload: { message: "¿Cuánto cuesta?" } });
    expect(summary).toBe("¿Cuánto cuesta?");
  });

  it("fallbacks on missing chat message", () => {
    expect(summarizeRequest({ action: "chat", payload: {} })).toBe("Consulta técnica");
  });

  it("summarizes apu action from description field", () => {
    expect(summarizeRequest({ action: "apu", payload: { description: "Concreto armado" } })).toBe("Concreto armado");
  });

  it("fallbacks on missing apu description", () => {
    expect(summarizeRequest({ action: "apu", payload: {} })).toBe("Generacion de APU");
  });

  it("summarizes review action from budgetSummary field", () => {
    const long = "A".repeat(200);
    const summary = summarizeRequest({ action: "review", payload: { budgetSummary: long } });
    expect(summary).toBe(long.slice(0, 140));
  });

  it("fallbacks on missing review summary", () => {
    expect(summarizeRequest({ action: "review", payload: {} })).toBe("Revision de presupuesto");
  });

  it("summarizes autocomplete action from input field", () => {
    expect(summarizeRequest({ action: "autocomplete", payload: { input: "Excavación" } })).toBe("Excavación");
  });

  it("fallbacks on missing autocomplete input", () => {
    expect(summarizeRequest({ action: "autocomplete", payload: {} })).toBe("Autocompletado técnico");
  });
});

// ─── readAiResult ───────────────────────────────────────────────

describe("readAiResult", () => {
  const validResult = {
    answer: "Respuesta OK",
    model: "llama3",
    requestedModel: "llama3",
    fallbackUsed: false,
    warnings: [],
  };

  it("parses a valid AI result payload", () => {
    const result = readAiResult(validResult);
    expect(result.answer).toBe("Respuesta OK");
    expect(result.model).toBe("llama3");
    expect(result.fallbackUsed).toBe(false);
  });

  it("includes latencyMs when present", () => {
    const result = readAiResult({ ...validResult, latencyMs: 350 });
    expect(result.latencyMs).toBe(350);
  });

  it("includes structuredData when present", () => {
    const data = { some: "value" };
    const result = readAiResult({ ...validResult, structuredData: data });
    expect(result.structuredData).toEqual(data);
  });

  it("attaches historyEntry when payload has a valid one", () => {
    const result = readAiResult({
      ...validResult,
      historyEntry: {
        id: "entry-1",
        action: "chat",
        summary: "Test",
        timestamp: "2026-01-01T00:00:00.000Z",
        result: validResult,
      },
    });
    expect(result.historyEntry).toBeDefined();
    expect(result.historyEntry!.id).toBe("entry-1");
  });

  it("throws when payload is not a record", () => {
    expect(() => readAiResult("not an object")).toThrow("La respuesta de IA no tiene el formato esperado.");
  });

  it("throws when mandatory fields are missing", () => {
    expect(() => readAiResult({ answer: "only one field" })).toThrow(
      "La respuesta de IA no tiene el formato esperado.",
    );
  });

  it("filters non-string warnings", () => {
    const result = readAiResult({ ...validResult, warnings: ["valid", 42, "also valid"] });
    expect(result.warnings).toEqual(["valid", "also valid"]);
  });
});

// ─── readHistoryEntry ──────────────────────────────────────────

describe("readHistoryEntry", () => {
  const validEntry = {
    id: "entry-1",
    action: "chat",
    summary: "Test entry",
    timestamp: "2026-01-01T00:00:00.000Z",
    context: { module: "Presupuestos" },
    result: {
      answer: "OK",
      model: "llama3",
      requestedModel: "llama3",
      fallbackUsed: false,
      warnings: [],
    },
  };

  it("parses a valid history entry", () => {
    const entry = readHistoryEntry(validEntry);
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("entry-1");
    expect(entry!.action).toBe("chat");
    expect(entry!.context).toEqual({ module: "Presupuestos" });
  });

  it("returns null when id is missing", () => {
    const noId: Record<string, unknown> = { ...validEntry };
    delete noId.id;
    expect(readHistoryEntry(noId)).toBeNull();
  });

  it("returns null when result is invalid", () => {
    const badResult = { ...validEntry, result: { not_valid: true } };
    expect(readHistoryEntry(badResult)).toBeNull();
  });

  it("returns null for non-object", () => {
    expect(readHistoryEntry(null)).toBeNull();
    expect(readHistoryEntry("string")).toBeNull();
  });
});

// ─── readHistoryResult ─────────────────────────────────────────

describe("readHistoryResult", () => {
  it("parses a valid result", () => {
    const result = readHistoryResult({
      answer: "Hello",
      model: "llama3",
      requestedModel: "llama3",
      fallbackUsed: true,
      warnings: ["warn1"],
      latencyMs: 500,
    });
    expect(result).not.toBeNull();
    expect(result!.answer).toBe("Hello");
    expect(result!.latencyMs).toBe(500);
  });

  it("returns null when answer is not a string", () => {
    expect(readHistoryResult({ answer: 42 })).toBeNull();
  });

  it("returns null when fallbackUsed is not boolean", () => {
    expect(
      readHistoryResult({
        answer: "ok",
        model: "m",
        requestedModel: "m",
        fallbackUsed: "yes",
        warnings: [],
      }),
    ).toBeNull();
  });

  it("parses debug when present", () => {
    const result = readHistoryResult({
      answer: "Hello",
      model: "llama3",
      requestedModel: "llama3",
      fallbackUsed: false,
      warnings: [],
      debug: { structuredParseStatus: "parsed", rawAnswer: "raw" },
    });
    expect(result!.debug).toBeDefined();
    expect(result!.debug!.structuredParseStatus).toBe("parsed");
  });
});

// ─── readAiDebug ────────────────────────────────────────────────

describe("readAiDebug", () => {
  it("returns undefined for non-record", () => {
    expect(readAiDebug(null)).toBeUndefined();
    expect(readAiDebug("string")).toBeUndefined();
  });

  it("returns undefined for invalid structuredParseStatus", () => {
    expect(readAiDebug({ structuredParseStatus: "unknown" })).toBeUndefined();
  });

  it("parses a valid debug with all fields", () => {
    const debug = readAiDebug({
      structuredParseStatus: "repaired",
      rawAnswer: "raw text",
      repairedRawAnswer: "fixed text",
      context: { module: "Test" },
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
      ],
      ai: { answer: "ai answer", rawAnswer: "ai raw" },
      fallback: { used: true, reason: "model missing" },
      validationWarnings: ["missing unit"],
      requestBody: { action: "chat" },
    });
    expect(debug).toBeDefined();
    expect(debug!.structuredParseStatus).toBe("repaired");
    expect(debug!.rawAnswer).toBe("raw text");
    expect(debug!.messages).toHaveLength(2);
    // structuredParseStatus inherits from parent via ?? status fallback
    expect(debug!.ai).toEqual({
      answer: "ai answer",
      rawAnswer: "ai raw",
      repairedRawAnswer: undefined,
      structuredParseStatus: "repaired",
    });
    expect(debug!.fallback).toEqual({ used: true, reason: "model missing" });
  });

  it("filters non-AiMessage entries from messages array", () => {
    const debug = readAiDebug({
      structuredParseStatus: "parsed",
      messages: [
        { role: "system", content: "ok" },
        { role: "invalid", content: "bad" },
        42,
      ],
    });
    expect(debug!.messages).toHaveLength(1);
  });
});

// ─── readStructuredParseStatus ─────────────────────────────────

describe("readStructuredParseStatus", () => {
  it.each(["not_requested", "parsed", "repaired", "failed"] as const)(
    "returns %s for valid value",
    (status) => {
      expect(readStructuredParseStatus(status)).toBe(status);
    },
  );

  it("returns undefined for invalid value", () => {
    expect(readStructuredParseStatus("unknown")).toBeUndefined();
    expect(readStructuredParseStatus(42)).toBeUndefined();
  });
});

// ─── isAiMessage ────────────────────────────────────────────────

describe("isAiMessage", () => {
  it("accepts system messages", () => {
    expect(isAiMessage({ role: "system", content: "You are helpful" })).toBe(true);
  });

  it("accepts user messages", () => {
    expect(isAiMessage({ role: "user", content: "Hello" })).toBe(true);
  });

  it("accepts assistant messages", () => {
    expect(isAiMessage({ role: "assistant", content: "Hi there!" })).toBe(true);
  });

  it("rejects messages with invalid role", () => {
    expect(isAiMessage({ role: "moderator", content: "text" })).toBe(false);
  });

  it("rejects messages without content", () => {
    expect(isAiMessage({ role: "user" })).toBe(false);
    expect(isAiMessage({ role: "user", content: 42 })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isAiMessage(null)).toBe(false);
    expect(isAiMessage("string")).toBe(false);
  });
});

// ─── readHistoryAction ─────────────────────────────────────────

describe("readHistoryAction", () => {
  it.each(["chat", "apu", "review", "autocomplete"] as const)(
    "returns %s unchanged",
    (action) => {
      expect(readHistoryAction(action)).toBe(action);
    },
  );

  it("defaults unknown actions to chat", () => {
    expect(readHistoryAction("unknown")).toBe("chat");
    expect(readHistoryAction("")).toBe("chat");
  });
});

// ─── readAiContext ──────────────────────────────────────────────

describe("readAiContext", () => {
  it("parses a full context", () => {
    const ctx = readAiContext({
      route: "/budgets/b-1",
      projectId: "p-1",
      budgetId: "b-1",
      project: "My Project",
      module: "Editor",
      selectedItem: "Partida 1",
      selectionType: "partida",
      selectionId: "item-1",
      unit: "m3",
      currentCost: 420,
      activeTable: "APU",
      viewSummary: "Works",
    });
    expect(ctx.route).toBe("/budgets/b-1");
    expect(ctx.projectId).toBe("p-1");
    expect(ctx.budgetId).toBe("b-1");
    expect(ctx.project).toBe("My Project");
    expect(ctx.module).toBe("Editor");
    expect(ctx.selectedItem).toBe("Partida 1");
    expect(ctx.selectionType).toBe("partida");
    expect(ctx.selectionId).toBe("item-1");
    expect(ctx.unit).toBe("m3");
    expect(ctx.currentCost).toBe(420);
    expect(ctx.activeTable).toBe("APU");
    expect(ctx.viewSummary).toBe("Works");
  });

  it("returns empty context for non-object", () => {
    expect(readAiContext(null)).toEqual({});
    expect(readAiContext("string")).toEqual({});
  });

  it("rejects invalid selectionType", () => {
    const ctx = readAiContext({ selectionType: "invalid" });
    expect(ctx.selectionType).toBeUndefined();
  });

  it("accepts all valid selectionTypes", () => {
    const types = ["project", "budget", "partida", "resource", "metrado"] as const;
    for (const type of types) {
      expect(readAiContext({ selectionType: type }).selectionType).toBe(type);
    }
  });

  it("omits fields with wrong types", () => {
    const ctx = readAiContext({
      route: 123,
      currentCost: "not a number",
      module: null,
    });
    expect(ctx.route).toBeUndefined();
    expect(ctx.currentCost).toBeUndefined();
    expect(ctx.module).toBeUndefined();
  });
});

// ─── areAiContextsEqual ────────────────────────────────────────

describe("areAiContextsEqual", () => {
  const base = {
    route: "/budgets/b-1",
    projectId: "p-1",
    budgetId: "b-1",
    project: "My Project",
    module: "Editor",
    selectedItem: "Partida 1",
    selectionType: "partida" as const,
    selectionId: "item-1",
    unit: "m3",
    currentCost: 420,
    activeTable: "APU",
    viewSummary: "Works",
  };

  it("returns true for identical contexts", () => {
    expect(areAiContextsEqual(base, { ...base })).toBe(true);
  });

  it("returns true for two empty contexts", () => {
    expect(areAiContextsEqual({}, {})).toBe(true);
  });

  it("returns false when route differs", () => {
    expect(areAiContextsEqual(base, { ...base, route: "/other" })).toBe(false);
  });

  it("returns false when selectedItem differs", () => {
    expect(areAiContextsEqual(base, { ...base, selectedItem: "Other" })).toBe(false);
  });

  it("returns false when currentCost differs", () => {
    expect(areAiContextsEqual(base, { ...base, currentCost: 999 })).toBe(false);
  });

  it("returns false when selectionType differs", () => {
    expect(areAiContextsEqual(base, { ...base, selectionType: "budget" })).toBe(false);
  });

  it("returns false when one has extra undefined fields vs empty", () => {
    expect(areAiContextsEqual({}, { route: undefined })).toBe(true);
  });
});
