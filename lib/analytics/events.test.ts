import { afterEach, describe, expect, it, vi } from "vitest";

const { persistMarketingEventMock } = vi.hoisted(() => ({
  persistMarketingEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/analytics/store", () => ({ persistMarketingEvent: persistMarketingEventMock }));

import { trackServerEvent } from "@/lib/analytics/events";

describe("server analytics events", () => {
  afterEach(() => {
    persistMarketingEventMock.mockClear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does nothing when GA4 server credentials are not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
    vi.stubEnv("GA_API_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await trackServerEvent("project_created", { userId: "user-1", companyId: "company-1" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(persistMarketingEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "project_created", userId: "user-1" }),
    );
  });

  it("sends scalar event parameters to the Measurement Protocol endpoint", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");
    vi.stubEnv("GA_API_SECRET", "secret");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await trackServerEvent("subscription_created", {
      userId: "user-1",
      provider: "stripe",
      target_plan: "pro",
      subscription_status: "ACTIVE",
      warnings: ["must not be sent"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.google-analytics.com/mp/collect?measurement_id=G-TEST123&api_secret=secret",
      expect.objectContaining({ method: "POST" }),
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body)) as {
      client_id: string;
      user_id: string;
      events: Array<{ name: string; params: Record<string, unknown> }>;
    };

    expect(body.client_id).toBe("server.user-1");
    expect(body.user_id).toBe("user-1");
    expect(body.events[0]).toEqual({
      name: "subscription_created",
      params: {
        event_version: "1",
        source: "server",
        provider: "stripe",
        target_plan: "pro",
        subscription_status: "ACTIVE",
      },
    });
  });

  it("throws on a rejected Measurement Protocol request so callers can handle it safely", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");
    vi.stubEnv("GA_API_SECRET", "secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 400 })));

    await expect(
      trackServerEvent("export_completed", { userId: "user-1", export_target: "budget" }),
    ).rejects.toThrow("Google Analytics rejected export_completed");
  });
});
