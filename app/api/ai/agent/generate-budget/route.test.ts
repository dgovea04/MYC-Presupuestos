import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Auth mock ───────────────────────────────────────────────────────────────
vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

// ── Billing mock ────────────────────────────────────────────────────────────
import { createBillingMock } from "@/app/api/ai/__tests__/billing-mock";
vi.mock("@/lib/billing/entitlements", () => createBillingMock());

// ── generateBudgetTool mock (vi.hoisted para que esté disponible cuando vi.mock se eleva al top) ──
const mockExecute = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/agent/tools/budgets", () => ({
  generateBudgetTool: {
    execute: mockExecute,
  },
}));

import { POST } from "@/app/api/ai/agent/generate-budget/route";
import { getAuthSession } from "@/lib/auth/session";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authAs(userId: string) {
  vi.mocked(getAuthSession).mockResolvedValue({
    expires: new Date().toISOString(),
    user: { id: userId },
  } as ReturnType<typeof getAuthSession> extends Promise<infer T> ? T : never);
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/ai/agent/generate-budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const MOCK_TOOL_RESULT = {
  projectId: "project-99",
  description: "vivienda unifamiliar de 2 pisos, 120m2",
  templateType: "edificio",
  totalItemsAdded: 77,
  fromMcp: 50,
  fromTemplates: 20,
  fromCatalog: 7,
  mcpMatchStats: { matched: 77, reviewRequired: 0, unmatched: 0, total: 77 },
  templatesApplied: ["Plantilla Vivienda → Estructuras (20 partidas)"],
  levels: [
    "Nivel 1: 3 proyectos similares encontrados (top: \"Vivienda Template\", score: 0.33)",
    'Nivel 1.5: Plantilla .mcp "Vivienda Template" aplicada: 4 sub-presupuestos, 77 partidas.',
  ],
  byBudget: [
    { budgetId: "budget-1", budgetName: "Estructuras", itemCount: 34, subtotal: 249992.06 },
    { budgetId: "budget-2", budgetName: "Arquitectura", itemCount: 25, subtotal: 382262.94 },
    { budgetId: "budget-3", budgetName: "Instalaciones Sanitarias", itemCount: 11, subtotal: 23239.8 },
    { budgetId: "budget-4", budgetName: "Instalaciones Electricas", itemCount: 7, subtotal: 19460.63 },
  ],
  message:
    'Nivel 1: 3 proyectos similares encontrados (top: "Vivienda Template", score: 0.33) | Nivel 1.5: Plantilla .mcp "Vivienda Template" aplicada: 4 sub-presupuestos, 77 partidas.',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/ai/agent/generate-budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockReset();
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await post({
      projectId: "project-99",
      description: "vivienda unifamiliar de 2 pisos, 120m2",
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  // ── Validation ───────────────────────────────────────────────────────────

  it("returns 400 when projectId is missing", async () => {
    authAs("user-1");

    const response = await post({
      description: "vivienda unifamiliar de 2 pisos, 120m2",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("projectId");
  });

  it("returns 400 when description is missing", async () => {
    authAs("user-1");

    const response = await post({
      projectId: "project-99",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("description");
  });

  it("returns 400 when description is too short (menos de 10 caracteres)", async () => {
    authAs("user-1");

    const response = await post({
      projectId: "project-99",
      description: "corta",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("description");
  });

  // ── Happy path ───────────────────────────────────────────────────────────

  it("returns 200 with tool result when input is valid", async () => {
    authAs("user-1");
    mockExecute.mockResolvedValue(MOCK_TOOL_RESULT);

    const response = await post({
      projectId: "project-99",
      description: "vivienda unifamiliar de 2 pisos, 120m2",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projectId).toBe("project-99");
    expect(body.totalItemsAdded).toBe(77);
    expect(body.fromMcp).toBe(50);
    expect(body.fromTemplates).toBe(20);
    expect(body.fromCatalog).toBe(7);
    expect(body.byBudget).toHaveLength(4);
    expect(body.levels).toHaveLength(2);
  });

  it("pasa projectId y description correctos al tool execute", async () => {
    authAs("user-1");
    mockExecute.mockResolvedValue(MOCK_TOOL_RESULT);

    await post({
      projectId: "project-99",
      description: "vivienda unifamiliar de 2 pisos, 120m2",
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const [input, context] = mockExecute.mock.calls[0];

    // Verificar input
    expect(input.projectId).toBe("project-99");
    expect(input.description).toBe("vivienda unifamiliar de 2 pisos, 120m2");
    expect(input.templateSource).toBe("auto");
    expect(input.previewOnly).toBe(false);

    // Verificar context
    expect(context.userId).toBe("user-1");
    expect(context.projectId).toBe("project-99");
    expect(context.lastUserMessage).toBe("vivienda unifamiliar de 2 pisos, 120m2");
    expect(context.messages).toEqual([]);
    expect(context.executionId).toMatch(/^fallback-/);
  });

  // ── workspaceId ──────────────────────────────────────────────────────

  it("pasa workspaceId al context del tool execute cuando se provee", async () => {
    authAs("user-1");
    mockExecute.mockResolvedValue(MOCK_TOOL_RESULT);

    await post({
      projectId: "project-99",
      description: "vivienda unifamiliar de 2 pisos, 120m2",
      workspaceId: "workspace-42",
    });

    const [input, context] = mockExecute.mock.calls[0];
    expect(context.workspaceId).toBe("workspace-42");
  });

  it("pasa workspaceId undefined al context cuando no se provee", async () => {
    authAs("user-1");
    mockExecute.mockResolvedValue(MOCK_TOOL_RESULT);

    await post({
      projectId: "project-99",
      description: "vivienda unifamiliar de 2 pisos, 120m2",
    });

    const [input, context] = mockExecute.mock.calls[0];
    expect(context.workspaceId).toBeUndefined();
  });

  it("pasa workspaceId como undefined cuando se envia null explícitamente", async () => {
    authAs("user-1");
    mockExecute.mockResolvedValue(MOCK_TOOL_RESULT);

    await post({
      projectId: "project-99",
      description: "vivienda unifamiliar de 2 pisos, 120m2",
      workspaceId: null,
    });

    const [input, context] = mockExecute.mock.calls[0];
    // null se convierte en undefined por la coalescencia ??
    expect(context.workspaceId).toBeUndefined();
  });

  // ── Optional fields ────────────────────────────────────────────────────

  it("pasa campos opcionales (templateType, templateSource, mcpPackageId, workspaceId)", async () => {
    authAs("user-1");
    mockExecute.mockResolvedValue(MOCK_TOOL_RESULT);

    await post({
      projectId: "project-99",
      description: "vivienda unifamiliar de 2 pisos, 120m2",
      templateType: "vivienda",
      templateSource: "mcp",
      mcpPackageId: "pkg-abc-123",
      workspaceId: "workspace-42",
    });

    const [input, context] = mockExecute.mock.calls[0];

    expect(input.templateType).toBe("vivienda");
    expect(input.templateSource).toBe("mcp");
    expect(input.mcpPackageId).toBe("pkg-abc-123");
    expect(context.workspaceId).toBe("workspace-42");
  });

  // ── Error handling ─────────────────────────────────────────────────────

  it("retorna error 500 cuando generateBudgetTool.execute lanza una excepción", async () => {
    authAs("user-1");
    mockExecute.mockRejectedValue(new Error("Error al conectar con la base de datos"));

    const response = await post({
      projectId: "project-99",
      description: "vivienda unifamiliar de 2 pisos, 120m2",
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("Error al conectar con la base de datos");
  });

  it("retorna 500 con mensaje generico cuando el error no es un Error conocido", async () => {
    authAs("user-1");
    mockExecute.mockRejectedValue("string error sin stack");

    const response = await post({
      projectId: "project-99",
      description: "vivienda unifamiliar de 2 pisos, 120m2",
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("Error inesperado");
  });
});
