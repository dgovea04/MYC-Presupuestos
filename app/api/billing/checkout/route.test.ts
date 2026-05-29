import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/billing/stripe", () => ({
  createProCheckoutSession: vi.fn(),
}));

import { POST } from "@/app/api/billing/checkout/route";
import { getAuthSession } from "@/lib/auth/session";
import { createProCheckoutSession } from "@/lib/billing/stripe";

describe("billing checkout route", () => {
  it("requires an authenticated user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(createProCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns a Stripe Checkout URL for Pro", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      user: { id: "user-1", email: "user@example.com", name: "User Uno", role: "USER", status: "ACTIVE" },
      expires: "2026-06-01T00:00:00.000Z",
    });
    vi.mocked(createProCheckoutSession).mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/session" });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "https://checkout.stripe.test/session" });
  });
});
