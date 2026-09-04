import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  isLocalServerRuntimeEnabled: vi.fn(),
  createDbSnapshot: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/runtime/local-capabilities", () => ({ isLocalServerRuntimeEnabled: mocks.isLocalServerRuntimeEnabled }));
vi.mock("@/lib/db-import/service", () => ({ createDbSnapshot: mocks.createDbSnapshot }));

import { POST } from "@/app/api/imports/db/local/export/route";

describe("POST /api/imports/db/local/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.isLocalServerRuntimeEnabled.mockReturnValue(true);
    mocks.createDbSnapshot.mockReturnValue({ snapshot: { schema: "mc.s10.snapshot" }, project: {}, inspection: {} });
  });

  it("requires authentication and local runtime", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const request = new Request("http://localhost/api/imports/db/local/export", { method: "POST", body: JSON.stringify({ path: "C:/test.db", projectId: "1" }) });
    expect((await POST(request)).status).toBe(401);

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.isLocalServerRuntimeEnabled.mockReturnValue(false);
    expect((await POST(request)).status).toBe(403);
  });

  it("returns a snapshot for a valid request", async () => {
    const response = await POST(new Request("http://localhost/api/imports/db/local/export", {
      method: "POST",
      body: JSON.stringify({ path: "C:/test.db", projectId: "1" }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).snapshot).toBeDefined();
    expect(mocks.createDbSnapshot).toHaveBeenCalledWith("C:/test.db", "1", undefined);
  });

  it("rejects path traversal", async () => {
    const response = await POST(new Request("http://localhost/api/imports/db/local/export", {
      method: "POST",
      body: JSON.stringify({ path: "C:/../test.db", projectId: "1" }),
    }));
    expect(response.status).toBe(400);
  });
});
