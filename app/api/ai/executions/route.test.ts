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
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/ai/executions/route";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  agentExecution: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

function authAs(userId: string) {
  vi.mocked(getAuthSession).mockResolvedValue({
    expires: new Date().toISOString(),
    user: { id: userId },
  } as ReturnType<typeof getAuthSession> extends Promise<infer T> ? T : never);
}

describe("GET /api/ai/executions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth ───────────────────────────────────────────────────────────────

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/ai/executions"),
    );

    expect(response.status).toBe(401);
  });

  // ── Empty list ─────────────────────────────────────────────────────────

  it("returns empty executions array when user has none", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findMany.mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/ai/executions"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.executions).toEqual([]);
  });

  it("queries with only userId filter when no projectId param", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findMany.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/ai/executions"));

    expect(mockPrisma.agentExecution.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { steps: true, toolInvocations: true, approvals: true } } },
    });
  });

  // ── Filtering ──────────────────────────────────────────────────────────

  it("adds projectId to where clause when query param present", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findMany.mockResolvedValue([]);

    await GET(
      new Request("http://localhost/api/ai/executions?projectId=project-99"),
    );

    expect(mockPrisma.agentExecution.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", projectId: "project-99" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { steps: true, toolInvocations: true, approvals: true } } },
    });
  });

  it("ignores empty projectId param", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findMany.mockResolvedValue([]);

    await GET(
      new Request("http://localhost/api/ai/executions?projectId="),
    );

    expect(mockPrisma.agentExecution.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { steps: true, toolInvocations: true, approvals: true } } },
    });
  });

  // ── Listing ────────────────────────────────────────────────────────────

  it("returns formatted execution list with counts", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findMany.mockResolvedValue([
      makeDbExecution("exec-1", "EXECUTED", "Crear presupuesto", 3, 5, 1),
      makeDbExecution("exec-2", "FAILED", "Eliminar capitulo", 1, 2, 1),
    ]);

    const response = await GET(
      new Request("http://localhost/api/ai/executions"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.executions).toHaveLength(2);

    const first = body.executions[0];
    expect(first.id).toBe("exec-1");
    expect(first.state).toBe("EXECUTED");
    expect(first.goal).toBe("Crear presupuesto");
    expect(first.stepCount).toBe(3);
    expect(first.toolInvocationCount).toBe(5);
    expect(first.pendingApprovals).toBe(1);
    expect(first.mode).toBe("goal");
    expect(first.startedAt).toBeDefined();
  });

  it("handles null optional fields gracefully", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findMany.mockResolvedValue([
      {
        id: "exec-min",
        mode: "chat",
        state: "READ",
        goal: "Hola",
        summary: null,
        provider: null,
        model: null,
        startedAt: new Date("2026-01-01"),
        finishedAt: null,
        lastError: null,
        projectId: null,
        _count: { steps: 0, toolInvocations: 0, approvals: 0 },
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/ai/executions"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.executions[0].summary).toBeNull();
    expect(body.executions[0].finishedAt).toBeNull();
    expect(body.executions[0].projectId).toBeNull();
  });

  it("returns up to 50 executions", async () => {
    authAs("user-1");
    mockPrisma.agentExecution.findMany.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/ai/executions"));

    expect(mockPrisma.agentExecution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDbExecution(
  id: string,
  state: string,
  goal: string,
  stepCount: number,
  toolCount: number,
  approvalCount: number,
) {
  return {
    id,
    mode: "goal",
    state,
    goal,
    summary: state === "EXECUTED" ? "Completado con exito" : null,
    provider: "agent",
    model: "deepseek-v4",
    startedAt: new Date("2026-07-09T10:00:00Z"),
    finishedAt: state === "EXECUTED" ? new Date("2026-07-09T10:01:00Z") : null,
    lastError: state === "FAILED" ? "Error en tool" : null,
    projectId: "project-1",
    _count: {
      steps: stepCount,
      toolInvocations: toolCount,
      approvals: approvalCount,
    },
  };
}
