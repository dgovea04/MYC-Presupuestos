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

// ── Approval service mock ───────────────────────────────────────────────────
const mockApprove = vi.fn();
const mockReject = vi.fn();
const mockGetStatus = vi.fn();

vi.mock("@/lib/ai/agent/approval-service", () => ({
  createApprovalService: vi.fn(() => ({
    approve: mockApprove,
    reject: mockReject,
    getStatus: mockGetStatus,
  })),
}));

import { POST } from "@/app/api/ai/approvals/route";
import { getAuthSession } from "@/lib/auth/session";

function authAs(userId: string) {
  vi.mocked(getAuthSession).mockResolvedValue({
    expires: new Date().toISOString(),
    user: { id: userId },
  } as ReturnType<typeof getAuthSession> extends Promise<infer T> ? T : never);
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/ai/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/ai/approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth ───────────────────────────────────────────────────────────────

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await post({
      approvalId: "approval-1",
      decision: "approve",
    });

    expect(response.status).toBe(401);
  });

  // ── Validation ─────────────────────────────────────────────────────────

  it("returns 400 when approvalId is missing", async () => {
    authAs("user-1");

    const response = await post({ decision: "approve" });

    expect(response.status).toBe(400);
  });

  it("returns 400 when decision is missing", async () => {
    authAs("user-1");

    const response = await post({ approvalId: "approval-1" });

    expect(response.status).toBe(400);
  });

  it("returns 400 when decision is invalid", async () => {
    authAs("user-1");

    const response = await post({
      approvalId: "approval-1",
      decision: "maybe",
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when approvalId is empty string", async () => {
    authAs("user-1");

    const response = await post({
      approvalId: "",
      decision: "approve",
    });

    expect(response.status).toBe(400);
  });

  // ── Approve ────────────────────────────────────────────────────────────

  it("approves successfully and returns execution state", async () => {
    authAs("user-1");
    mockApprove.mockResolvedValue({
      approved: true,
      executionId: "exec-1",
      newState: "EXECUTING",
    });

    const response = await post({
      approvalId: "approval-1",
      decision: "approve",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.approved).toBe(true);
    expect(body.executionId).toBe("exec-1");
    expect(body.newState).toBe("EXECUTING");

    expect(mockApprove).toHaveBeenCalledWith({
      approvalId: "approval-1",
      userId: "user-1",
      reason: undefined,
    });
  });

  it("passes reason to approve", async () => {
    authAs("user-1");
    mockApprove.mockResolvedValue({
      approved: true,
      executionId: "exec-2",
      newState: "EXECUTING",
    });

    await post({
      approvalId: "approval-2",
      decision: "approve",
      reason: "Parece correcto, continuar.",
    });

    expect(mockApprove).toHaveBeenCalledWith({
      approvalId: "approval-2",
      userId: "user-1",
      reason: "Parece correcto, continuar.",
    });
  });

  // ── Reject ─────────────────────────────────────────────────────────────

  it("rejects successfully and returns FAILED state", async () => {
    authAs("user-1");
    mockReject.mockResolvedValue({
      approved: false,
      executionId: "exec-3",
      newState: "FAILED",
    });

    const response = await post({
      approvalId: "approval-3",
      decision: "reject",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.approved).toBe(false);
    expect(body.executionId).toBe("exec-3");
    expect(body.newState).toBe("FAILED");

    expect(mockReject).toHaveBeenCalledWith({
      approvalId: "approval-3",
      userId: "user-1",
      reason: undefined,
    });
  });

  it("passes reason to reject", async () => {
    authAs("user-1");
    mockReject.mockResolvedValue({
      approved: false,
      executionId: "exec-4",
      newState: "FAILED",
    });

    await post({
      approvalId: "approval-4",
      decision: "reject",
      reason: "El costo estimado es demasiado alto.",
    });

    expect(mockReject).toHaveBeenCalledWith({
      approvalId: "approval-4",
      userId: "user-1",
      reason: "El costo estimado es demasiado alto.",
    });
  });

  // ── Error propagation ──────────────────────────────────────────────────

  it("returns 500 when approval service throws for approve", async () => {
    authAs("user-1");
    mockApprove.mockRejectedValue(new Error("Aprobación no encontrada."));

    const response = await post({
      approvalId: "no-exist",
      decision: "approve",
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("Aprobación no encontrada.");
  });

  it("returns 500 when approval service throws for reject", async () => {
    authAs("user-1");
    mockReject.mockRejectedValue(new Error("Aprobación ya fue decidida."));

    const response = await post({
      approvalId: "already-decided",
      decision: "reject",
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("Aprobación ya fue decidida.");
  });
});
