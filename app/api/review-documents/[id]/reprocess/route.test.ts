import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  documentFindFirst: vi.fn(),
  storageRead: vi.fn(),
  getReviewDocumentStorage: vi.fn(),
  getPdfImportAiConfiguration: vi.fn(),
  createPdfImportOcrProvider: vi.fn(),
  createPdfImportOcrAdapter: vi.fn(),
  reprocessDocumentCoverage: vi.fn(),
  markStaleForChange: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { projectDocument: { findFirst: mocks.documentFindFirst } } }));
vi.mock("@/lib/review-intelligence/documents", () => ({ getReviewDocumentStorage: mocks.getReviewDocumentStorage }));
vi.mock("@/lib/pdf-import/provider", () => ({ getPdfImportAiConfiguration: mocks.getPdfImportAiConfiguration }));
vi.mock("@/lib/pdf-import/ocr", () => ({ createPdfImportOcrProvider: mocks.createPdfImportOcrProvider }));
vi.mock("@/lib/review-intelligence/ocr", () => ({ createPdfImportOcrAdapter: mocks.createPdfImportOcrAdapter }));
vi.mock("@/lib/review-intelligence/extraction-persistence", () => ({ reprocessDocumentCoverage: mocks.reprocessDocumentCoverage }));
vi.mock("@/lib/review-intelligence/stale", () => ({ markStaleForChange: mocks.markStaleForChange }));

import { POST } from "@/app/api/review-documents/[id]/reprocess/route";

describe("review document reprocessing API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue({ role: "EDITOR" });
    mocks.documentFindFirst.mockResolvedValue({ id: "document-1", projectId: "project-1", currentVersion: { id: "version-1", storageKey: "companies/company-1/projects/project-1/documents/document-1/versions/1/original.pdf", originalFileName: "source.pdf", mimeType: "application/pdf" } });
    mocks.getReviewDocumentStorage.mockReturnValue({ read: mocks.storageRead });
    mocks.storageRead.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    mocks.getPdfImportAiConfiguration.mockResolvedValue({ provider: "gemini", apiKey: "gemini-key", model: "gemini-2.5-flash" });
    mocks.createPdfImportOcrProvider.mockReturnValue({ extractText: mocks.createPdfImportOcrProvider });
    mocks.createPdfImportOcrAdapter.mockReturnValue({ extractPages: vi.fn() });
    mocks.reprocessDocumentCoverage.mockResolvedValue({ coverage: [{ page: 1, coverage: "PROCESSED" }], warnings: [] });
    mocks.markStaleForChange.mockResolvedValue(1);
  });

  it("requires workspace editor authorization", async () => {
    mocks.assertWorkspaceMembership.mockRejectedValue(new Error("Rol necesario: EDITOR"));
    const response = await POST(new Request("http://localhost/api/review-documents/document-1/reprocess", { method: "POST", body: JSON.stringify({ pages: [1] }) }), { params: Promise.resolve({ id: "document-1" }) });
    expect(response.status).toBe(403);
    expect(mocks.documentFindFirst).not.toHaveBeenCalled();
  });

  it("rejects an empty or malformed coverage selection", async () => {
    const response = await POST(new Request("http://localhost/api/review-documents/document-1/reprocess", { method: "POST", body: JSON.stringify({ pages: [0] }) }), { params: Promise.resolve({ id: "document-1" }) });
    expect(response.status).toBe(400);
    expect(mocks.reprocessDocumentCoverage).not.toHaveBeenCalled();
  });

  it("rejects a document outside the active company", async () => {
    mocks.documentFindFirst.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/review-documents/document-other/reprocess", { method: "POST", body: JSON.stringify({ pages: [1] }) }), { params: Promise.resolve({ id: "document-other" }) });
    expect(response.status).toBe(404);
  });

  it("reprocesses selected coverage and marks affected runs stale", async () => {
    const response = await POST(new Request("http://localhost/api/review-documents/document-1/reprocess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pages: [2], worksheets: ["Metrados"] }) }), { params: Promise.resolve({ id: "document-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.reprocessDocumentCoverage).toHaveBeenCalledWith(expect.objectContaining({ documentVersionId: "version-1", pages: [2], worksheets: ["Metrados"] }), expect.anything());
    expect(mocks.markStaleForChange).toHaveBeenCalledWith(expect.objectContaining({ kind: "document-reprocessing", id: "version-1" }), expect.anything());
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ documentVersionId: "version-1", coverage: expect.any(Array) }));
  });

  it("injects the configured PDF OCR provider when reprocessing scanned pages", async () => {
    await POST(new Request("http://localhost/api/review-documents/document-1/reprocess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pages: [2] }) }), { params: Promise.resolve({ id: "document-1" }) });

    expect(mocks.getPdfImportAiConfiguration).toHaveBeenCalledWith("user-1");
    expect(mocks.createPdfImportOcrProvider).toHaveBeenCalledWith({ provider: "gemini", apiKey: "gemini-key", model: "gemini-2.5-flash" });
    expect(mocks.createPdfImportOcrAdapter).toHaveBeenCalledWith(expect.any(Object));
    expect(mocks.reprocessDocumentCoverage).toHaveBeenCalledWith(expect.objectContaining({ ocrAdapter: expect.any(Object) }), expect.anything());
  });
});
