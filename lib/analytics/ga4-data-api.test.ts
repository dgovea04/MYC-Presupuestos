import { afterEach, describe, expect, it, vi } from "vitest";

const { signerMock } = vi.hoisted(() => ({
  signerMock: {
    update: vi.fn(),
    end: vi.fn(),
    sign: vi.fn().mockReturnValue("signature"),
  },
}));

vi.mock("node:crypto", () => ({
  createSign: vi.fn(() => signerMock),
}));

import { getGa4MarketingReport } from "@/lib/analytics/ga4-data-api";

describe("GA4 Data API client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("fails soft when server credentials are not configured", async () => {
    vi.stubEnv("GA4_PROPERTY_ID", "");
    vi.stubEnv("GA4_SERVICE_ACCOUNT_EMAIL", "");
    vi.stubEnv("GA4_SERVICE_ACCOUNT_PRIVATE_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGa4MarketingReport({
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-08T00:00:00.000Z"),
    });

    expect(result).toEqual(expect.objectContaining({ available: false }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("authenticates and parses event and active-user reports", async () => {
    vi.stubEnv("GA4_PROPERTY_ID", "123456");
    vi.stubEnv("GA4_SERVICE_ACCOUNT_EMAIL", "analytics@example.iam.gserviceaccount.com");
    vi.stubEnv("GA4_SERVICE_ACCOUNT_PRIVATE_KEY", "private-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        rows: [
          { dimensionValues: [{ value: "landing_view" }], metricValues: [{ value: "12" }, { value: "10" }] },
          { dimensionValues: [{ value: "unknown_event" }], metricValues: [{ value: "99" }, { value: "99" }] },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        rows: [{ metricValues: [{ value: "10" }] }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGa4MarketingReport({
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-08T00:00:00.000Z"),
    });

    expect(result).toEqual({
      available: true,
      activeUsers: 10,
      events: [{ name: "landing_view", count: 12, users: 10 }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://analyticsdata.googleapis.com/v1beta/properties/123456:runReport");
  });
});
