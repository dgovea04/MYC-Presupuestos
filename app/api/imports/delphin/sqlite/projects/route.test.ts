import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  listDelphinSqliteProjects: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/runtime/local-capabilities", () => ({
  isLocalServerRuntimeEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/delphin/sqlite-reader", () => ({
  listDelphinSqliteProjects: mocks.listDelphinSqliteProjects,
}));

import { GET } from "@/app/api/imports/delphin/sqlite/projects/route";

describe("GET /api/imports/delphin/sqlite/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("returns 401 without auth", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/imports/delphin/sqlite/projects?path=test.sqlite"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when path is missing", async () => {
    const response = await GET(new Request("http://localhost/api/imports/delphin/sqlite/projects"));
    expect(response.status).toBe(400);
  });

  it("lists projects from a valid path", async () => {
    mocks.listDelphinSqliteProjects.mockReturnValue([{ id: "PR01", name: "Test", budgetCount: 2 }]);
    const response = await GET(new Request("http://localhost/api/imports/delphin/sqlite/projects?path=C%3A%2Ftest.sqlite"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].id).toBe("PR01");
  });

  it("returns 400 on read error", async () => {
    mocks.listDelphinSqliteProjects.mockImplementation(() => {
      throw new Error("SQLite read error");
    });
    const response = await GET(new Request("http://localhost/api/imports/delphin/sqlite/projects?path=test.sqlite"));
    expect(response.status).toBe(400);
  });
});