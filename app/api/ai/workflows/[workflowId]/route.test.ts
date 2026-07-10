import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetWorkflowById = vi.hoisted(() => vi.fn());

// ── Auth mock ───────────────────────────────────────────────────────────────
vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

// ── Billing mock ────────────────────────────────────────────────────────────
import { createBillingMock } from "@/app/api/ai/__tests__/billing-mock";
vi.mock("@/lib/billing/entitlements", () => createBillingMock());

// ── Data layer mock ─────────────────────────────────────────────────────────
vi.mock("@/lib/data/agent-workflows", () => ({
  getWorkflowById: mockGetWorkflowById,
}));

import { GET } from "@/app/api/ai/workflows/[workflowId]/route";
import { getAuthSession } from "@/lib/auth/session";

// ── Helpers ─────────────────────────────────────────────────────────────────

function authAs(userId: string) {
  vi.mocked(getAuthSession).mockResolvedValue({
    expires: new Date().toISOString(),
    user: { id: userId },
  } as ReturnType<typeof getAuthSession> extends Promise<infer T> ? T : never);
}

function get(workflowId: string) {
  return GET(
    new Request(`http://localhost/api/ai/workflows/${workflowId}`, {
      method: "GET",
    }),
    { params: Promise.resolve({ workflowId }) },
  );
}

const baseDate = new Date("2026-07-09T10:00:00Z");

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wf-1",
    slug: "crear-presupuesto",
    name: "Crear Presupuesto",
    description: "Crea un presupuesto desde cero usando un objetivo en lenguaje natural.",
    initialGoalTemplate: "Crea un presupuesto para {{proyecto}} de {{area}} m²",
    allowedToolsJson: ["searchPartidas", "createBudget", "calculateAPU"],
    defaultMode: "goal",
    isActive: true,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/ai/workflows/[workflowId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth ───────────────────────────────────────────────────────────────

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await get("wf-1");

    expect(response.status).toBe(401);
  });

  // ── Success ────────────────────────────────────────────────────────────

  it("returns workflow when found", async () => {
    authAs("user-1");
    mockGetWorkflowById.mockResolvedValue(makeWorkflow());

    const response = await get("wf-1");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workflow.id).toBe("wf-1");
    expect(body.workflow.slug).toBe("crear-presupuesto");
    expect(body.workflow.name).toBe("Crear Presupuesto");
    expect(body.workflow.description).toBe(
      "Crea un presupuesto desde cero usando un objetivo en lenguaje natural.",
    );
    expect(body.workflow.initialGoalTemplate).toBe(
      "Crea un presupuesto para {{proyecto}} de {{area}} m²",
    );
    expect(body.workflow.allowedTools).toEqual(["searchPartidas", "createBudget", "calculateAPU"]);
    expect(body.workflow.defaultMode).toBe("goal");
    expect(body.workflow.isActive).toBe(true);
    expect(body.workflow.createdAt).toBe("2026-07-09T10:00:00.000Z");
    expect(body.workflow.updatedAt).toBe("2026-07-09T10:00:00.000Z");
  });

  it("returns workflow with empty allowedTools when allowedToolsJson is null", async () => {
    authAs("user-1");
    mockGetWorkflowById.mockResolvedValue(makeWorkflow({ allowedToolsJson: null }));

    const response = await get("wf-null-tools");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workflow.allowedTools).toEqual([]);
  });

  it("returns workflow with inactive flag when isActive is false", async () => {
    authAs("user-1");
    mockGetWorkflowById.mockResolvedValue(makeWorkflow({ isActive: false }));

    const response = await get("wf-inactive");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workflow.isActive).toBe(false);
  });

  // ── Not found ─────────────────────────────────────────────────────────

  it("returns 404 when workflow is not found", async () => {
    authAs("user-1");
    mockGetWorkflowById.mockResolvedValue(null);

    const response = await get("no-exist");

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("no encontrado");
  });

  // ── Error ──────────────────────────────────────────────────────────────

  it("returns 500 on unexpected error", async () => {
    authAs("user-1");
    mockGetWorkflowById.mockRejectedValue(
      new Error("Error de conexión a la base de datos."),
    );

    const response = await get("wf-1");

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("Error de conexión");
  });

  // ── Passes correct ID ──────────────────────────────────────────────────

  it("calls getWorkflowById with the correct workflowId", async () => {
    authAs("user-1");
    mockGetWorkflowById.mockResolvedValue(makeWorkflow());

    await get("wf-custom-id");

    expect(mockGetWorkflowById).toHaveBeenCalledWith("wf-custom-id");
  });
});
