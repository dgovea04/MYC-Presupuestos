import { describe, expect, it, vi } from "vitest";
import { touchWorkspaceMembershipActivity } from "@/lib/workspace/activity";
import { formatRelativeLastActive } from "@/lib/workspace/activity-format";

function createClient() {
  return {
    companyMembership: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe("touchWorkspaceMembershipActivity", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");

  it("writes when the member has never been active", async () => {
    const client = createClient();
    client.companyMembership.findUnique.mockResolvedValue({ status: "ACTIVE", lastActiveAt: null });
    await expect(touchWorkspaceMembershipActivity({ userId: "u1", companyId: "c1", now, client })).resolves.toBe(true);
    expect(client.companyMembership.update).toHaveBeenCalledWith({
      where: { companyId_userId: { companyId: "c1", userId: "u1" } },
      data: { lastActiveAt: now },
    });
  });

  it("writes when the last mark is older than the throttle window", async () => {
    const client = createClient();
    client.companyMembership.findUnique.mockResolvedValue({ status: "ACTIVE", lastActiveAt: new Date("2026-08-20T12:00:00.000Z") });
    await expect(touchWorkspaceMembershipActivity({ userId: "u1", companyId: "c1", now, client })).resolves.toBe(true);
    expect(client.companyMembership.update).toHaveBeenCalled();
  });

  it("skips the write when within the throttle window", async () => {
    const client = createClient();
    client.companyMembership.findUnique.mockResolvedValue({ status: "ACTIVE", lastActiveAt: new Date("2026-08-21T11:55:00.000Z") });
    await expect(touchWorkspaceMembershipActivity({ userId: "u1", companyId: "c1", now, client })).resolves.toBe(false);
    expect(client.companyMembership.update).not.toHaveBeenCalled();
  });

  it("skips inactive or missing memberships", async () => {
    const client = createClient();
    client.companyMembership.findUnique.mockResolvedValue(null);
    await expect(touchWorkspaceMembershipActivity({ userId: "u1", companyId: "c1", now, client })).resolves.toBe(false);
    expect(client.companyMembership.update).not.toHaveBeenCalled();
  });
});

describe("formatRelativeLastActive", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");

  it("returns Nunca for missing values", () => {
    expect(formatRelativeLastActive(null, now)).toEqual({ relative: "Nunca", absolute: null });
  });

  it("returns Hoy for today", () => {
    expect(formatRelativeLastActive(new Date("2026-08-21T08:00:00.000Z"), now).relative).toBe("Hoy");
  });

  it("returns Ayer for yesterday", () => {
    expect(formatRelativeLastActive(new Date("2026-08-20T23:59:00.000Z"), now).relative).toBe("Ayer");
  });

  it("returns Hace N días for older dates and exposes the absolute date", () => {
    const result = formatRelativeLastActive(new Date("2026-08-18T12:00:00.000Z"), now);
    expect(result.relative).toBe("Hace 3 días");
    expect(result.absolute).toBeTruthy();
  });
});
