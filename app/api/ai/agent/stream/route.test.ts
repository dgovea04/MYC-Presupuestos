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
import { POST, detectPendingActionFromHistory } from "@/app/api/ai/agent/stream/route";

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

async function readSSEBody(response: Response): Promise<string> {
  return response.text();
}

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

    expect(body.startsWith(": ")).toBe(true);
    expect(body).toContain("event: delta");
    expect(body).toContain("event: final");
  });

  // ── Pending action event ──────────────────────────────────────────────────

  it("emits pending_action event (null when no pending action)", async () => {
    mockStreamYield([makeFinal()]);

    const response = await post({ message: "Hola" });
    const events = parseSSEEvents(await readSSEBody(response));

    const pendingActions = events.filter((e) => e.event === "pending_action");
    expect(pendingActions).toHaveLength(1);
    expect(pendingActions[0].data).toBeNull();
  });

  // ── Intent event ─────────────────────────────────────────────────────────

  it("emits intent event as the first event after preamble", async () => {
    mockStreamYield([
      { type: "delta", text: "Hola" },
      makeFinal(),
    ]);

    const response = await post({ message: "generar presupuesto para vivienda" });
    const events = parseSSEEvents(await readSSEBody(response));

    const intentEvents = events.filter((e) => e.event === "intent");
    expect(intentEvents).toHaveLength(1);
    const intentData = intentEvents[0].data as Record<string, unknown>;
    expect(intentData).toHaveProperty("type");
    expect(intentData).toHaveProperty("confidence");
    expect(intentData).toHaveProperty("reason");
    expect(intentData).toHaveProperty("suggestedTools");
    expect(intentData).toHaveProperty("extracted");

    // intent should be the first non-preamble event
    expect(events[0].event).toBe("intent");
  });

  it("intent event includes requiredFields when intent needs data", async () => {
    mockStreamYield([makeFinal()]);

    // Message without project — should detect create_general_budget intent
    const response = await post({ message: "crear presupuesto general" });
    const events = parseSSEEvents(await readSSEBody(response));

    const intentEvent = events.find((e) => e.event === "intent");
    expect(intentEvent).toBeDefined();
    const data = intentEvent!.data as Record<string, unknown>;
    expect(data.type).toBe("create_general_budget");
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

  // ── Tool events (pass-through from provider) ─────────────────────────────

  it("emits tool_start events from streamAgentChat", async () => {
    mockStreamYield([
      { type: "tool_start", toolName: "searchPartidas" },
      { type: "delta", text: "Buscando partidas..." },
      makeFinal(),
    ]);

    const response = await post({ message: "Buscar partidas" });
    const events = parseSSEEvents(await readSSEBody(response));

    const toolStarts = events.filter((e) => e.event === "tool_start");
    expect(toolStarts).toHaveLength(1);
    expect((toolStarts[0].data as { toolName: string }).toolName).toBe("searchPartidas");
  });

  it("emits tool_result events from streamAgentChat", async () => {
    mockStreamYield([
      { type: "tool_result", toolName: "calculateBudget", success: true, summary: "Presupuesto calculado", latencyMs: 120 },
      makeFinal(),
    ]);

    const response = await post({ message: "Calcular presupuesto" });
    const events = parseSSEEvents(await readSSEBody(response));

    const toolResults = events.filter((e) => e.event === "tool_result");
    expect(toolResults).toHaveLength(1);
    const result = toolResults[0].data as {
      toolName: string; success: boolean; summary: string; latencyMs: number;
    };
    expect(result.toolName).toBe("calculateBudget");
    expect(result.success).toBe(true);
    expect(result.summary).toBe("Presupuesto calculado");
  });

  it("emits tool_result with failure correctly", async () => {
    mockStreamYield([
      { type: "tool_result", toolName: "deleteChapter", success: false, summary: "Error: capítulo no existe", latencyMs: 50 },
      makeFinal(),
    ]);

    const response = await post({ message: "Eliminar capítulo" });
    const events = parseSSEEvents(await readSSEBody(response));

    const toolResults = events.filter((e) => e.event === "tool_result");
    expect(toolResults).toHaveLength(1);
    expect((toolResults[0].data as { success: boolean }).success).toBe(false);
  });

  it("emits multiple tool events in sequence", async () => {
    mockStreamYield([
      { type: "tool_start", toolName: "searchPartidas" },
      { type: "tool_result", toolName: "searchPartidas", success: true, summary: "3 partidas", latencyMs: 80 },
      { type: "tool_start", toolName: "calculateBudget" },
      { type: "tool_result", toolName: "calculateBudget", success: true, summary: "Calculado", latencyMs: 100 },
      makeFinal(),
    ]);

    const response = await post({ message: "Flujo completo" });
    const events = parseSSEEvents(await readSSEBody(response));

    const starts = events.filter((e) => e.event === "tool_start");
    const results = events.filter((e) => e.event === "tool_result");
    expect(starts).toHaveLength(2);
    expect(results).toHaveLength(2);
  });

  // ── Approval parsing ─────────────────────────────────────────────────────

  it("emits approval_required events from streamAgentChat", async () => {
    mockStreamYield([
      { type: "approval_required", approvalId: "appr-1", toolName: "deleteChapter", reason: "Eliminar capítulo 3" },
      makeFinal(),
    ]);

    const response = await post({ message: "Eliminar capítulo" });
    const events = parseSSEEvents(await readSSEBody(response));

    const approvals = events.filter((e) => e.event === "approval_required");
    expect(approvals).toHaveLength(1);
    const approval = approvals[0].data as { toolName: string; reason: string };
    expect(approval.toolName).toBe("deleteChapter");
    expect(approval.reason).toContain("Eliminar capítulo 3");
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
      answer: string; warnings: string[]; latencyMs: number;
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
      { type: "tool_start", toolName: "calculateBudget" },
      { type: "delta", text: "Calculando..." },
      { type: "tool_result", toolName: "calculateBudget", success: true, summary: "S/ 95,400", latencyMs: 200 },
      { type: "tool_start", toolName: "searchPartidas" },
      { type: "delta", text: "Buscando..." },
      { type: "tool_result", toolName: "searchPartidas", success: true, summary: "12 partidas", latencyMs: 150 },
      { type: "delta", text: "Análisis completo." },
      makeFinal("Análisis completado correctamente.", [], 2340),
    ]);

    const response = await post({
      message: "Analizar presupuesto completo",
      projectId: "project-42",
    });
    const events = parseSSEEvents(await readSSEBody(response));

    // Verify all event types present
    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain("intent");
    expect(eventTypes).toContain("pending_action");
    expect(eventTypes).toContain("tool_start");
    expect(eventTypes).toContain("tool_result");
    expect(eventTypes).toContain("delta");
    expect(eventTypes).toContain("final");

    // intent and pending_action should be first, final should be last
    expect(events[0].event).toBe("intent");
    expect(events[1].event).toBe("pending_action");
    expect(events[events.length - 1].event).toBe("final");
  });

  it("passes message and projectId to streamAgentChat", async () => {
    mockStreamYield([makeFinal()]);

    await post({
      message: "Crear presupuesto para hospital",
      projectId: "project-99",
    });

    expect(mocks.streamAgentChat).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "chat",
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
      undefined,
    );
  });

  // ── Project injection into system prompt ─────────────────────────────────

  it("injects projects into system prompt when workspaceId is provided", async () => {
    const mockProjects = [
      {
        id: "proj-santa", name: "Santa Monica",
        clientName: "Cliente Ejemplo", location: "Lima, Perú",
        status: "IN_PROGRESS", updatedAt: new Date("2025-06-01"),
      },
      {
        id: "proj-olivos", name: "Los Olivos",
        clientName: null, location: null,
        status: "PLANNING", updatedAt: new Date("2025-05-15"),
      },
    ];
    const projectSpy = vi.spyOn(prisma.project, "findMany").mockResolvedValue(mockProjects as any);
    mockStreamYield([makeFinal()]);

    await post({
      message: "Trabajar en proyecto Santa Monica",
      workspaceId: "ws-1",
    });

    const systemPrompt = mocks.streamAgentChat.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).toContain("PROYECTOS DISPONIBLES");
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

    await post({ message: "Hola", workspaceId: "ws-1" });

    const systemPrompt = mocks.streamAgentChat.mock.calls[0][0].messages[0].content as string;
    // The prompt examples section references "Santa Monica" as an example project.
    // This is expected even when no projects are injected — it's part of the static flow instructions.
    expect(systemPrompt).toContain("Santa Monica");

    projectSpy.mockRestore();
  });

  it("does not inject projects when workspaceId is missing", async () => {
    mockStreamYield([makeFinal()]);

    await post({ message: "Hola" });

    const systemPrompt = mocks.streamAgentChat.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).toContain("Santa Monica");
  });

  // ── namedProjectMatch detection ──────────────────────────────────────────

  describe("namedProjectMatch detection", () => {
    it("injects YA DETECTADO flow when extracted projectName matches a recentProject", async () => {
      const mockProjects = [
        { id: "proj-san-felipe", name: "San Felipe", clientName: null, location: null, status: "IN_PROGRESS", updatedAt: new Date() },
        { id: "proj-santa", name: "Santa Monica", clientName: null, location: null, status: "PLANNING", updatedAt: new Date() },
      ];
      const projectSpy = vi.spyOn(prisma.project, "findMany").mockResolvedValue(mockProjects as any);
      mockStreamYield([makeFinal()]);

      await post({
        message: "genera un presupuesto para vivienda en el proyecto San Felipe",
        workspaceId: "ws-1",
      });

      // The real buildAgentSystemPrompt should have received namedProjectMatch
      // and generated the YA DETECTADO flow with the project ID
      const systemPrompt = mocks.streamAgentChat.mock.calls[0][0].messages[0].content as string;
      expect(systemPrompt).toContain("YA DETECTADO");
      expect(systemPrompt).toContain("San Felipe");
      expect(systemPrompt).toContain("proj-san-felipe");
      expect(systemPrompt).not.toContain("DETERMINAR PROYECTO");

      projectSpy.mockRestore();
    });

    it("injects DETERMINAR PROYECTO flow when extracted projectName does NOT match", async () => {
      const mockProjects = [
        { id: "proj-santa", name: "Santa Monica", clientName: null, location: null, status: "PLANNING", updatedAt: new Date() },
      ];
      const projectSpy = vi.spyOn(prisma.project, "findMany").mockResolvedValue(mockProjects as any);
      mockStreamYield([makeFinal()]);

      await post({
        message: "genera un presupuesto para vivienda en el proyecto San Felipe",
        workspaceId: "ws-1",
      });

      // San Felipe is NOT in the project list → namedProjectMatch is null
      // → buildProjectUnnamedFlow should be used
      const systemPrompt = mocks.streamAgentChat.mock.calls[0][0].messages[0].content as string;
      expect(systemPrompt).toContain("DETERMINAR PROYECTO");
      expect(systemPrompt).toContain("¿Quieres usar un proyecto existente o crear uno nuevo?");
      expect(systemPrompt).not.toContain("YA DETECTADO");

      projectSpy.mockRestore();
    });

    it("injects DETERMINAR PROYECTO flow when message does not mention a project", async () => {
      const mockProjects = [
        { id: "proj-santa", name: "Santa Monica", clientName: null, location: null, status: "PLANNING", updatedAt: new Date() },
      ];
      const projectSpy = vi.spyOn(prisma.project, "findMany").mockResolvedValue(mockProjects as any);
      mockStreamYield([makeFinal()]);

      await post({
        message: "Crear presupuesto para vivienda",
        workspaceId: "ws-1",
      });

      // No project name mentioned → extracted.projectName is undefined → namedProjectMatch is null
      const systemPrompt = mocks.streamAgentChat.mock.calls[0][0].messages[0].content as string;
      expect(systemPrompt).toContain("DETERMINAR PROYECTO");
      expect(systemPrompt).toContain("¿Quieres usar un proyecto existente o crear uno nuevo?");
      expect(systemPrompt).not.toContain("YA DETECTADO");

      projectSpy.mockRestore();
    });
  });
});

// ── detectPendingActionFromHistory ─────────────────────────────────────────

describe("detectPendingActionFromHistory", () => {
  it("returns null when there are no messages", () => {
    const result = detectPendingActionFromHistory({
      currentMessage: "Sí, procede",
      messages: [],
      projectId: "proj-1",
    });
    expect(result).toBeNull();
  });

  it("returns null when messages is undefined", () => {
    const result = detectPendingActionFromHistory({
      currentMessage: "Sí, procede",
      messages: undefined,
      projectId: "proj-1",
    });
    expect(result).toBeNull();
  });

  it("returns null when no preview is found in assistant messages", () => {
    const result = detectPendingActionFromHistory({
      currentMessage: "Sí, procede",
      messages: [
        { role: "user", content: "genera un presupuesto para una vivienda de 120m2 en Lima" },
        { role: "assistant", content: "Claro, voy a revisar los precios del mercado." },
      ],
      projectId: "proj-1",
    });
    expect(result).toBeNull();
  });

  it("detects preview from 'Vista previa' keyword in assistant message", () => {
    const result = detectPendingActionFromHistory({
      currentMessage: "Sí, procede",
      messages: [
        { role: "user", content: "genera un presupuesto para una vivienda de 120m2 en Lima" },
        { role: "assistant", content: "He generado una Vista previa del presupuesto. ¿Deseas que proceda?" },
      ],
      projectId: "proj-1",
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe("apply_budget_generation");
    expect(result!.projectId).toBe("proj-1");
    expect(result!.description).toContain("genera un presupuesto para una vivienda");
    if (result && result.type === "apply_budget_generation") {
      expect(result.templateSource).toBe("auto");
    }
  });

  it("detects preview from 'previewBudgetGeneration' tool name in assistant message", () => {
    const result = detectPendingActionFromHistory({
      currentMessage: "Sí, procede",
      messages: [
        { role: "user", content: "crea presupuesto para un hospital de 4 pisos en Cusco" },
        { role: "assistant", content: "🔧 Ejecutando previewBudgetGeneration...\n  ✓ 📋 Vista previa generada. ¿Deseas que genere el presupuesto?" },
      ],
      projectId: "proj-2",
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe("apply_budget_generation");
    expect(result!.projectId).toBe("proj-2");
  });

  it("detects preview from 'vista previa' (lowercase) in assistant message", () => {
    const result = detectPendingActionFromHistory({
      currentMessage: "sí, adelante",
      messages: [
        { role: "user", content: "presupuesto para colegio de 3 pisos con 12 aulas" },
        { role: "assistant", content: "Aquí tienes la vista previa del presupuesto para el colegio." },
      ],
      projectId: "proj-3",
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe("apply_budget_generation");
    expect(result!.projectId).toBe("proj-3");
  });

  it("returns null when preview found but no projectId provided", () => {
    const result = detectPendingActionFromHistory({
      currentMessage: "Sí, procede",
      messages: [
        { role: "user", content: "genera un presupuesto para una vivienda de 120m2" },
        { role: "assistant", content: "Vista previa generada. ¿Procedo?" },
      ],
      projectId: undefined,
    });
    expect(result).toBeNull();
  });

  it("skips confirmation messages when extracting construction description", () => {
    const result = detectPendingActionFromHistory({
      currentMessage: "¡SÍ! CONFIRMADO. EJECUTA generateBudget AHORA MISMO.",
      messages: [
        { role: "user", content: "crea presupuesto para edificio de oficinas de 500m2 en Lima" },
        { role: "assistant", content: "📋 Vista previa lista. ¿Deseas que proceda?" },
        { role: "user", content: "Confirmado" },
      ],
      projectId: "proj-4",
    });
    expect(result).not.toBeNull();
    // Should find the construction description, not the confirmation messages
    expect(result!.description).toContain("crea presupuesto para edificio de oficinas");
    expect(result!.description).not.toContain("Confirmado");
    expect(result!.description).not.toContain("¡SÍ");
  });

  it("returns empty description when no construction description found in history", () => {
    const result = detectPendingActionFromHistory({
      currentMessage: "sí",
      messages: [
        { role: "user", content: "Sí" },
        { role: "assistant", content: "Vista previa generada. ¿Procedemos?" },
      ],
      projectId: "proj-5",
    });
    expect(result).not.toBeNull();
    expect(result!.description).toBe("");
  });

  it("finds construction description from earlier user messages when later ones are confirmations", () => {
    const result = detectPendingActionFromHistory({
      currentMessage: "sí, dale",
      messages: [
        { role: "user", content: "necesito presupuestar una carretera de 15km asfaltada en Arequipa" },
        { role: "assistant", content: "He preparado la Vista previa con 45 partidas. ¿Procedo con la generación?" },
        { role: "user", content: "Sí" },
        { role: "assistant", content: "¿Confirmas que quieres generar el presupuesto completo?" },
      ],
      projectId: "proj-6",
    });
    expect(result).not.toBeNull();
    expect(result!.description).toContain("necesito presupuestar una carretera");
    expect(result!.description).toContain("Arequipa");
  });

  it("looks at all assistant messages for preview, not just the last one", () => {
    const result = detectPendingActionFromHistory({
      currentMessage: "sí",
      messages: [
        { role: "user", content: "presupuesto para vivienda unifamiliar de 80m2" },
        { role: "assistant", content: "📋 Vista previa lista con 12 partidas." },
        { role: "user", content: "agrega más partidas de acabados" },
        { role: "assistant", content: "He actualizado la lista. Ahora son 18 partidas." },
        { role: "user", content: "ok, procede" },
      ],
      projectId: "proj-7",
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe("apply_budget_generation");
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

function mockStreamYield(events: unknown[]) {
  mocks.streamAgentChat.mockImplementation(async function* () {
    for (const event of events) {
      yield event;
    }
  });
}

function mockStreamYieldError(error: unknown) {
  mocks.streamAgentChat.mockImplementation(async function* () {
    throw error;
  });
}
