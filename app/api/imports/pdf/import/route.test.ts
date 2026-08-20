import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PdfAiImportDraft } from "@/lib/pdf-import/types";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  assertWorkspaceMembership: vi.fn(),
  getAuthSession: vi.fn(),
  importPdfAiDraftToMyc: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  trackServerEvent: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@/lib/analytics/events", () => ({
  trackServerEvent: mocks.trackServerEvent,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/pdf-import/import-persistence", () => ({
  importPdfAiDraftToMyc: mocks.importPdfAiDraftToMyc,
}));

vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: mocks.assertWorkspaceMembership,
}));

describe("POST /api/imports/pdf/import", () => {
  beforeEach(() => {
    mocks.assertWorkspaceMembership.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.importPdfAiDraftToMyc.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
    mocks.trackServerEvent.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(createJsonRequest({ companyId: "company-1", draft: createDraft() }));

    expect(response.status).toBe(401);
    expect(mocks.importPdfAiDraftToMyc).not.toHaveBeenCalled();
  });

  it("requires a destination company", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(createJsonRequest({ draft: createDraft() }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("empresa");
    expect(mocks.assertWorkspaceMembership).not.toHaveBeenCalled();
  });

  it("requires editor access before importing", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockRejectedValue(new Error("No tienes el rol necesario"));

    const response = await POST(createJsonRequest({ companyId: "company-1", draft: createDraft() }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("rol necesario");
    expect(mocks.importPdfAiDraftToMyc).not.toHaveBeenCalled();
  });

  it("rejects invalid draft payloads", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);

    const response = await POST(createJsonRequest({ companyId: "company-1", draft: { source: "PDF_AI" } }));

    expect(response.status).toBe(400);
    expect(mocks.importPdfAiDraftToMyc).not.toHaveBeenCalled();
  });

  it("imports a reviewed PDF draft and revalidates affected views", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.importPdfAiDraftToMyc.mockResolvedValue({
      projectId: "project-1",
      projectName: "Colegio",
      generalBudgetId: "budget-1",
      subBudgetIds: ["sub-budget-1"],
      resourceCount: 1,
      budgetCount: 2,
      itemCount: 1,
      apuCount: 1,
    });

    const response = await POST(createJsonRequest({ companyId: "company-1", draft: createDraft() }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.projectId).toBe("project-1");
    expect(mocks.assertWorkspaceMembership).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "company-1",
      minimumRole: "EDITOR",
    });
    expect(mocks.importPdfAiDraftToMyc).toHaveBeenCalledWith("user-1", expect.objectContaining({ source: "PDF_AI" }), {
      companyId: "company-1",
    });
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("budget_imported", {
      userId: "user-1",
      companyId: "company-1",
      projectId: "project-1",
      generalBudgetId: "budget-1",
      import_source: "pdf_ai",
      format: "pdf",
    });
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("pdf_import_imported", {
      userId: "user-1",
      companyId: "company-1",
      projectId: "project-1",
      generalBudgetId: "budget-1",
      import_source: "pdf_ai",
      format: "pdf",
      budgetCount: 2,
      itemCount: 1,
      apuCount: 1,
      resourceCount: 1,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects/project-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets/budget-1");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("projects-list", "max");
  });

  it("tracks failed imports after the company is known", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.importPdfAiDraftToMyc.mockRejectedValue(new Error("db down"));

    const response = await POST(createJsonRequest({ companyId: "company-1", draft: createDraft() }));

    expect(response.status).toBe(400);
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("pdf_import_failed", {
      userId: "user-1",
      companyId: "company-1",
      stage: "import",
    });
  });
});

function createJsonRequest(body: unknown) {
  return new Request("http://localhost/api/imports/pdf/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDraft(): PdfAiImportDraft {
  return {
    source: "PDF_AI",
    project: { name: "Colegio", currency: "PEN" },
    sourceFiles: [{ id: "file-1", fileName: "presupuesto.pdf", role: "BUDGET", pageCount: 1, confidence: 0.92 }],
    budgets: [
      {
        id: "budget-1",
        name: "General",
        kind: "GENERAL",
        currency: "PEN",
        levels: [],
        items: [
          {
            id: "item-1",
            code: "01.01",
            description: "Trazo y replanteo",
            unit: "m2",
            quantity: "10",
            unitPrice: "2.50",
            partial: "25.00",
            sortOrder: 1,
            evidence: { sourceFileName: "presupuesto.pdf", sourcePage: 1, rawText: "01.01", confidence: 0.9 },
          },
        ],
      },
    ],
    apus: [],
    subpartidas: [],
    resources: [],
    links: [],
    validations: [],
    warnings: [],
  };
}
