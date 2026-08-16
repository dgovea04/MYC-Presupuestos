import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcileBetaGrants: vi.fn(),
}));

vi.mock("@/lib/beta/reconciliation", () => ({ reconcileBetaGrants: mocks.reconcileBetaGrants }));

import { GET } from "@/app/api/cron/reconcile-beta-grants/route";

const originalEnv = process.env;

describe("GET /api/cron/reconcile-beta-grants", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "test-secret" };
  });

  it("rejects requests without a configured secret", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(new Request("http://localhost/api/cron/reconcile-beta-grants"));

    expect(response.status).toBe(500);
    expect(mocks.reconcileBetaGrants).not.toHaveBeenCalled();
  });

  it("rejects an invalid secret", async () => {
    const response = await GET(new Request("http://localhost/api/cron/reconcile-beta-grants", {
      headers: { Authorization: "Bearer wrong-secret" },
    }));

    expect(response.status).toBe(401);
    expect(mocks.reconcileBetaGrants).not.toHaveBeenCalled();
  });

  it("runs reconciliation with a valid bearer token", async () => {
    mocks.reconcileBetaGrants.mockResolvedValue({
      activated: 1,
      expired: 2,
      remindersRecorded: 1,
      notificationsSent: 1,
      notificationFailures: 0,
      checkedAt: "2026-08-15T08:00:00.000Z",
    });

    const response = await GET(new Request("http://localhost/api/cron/reconcile-beta-grants", {
      headers: { Authorization: "Bearer test-secret" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ activated: 1, expired: 2, remindersRecorded: 1 });
    expect(mocks.reconcileBetaGrants).toHaveBeenCalledOnce();
  });

  it("returns 500 when reconciliation fails", async () => {
    mocks.reconcileBetaGrants.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(new Request("http://localhost/api/cron/reconcile-beta-grants", {
      headers: { Authorization: "Bearer test-secret" },
    }));

    expect(response.status).toBe(500);
  });
});
