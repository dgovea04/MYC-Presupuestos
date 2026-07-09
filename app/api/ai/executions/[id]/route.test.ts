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

import { GET } from "@/app/api/ai/executions/[id]/route";
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

describe("GET /api/ai/executions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth ───────────────────────────────────────────────────────────────

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/ai/executions/exec-1"),
      { params: Promise.resolve({ id: "exec-1" }) },
    );

    expect(response.status).toBe(401);
  });

  // ── Not found ──────────────────────────────────────────────────────────

  it("returns 404 when execution does not exist", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findUnique.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/ai/executions/no-exist"),
      { params: Promise.resolve({ id: "no-exist" }) },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatch(/no encontrada/i);
  });

  // ── Authorization ──────────────────────────────────────────────────────

  it("returns 404 when execution belongs to different user", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findUnique.mockResolvedValue(
      makeMinimalDbExecution("exec-x", "user-other"),
    );

    const response = await GET(
      new Request("http://localhost/api/ai/executions/exec-x"),
      { params: Promise.resolve({ id: "exec-x" }) },
    );

    expect(response.status).toBe(404);
  });

  // ── Full detail ────────────────────────────────────────────────────────

  it("returns full execution detail with nested includes", async () => {
    authAs("user-1");
    const dbExecution = makeFullDbExecution("exec-1", "user-1");
    mockPrisma.agentExecution.findUnique.mockResolvedValue(dbExecution);

    const response = await GET(
      new Request("http://localhost/api/ai/executions/exec-1"),
      { params: Promise.resolve({ id: "exec-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    const exec = body.execution;

    // Top-level fields
    expect(exec.id).toBe("exec-1");
    expect(exec.userId).toBe("user-1");
    expect(exec.state).toBe("EXECUTED");
    expect(exec.mode).toBe("goal");
    expect(exec.goal).toBe("Crear presupuesto hospital");
    expect(exec.summary).toBe("Ejecucion completada.");
    expect(exec.provider).toBe("agent");
    expect(exec.model).toBe("deepseek-v4");
    expect(exec.startedAt).toBeDefined();
    expect(exec.finishedAt).toBeDefined();

    // Steps
    expect(exec.steps).toHaveLength(2);
    expect(exec.steps[0].sequence).toBe(1);
    expect(exec.steps[0].title).toBe("Analizar presupuesto");
    expect(exec.steps[0].toolName).toBe("calculateBudget");
    expect(exec.steps[0].status).toBe("completed");
    expect(exec.steps[0].approvalRequired).toBe(false);

    // Step tool invocations
    expect(exec.steps[0].toolInvocations).toHaveLength(1);
    expect(exec.steps[0].toolInvocations[0].toolName).toBe("calculateBudget");
    expect(exec.steps[0].toolInvocations[0].success).toBe(true);
    expect(exec.steps[0].toolInvocations[0].latencyMs).toBe(120);

    // Step approvals
    expect(exec.steps[0].approvals).toHaveLength(0);
    expect(exec.steps[1].approvals).toHaveLength(1);
    expect(exec.steps[1].approvals[0].decision).toBe("approve");

    // Top-level approvals
    expect(exec.approvals).toHaveLength(1);
    expect(exec.approvals[0].id).toBe("approval-1");
    expect(exec.approvals[0].decision).toBe("approve");
    expect(exec.approvals[0].reason).toBe("Usuario autorizo.");
    expect(exec.approvals[0].decidedByUserId).toBe("user-1");

    // Rollbacks
    expect(exec.rollbacks).toHaveLength(0);

    // Top-level tool invocations
    expect(exec.steps).toBeDefined();
  });

  it("returns execution with rollbacks included", async () => {
    authAs("user-1");
    const dbExecution = makeFullDbExecution("exec-rb", "user-1");
    mockPrisma.agentExecution.findUnique.mockResolvedValue({
      ...dbExecution,
      state: "ROLLED_BACK",
      rollbacks: [
        {
          id: "rb-1",
          rollbackToolName: "deleteChapter",
          success: true,
          errorMessage: null,
          reason: "Reversion por fallo de tool",
          createdAt: new Date("2026-07-09T12:00:00Z"),
        },
      ],
    });

    const response = await GET(
      new Request("http://localhost/api/ai/executions/exec-rb"),
      { params: Promise.resolve({ id: "exec-rb" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.execution.state).toBe("ROLLED_BACK");
    expect(body.execution.rollbacks).toHaveLength(1);
    expect(body.execution.rollbacks[0].rollbackToolName).toBe("deleteChapter");
    expect(body.execution.rollbacks[0].success).toBe(true);
  });

  it("handles execution with no steps or tool invocations", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findUnique.mockResolvedValue({
      id: "exec-empty",
      userId: "user-1",
      projectId: null,
      mode: "chat",
      state: "READ",
      goal: "Hola",
      summary: null,
      provider: null,
      model: null,
      startedAt: new Date(),
      finishedAt: null,
      lastError: null,
      contextSnapshotJson: null,
      steps: [],
      toolInvocations: [],
      approvals: [],
      rollbacks: [],
    });

    const response = await GET(
      new Request("http://localhost/api/ai/executions/exec-empty"),
      { params: Promise.resolve({ id: "exec-empty" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.execution.steps).toEqual([]);
    expect(body.execution.approvals).toEqual([]);
    expect(body.execution.rollbacks).toEqual([]);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMinimalDbExecution(id: string, userId: string) {
  return {
    id,
    userId,
    projectId: null,
    mode: "chat",
    state: "EXECUTED",
    goal: "Test",
    summary: null,
    provider: null,
    model: null,
    startedAt: new Date(),
    finishedAt: null,
    lastError: null,
    contextSnapshotJson: null,
    steps: [],
    toolInvocations: [],
    approvals: [],
    rollbacks: [],
  };
}

function makeFullDbExecution(id: string, userId: string) {
  const now = new Date("2026-07-09T10:00:00Z");
  return {
    id,
    userId,
    projectId: "project-1",
    mode: "goal",
    state: "EXECUTED",
    goal: "Crear presupuesto hospital",
    summary: "Ejecucion completada.",
    provider: "agent",
    model: "deepseek-v4",
    startedAt: now,
    finishedAt: new Date("2026-07-09T10:01:00Z"),
    lastError: null,
    contextSnapshotJson: { project: "Hospital" },
    steps: [
      {
        id: "step-1",
        sequence: 1,
        title: "Analizar presupuesto",
        objective: "Obtener datos del presupuesto actual",
        toolName: "calculateBudget",
        status: "completed",
        approvalRequired: false,
        inputJson: { budgetId: "budget-1" },
        resultSummary: "Presupuesto calculado.",
        startedAt: now,
        finishedAt: now,
        toolInvocations: [
          {
            id: "ti-1",
            toolName: "calculateBudget",
            argumentsJson: { budgetId: "budget-1" },
            resultJson: { total: 500000 },
            latencyMs: 120,
            success: true,
            errorMessage: null,
          },
        ],
        approvals: [],
      },
      {
        id: "step-2",
        sequence: 2,
        title: "Crear presupuesto",
        objective: "Crear nuevo presupuesto base",
        toolName: "createBudget",
        status: "completed",
        approvalRequired: true,
        inputJson: { name: "Presupuesto Hospital" },
        resultSummary: "Presupuesto creado.",
        startedAt: now,
        finishedAt: now,
        toolInvocations: [
          {
            id: "ti-2",
            toolName: "createBudget",
            argumentsJson: { name: "Presupuesto Hospital" },
            resultJson: { id: "new-budget-1" },
            latencyMs: 85,
            success: true,
            errorMessage: null,
          },
        ],
        approvals: [
          {
            id: "approval-1",
            decision: "approve",
            reason: "Usuario autorizo.",
            requestedAt: now,
            decidedAt: now,
          },
        ],
      },
    ],
    toolInvocations: [
      {
        id: "ti-1",
        stepId: "step-1",
        toolName: "calculateBudget",
        argumentsJson: { budgetId: "budget-1" },
        resultJson: { total: 500000 },
        latencyMs: 120,
        success: true,
        errorMessage: null,
        createdAt: now,
      },
      {
        id: "ti-2",
        stepId: "step-2",
        toolName: "createBudget",
        argumentsJson: { name: "Presupuesto Hospital" },
        resultJson: { id: "new-budget-1" },
        latencyMs: 85,
        success: true,
        errorMessage: null,
        createdAt: now,
      },
    ],
    approvals: [
      {
        id: "approval-1",
        decision: "approve",
        reason: "Usuario autorizo.",
        requestedAt: now,
        decidedAt: now,
        decidedByUserId: "user-1",
      },
    ],
    rollbacks: [],
  };
}
