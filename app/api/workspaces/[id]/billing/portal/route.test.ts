import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/workspace/entitlements", () => ({ assertWorkspaceFeatureAccess: vi.fn() }));
vi.mock("@/lib/workspace/authorization", () => ({
  requireWorkspaceOwner: vi.fn(),
  WorkspaceAuthorizationError: class WorkspaceAuthorizationError extends Error {},
}));
vi.mock("@/lib/billing/stripe", () => ({ createWorkspaceBillingPortalSession: vi.fn() }));

import { POST } from "@/app/api/workspaces/[id]/billing/portal/route";
import { getAuthSession } from "@/lib/auth/session";
import { createWorkspaceBillingPortalSession } from "@/lib/billing/stripe";
import { requireWorkspaceOwner } from "@/lib/workspace/authorization";

describe("POST /api/workspaces/[id]/billing/portal", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 without a session", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);
    const response = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-owners", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1", email: "owner@example.com" } });
    vi.mocked(requireWorkspaceOwner).mockRejectedValue(new Error("Sin permisos"));
    const response = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(403);
  });

  it("opens the workspace billing portal and returns its URL", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1", email: "owner@example.com" } });
    vi.mocked(createWorkspaceBillingPortalSession).mockResolvedValue({ id: "bps_1", url: "https://portal.stripe.test/session" });
    const response = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(200);
    expect(createWorkspaceBillingPortalSession).toHaveBeenCalledWith({ companyId: "ws-1" });
    await expect(response.json()).resolves.toEqual({ url: "https://portal.stripe.test/session" });
  });
});
