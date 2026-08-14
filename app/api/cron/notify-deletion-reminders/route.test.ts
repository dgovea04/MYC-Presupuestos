import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyDueAdminDeletionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/data/admin-deletion-approvals", () => ({
  notifyDueAdminDeletions: notifyDueAdminDeletionsMock,
}));

import { GET } from "@/app/api/cron/notify-deletion-reminders/route";

const originalEnv = process.env;

describe("GET /api/cron/notify-deletion-reminders", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "test-secret" };
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(new Request("http://localhost/api/cron/notify-deletion-reminders"));

    expect(response.status).toBe(500);
    expect(notifyDueAdminDeletionsMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid cron secret", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/notify-deletion-reminders", {
        headers: { Authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(notifyDueAdminDeletionsMock).not.toHaveBeenCalled();
  });

  it("processes due deletion reminders with the valid bearer token", async () => {
    notifyDueAdminDeletionsMock.mockResolvedValue({ checked: 2, sent: 2, failed: 0 });

    const response = await GET(
      new Request("http://localhost/api/cron/notify-deletion-reminders", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      checked: 2,
      sent: 2,
      failed: 0,
      checkedAt: expect.any(String),
    });
    expect(notifyDueAdminDeletionsMock).toHaveBeenCalledOnce();
  });

  it("returns 500 when processing fails", async () => {
    notifyDueAdminDeletionsMock.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(
      new Request("http://localhost/api/cron/notify-deletion-reminders", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(500);
  });
});
