import { describe, expect, it, vi } from "vitest";

const requireAdminSessionMock = vi.hoisted(() => vi.fn());
const anonymizeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: requireAdminSessionMock }));
vi.mock("@/lib/data/admin-audit-retention", () => ({ anonymizeAdminAuditLogsBefore: anonymizeMock }));

import { POST } from "@/app/api/admin/audit/retention/route";

describe("admin audit retention route", () => {
  it("returns forbidden without the retention capability and MFA proof", async () => {
    requireAdminSessionMock.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/admin/audit/retention", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(requireAdminSessionMock).toHaveBeenCalledWith("audit.manage_retention", expect.any(Request));
    expect(anonymizeMock).not.toHaveBeenCalled();
  });

  it("runs anonymization for an authorized administrator", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });
    anonymizeMock.mockResolvedValue({ anonymizedCount: 4, cutoff: new Date("2026-05-16T12:00:00.000Z") });

    const response = await POST(new Request("http://localhost/api/admin/audit/retention", { method: "POST" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, anonymizedCount: 4 });
    expect(anonymizeMock).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "admin-1", actorEmail: "admin@example.com" }));
  });
});
