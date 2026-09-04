import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  discoverDbProjects: vi.fn(),
  createDbSnapshot: vi.fn(),
  createS10ImportDraftPreview: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/db-import/service", () => ({ discoverDbProjects: mocks.discoverDbProjects, createDbSnapshot: mocks.createDbSnapshot }));
vi.mock("@/lib/s10/import-preview", () => ({ createS10ImportDraftPreview: mocks.createS10ImportDraftPreview }));
vi.mock("@/lib/s10/snapshot-contract", () => ({ parseS10SnapshotValue: vi.fn((value: unknown) => ({ snapshot: value })) }));

import { POST } from "@/app/api/imports/db/draft/route";

function formRequest(fileName = "budget.db", fields: Record<string, string> = {}) {
  const form = new FormData();
  form.set("file", new File([Buffer.from("SQLite format 3\0")], fileName));
  Object.entries(fields).forEach(([key, value]) => form.set(key, value));
  return new Request("http://localhost/api/imports/db/draft", { method: "POST", body: form });
}

describe("POST /api/imports/db/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.discoverDbProjects.mockReturnValue([{ id: "1", name: "Test", subBudgetCount: 0, itemCount: 1, subBudgets: [] }]);
    mocks.createDbSnapshot.mockReturnValue({ snapshot: { presupuestos: [] }, project: {}, inspection: {} });
    mocks.createS10ImportDraftPreview.mockReturnValue({ projectName: "Test", warnings: [] });
  });

  it("requires authentication", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    expect((await POST(formRequest())).status).toBe(401);
  });

  it("discovers projects without parsing a selected project", async () => {
    const response = await POST(formRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).projects[0].id).toBe("1");
    expect(mocks.createDbSnapshot).not.toHaveBeenCalled();
  });

  it("returns a preview and snapshot for a selected project", async () => {
    const response = await POST(formRequest("budget.db", { projectId: "1" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.preview.projectName).toBe("Test");
    expect(body.snapshot).toBeDefined();
    expect(mocks.createS10ImportDraftPreview).toHaveBeenCalled();
  });

  it("rejects unsupported extensions", async () => {
    const response = await POST(formRequest("budget.xlsx"));
    expect(response.status).toBe(400);
  });
});
