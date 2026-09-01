import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  assertWorkspaceFeatureAccess: vi.fn(),
  extractPdfImportFile: vi.fn(),
  createPdfImportOcrProvider: vi.fn(),
  getPdfImportAiConfiguration: vi.fn(),
  trackServerEvent: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: mocks.assertWorkspaceMembership,
}));

vi.mock("@/lib/workspace/entitlements", () => ({
  assertWorkspaceFeatureAccess: mocks.assertWorkspaceFeatureAccess,
  getWorkspaceFeatureAccessStatus: () => 403,
  isWorkspaceFeatureAccessError: () => false,
}));

vi.mock("@/lib/pdf-import/extraction", () => ({
  extractPdfImportFile: mocks.extractPdfImportFile,
}));

vi.mock("@/lib/pdf-import/ocr", () => ({
  createPdfImportOcrProvider: mocks.createPdfImportOcrProvider,
}));

vi.mock("@/lib/pdf-import/provider", () => ({
  getPdfImportAiConfiguration: mocks.getPdfImportAiConfiguration,
}));

vi.mock("@/lib/analytics/events", () => ({
  trackServerEvent: mocks.trackServerEvent,
}));

describe("POST /api/imports/pdf/analyze", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.assertWorkspaceMembership.mockReset();
    mocks.assertWorkspaceFeatureAccess.mockReset();
    mocks.assertWorkspaceFeatureAccess.mockResolvedValue(undefined);
    mocks.extractPdfImportFile.mockReset();
    mocks.createPdfImportOcrProvider.mockReset();
    mocks.getPdfImportAiConfiguration.mockReset();
    mocks.getPdfImportAiConfiguration.mockResolvedValue({ provider: "openai", apiKey: "sk-test", model: "gpt-test" });
    mocks.createPdfImportOcrProvider.mockReturnValue({ extractText: vi.fn() });
    mocks.trackServerEvent.mockReset();
  });

  it("passes configured OCR provider to extraction", async () => {
    const ocrProvider = { extractText: vi.fn() };
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.createPdfImportOcrProvider.mockReturnValue(ocrProvider);
    mocks.extractPdfImportFile.mockResolvedValue({
      id: "file-scan-pdf",
      fileName: "scan.pdf",
      role: "BUDGET",
      text: "",
      pageCount: 1,
      requiresOcr: true,
      ocrApplied: false,
      confidence: 0.2,
    });
    const formData = new FormData();
    formData.set("companyId", "company-1");
    formData.append("files", new File([""], "scan.pdf", { type: "application/pdf" }));

    const response = await POST(new Request("http://localhost/api/imports/pdf/analyze", { method: "POST", body: formData }));

    expect(response.status).toBe(200);
    expect(mocks.extractPdfImportFile).toHaveBeenCalledWith(expect.any(File), "AUTO", { ocrProvider });
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("pdf_import_analyzed", {
      userId: "user-1",
      companyId: "company-1",
      fileCount: 1,
      pageCount: 1,
      ocrPageCount: 1,
    });
  });

  it("does not fail analyze when analytics tracking fails", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.trackServerEvent.mockRejectedValue(new Error("analytics down"));
    mocks.extractPdfImportFile.mockResolvedValue({
      id: "file-pdf",
      fileName: "presupuesto.pdf",
      role: "BUDGET",
      text: "",
      pageCount: 1,
      requiresOcr: false,
      ocrApplied: false,
      confidence: 0.75,
    });
    const formData = new FormData();
    formData.set("companyId", "company-1");
    formData.append("files", new File(["contenido"], "presupuesto.pdf", { type: "application/pdf" }));

    const response = await POST(new Request("http://localhost/api/imports/pdf/analyze", { method: "POST", body: formData }));

    expect(response.status).toBe(200);
  });

  it("rejects files that are not PDF MIME type", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    const formData = new FormData();
    formData.set("companyId", "company-1");
    formData.append("files", new File(["texto"], "presupuesto.pdf", { type: "text/plain" }));

    const response = await POST(new Request("http://localhost/api/imports/pdf/analyze", { method: "POST", body: formData }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("MIME");
    expect(mocks.extractPdfImportFile).not.toHaveBeenCalled();
  });

  it("rejects packages that exceed the page limit after extraction", async () => {
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

    const response = await POST(new Request("http://localhost/api/imports/pdf/analyze", { method: "POST", body: formData }));
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toContain("300 paginas");
  });

  it("tracks failed analyze attempts after the company is known", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.extractPdfImportFile.mockRejectedValue(new Error("pdf parser down"));
    const formData = new FormData();
    formData.set("companyId", "company-1");
    formData.append("files", new File(["contenido"], "presupuesto.pdf", { type: "application/pdf" }));

    const response = await POST(new Request("http://localhost/api/imports/pdf/analyze", { method: "POST", body: formData }));

    expect(response.status).toBe(500);
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("pdf_import_failed", {
      userId: "user-1",
      companyId: "company-1",
      stage: "analyze",
    });
  });
});
