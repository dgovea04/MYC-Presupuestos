import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/billing/webhook", () => ({
  constructStripeWebhookEvent: vi.fn(),
  processStripeWebhookEvent: vi.fn(),
}));

import { POST } from "@/app/api/billing/webhook/route";
import { constructStripeWebhookEvent, processStripeWebhookEvent } from "@/lib/billing/webhook";

describe("billing webhook route", () => {
  it("rejects invalid Stripe signatures", async () => {
    vi.mocked(constructStripeWebhookEvent).mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const response = await POST(new Request("http://localhost/api/billing/webhook", { method: "POST", body: "{}" }));

    expect(response.status).toBe(400);
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
  });
});
