import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  withAiRoute: vi.fn(),
  streamAgentChat: vi.fn(),
}));

vi.mock("@/lib/ai/route-handler", () => ({
  withAiRoute: mocks.withAiRoute,
}));

vi.mock("@/lib/ai/gateway/providers/agent-provider", () => ({
  streamAgentChat: mocks.streamAgentChat,
}));

import { prisma } from "@/lib/db/prisma";
import { POST } from "@/app/api/ai/agent/stream/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function authAs(userId = "user-1") {
  mocks.withAiRoute.mockImplementation(
    async (
      handler: (session: { user: { id: string } }) => Promise<Response>,
    ) => handler({ user: { id: userId } }),
  );
}

function unauthenticated() {
  mocks.withAiRoute.mockImplementation(async () => {
    return new Response(
      JSON.stringify({ error: "No autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  });
}

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/ai/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/** Helper: collect the full SSE body text from a Response. */
async function readSSEBody(response: Response): Promise<string> {
  return response.text();
}

/** Helper: parse SSE events from body text into { event, data } objects. */
function parseSSEEvents(body: string): { event: string; data: unknown }[] {
  const events: { event: string; data: unknown }[] = [];
  const frames = body.split("\n\n").filter(Boolean);
  for (const frame of frames) {
    const eventMatch = frame.match(/^event:\s*(\S+)/m);
    const dataMatch = frame.match(/^data:\s*(.+)/m);
    if (eventMatch && dataMatch) {
      events.push({
        event: eventMatch[1],
        data: JSON.parse(dataMatch[1]),
      });
    }
  }
  return events;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/ai/agent/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authAs();
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it("returns 401 when user is not authenticated", async () => {
    unauthenticated();
    const response = await post({ message: "Crear presupuesto" });
    expect(response.status).toBe(401);
  });

  // ── Validation ───────────────────────────────────────────────────────────

  it("returns 400 when message is missing", async () => {
    // zod throws on parse; withAiRoute wraps/catches it
    mocks.withAiRoute.mockImplementation(async () => {
      return new Response(
        JSON.stringify({ error: "Ingresa un objetivo para el agente." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    });

    const response = await POST(
      new Request("http://localhost/api/ai/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
  });

  // ── Headers ──────────────────────────────────────────────────────────────

  it("returns SSE content-type and streaming headers", async () => {
    mockStreamYield([makeFinal()]);

    const response = await post({ message: "Hola" });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toContain("no-cache");
    expect(response.headers.get("connection")).toBe("keep-alive");
  });

  // ── Preamble ─────────────────────────────────────────────────────────────

  it("sends SSE preamble before events", async () => {
    mockStreamYield([
      { type: "delta", text: "preamble test" },
      makeFinal(),
    ]);

    const response = await post({ message: "Hola" });
    const body = await readSSEBody(response);

    // Preamble should start with ": " (SSE comment line)
    expect(body.startsWith(": ")).toBe(true);
    // Preamble + delta + final
    expect(body).toContain('event: delta');
    expect(body).toContain('event: final');
  });

  // ── Delta events ─────────────────────────────────────────────────────────

  it("emits delta events from streamAgentChat", async () => {
    mockStreamYield([
      { type: "delta", text: "Hola, " },
      { type: "delta", text: "estoy analizando tu presupuesto." },
      makeFinal(),
    ]);

    const response = await post({ message: "Analiza presupuesto" });
    const events = parseSSEEvents(await readSSEBody(response));

    const deltas = events.filter((e) => e.event === "delta");
    expect(deltas).toHaveLength(2);
    expect((deltas[0].data as { text: string }).text).toBe("Hola, ");
    expect((deltas[1].data as { text: string }).text).toBe(
      "estoy analizando tu presupuesto.",
    );
  });

  // ── Tool start / result parsed from delta text ────────────────────────────

  it("parses tool_start from '🔧 Ejecutando <name>' delta text", async () => {
    mockStreamYield([
      { type: "delta", text: "🔧 Ejecutando searchPartidas...\n" },
      { type: "delta", text: "  ✓ Se encontraron 5 partidas coincidentes\n" },
      makeFinal(),
    ]);

    const response = await post({ message: "Buscar partidas" });
    const events = parseSSEEvents(await readSSEBody(response));

    const toolStarts = events.filter((e) => e.event === "tool_start");
    expect(toolStarts).toHaveLength(1);
    expect((toolStarts[0].data as { toolName: string }).toolName).toBe(
      "searchPartidas",
    );
  });

  it("parses tool_result from '  ✓/<summary>' delta text", async () => {
    mockStreamYield([
      { type: "delta", text: "🔧 Ejecutando calculateBudget...\n" },
      { type: "delta", text: "  ✓ Presupuesto total calculado: S/ 45,230\n" },
      makeFinal(),
    ]);

    const response = await post({ message: "Calcular presupuesto" });
    const events = parseSSEEvents(await readSSEBody(response));

    const toolResults = events.filter((e) => e.event === "tool_result");
    expect(toolResults).toHaveLength(1);
    const result = toolResults[0].data as {
      toolName: string;
      success: boolean;
      summary: string;
      latencyMs: number;
    };
    expect(result.toolName).toBe("calculateBudget");
    expect(result.success).toBe(true);
    expect(result.summary).toContain("Presupuesto total calculado");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("parses tool_result with failure (✗) correctly", async () => {
    mockStreamYield([
      { type: "delta", text: "🔧 Ejecutando deleteChapter...\n" },
      {
        type: "delta",
        text: "  ✗ Error: el capítulo no existe en la base de datos\n",
      },
      makeFinal(),
    ]);

    const response = await post({ message: "Eliminar capítulo" });
    const events = parseSSEEvents(await readSSEBody(response));

    const toolResults = events.filter((e) => e.event === "tool_result");
    expect(toolResults).toHaveLength(1);
    expect((toolResults[0].data as { success: boolean }).success).toBe(false);
    expect((toolResults[0].data as { summary: string }).summary).toContain(
      "Error",
    );
  });

  it("emits tool_start and tool_result for multiple tools in sequence", async () => {
    mockStreamYield([
      { type: "delta", text: "🔧 Ejecutando searchPartidas...\n" },
      { type: "delta", text: "  ✓ Encontré 3 partidas\n" },
      { type: "delta", text: "🔧 Ejecutando calculateBudget...\n" },
      {
        type: "delta",
        text: "  ✓ Presupuesto calculado correctamente\n",
      },
      makeFinal(),
    ]);

    const response = await post({ message: "Flujo completo" });
    const events = parseSSEEvents(await readSSEBody(response));

    const starts = events.filter((e) => e.event === "tool_start");
    const results = events.filter((e) => e.event === "tool_result");
    expect(starts).toHaveLength(2);
    expect(results).toHaveLength(2);
    expect((starts[0].data as { toolName: string }).toolName).toBe(
      "searchPartidas",
    );
    expect((starts[1].data as { toolName: string }).toolName).toBe(
      "calculateBudget",
    );
  });

  // ── Approval parsing ─────────────────────────────────────────────────────

  it("parses approval_required from 'Se requiere tu aprobación' delta text", async () => {
    mockStreamYield([
      { type: "delta", text: "🔧 Ejecutando deleteChapter...\n" },
      {
        type: "delta",
        text:
          '⚠️ **Se requiere tu aprobación** para ejecutar "deleteChapter":\n> Eliminar el capítulo 3 del presupuesto\n',
      },
      makeFinal(),
    ]);

    const response = await post({ message: "Eliminar capítulo" });
    const events = parseSSEEvents(await readSSEBody(response));

    const approvals = events.filter((e) => e.event === "approval_required");
    expect(approvals).toHaveLength(1);
    const approval = approvals[0].data as {
      toolName: string;
      reason: string;
    };
    expect(approval.toolName).toBe("deleteChapter");
    expect(approval.reason).toContain("Eliminar el capítulo 3");
  });

  // ── Final event ──────────────────────────────────────────────────────────

  it("emits final event with answer, warnings, and latencyMs", async () => {
    mockStreamYield([
      { type: "delta", text: "Reporte generado.\n" },
      makeFinal("Reporte exportado con éxito.", ["Advertencia: datos parciales"], 1250),
    ]);

    const response = await post({ message: "Exportar reporte" });
    const events = parseSSEEvents(await readSSEBody(response));

    const finals = events.filter((e) => e.event === "final");
    expect(finals).toHaveLength(1);
    const final = finals[0].data as {
      answer: string;
      warnings: string[];
      latencyMs: number;
    };
    expect(final.answer).toBe("Reporte exportado con éxito.");
    expect(final.warnings).toEqual(["Advertencia: datos parciales"]);
    expect(final.latencyMs).toBe(1250);
  });

  // ── Error handling ───────────────────────────────────────────────────────

  it("emits error event when streamAgentChat throws", async () => {
    mockStreamYieldError(new Error("OPENROUTER_API_KEY no configurado"));

    const response = await post({ message: "Hola" });
    const events = parseSSEEvents(await readSSEBody(response));

    const errors = events.filter((e) => e.event === "error");
    expect(errors).toHaveLength(1);
    expect((errors[0].data as { message: string }).message).toBe(
      "OPENROUTER_API_KEY no configurado",
    );
  });

  it("emits error event with generic message for non-Error throws", async () => {
    mockStreamYieldError("raw string error");

    const response = await post({ message: "Hola" });
    const events = parseSSEEvents(await readSSEBody(response));

    const errors = events.filter((e) => e.event === "error");
    expect(errors).toHaveLength(1);
    expect((errors[0].data as { message: string }).message).toBe(
      "Error inesperado del agente.",
    );
  });

  // ── Integration: full agent lifecycle ─────────────────────────────────────

  it("streams a complete agent lifecycle through all SSE event types", async () => {
    mockStreamYield([
      { type: "delta", text: "🔧 Ejecutando calculateBudget...\n" },
      {
        type: "delta",
        text: "  ✓ Presupuesto total calculado: S/ 95,400\n",
      },
      { type: "delta", text: "🔧 Ejecutando searchPartidas...\n" },
      {
        type: "delta",
        text: "  ✓ Se encontraron 12 partidas en el presupuesto\n",
      },
      { type: "delta", text: "\nEl presupuesto base contiene 12 partidas...\n" },
      makeFinal("Análisis completado correctamente.", [], 2340),
    ]);

    const response = await post({
      message: "Analizar presupuesto completo",
      projectId: "project-42",
    });
    const events = parseSSEEvents(await readSSEBody(response));

    // Verify all event types present
    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain("tool_start");
    expect(eventTypes).toContain("tool_result");
    expect(eventTypes).toContain("delta");
    expect(eventTypes).toContain("final");

    // Verify chronological order: preamble comment, tool_start, delta (tool_start text), tool_result, delta (tool_result text), etc., final
    // The first non-preamble frame should be the first delta (which also triggers tool_start)
    const nonPreambleEvents = events;
    expect(nonPreambleEvents[0].event).toBe("tool_start");
    expect(nonPreambleEvents[1].event).toBe("delta"); // "🔧 Ejecutando..."
    expect(nonPreambleEvents[2].event).toBe("tool_result");
    expect(nonPreambleEvents[3].event).toBe("delta"); // "  ✓ ..."
    // final should be last
    expect(nonPreambleEvents[nonPreambleEvents.length - 1].event).toBe("final");
  });

  it("passes message and projectId to streamAgentChat", async () => {
    mockStreamYield([makeFinal()]);

    await post({
      message: "Crear presupuesto para hospital",
      projectId: "project-99",
    });

    expect(mocks.streamAgentChat).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "review_budget",
        userId: "user-1",
        projectId: "project-99",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({
            role: "user",
            content: "Crear presupuesto para hospital",
          }),
        ]),
      }),
      undefined, // prebuiltModel ya no tiene parámetros de fallback
    );
  });

  // ── Project injection into system prompt ─────────────────────────────────

  it("injects projects into system prompt when workspaceId is provided", async () => {
    const mockProjects = [
      {
        id: "proj-santa",
        name: "Santa Monica",
        clientName: "Cliente Ejemplo",
        location: "Lima, Perú",
        status: "IN_PROGRESS",
        updatedAt: new Date("2025-06-01"),
      },
      {
        id: "proj-olivos",
        name: "Los Olivos",
        clientName: null,
        location: null,
        status: "PLANNING",
        updatedAt: new Date("2025-05-15"),
      },
    ];
    const projectSpy = vi.spyOn(prisma.project, "findMany").mockResolvedValue(mockProjects as any);
    mockStreamYield([makeFinal()]);

    await post({
      message: "Trabajar en proyecto Santa Monica",
      workspaceId: "ws-1",
    });

    const systemPrompt = mocks.streamAgentChat.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).toContain("--- PROYECTOS DISPONIBLES ---");
    expect(systemPrompt).toContain("Santa Monica");
    expect(systemPrompt).toContain("proj-santa");
    expect(systemPrompt).toContain("Los Olivos");
    expect(systemPrompt).toContain("proj-olivos");
    expect(systemPrompt).toContain("Cliente Ejemplo");
    expect(systemPrompt).toContain("Lima, Perú");

    projectSpy.mockRestore();
  });

  it("does not inject projects section when there are no projects", async () => {
    const projectSpy = vi.spyOn(prisma.project, "findMany").mockResolvedValue([]);
    mockStreamYield([makeFinal()]);

    await post({
      message: "Hola",
      workspaceId: "ws-1",
    });

    const systemPrompt = mocks.streamAgentChat.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).not.toContain("--- PROYECTOS DISPONIBLES ---");

    projectSpy.mockRestore();
  });

  it("does not inject projects when workspaceId is missing", async () => {
    mockStreamYield([makeFinal()]);

    await post({ message: "Hola" });

    const systemPrompt = mocks.streamAgentChat.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).not.toContain("--- PROYECTOS DISPONIBLES ---");
  });

});

// ── Mock helpers ───────────────────────────────────────────────────────────

function makeFinal(
  answer = "Ok.",
  warnings: string[] = [],
  latencyMs = 500,
) {
  return {
    type: "final" as const,
    result: {
      answer,
      model: "openai/gpt-4o",
      requestedModel: "openai/gpt-4o",
      fallbackUsed: false,
      warnings,
      latencyMs,
    },
  };
}

/** Mock streamAgentChat to yield events synchronously. */
function mockStreamYield(events: unknown[]) {
  mocks.streamAgentChat.mockImplementation(async function* () {
    for (const event of events) {
      yield event;
    }
  });
}

/** Mock streamAgentChat to throw an error. */
function mockStreamYieldError(error: unknown) {
  mocks.streamAgentChat.mockImplementation(async function* () {
    throw error;
  });
}
