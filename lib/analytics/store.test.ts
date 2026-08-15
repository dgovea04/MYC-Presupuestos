import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    marketingEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import { persistMarketingEvent } from "@/lib/analytics/store";

describe("marketing event store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.marketingEvent.create.mockResolvedValue({ id: "event-1" });
  });

  it("stores attribution and removes personal or financial parameters", async () => {
    await persistMarketingEvent({
      name: "signup_completed",
      userId: "user-1",
      clientId: "client-1",
      params: {
        registration_method: "email",
        first_touch_utm_source: "google",
        utm_campaign: "obra-2026",
        email: "engineer@example.com",
        project_name: "Edificio privado",
        amount: 123456,
      },
    });

    expect(prismaMock.marketingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "signup_completed",
        userId: "user-1",
        clientId: "client-1",
        firstTouchUtmSource: "google",
        utmCampaign: "obra-2026",
        parameters: {
          registration_method: "email",
          first_touch_utm_source: "google",
          utm_campaign: "obra-2026",
        },
      }),
    });

    const data = prismaMock.marketingEvent.create.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("email");
    expect(data).not.toHaveProperty("amount");
    expect(JSON.stringify(data)).not.toContain("engineer@example.com");
    expect(JSON.stringify(data)).not.toContain("123456");
  });
});
