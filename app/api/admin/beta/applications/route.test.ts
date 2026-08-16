import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  listBetaApplications: vi.fn(),
  reviewBetaApplication: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/beta/applications", () => ({
  listBetaApplications: mocks.listBetaApplications,
  reviewBetaApplication: mocks.reviewBetaApplication,
}));

import { GET, PATCH } from "@/app/api/admin/beta/applications/route";

function buildRequest(url: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method: body ? "PATCH" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const adminSession = { user: { id: "admin-1", email: "admin@example.com", isSuperAdmin: false, adminProfile: "ADMIN" } };

describe("admin beta applications routes", () => {
  beforeEach(() => {
    mocks.requireAdminSession.mockReset();
    mocks.listBetaApplications.mockReset();
    mocks.reviewBetaApplication.mockReset();
  });

  it("requires admin access to list applications", async () => {
    mocks.requireAdminSession.mockResolvedValue(null);
    const response = await GET(buildRequest("/api/admin/beta/applications"));
    expect(response.status).toBe(403);
    expect(mocks.listBetaApplications).not.toHaveBeenCalled();
  });

  it("allows beta admins to read applications", async () => {
    mocks.requireAdminSession.mockResolvedValue(adminSession);
    mocks.listBetaApplications.mockResolvedValue([]);
    const response = await GET(buildRequest("/api/admin/beta/applications?status=PENDING"));
    expect(response.status).toBe(200);
    expect(mocks.listBetaApplications).toHaveBeenCalledWith("PENDING");
  });

  it("blocks review actions for non-Super Admin users", async () => {
    mocks.requireAdminSession.mockResolvedValue(adminSession);
    const response = await PATCH(buildRequest("/api/admin/beta/applications?id=application-1", { decision: "APPROVE" }));
    expect(response.status).toBe(403);
    expect(mocks.reviewBetaApplication).not.toHaveBeenCalled();
  });

  it("lets a Super Admin approve an application", async () => {
    const superAdminSession = { user: { ...adminSession.user, isSuperAdmin: true } };
    mocks.requireAdminSession.mockResolvedValue(superAdminSession);
    mocks.reviewBetaApplication.mockResolvedValue({ application: { id: "application-1" }, grant: { grantId: "grant-1" } });
    const response = await PATCH(buildRequest("/api/admin/beta/applications?id=application-1", { decision: "APPROVE", reviewNote: "Validado" }));
    expect(response.status).toBe(200);
    expect(mocks.reviewBetaApplication).toHaveBeenCalledWith({ applicationId: "application-1", reviewerId: "admin-1", decision: "APPROVE", reviewNote: "Validado" });
  });
});
