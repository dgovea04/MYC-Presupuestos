import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Auth mock ───────────────────────────────────────────────────────────────
vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

// ── Billing mock ────────────────────────────────────────────────────────────
import { createBillingMock } from "@/app/api/ai/__tests__/billing-mock";
vi.mock("@/lib/billing/entitlements", () => createBillingMock());

// ── Approval service mock ───────────────────────────────────────────────────
const mockGetStatus = vi.fn();

vi.mock("@/lib/ai/agent/approval-service", () => ({
  createApprovalService: vi.fn(() => ({
    getStatus: mockGetStatus,
  })),
}));

import { GET } from "@/app/api/ai/approvals/[approvalId]/route";
import { getAuthSession } from "@/lib/auth/session";

function authAs(userId: string) {
  vi.mocked(getAuthSession).mockResolvedValue({
    expires: new Date().toISOString(),
    user: { id: userId },
  } as ReturnType<typeof getAuthSession> extends Promise<infer T> ? T : never);
}

function get(approvalId: string) {
  return GET(
    new Request(`http://localhost/api/ai/approvals/${approvalId}`, {
      method: "GET",
    }),
    { params: Promise.resolve({ approvalId }) },
  );
}

describe("GET /api/ai/approvals/[approvalId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth ───────────────────────────────────────────────────────────────

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await get("approval-1");

    expect(response.status).toBe(401);
  });

  // ── Success ────────────────────────────────────────────────────────────

  it("returns approval status when found (pending)", async () => {
    authAs("user-1");
    mockGetStatus.mockResolvedValue({
      approvalId: "approval-1",
      executionId: "exec-1",
      decision: "pending",
      reason: undefined,
      decidedByUserId: undefined,
      decidedAt: undefined,
      requestedAt: new Date("2026-07-09T10:00:00Z"),
    });

    const response = await get("approval-1");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.approval.id).toBe("approval-1");
    expect(body.approval.executionId).toBe("exec-1");
    expect(body.approval.decision).toBe("pending");
    expect(body.approval.reason).toBeNull();
    expect(body.approval.decidedByUserId).toBeNull();
    expect(body.approval.decidedAt).toBeNull();
    expect(body.approval.requestedAt).toBe("2026-07-09T10:00:00.000Z");
  });

  it("returns approval with approve decision", async () => {
    authAs("user-1");
    mockGetStatus.mockResolvedValue({
      approvalId: "approval-2",
      executionId: "exec-1",
      decision: "approve",
      reason: "Costo aceptable.",
      decidedByUserId: "user-2",
      decidedAt: new Date("2026-07-09T11:00:00Z"),
      requestedAt: new Date("2026-07-09T10:00:00Z"),
    });

    const response = await get("approval-2");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.approval.decision).toBe("approve");
    expect(body.approval.reason).toBe("Costo aceptable.");
    expect(body.approval.decidedByUserId).toBe("user-2");
    expect(body.approval.decidedAt).toBe("2026-07-09T11:00:00.000Z");
  });

  it("returns approval with reject decision", async () => {
    authAs("user-1");
    mockGetStatus.mockResolvedValue({
      approvalId: "approval-3",
      executionId: "exec-1",
      decision: "reject",
      reason: "Presupuesto excede el límite.",
      decidedByUserId: "user-3",
      decidedAt: new Date("2026-07-09T12:00:00Z"),
      requestedAt: new Date("2026-07-09T09:00:00Z"),
    });

    const response = await get("approval-3");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.approval.decision).toBe("reject");
    expect(body.approval.reason).toBe("Presupuesto excede el límite.");
    expect(body.approval.decidedByUserId).toBe("user-3");
  });

  // ── Not found ─────────────────────────────────────────────────────────

  it("returns 404 when approval is not found", async () => {
    authAs("user-1");
    mockGetStatus.mockRejectedValue(
      new Error("Aprobación \"no-exist\" no encontrada."),
    );

    const response = await get("no-exist");

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("no encontrada");
  });

  // ── Error ──────────────────────────────────────────────────────────────

  it("returns 500 on unexpected error", async () => {
    authAs("user-1");
    mockGetStatus.mockRejectedValue(new Error("Error de conexión a la base de datos."));

    const response = await get("approval-1");

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("Error de conexión");
  });
});
