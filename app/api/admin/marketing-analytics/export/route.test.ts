import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  consumeRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn(),
  getRequestClientIp: vi.fn(),
  getAdminMarketingAnalytics: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  getRateLimitHeaders: mocks.getRateLimitHeaders,
  getRequestClientIp: mocks.getRequestClientIp,
}));
vi.mock("@/lib/data/admin-marketing-analytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/admin-marketing-analytics")>("@/lib/data/admin-marketing-analytics");
  return {
    ...actual,
    getAdminMarketingAnalytics: mocks.getAdminMarketingAnalytics,
  };
});

import { GET } from "@/app/api/admin/marketing-analytics/export/route";

describe("admin marketing analytics export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 600 });
    mocks.getRateLimitHeaders.mockReturnValue({});
    mocks.getRequestClientIp.mockReturnValue("127.0.0.1");
  });

  it("rejects users without admin access", async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/marketing-analytics/export"));

    expect(response.status).toBe(403);
    expect(mocks.getAdminMarketingAnalytics).not.toHaveBeenCalled();
  });

  it("exports funnel, UTM and cohort sections as escaped CSV", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.getAdminMarketingAnalytics.mockResolvedValue({
      available: true,
      range: { from: "2026-08-01T00:00:00.000Z", to: "2026-08-07T23:59:59.999Z" },
      metrics: {
        visitors: 10,
        signups: 4,
        activated: 2,
        wau: 3,
        wab: 2,
        pro: 1,
        newPro: 1,
        upgradeClicked: 3,
        checkoutStarted: 2,
        subscriptionCreated: 1,
      },
      rates: { signupRate: 40, activationRate: 50, proRate: 50 },
      byUtm: [{ source: "google", medium: "cpc", campaign: "obra, agosto", content: "video-1", signups: 2, activated: 1 }],
      ahaMoments: [{ eventName: "project_created", users: 1, activationRate: 25, shareOfActivated: 50 }],
      cohorts: [{
        week: "2026-07-27",
        signups: 2,
        activated: 1,
        activationRate: 50,
        w1: { users: null, rate: null },
        w4: { users: 1, rate: 50 },
        w8: { users: 0, rate: 0 },
      }],
    });

    const response = await GET(
      new Request("http://localhost/api/admin/marketing-analytics/export?from=2026-08-01&to=2026-08-07"),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("mc-presupuestos-marketing-2026-08-01-2026-08-07.csv");
    expect(body).toContain('"obra, agosto"');
    expect(body).toContain("Cohorte,2026-07-27,2,1,50%,,1 (50%),0 (0%)");
    expect(mocks.getAdminMarketingAnalytics).toHaveBeenCalledWith({
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-08T00:00:00.000Z"),
    });
  });
});
