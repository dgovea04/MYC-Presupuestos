import { describe, expect, it, vi } from "vitest";
import { extractAndPersistDocumentVersion, reprocessDocumentCoverage } from "./extraction-persistence";

vi.mock("./extractors", () => ({ extractDocument: vi.fn() }));
import { extractDocument } from "./extractors";

describe("review extraction persistence", () => {
  it("persists extracted evidence, warnings and completed status", async () => {
    vi.mocked(extractDocument).mockResolvedValue({ kind: "XLSX", sha256: "hash", mimeType: "xlsx", fileSizeBytes: 3, items: [{ content: "12.00", location: { sheet: "Hoja 1", range: "B4:B4" } }], warnings: ["macro no ejecutada"], sheetCount: 1 });
    const client = { reviewEvidence: { upsert: vi.fn().mockResolvedValue({}) }, documentVersion: { update: vi.fn().mockResolvedValue({}) } };
    await extractAndPersistDocumentVersion({ file: new File(["x"], "file.xlsx"), version: { id: "version-1", sha256: "hash" }, companyId: "company-1", projectId: "project-1" }, client);
    expect(client.reviewEvidence.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ documentVersionId: "version-1", extractionMethod: "XLSX_CELL_RANGE" }) }));
    expect(client.documentVersion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ extractionStatus: "COMPLETED_WITH_WARNINGS", extractionWarnings: ["macro no ejecutada"] }) }));
  });

  it("persists failed extraction warning", async () => {
    vi.mocked(extractDocument).mockRejectedValue(new Error("extract failed"));
    const client = { reviewEvidence: { upsert: vi.fn() }, documentVersion: { update: vi.fn().mockResolvedValue({}) } };
    await expect(extractAndPersistDocumentVersion({ file: new File(["x"], "file.xlsx"), version: { id: "version-1", sha256: "hash" }, companyId: "company-1", projectId: "project-1" }, client)).rejects.toThrow("extract failed");
    expect(client.documentVersion.update).toHaveBeenCalledWith(expect.objectContaining({ data: { extractionStatus: "FAILED", extractionWarnings: ["extract failed"] } }));
  });

  it("records only PDF pages with actual extraction evidence instead of claiming all pages are covered", async () => {
    vi.mocked(extractDocument).mockResolvedValue({ kind: "PDF", sha256: "hash", mimeType: "pdf", fileSizeBytes: 3, items: [{ content: "Plano E-01", location: { page: 1 } }], warnings: [], pageCount: 3 });
    const client = { reviewEvidence: { upsert: vi.fn().mockResolvedValue({}) }, documentVersion: { update: vi.fn().mockResolvedValue({}) } };

    await extractAndPersistDocumentVersion({ file: new File(["pdf"], "file.pdf"), version: { id: "version-1", sha256: "hash" }, companyId: "company-1", projectId: "project-1" }, client);

    expect(client.documentVersion.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        extractionMethod: "PDF_TEXT",
        extractionCoverage: [{ page: 1, coverage: "PROCESSED" }],
      }),
    }));
  });

  it("persists page coverage and OCR metadata while merging duplicate evidence by source hash", async () => {
    vi.mocked(extractDocument).mockResolvedValue({ kind: "PDF", sha256: "hash", mimeType: "application/pdf", fileSizeBytes: 3, items: [{ content: "02.01 Acero 10 kg", location: { page: 2 }, extractionMethod: "OCR_PROVIDER", confidence: "HIGH" }], coverage: [{ page: 1, coverage: "PROCESSED", method: "PDF_TEXT", confidence: "MEDIUM", warnings: [] }, { page: 2, coverage: "PROCESSED", method: "OCR_PROVIDER", confidence: "HIGH", warnings: [] }], warnings: [], pageCount: 2 });
    const client = { reviewEvidence: { upsert: vi.fn().mockResolvedValue({}) }, documentVersion: { update: vi.fn().mockResolvedValue({}) } };

    await extractAndPersistDocumentVersion({ file: new File(["pdf"], "file.pdf"), version: { id: "version-1", sha256: "hash" }, companyId: "company-1", projectId: "project-1" }, client);

    expect(client.reviewEvidence.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ extractionMethod: "OCR_PROVIDER", confidence: "HIGH" }), update: expect.objectContaining({ extractionMethod: "OCR_PROVIDER", confidence: "HIGH" }) }));
    expect(client.documentVersion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ extractionMethod: "OCR_PROVIDER", extractionConfidence: "HIGH", extractionCoverage: [{ page: 1, coverage: "PROCESSED", method: "PDF_TEXT", confidence: "MEDIUM", warnings: [] }, { page: 2, coverage: "PROCESSED", method: "OCR_PROVIDER", confidence: "HIGH", warnings: [] }] }) }));
  });

  it("merges only reprocessed page evidence by source hash without replacing existing coverage", async () => {
    vi.mocked(extractDocument).mockResolvedValue({ kind: "PDF", sha256: "hash", mimeType: "application/pdf", fileSizeBytes: 3, items: [{ content: "02.01 Acero 10 kg", location: { page: 2 }, extractionMethod: "OCR_PROVIDER", confidence: "HIGH" }], coverage: [{ page: 2, coverage: "PROCESSED", method: "OCR_PROVIDER", confidence: "HIGH", warnings: [] }], warnings: [], pageCount: 3 });
    const client = { reviewEvidence: { upsert: vi.fn().mockResolvedValue({}) }, documentVersion: { update: vi.fn().mockResolvedValue({}) } };

    await reprocessDocumentCoverage({ file: new File(["pdf"], "file.pdf", { type: "application/pdf" }), version: { id: "version-1", sha256: "hash", extractionCoverage: [{ page: 1, coverage: "PROCESSED", method: "PDF_TEXT", confidence: "MEDIUM", warnings: [] }, { page: 2, coverage: "OCR_REQUIRED", method: "PDF_TEXT", confidence: "LOW", warnings: [] }] }, companyId: "company-1", projectId: "project-1", pages: [2] }, client);

    expect(client.reviewEvidence.upsert).toHaveBeenCalledOnce();
    expect(client.documentVersion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ extractionCoverage: [{ page: 1, coverage: "PROCESSED", method: "PDF_TEXT", confidence: "MEDIUM", warnings: [] }, { page: 2, coverage: "PROCESSED", method: "OCR_PROVIDER", confidence: "HIGH", warnings: [] }] }) }));
  });
});
