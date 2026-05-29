import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/billing/stripe", () => ({
  createBillingPortalSession: vi.fn(),
}));

import { POST } from "@/app/api/billing/portal/route";
import { getAuthSession } from "@/lib/auth/session";
import { createBillingPortalSession } from "@/lib/billing/stripe";

describe("billing portal route", () => {
  it("requires an authenticated user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });

  it("returns a Stripe Customer Portal URL", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      user: { id: "user-1", email: "user@example.com", name: "User Uno", role: "USER", status: "ACTIVE" },
      expires: "2026-06-01T00:00:00.000Z",
    });
    vi.mocked(createBillingPortalSession).mockResolvedValue({ id: "bps_1", url: "https://portal.stripe.test/session" });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "https://portal.stripe.test/session" });
  });
});
