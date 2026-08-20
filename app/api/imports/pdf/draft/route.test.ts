import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  structurePdfImportWithAi: vi.fn(),
  extractPdfImportFile: vi.fn(),
  trackServerEvent: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: mocks.assertWorkspaceMembership,
}));

vi.mock("@/lib/pdf-import/ai-structure", () => ({
  structurePdfImportWithAi: mocks.structurePdfImportWithAi,
}));

vi.mock("@/lib/pdf-import/extraction", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pdf-import/extraction")>();
  return {
    ...actual,
    extractPdfImportFile: mocks.extractPdfImportFile,
  };
});

vi.mock("@/lib/analytics/events", () => ({
  trackServerEvent: mocks.trackServerEvent,
}));

describe("POST /api/imports/pdf/draft", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.assertWorkspaceMembership.mockReset();
    mocks.structurePdfImportWithAi.mockReset();
    mocks.extractPdfImportFile.mockReset();
    mocks.trackServerEvent.mockReset();
    mocks.extractPdfImportFile.mockImplementation(async (file: File, role: string) => ({
      id: `file-${file.name}`,
      fileName: file.name,
      role,
      text: await file.text(),
      pageCount: 1,
      requiresOcr: false,
      ocrApplied: false,
      confidence: 0.75,
    }));
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/imports/pdf/draft", { method: "POST" }));

    expect(response.status).toBe(401);
  });

  it("requires a PDF file", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });

    const formData = new FormData();
    formData.set("companyId", "company-1");

    const response = await POST(new Request("http://localhost/api/imports/pdf/draft", { method: "POST", body: formData }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("PDF");
  });

  it("returns a draft preview for uploaded PDF text", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    const formData = new FormData();
    formData.set("companyId", "company-1");
    formData.set("projectName", "Colegio inicial");
    formData.set("fileRoles", JSON.stringify({ "presupuesto.pdf": "BUDGET", "apu.pdf": "APU" }));
    formData.append("files", new File(["01.01 Trazo y replanteo m2 10 2.50 25.00"], "presupuesto.pdf", { type: "application/pdf" }));
    formData.append(
      "files",
      new File(["APU 01.01 Trazo y replanteo m2 2.50\nRECURSO Mano de obra hh 1 2.50 2.50"], "apu.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(new Request("http://localhost/api/imports/pdf/draft", { method: "POST", body: formData }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.project.name).toBe("Colegio inicial");
    expect(body.budgets[0].items).toHaveLength(1);
    expect(body.links).toContainEqual(expect.objectContaining({ status: "MATCHED" }));
    expect(mocks.structurePdfImportWithAi).not.toHaveBeenCalled();
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("pdf_import_draft_created", {
      userId: "user-1",
      companyId: "company-1",
      fileCount: 2,
      pageCount: 2,
      itemCount: 1,
      apuCount: 1,
      subpartidaCount: 0,
      warningCount: expect.any(Number),
      usedAi: false,
    });
  });

  it("uses AI structure fallback when deterministic extraction finds no budget items", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.structurePdfImportWithAi.mockResolvedValue({
      draft: {
        source: "PDF_AI",
        project: { name: "Escaneado IA", currency: "PEN" },
        sourceFiles: [{ id: "file-scan-pdf", fileName: "scan.pdf", role: "BUDGET", pageCount: 1, confidence: 0.2 }],
        budgets: [],
        apus: [],
        subpartidas: [],
        resources: [],
        links: [],
        validations: [],
        warnings: ["Estructurado con IA"],
      },
      metadata: { provider: "openai", model: "gpt-test", structuredParseStatus: "parsed" },
    });
    const formData = new FormData();
    formData.set("companyId", "company-1");
    formData.set("fileRoles", JSON.stringify({ "scan.pdf": "BUDGET" }));
    formData.append("files", new File(["imagen escaneada sin tabla"], "scan.pdf", { type: "application/pdf" }));

    const response = await POST(new Request("http://localhost/api/imports/pdf/draft", { method: "POST", body: formData }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.project.name).toBe("Escaneado IA");
    expect(mocks.structurePdfImportWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        companyId: "company-1",
      }),
    );
    expect(mocks.trackServerEvent).toHaveBeenCalledWith(
      "pdf_import_draft_created",
      expect.objectContaining({ usedAi: true }),
    );
  });

  it("does not fail draft creation when analytics tracking fails", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.trackServerEvent.mockRejectedValue(new Error("analytics down"));
    const formData = new FormData();
    formData.set("companyId", "company-1");
    formData.append("files", new File(["01.01 Trazo y replanteo m2 10 2.50 25.00"], "presupuesto.pdf", { type: "application/pdf" }));

    const response = await POST(new Request("http://localhost/api/imports/pdf/draft", { method: "POST", body: formData }));

    expect(response.status).toBe(200);
  });

  it("rejects packages that exceed the page limit before creating a draft", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.extractPdfImportFile.mockResolvedValue({
      id: "file-large-pdf",
      fileName: "large.pdf",
      role: "BUDGET",
      text: "",
      pageCount: 301,
      requiresOcr: false,
      ocrApplied: false,
      confidence: 0.75,
    });
    const formData = new FormData();
    formData.set("companyId", "company-1");
    formData.append("files", new File(["contenido"], "large.pdf", { type: "application/pdf" }));

    const response = await POST(new Request("http://localhost/api/imports/pdf/draft", { method: "POST", body: formData }));
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toContain("300 paginas");
    expect(mocks.structurePdfImportWithAi).not.toHaveBeenCalled();
  });

  it("tracks failed draft attempts after the company is known", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.extractPdfImportFile.mockRejectedValue(new Error("pdf parser down"));
    const formData = new FormData();
    formData.set("companyId", "company-1");
    formData.append("files", new File(["contenido"], "presupuesto.pdf", { type: "application/pdf" }));

    const response = await POST(new Request("http://localhost/api/imports/pdf/draft", { method: "POST", body: formData }));

    expect(response.status).toBe(500);
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("pdf_import_failed", {
      userId: "user-1",
      companyId: "company-1",
      stage: "draft",
    });
  });
});
