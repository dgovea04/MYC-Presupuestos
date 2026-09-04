import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  createDbSnapshot: vi.fn(),
  importS10SnapshotToMyc: vi.fn(),
  trackServerEvent: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/db-import/service", () => ({ createDbSnapshot: mocks.createDbSnapshot }));
vi.mock("@/lib/s10/import-persistence", () => ({ importS10SnapshotToMyc: mocks.importS10SnapshotToMyc }));
vi.mock("@/lib/analytics/events", () => ({ trackServerEvent: mocks.trackServerEvent }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));
vi.mock("@/lib/s10/snapshot-contract", () => ({ parseS10SnapshotValue: vi.fn((value: unknown) => ({ snapshot: value })) }));

import { POST } from "@/app/api/imports/db/import/route";

function makeRequest(fields: Record<string, string> = {}, fileName = "budget.db") {
  const form = new FormData();
  form.set("file", new File([Buffer.from("SQLite format 3\0")], fileName));
  Object.entries(fields).forEach(([key, value]) => form.set(key, value));
  return new Request("http://localhost/api/imports/db/import", { method: "POST", body: form });
}

describe("POST /api/imports/db/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.createDbSnapshot.mockReturnValue({ snapshot: { schema: "mc.s10.snapshot" } });
    mocks.importS10SnapshotToMyc.mockResolvedValue({
      projectId: "project-1",
      projectName: "Proyecto importado",
      generalBudgetId: "budget-1",
      subBudgetIds: [],
      resourceCount: 2,
      budgetCount: 1,
      itemCount: 3,
      apuCount: 2,
    });
    mocks.trackServerEvent.mockResolvedValue(undefined);
  });

  it("requires authentication", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    expect((await POST(makeRequest({ companyId: "company-1", projectId: "1" }))).status).toBe(401);
  });

  it("requires company and project selection", async () => {
    expect((await POST(makeRequest({ projectId: "1" }))).status).toBe(400);
    expect((await POST(makeRequest({ companyId: "company-1" }))).status).toBe(400);
  });

  it("requires editor membership before reading the uploaded database", async () => {
    mocks.assertWorkspaceMembership.mockRejectedValue(new Error("Sin permisos"));
    const response = await POST(makeRequest({ companyId: "company-1", projectId: "1" }));

    expect(response.status).toBe(400);
    expect(mocks.createDbSnapshot).not.toHaveBeenCalled();
  });

  it("rebuilds and persists the DB snapshot with source metadata", async () => {
    const response = await POST(makeRequest({ companyId: "company-1", projectId: "1", subBudgetId: "2" }));

    expect(response.status).toBe(201);
    expect(mocks.assertWorkspaceMembership).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "company-1",
      minimumRole: "EDITOR",
    });
    expect(mocks.createDbSnapshot).toHaveBeenCalledWith(expect.stringContaining("myc-db-import-"), "1", "2");
    expect(mocks.importS10SnapshotToMyc).toHaveBeenCalledWith(
      "user-1",
      { schema: "mc.s10.snapshot" },
      { companyId: "company-1", sourceSystem: "DB" },
    );
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("budget_imported", expect.objectContaining({
      import_source: "db",
      format: "sqlite-db",
    }));
    expect((await response.json()).projectId).toBe("project-1");
  });

  it("rejects unsupported file extensions", async () => {
    const response = await POST(makeRequest({ companyId: "company-1", projectId: "1" }, "budget.xlsx"));
    expect(response.status).toBe(400);
    expect(mocks.createDbSnapshot).not.toHaveBeenCalled();
  });
});
