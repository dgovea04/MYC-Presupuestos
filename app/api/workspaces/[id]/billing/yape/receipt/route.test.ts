import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  requireWorkspaceOwner: vi.fn(),
  companySubscriptionFindFirst: vi.fn(),
  storeYapeReceipt: vi.fn(),
  companySubscriptionUpdate: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/authorization", () => ({
  requireWorkspaceOwner: mocks.requireWorkspaceOwner,
  WorkspaceAuthorizationError: class WorkspaceAuthorizationError extends Error {},
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    companySubscription: {
      findFirst: mocks.companySubscriptionFindFirst,
      update: mocks.companySubscriptionUpdate,
    },
  },
}));
vi.mock("@/lib/storage/yape-receipts", () => ({ storeYapeReceipt: mocks.storeYapeReceipt }));

import { POST } from "@/app/api/workspaces/[id]/billing/yape/receipt/route";

describe("POST /api/workspaces/[id]/billing/yape/receipt", () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset?.()));

  it("requires an authenticated session", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "ws-1" }) });

    expect(response.status).toBe(401);
    expect(mocks.storeYapeReceipt).not.toHaveBeenCalled();
  });

  it("returns 404 when there is no pending Yape request for the workspace", async () => {
    mocks.getAuthSession.mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    mocks.companySubscriptionFindFirst.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost", { method: "POST", body: new FormData() }), {
      params: Promise.resolve({ id: "ws-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 when no file is provided", async () => {
    mocks.getAuthSession.mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    mocks.companySubscriptionFindFirst.mockResolvedValue({ id: "sub-1" });

    const response = await POST(new Request("http://localhost", { method: "POST", body: new FormData() }), {
      params: Promise.resolve({ id: "ws-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Comprobante requerido." });
  });

  it("uploads a receipt and updates the subscription", async () => {
    mocks.getAuthSession.mockResolvedValue({ expires: new Date().toISOString(), user: { id: "owner-1" } });
    mocks.companySubscriptionFindFirst.mockResolvedValue({ id: "sub-1" });
    mocks.storeYapeReceipt.mockResolvedValue({ filePath: "/uploads/yape-receipts/sub-1/comprobante-1.jpg" });

    const formData = new FormData();
    formData.set("file", new File(["content"], "comprobante.jpg", { type: "image/jpeg" }));

    const response = await POST(new Request("http://localhost", { method: "POST", body: formData }), {
      params: Promise.resolve({ id: "ws-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      receiptUrl: "/uploads/yape-receipts/sub-1/comprobante-1.jpg",
    });
    expect(mocks.companySubscriptionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { receiptUrl: "/uploads/yape-receipts/sub-1/comprobante-1.jpg", receiptUploadedAt: expect.any(Date) },
    });
    expect(mocks.requireWorkspaceOwner).toHaveBeenCalledWith({ userId: "owner-1", companyId: "ws-1" });
  });
});