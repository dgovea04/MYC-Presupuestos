import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  isLocalServerRuntimeEnabled: vi.fn(),
  discoverDbProjects: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/runtime/local-capabilities", () => ({ isLocalServerRuntimeEnabled: mocks.isLocalServerRuntimeEnabled }));
vi.mock("@/lib/db-import/service", () => ({ discoverDbProjects: mocks.discoverDbProjects }));

import { GET } from "@/app/api/imports/db/local/projects/route";

describe("GET /api/imports/db/local/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.isLocalServerRuntimeEnabled.mockReturnValue(true);
    mocks.discoverDbProjects.mockReturnValue([]);
  });

  it("requires authentication", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/imports/db/local/projects?path=C%3A%2Ftest.db"))).status).toBe(401);
  });

  it("requires local runtime", async () => {
    mocks.isLocalServerRuntimeEnabled.mockReturnValue(false);
    expect((await GET(new Request("http://localhost/api/imports/db/local/projects?path=C%3A%2Ftest.db"))).status).toBe(403);
  });

  it("rejects traversal and missing paths", async () => {
    expect((await GET(new Request("http://localhost/api/imports/db/local/projects"))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/imports/db/local/projects?path=C%3A%2F..%2Ftest.db"))).status).toBe(400);
  });

  it("returns discovered projects", async () => {
    mocks.discoverDbProjects.mockReturnValue([{ id: "1", name: "Test", subBudgetCount: 1, itemCount: 2, subBudgets: [] }]);
    const response = await GET(new Request("http://localhost/api/imports/db/local/projects?path=C%3A%2Ftest.db"));
    expect(response.status).toBe(200);
    expect((await response.json()).projects[0].id).toBe("1");
  });
});
