import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/workspace/authorization", () => ({
  requireWorkspaceOwner: vi.fn(),
  WorkspaceAuthorizationError: class WorkspaceAuthorizationError extends Error {},
}));
vi.mock("@/lib/billing/yape", () => ({
  createWorkspaceYapePaymentRequest: vi.fn(),
  getYapePaymentConfig: vi.fn(() => ({
    accountName: "MC Presupuestos",
    amount: "S/ 299.00",
    offerCode: "PRO_ANNUAL_FOUNDER",
    phone: "999999999",
    qrImageUrl: "/yape-qr.png",
  })),
}));

import { POST } from "@/app/api/workspaces/[id]/billing/yape/request/route";
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceOwner } from "@/lib/workspace/authorization";
import { createWorkspaceYapePaymentRequest } from "@/lib/billing/yape";

describe("POST /api/workspaces/[id]/billing/yape/request", () => {
  beforeEach(() => vi.resetAllMocks());

  it("requires an authenticated session", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "ws-1" }) });

    expect(response.status).toBe(401);
    expect(createWorkspaceYapePaymentRequest).not.toHaveBeenCalled();
  });

  it("creates a workspace-scoped manual request for the owner", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(createWorkspaceYapePaymentRequest).mockResolvedValue({
      id: "company-request-1",
      createdAt: new Date("2026-08-22T12:00:00.000Z"),
      status: "INCOMPLETE",
    });

    const response = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "ws-1" }) });

    expect(response.status).toBe(200);
    expect(requireWorkspaceOwner).toHaveBeenCalledWith({ userId: "user-1", companyId: "ws-1" });
    expect(createWorkspaceYapePaymentRequest).toHaveBeenCalledWith({ companyId: "ws-1" });
    await expect(response.json()).resolves.toMatchObject({ requestId: "company-request-1", status: "INCOMPLETE" });
  });
});
