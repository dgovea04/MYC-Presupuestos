import { describe, expect, it, vi } from "vitest";
import { processStripeWebhookEvent } from "@/lib/billing/webhook";

describe("billing webhook processing", () => {
  it("skips events that were already processed", async () => {
    const prisma = createWebhookPrismaMock({ existingEvent: true });
    const syncStripeSubscription = vi.fn();

    await processStripeWebhookEvent({
      event: createSubscriptionEvent("customer.subscription.updated"),
      prisma,
      syncStripeSubscription,
    });

    expect(syncStripeSubscription).not.toHaveBeenCalled();
    expect(prisma.billingWebhookEvent.create).not.toHaveBeenCalled();
  });

  it("records the event and syncs subscription changes idempotently", async () => {
    const prisma = createWebhookPrismaMock({ existingEvent: false });
    const syncStripeSubscription = vi.fn().mockResolvedValue(undefined);

    await processStripeWebhookEvent({
      event: createSubscriptionEvent("customer.subscription.updated"),
      prisma,
      syncStripeSubscription,
    });

    expect(syncStripeSubscription).toHaveBeenCalledWith({ subscriptionId: "sub_1" });
    expect(prisma.billingWebhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeEventId: "evt_1",
        type: "customer.subscription.updated",
      }),
    });
  });
});

function createWebhookPrismaMock({ existingEvent }: { existingEvent: boolean }) {
  return {
    billingWebhookEvent: {
      findUnique: vi.fn().mockResolvedValue(existingEvent ? { id: "event-1" } : null),
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

function createSubscriptionEvent(type: "customer.subscription.updated") {
  return {
    id: "evt_1",
    type,
    data: {
      object: {
        id: "sub_1",
      },
    },
  };
}
