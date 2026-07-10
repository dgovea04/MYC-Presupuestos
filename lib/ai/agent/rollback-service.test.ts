import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Prisma mock ────────────────────────────────────────────────────────────
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    agentExecution: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    agentRollback: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  AgentRollbackServiceImpl,
  createRollbackService,
} from "@/lib/ai/agent/rollback-service";

const mockPrisma = prisma as unknown as {
  agentExecution: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  agentRollback: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeExecution(overrides: Partial<{
  id: string;
  userId: string;
  state: string;
  steps: Array<{ id: string; sequence: number; title: string }>;
  toolInvocations: Array<{
    id: string;
    stepId: string | null;
    toolName: string;
    argumentsJson: Record<string, unknown>;
    resultJson: Record<string, unknown> | null;
    success: boolean;
  }>;
}> = {}) {
  return {
    id: overrides.id ?? "exec-1",
    userId: "user-1",
    state: overrides.state ?? "EXECUTED",
    goal: "Test goal",
    summary: "Ejecución completada",
    steps: overrides.steps ?? [
      { id: "step-1", sequence: 1, title: "Buscar partidas" },
    ],
    toolInvocations: overrides.toolInvocations ?? [
      {
        id: "ti-1",
        stepId: "step-1",
        toolName: "searchPartidas",
        argumentsJson: { query: "concreto" },
        resultJson: { matchCount: 5 },
        success: true,
      },
    ],
  };
}

function mockTransaction() {
  mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
    return fn({
      agentRollback: {
        create: mockPrisma.agentRollback.create,
      },
      agentExecution: {
        update: mockPrisma.agentExecution.update,
      },
    });
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AgentRollbackServiceImpl", () => {
  let service: AgentRollbackServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentRollbackServiceImpl();
  });

  // ── createRollbackService factory ──────────────────────────────────────

  describe("createRollbackService", () => {
    it("returns an AgentRollbackServiceImpl instance", () => {
      const svc = createRollbackService();
      expect(svc).toBeInstanceOf(AgentRollbackServiceImpl);
    });
  });

  // ── supportsRollback ───────────────────────────────────────────────────

  describe("supportsRollback", () => {
    const writeTools = [
      "createBudget", "createChapter", "moveChapter", "deleteChapter",
      "addPartida", "removePartida", "addInsumo", "replaceInsumo",
      "updatePrecio", "createAPU", "updateAPU", "createSchedule",
      "updateTask", "moveTask", "createTakeoff", "archiveBudget",
      "cloneBudget", "generateBudget", "duplicatePartida",
      "reorderPartidas", "importTakeoff", "linkPredecessor",
    ];

    for (const toolName of writeTools) {
      it(`supports rollback for "${toolName}"`, () => {
        expect(service.supportsRollback(toolName)).toBe(true);
      });
    }

    it("does not support rollback for read tools", () => {
      expect(service.supportsRollback("searchPartidas")).toBe(false);
      expect(service.supportsRollback("calculateBudget")).toBe(false);
      expect(service.supportsRollback("reviewAPU")).toBe(false);
    });

    it("does not support rollback for unknown tools", () => {
      expect(service.supportsRollback("nonExistentTool")).toBe(false);
    });
  });

  // ── rollback ───────────────────────────────────────────────────────────

  describe("rollback", () => {
    it("rolls back full execution successfully", async () => {
      const execution = makeExecution();
      mockPrisma.agentExecution.findUnique.mockResolvedValue(execution);
      mockTransaction();
      mockPrisma.agentRollback.create.mockResolvedValue({ id: "rollback-1" });

      const result = await service.rollback({
        executionId: "exec-1",
        userId: "user-1",
        reason: "El presupuesto tenía errores.",
      });

      expect(result.success).toBe(true);
      expect(result.rollbackId).toBe("rollback-1");
    });

    it("rolls back a specific step", async () => {
      const execution = makeExecution({
        steps: [{ id: "step-1", sequence: 1, title: "Buscar partidas" }],
        toolInvocations: [
          {
            id: "ti-1",
            stepId: "step-1",
            toolName: "searchPartidas",
            argumentsJson: { query: "concreto" },
            resultJson: { matchCount: 5 },
            success: true,
          },
        ],
      });
      mockPrisma.agentExecution.findUnique.mockResolvedValue(execution);
      mockTransaction();
      mockPrisma.agentRollback.create.mockResolvedValue({ id: "rollback-2" });

      const result = await service.rollback({
        executionId: "exec-1",
        stepId: "step-1",
        userId: "user-1",
        reason: "Revertir paso específico.",
      });

      expect(result.success).toBe(true);
      expect(result.rollbackId).toBe("rollback-2");
    });

    it("transitions execution state to ROLLED_BACK", async () => {
      const execution = makeExecution();
      mockPrisma.agentExecution.findUnique.mockResolvedValue(execution);
      mockTransaction();
      mockPrisma.agentRollback.create.mockResolvedValue({ id: "rollback-3" });

      await service.rollback({
        executionId: "exec-1",
        userId: "user-1",
        reason: "Corregir presupuesto.",
      });

      expect(mockPrisma.agentExecution.update).toHaveBeenCalledWith({
        where: { id: "exec-1" },
        data: expect.objectContaining({
          state: "ROLLED_BACK",
          summary: expect.stringContaining("Corregir presupuesto"),
          finishedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      });
    });

    it("returns error when execution is not found", async () => {
      mockPrisma.agentExecution.findUnique.mockResolvedValue(null);

      const result = await service.rollback({
        executionId: "no-exist",
        userId: "user-1",
        reason: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("no encontrada");
      expect(result.rollbackId).toBe("");
    });

    it("returns error when execution state does not allow rollback", async () => {
      const execution = makeExecution({ state: "EXECUTING" });
      mockPrisma.agentExecution.findUnique.mockResolvedValue(execution);

      const result = await service.rollback({
        executionId: "exec-1",
        userId: "user-1",
        reason: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("EXECUTING");
      expect(result.errorMessage).toContain("EXECUTED");
    });

    it("returns error when execution is in PENDING_APPROVAL state", async () => {
      const execution = makeExecution({ state: "PENDING_APPROVAL" });
      mockPrisma.agentExecution.findUnique.mockResolvedValue(execution);

      const result = await service.rollback({
        executionId: "exec-1",
        userId: "user-1",
        reason: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("PENDING_APPROVAL");
    });

    it("returns error when specified step is not found", async () => {
      // Simulate Prisma's filtering: when stepId doesn't match any step,
      // the returned object should have empty steps array.
      const execution = makeExecution({
        steps: [], // stepId "step-not-exist" would match nothing
      });
      mockPrisma.agentExecution.findUnique.mockResolvedValue(execution);

      const result = await service.rollback({
        executionId: "exec-1",
        stepId: "step-not-exist",
        userId: "user-1",
        reason: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("no encontrado");
    });

    it("audits rollback failure and still returns error", async () => {
      const execution = makeExecution();
      mockPrisma.agentExecution.findUnique.mockResolvedValue(execution);

      // Make the transaction throw
      mockPrisma.$transaction.mockRejectedValue(
        new Error("Base de datos no disponible"),
      );

      const result = await service.rollback({
        executionId: "exec-1",
        userId: "user-1",
        reason: "Test rollback failure",
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("Base de datos no disponible");
      expect(result.rollbackId).toBe("");
    });

    it("rolls back execution with multiple tool invocations", async () => {
      const execution = makeExecution({
        toolInvocations: [
          {
            id: "ti-1",
            stepId: "step-1",
            toolName: "searchPartidas",
            argumentsJson: { query: "concreto" },
            resultJson: { matchCount: 5 },
            success: true,
          },
          {
            id: "ti-2",
            stepId: "step-2",
            toolName: "addPartida",
            argumentsJson: { description: "Viga concreto", unit: "m3", unitPrice: 450 },
            resultJson: { id: "partida-1" },
            success: true,
          },
        ],
      });
      mockPrisma.agentExecution.findUnique.mockResolvedValue(execution);
      mockTransaction();
      mockPrisma.agentRollback.create.mockResolvedValue({ id: "rollback-4" });

      const result = await service.rollback({
        executionId: "exec-1",
        userId: "user-1",
        reason: "Revertir multi-step",
      });

      expect(result.success).toBe(true);
      expect(result.rollbackId).toBe("rollback-4");
    });
  });
});
