import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: vi.fn(),
}));

vi.mock("@/lib/s10/import-preview", () => ({
  parseS10ExportSnapshotJson: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/billing/api", () => ({
  createBillingErrorResponse: vi.fn(() => null),
}));

vi.mock("@/lib/s10/import-persistence", () => ({
  importS10SnapshotToMyc: vi.fn(),
}));
vi.mock("@/lib/knowledge/integrations", () => ({ recordImportKnowledgeEvent: vi.fn() }));
vi.mock("@/lib/knowledge/import-learning-runner", () => ({ recordImportLearningBestEffort: vi.fn() }));
vi.mock("@/lib/knowledge/import-learning-extraction", () => ({ buildS10ImportLearningBatch: vi.fn(() => ({ sourceType: "S10_IMPORT" })) }));

import { POST } from "@/app/api/imports/s10/import/route";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { parseS10ExportSnapshotJson } from "@/lib/s10/import-preview";
import { importS10SnapshotToMyc } from "@/lib/s10/import-persistence";
import { recordImportLearningBestEffort } from "@/lib/knowledge/import-learning-runner";

const VALID_SNAPSHOT = { proyectos: [] };
const VALID_BODY = {
  snapshot: VALID_SNAPSHOT,
  companyId: "company-1",
};

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    expires: new Date().toISOString(),
    user: { id: "user-1", ...overrides },
  };
}

describe("POST /api/imports/s10/import", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/imports/s10/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("No autorizado");
  });

  it("returns 400 when companyId is missing", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    const response = await POST(
      new Request("http://localhost/api/imports/s10/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: VALID_SNAPSHOT }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("empresa");
  });

  it("returns 400 when user has no workspace membership", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockRejectedValue(new Error("Workspace no disponible"));

    const response = await POST(
      new Request("http://localhost/api/imports/s10/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
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
      new Request("http://localhost/api/imports/s10/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("rol necesario");
  });

  it("returns 400 when snapshot is missing from body", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    const response = await POST(
      new Request("http://localhost/api/imports/s10/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: "company-1" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when snapshot JSON is invalid", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(parseS10ExportSnapshotJson).mockImplementation(() => {
      throw new Error("El snapshot S10 no es valido.");
    });

    const response = await POST(
      new Request("http://localhost/api/imports/s10/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("snapshot S10");
  });

  it("calls assertWorkspaceMembership with correct params before parsing", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(parseS10ExportSnapshotJson).mockReturnValue(VALID_SNAPSHOT as never);
    vi.mocked(importS10SnapshotToMyc).mockResolvedValue({
      projectId: "project-1",
      generalBudgetId: "budget-1",
    } as never);

    await POST(
      new Request("http://localhost/api/imports/s10/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
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
    vi.mocked(parseS10ExportSnapshotJson).mockReturnValue(VALID_SNAPSHOT as never);
    vi.mocked(importS10SnapshotToMyc).mockResolvedValue({
      projectId: "project-1",
      generalBudgetId: "budget-1",
    } as never);

    await POST(
      new Request("http://localhost/api/imports/s10/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      }),
    );

    // Membership check must happen before snapshot parsing
    const assertCallOrder = vi.mocked(assertWorkspaceMembership).mock.invocationCallOrder[0];
    const parseCallOrder = vi.mocked(parseS10ExportSnapshotJson).mock.invocationCallOrder[0];
    const importCallOrder = vi.mocked(importS10SnapshotToMyc).mock.invocationCallOrder[0];

    expect(assertCallOrder).toBeLessThan(parseCallOrder);
    expect(assertCallOrder).toBeLessThan(importCallOrder);
  });

  it("returns 201 on successful import", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(parseS10ExportSnapshotJson).mockReturnValue(VALID_SNAPSHOT as never);
    vi.mocked(importS10SnapshotToMyc).mockResolvedValue({
      projectId: "project-1",
      generalBudgetId: "budget-1",
    } as never);

    const response = await POST(
      new Request("http://localhost/api/imports/s10/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.projectId).toBe("project-1");
    expect(body.generalBudgetId).toBe("budget-1");
  });

  it("records an S10 learning batch without changing the successful HTTP response", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(parseS10ExportSnapshotJson).mockReturnValue(VALID_SNAPSHOT as never);
    vi.mocked(importS10SnapshotToMyc).mockResolvedValue({ projectId: "project-1", generalBudgetId: "budget-1" } as never);

    const response = await POST(new Request("http://localhost/api/imports/s10/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(VALID_BODY) }));

    expect(response.status).toBe(201);
    expect(recordImportLearningBestEffort).toHaveBeenCalledWith(expect.objectContaining({ sourceType: "S10_IMPORT" }));
  });

  it("keeps the import successful when learning recording fails", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceMembership).mockResolvedValue(undefined as never);
    vi.mocked(parseS10ExportSnapshotJson).mockReturnValue(VALID_SNAPSHOT as never);
    vi.mocked(importS10SnapshotToMyc).mockResolvedValue({ projectId: "project-1", generalBudgetId: "budget-1" } as never);
    vi.mocked(recordImportLearningBestEffort).mockRejectedValue(new Error("knowledge unavailable"));

    const response = await POST(new Request("http://localhost/api/imports/s10/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(VALID_BODY) }));
    expect(response.status).toBe(201);
  });
});
