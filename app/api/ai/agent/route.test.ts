import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Auth mock ───────────────────────────────────────────────────────────────
vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

// ── Billing mock ────────────────────────────────────────────────────────────
vi.mock("@/lib/billing/entitlements", () => {
  class FeatureAccessError extends Error {
    feature: string;
    constructor(message: string) {
      super(message);
      this.name = "FeatureAccessError";
      this.feature = "unknown";
    }
  }
  class PlanLimitError extends Error {
    resource: string;
    limit: number;
    usage: number;
    constructor(message: string) {
      super(message);
      this.name = "PlanLimitError";
      this.resource = "unknown";
      this.limit = 0;
      this.usage = 0;
    }
  }
  return {
    assertFeatureAccess: vi.fn().mockResolvedValue(undefined),
    FeatureAccessError,
    PlanLimitError,
  };
});

// ── Prisma mock ─────────────────────────────────────────────────────────────
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    agentExecution: {
      findUnique: vi.fn(),
    },
  },
}));

// ── Orchestrator mock ───────────────────────────────────────────────────────
const mockRun = vi.fn();
vi.mock("@/lib/ai/agent/orchestrator", () => ({
  createAgentOrchestrator: vi.fn(() => ({ run: mockRun })),
}));

import { POST } from "@/app/api/ai/agent/route";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  agentExecution: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

function authAs(userId: string) {
  vi.mocked(getAuthSession).mockResolvedValue({
    expires: new Date().toISOString(),
    user: { id: userId },
  } as ReturnType<typeof getAuthSession> extends Promise<infer T> ? T : never);
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/ai/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/ai/agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReset();
  });

  // ── Auth ───────────────────────────────────────────────────────────────

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await post({ message: "Crear presupuesto" });

    expect(response.status).toBe(401);
  });

  // ── Validation ─────────────────────────────────────────────────────────

  it("returns 400 when message is missing", async () => {
    authAs("user-1");

    const response = await post({});

    expect(response.status).toBe(400);
  });

  it("returns 400 when message is empty string", async () => {
    authAs("user-1");

    const response = await post({ message: "   " });

    expect(response.status).toBe(400);
  });

  it("returns 400 when mode is invalid", async () => {
    authAs("user-1");

    const response = await post({ message: "Test", mode: "invalid_mode" });

    expect(response.status).toBe(400);
  });

  // ── Validation: valid modes ────────────────────────────────────────────

  it("accepts mode 'chat' (default)", async () => {
    authAs("user-1");
    mockRun.mockResolvedValue(makeOrchestratorOutput("exec-1", "EXECUTED"));

    const response = await post({ message: "Hola" });

    expect(response.status).toBe(200);
  });

  it("accepts mode 'goal'", async () => {
    authAs("user-1");
    mockRun.mockResolvedValue(makeOrchestratorOutput("exec-2", "PLAN"));

    const response = await post({ message: "Crear presupuesto", mode: "goal" });

    expect(response.status).toBe(200);
  });

  it("accepts mode 'workflow'", async () => {
    authAs("user-1");
    mockRun.mockResolvedValue(makeOrchestratorOutput("exec-3", "EXECUTED"));

    const response = await post({ message: "Ejecutar workflow", mode: "workflow" });

    expect(response.status).toBe(200);
  });

  // ── Resume ─────────────────────────────────────────────────────────────

  it("returns 404 when resuming a non-existent execution", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findUnique.mockResolvedValue(null);

    const response = await post({
      message: "Continuar",
      executionId: "no-exist",
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatch(/no encontrada/i);
  });

  it("returns 404 when resuming another user's execution", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findUnique.mockResolvedValue({
      id: "exec-x",
      userId: "user-other",
      state: "PENDING_APPROVAL",
    });

    const response = await post({
      message: "Continuar",
      executionId: "exec-x",
    });

    expect(response.status).toBe(404);
  });

  it("returns 409 when resuming execution in invalid state", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findUnique.mockResolvedValue({
      id: "exec-done",
      userId: "user-1",
      state: "EXECUTED",
    });

    const response = await post({
      message: "Continuar",
      executionId: "exec-done",
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.state).toBe("EXECUTED");
    expect(body.error).toMatch(/no puede reanudarse/i);
  });

  it("resumes PENDING_APPROVAL execution successfully", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findUnique.mockResolvedValue({
      id: "exec-paused",
      userId: "user-1",
      state: "PENDING_APPROVAL",
    });
    mockRun.mockResolvedValue(makeOrchestratorOutput("exec-paused", "EXECUTING"));

    const response = await post({
      message: "Continuar",
      executionId: "exec-paused",
    });

    expect(response.status).toBe(200);
  });

  it("resumes EXECUTING execution successfully", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findUnique.mockResolvedValue({
      id: "exec-active",
      userId: "user-1",
      state: "EXECUTING",
    });
    mockRun.mockResolvedValue(makeOrchestratorOutput("exec-active", "EXECUTING"));

    const response = await post({
      message: "Continuar",
      executionId: "exec-active",
    });

    expect(response.status).toBe(200);
  });

  // ── Happy path ─────────────────────────────────────────────────────────

  it("returns orchestrator output on successful execution", async () => {
    authAs("user-1");
    mockRun.mockResolvedValue(makeOrchestratorOutput("exec-10", "EXECUTED"));

    const response = await post({ message: "Crear presupuesto para hospital" });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.executionId).toBe("exec-10");
    expect(body.state).toBe("EXECUTED");
    expect(body.plan).toBeDefined();
    expect(body.toolActivity).toBeDefined();
  });

  it("returns orchestrator output with pending approval", async () => {
    authAs("user-1");
    mockRun.mockResolvedValue(
      makeOrchestratorOutput("exec-11", "PENDING_APPROVAL", {
        approvalId: "approval-1",
        stepId: "step-2",
        reason: "La herramienta deleteChapter requiere verificacion humana.",
      }),
    );

    const response = await post({ message: "Eliminar capitulo obsoleto", mode: "goal" });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.state).toBe("PENDING_APPROVAL");
    expect(body.pendingApproval).toBeDefined();
    expect(body.pendingApproval.approvalId).toBe("approval-1");
    expect(body.pendingApproval.reason).toContain("deleteChapter");
  });

  it("passes projectId and optional fields to orchestrator", async () => {
    authAs("user-1");
    mockRun.mockResolvedValue(makeOrchestratorOutput("exec-12", "EXECUTED"));

    await post({
      message: "Analizar presupuesto",
      projectId: "project-42",
      mode: "goal",
      workflowId: "wf-1",
    });

    expect(mockRun).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-42",
      message: "Analizar presupuesto",
      mode: "goal",
      workflowId: "wf-1",
      executionId: undefined,
    });
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrchestratorOutput(
  executionId: string,
  state: string,
  pendingApproval?: { approvalId: string; stepId?: string; reason: string },
) {
  return {
    executionId,
    state,
    mode: "goal",
    summary: "Ejecucion completada.",
    plan: [
      {
        id: "step-1",
        title: "Leer contexto",
        toolName: "calculateBudget",
        objective: "Entender el presupuesto actual",
        expectedOutcome: "Contexto del presupuesto",
        dependsOn: [],
        approvalBoundary: false,
      },
    ],
    completedSteps: [
      {
        id: "step-1",
        title: "Leer contexto",
        toolName: "calculateBudget",
        objective: "Entender el presupuesto actual",
        expectedOutcome: "Contexto del presupuesto",
        dependsOn: [],
        approvalBoundary: false,
      },
    ],
    failedSteps: [],
    pendingApproval,
    toolActivity: [
      { toolName: "calculateBudget", success: true, latencyMs: 120, summary: "Presupuesto calculado." },
    ],
    warnings: [],
  };
}
