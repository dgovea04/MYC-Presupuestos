import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/billing/yape", () => ({
  createYapePaymentRequest: vi.fn(),
  getYapePaymentConfig: vi.fn(() => ({
    accountName: "MC Presupuestos",
    amount: "S/ 49.00",
    phone: "999999999",
    qrImageUrl: "/yape-qr.png",
  })),
}));

import { POST } from "@/app/api/billing/yape/request/route";
import { getAuthSession } from "@/lib/auth/session";
import { createYapePaymentRequest } from "@/lib/billing/yape";

describe("billing yape request route", () => {
  it("requires login", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(createYapePaymentRequest).not.toHaveBeenCalled();
  });

  it("creates a manual Yape payment request", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(createYapePaymentRequest).mockResolvedValue({
      id: "manual-request-1",
      createdAt: new Date("2026-05-29T12:00:00.000Z"),
      status: "INCOMPLETE",
    });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(createYapePaymentRequest).toHaveBeenCalledWith({ userId: "user-1" });
    await expect(response.json()).resolves.toEqual({
      requestId: "manual-request-1",
      status: "INCOMPLETE",
      createdAt: "2026-05-29T12:00:00.000Z",
      yape: {
        accountName: "MC Presupuestos",
        amount: "S/ 49.00",
        phone: "999999999",
        qrImageUrl: "/yape-qr.png",
      },
    });
  });
});
