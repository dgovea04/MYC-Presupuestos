import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: vi.fn(),
}));

vi.mock("@/lib/delphin/dprj-import", () => ({
  parseDelphinDprjToS10Snapshot: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/s10/import-persistence", () => ({
  importS10SnapshotToMyc: vi.fn(),
}));

import { POST } from "@/app/api/imports/delphin/import/route";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { parseDelphinDprjToS10Snapshot } from "@/lib/delphin/dprj-import";
import { importS10SnapshotToMyc } from "@/lib/s10/import-persistence";

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    expires: new Date().toISOString(),
    user: { id: "user-1", ...overrides },
  };
}

function makeFormData(overrides: Record<string, unknown> = {}) {
  const formData = new FormData();
  const file = overrides.file ?? new File(["dummy"], "project.dprj");
  formData.append("file", file);
  formData.append("companyId", (overrides.companyId as string) ?? "company-1");
  return formData;
}

describe("POST /api/imports/delphin/import", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/imports/delphin/import", {
        method: "POST",
        body: makeFormData(),
      }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("No autorizado");
  });

  it("returns 400 when companyId is missing", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    const formData = new FormData();
    formData.append("file", new File(["dummy"], "project.dprj"));

    const response = await POST(
      new Request("http://localhost/api/imports/delphin/import", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("empresa");
  });

  it("returns 400 when file is not a .dprj file", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    const formData = new FormData();
    formData.append("file", new File(["dummy"], "test.txt"));
    formData.append("companyId", "company-1");

    const response = await POST(
      new Request("http://localhost/api/imports/delphin/import", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Delphin");
  });

  it("returns 400 when user has no workspace membership", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockRejectedValue(new Error("Workspace no disponible"));

    const response = await POST(
      new Request("http://localhost/api/imports/delphin/import", {
        method: "POST",
        body: makeFormData(),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Workspace no disponible");
  });

  it("returns 400 when user has insufficient role", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockRejectedValue(
      new Error("No tienes el rol necesario en este workspace"),
    );

    const response = await POST(
      new Request("http://localhost/api/imports/delphin/import", {
        method: "POST",
        body: makeFormData(),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("rol necesario");
  });

  it("calls assertWorkspaceMembership with correct params", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(parseDelphinDprjToS10Snapshot).mockReturnValue({} as never);
    vi.mocked(importS10SnapshotToMyc).mockResolvedValue({
      projectId: "project-1",
      generalBudgetId: "budget-1",
    } as never);

    await POST(
      new Request("http://localhost/api/imports/delphin/import", {
        method: "POST",
        body: makeFormData(),
      }),
    );

    expect(assertWorkspaceMembership).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "company-1",
      minimumRole: "EDITOR",
    });
  });

  it("calls assertWorkspaceMembership before parsing and importing", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(parseDelphinDprjToS10Snapshot).mockReturnValue({} as never);
    vi.mocked(importS10SnapshotToMyc).mockResolvedValue({
      projectId: "project-1",
      generalBudgetId: "budget-1",
    } as never);

    await POST(
      new Request("http://localhost/api/imports/delphin/import", {
        method: "POST",
        body: makeFormData(),
      }),
    );

    const assertOrder = vi.mocked(assertWorkspaceMembership).mock.invocationCallOrder[0];
    const parseOrder = vi.mocked(parseDelphinDprjToS10Snapshot).mock.invocationCallOrder[0];
    const importOrder = vi.mocked(importS10SnapshotToMyc).mock.invocationCallOrder[0];

    expect(assertOrder).toBeLessThan(parseOrder);
    expect(assertOrder).toBeLessThan(importOrder);
  });

  it("returns 201 on successful import", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(parseDelphinDprjToS10Snapshot).mockReturnValue({} as never);
    vi.mocked(importS10SnapshotToMyc).mockResolvedValue({
      projectId: "project-1",
      generalBudgetId: "budget-1",
    } as never);

    const response = await POST(
      new Request("http://localhost/api/imports/delphin/import", {
        method: "POST",
        body: makeFormData(),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projectId).toBe("project-1");
    expect(body.generalBudgetId).toBe("budget-1");
  });
});
