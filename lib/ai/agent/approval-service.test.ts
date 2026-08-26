import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Prisma mock ────────────────────────────────────────────────────────────
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    agentApproval: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    agentExecution: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  AgentApprovalServiceImpl,
  createApprovalService,
} from "@/lib/ai/agent/approval-service";

const mockPrisma = prisma as unknown as {
  agentApproval: {
    findFirst: ReturnType<typeof vi.fn>;
    findFirstOrThrow: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  agentExecution: {
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeApproval(overrides: Partial<{
  id: string;
  executionId: string;
  decision: string | null;
  reason: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  execution: { id: string; state: string };
}> = {}) {
  return {
    id: overrides.id ?? "approval-1",
    executionId: overrides.executionId ?? "exec-1",
    decision: overrides.decision ?? null,
    reason: overrides.reason ?? null,
    requestedAt: overrides.requestedAt ?? new Date("2026-07-09T10:00:00Z"),
    decidedAt: overrides.decidedAt ?? null,
    decidedByUserId: overrides.decidedByUserId ?? null,
    execution: overrides.execution ?? {
      id: overrides.executionId ?? "exec-1",
      state: "PENDING_APPROVAL",
    },
  };
}

function mockTransaction() {
  mockPrisma.$transaction.mockImplementation(async (fn: Function) => {
    return fn({
      agentApproval: {
        findFirst: mockPrisma.agentApproval.findFirst,
        updateMany: mockPrisma.agentApproval.updateMany,
      },
      agentExecution: {
        updateMany: mockPrisma.agentExecution.updateMany,
      },
    });
  });
}

describe("AgentApprovalServiceImpl", () => {
  let service: AgentApprovalServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentApprovalServiceImpl();
    mockPrisma.agentApproval.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.agentExecution.updateMany.mockResolvedValue({ count: 1 });
    mockTransaction();
  });

  // ── createApprovalService factory ──────────────────────────────────────

  describe("createApprovalService", () => {
    it("returns an AgentApprovalServiceImpl instance", () => {
      const svc = createApprovalService();
      expect(svc).toBeInstanceOf(AgentApprovalServiceImpl);
    });
  });

  // ── approve ───────────────────────────────────────────────────────────

  describe("approve", () => {
    it("approves successfully and transitions to EXECUTING", async () => {
      const approval = makeApproval();
      mockPrisma.agentApproval.findFirst.mockResolvedValue(approval);
      mockPrisma.agentApproval.findFirstOrThrow.mockResolvedValue(approval);

      const result = await service.approve({
        approvalId: "approval-1",
        userId: "user-1",
      });

      expect(result.approved).toBe(true);
      expect(result.executionId).toBe("exec-1");
      expect(result.newState).toBe("EXECUTING");
    });

    it("updates approval with decision and metadata", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(makeApproval());
      mockPrisma.agentApproval.findFirstOrThrow.mockResolvedValue(makeApproval());
      mockPrisma.agentApproval.updateMany.mockResolvedValue({ count: 1 });

      await service.approve({
        approvalId: "approval-1",
        userId: "user-1",
        reason: "Apruebo el costo estimado.",
      });

      expect(mockPrisma.agentApproval.updateMany).toHaveBeenCalledWith({
        where: {
          id: "approval-1",
          decision: null,
          execution: { userId: "user-1" },
        },
        data: {
          decision: "approve",
          reason: "Apruebo el costo estimado.",
          decidedAt: expect.any(Date),
          decidedByUserId: "user-1",
        },
      });
    });

    it("transitions execution from PENDING_APPROVAL to EXECUTING", async () => {
      const approval = makeApproval({
        execution: { id: "exec-1", state: "PENDING_APPROVAL" },
      });
      mockPrisma.agentApproval.findFirst.mockResolvedValue(approval);
      mockPrisma.agentApproval.findFirstOrThrow.mockResolvedValue(approval);

      await service.approve({
        approvalId: "approval-1",
        userId: "user-1",
      });

      expect(mockPrisma.agentExecution.updateMany).toHaveBeenCalledWith({
        where: { id: "exec-1", userId: "user-1" },
        data: { state: "EXECUTING", updatedAt: expect.any(Date) },
      });
    });

    it("does not transition execution if state is not PENDING_APPROVAL", async () => {
      const approval = makeApproval({
        execution: { id: "exec-1", state: "EXECUTING" },
      });
      mockPrisma.agentApproval.findFirst.mockResolvedValue(approval);
      mockPrisma.agentApproval.findFirstOrThrow.mockResolvedValue(approval);

      await service.approve({
        approvalId: "approval-1",
        userId: "user-1",
      });

      // agentExecution.update should not be called because state is not in validTransitions
      expect(mockPrisma.agentExecution.updateMany).not.toHaveBeenCalled();
    });

    it("throws when approval is not found", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(null);

      await expect(
        service.approve({ approvalId: "no-exist", userId: "user-1" }),
      ).rejects.toThrow("Aprobación \"no-exist\" no encontrada.");
    });

    it("throws when approval was already decided", async () => {
      const decided = makeApproval({
        decision: "approve",
        decidedAt: new Date(),
        decidedByUserId: "user-2",
      });
      mockPrisma.agentApproval.findFirst.mockResolvedValue(decided);

      await expect(
        service.approve({ approvalId: "approval-1", userId: "user-1" }),
      ).rejects.toThrow("ya fue decidida");
    });

    it("throws when approval was already rejected", async () => {
      const rejected = makeApproval({
        decision: "reject",
        decidedAt: new Date(),
        decidedByUserId: "user-2",
      });
      mockPrisma.agentApproval.findFirst.mockResolvedValue(rejected);

      await expect(
        service.approve({ approvalId: "approval-1", userId: "user-1" }),
      ).rejects.toThrow("ya fue decidida");
    });
  });

  // ── reject ────────────────────────────────────────────────────────────

  describe("reject", () => {
    it("rejects successfully and transitions to FAILED", async () => {
      const approval = makeApproval();
      mockPrisma.agentApproval.findFirst.mockResolvedValue(approval);
      mockPrisma.agentApproval.findFirstOrThrow.mockResolvedValue(approval);

      const result = await service.reject({
        approvalId: "approval-1",
        userId: "user-1",
      });

      expect(result.approved).toBe(false);
      expect(result.executionId).toBe("exec-1");
      expect(result.newState).toBe("FAILED");
    });

    it("updates approval with reject decision", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(makeApproval());
      mockPrisma.agentApproval.findFirstOrThrow.mockResolvedValue(makeApproval());
      mockPrisma.agentApproval.updateMany.mockResolvedValue({ count: 1 });

      await service.reject({
        approvalId: "approval-1",
        userId: "user-1",
        reason: "Costo demasiado alto.",
      });

      expect(mockPrisma.agentApproval.updateMany).toHaveBeenCalledWith({
        where: {
          id: "approval-1",
          decision: null,
          execution: { userId: "user-1" },
        },
        data: {
          decision: "reject",
          reason: "Costo demasiado alto.",
          decidedAt: expect.any(Date),
          decidedByUserId: "user-1",
        },
      });
    });

    it("uses default reason when no reason provided", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(makeApproval());
      mockPrisma.agentApproval.findFirstOrThrow.mockResolvedValue(makeApproval());
      mockPrisma.agentApproval.updateMany.mockResolvedValue({ count: 1 });

      await service.reject({
        approvalId: "approval-1",
        userId: "user-1",
      });

      expect(mockPrisma.agentApproval.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: "Rechazado por el usuario.",
          }),
        }),
      );
    });

    it("sets execution to FAILED with summary", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(makeApproval());
      mockPrisma.agentApproval.findFirstOrThrow.mockResolvedValue(makeApproval());
      mockPrisma.agentApproval.updateMany.mockResolvedValue({ count: 1 });

      await service.reject({
        approvalId: "approval-1",
        userId: "user-1",
        reason: "No autorizado.",
      });

      expect(mockPrisma.agentExecution.updateMany).toHaveBeenCalledWith({
        where: { id: "exec-1", userId: "user-1" },
        data: {
          state: "FAILED",
          summary: "Ejecución rechazada: No autorizado.",
          finishedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it("sets default summary when no reason given", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(makeApproval());
      mockPrisma.agentApproval.findFirstOrThrow.mockResolvedValue(makeApproval());
      mockPrisma.agentApproval.updateMany.mockResolvedValue({ count: 1 });

      await service.reject({
        approvalId: "approval-1",
        userId: "user-1",
      });

      expect(mockPrisma.agentExecution.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "exec-1", userId: "user-1" },
          data: expect.objectContaining({
            summary: "Ejecución rechazada: Sin motivo especificado.",
          }),
        }),
      );
    });

    it("throws when approval is not found", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(null);

      await expect(
        service.reject({ approvalId: "no-exist", userId: "user-1" }),
      ).rejects.toThrow("Aprobación \"no-exist\" no encontrada.");
    });

    it("throws when approval was already decided", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(
        makeApproval({ decision: "approve", decidedAt: new Date() }),
      );

      await expect(
        service.reject({ approvalId: "approval-1", userId: "user-1" }),
      ).rejects.toThrow("ya fue decidida");
    });
  });

  // ── getStatus ─────────────────────────────────────────────────────────

  describe("getStatus", () => {
    it("returns pending status for undecided approval", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(
        makeApproval({ decision: null }),
      );

      const status = await service.getStatus({ approvalId: "approval-1", userId: "user-1" });

      expect(status.approvalId).toBe("approval-1");
      expect(status.executionId).toBe("exec-1");
      expect(status.decision).toBe("pending");
      expect(status.reason).toBeUndefined();
      expect(status.decidedByUserId).toBeUndefined();
      expect(status.decidedAt).toBeUndefined();
      expect(status.requestedAt).toBeDefined();
    });

    it("returns approve decision for approved approval", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(
        makeApproval({
          decision: "approve",
          reason: "Autorizado.",
          decidedAt: new Date("2026-07-09T11:00:00Z"),
          decidedByUserId: "user-2",
        }),
      );

      const status = await service.getStatus({ approvalId: "approval-1", userId: "user-1" });

      expect(status.decision).toBe("approve");
      expect(status.reason).toBe("Autorizado.");
      expect(status.decidedByUserId).toBe("user-2");
      expect(status.decidedAt).toBeDefined();
    });

    it("returns reject decision for rejected approval", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(
        makeApproval({
          decision: "reject",
          reason: "Costo elevado.",
          decidedAt: new Date("2026-07-09T11:00:00Z"),
          decidedByUserId: "user-3",
        }),
      );

      const status = await service.getStatus({ approvalId: "approval-1", userId: "user-1" });

      expect(status.decision).toBe("reject");
      expect(status.reason).toBe("Costo elevado.");
      expect(status.decidedByUserId).toBe("user-3");
    });

    it("throws when approval is not found", async () => {
      mockPrisma.agentApproval.findFirst.mockResolvedValue(null);

      await expect(
        service.getStatus({ approvalId: "no-exist", userId: "user-1" }),
      ).rejects.toThrow("Aprobación \"no-exist\" no encontrada.");
    });
  });
});
