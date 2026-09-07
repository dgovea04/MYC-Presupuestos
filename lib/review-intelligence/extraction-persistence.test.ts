import { describe, expect, it, vi } from "vitest";
import { extractAndPersistDocumentVersion, reprocessDocumentCoverage } from "./extraction-persistence";

vi.mock("./extractors", () => ({ extractDocument: vi.fn() }));
import { extractDocument } from "./extractors";

describe("review extraction persistence", () => {
  it("passes a version-scoped XLSX selection to extraction before persisting evidence", async () => {
    vi.mocked(extractDocument).mockResolvedValue({ kind: "XLSX", sha256: "hash", mimeType: "xlsx", fileSizeBytes: 3, items: [{ content: "Metrados", location: { sheet: "Metrados", range: "A2:B2" } }], warnings: [], sheetCount: 2 });
    const client = { reviewEvidence: { upsert: vi.fn().mockResolvedValue({}) }, documentVersion: { update: vi.fn().mockResolvedValue({}) } };
    await extractAndPersistDocumentVersion({ file: new File(["x"], "file.xlsx"), version: { id: "version-1", sha256: "hash" }, companyId: "company-1", projectId: "project-1", xlsxSheetNames: ["Metrados"] }, client);
    expect(extractDocument).toHaveBeenCalledWith(expect.objectContaining({ xlsxSheetNames: ["Metrados"] }));
    expect(client.reviewEvidence.upsert).toHaveBeenCalledOnce();
  });
  it("persists extracted evidence, warnings and completed status", async () => {
    vi.mocked(extractDocument).mockResolvedValue({ kind: "XLSX", sha256: "hash", mimeType: "xlsx", fileSizeBytes: 3, items: [{ content: "12.00", location: { sheet: "Hoja 1", range: "B4:B4" } }], warnings: ["macro no ejecutada"], sheetCount: 1 });
    const client = { reviewEvidence: { upsert: vi.fn().mockResolvedValue({}) }, documentVersion: { update: vi.fn().mockResolvedValue({}) } };
    await extractAndPersistDocumentVersion({ file: new File(["x"], "file.xlsx"), version: { id: "version-1", sha256: "hash" }, companyId: "company-1", projectId: "project-1" }, client);
    expect(client.reviewEvidence.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ documentVersionId: "version-1", extractionMethod: "XLSX_CELL_RANGE" }) }));
    expect(client.documentVersion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ extractionStatus: "COMPLETED_WITH_WARNINGS", extractionWarnings: ["macro no ejecutada"] }) }));
  });

  it("persists normalized structured metadata with only a valid decimal quantity", async () => {
    vi.mocked(extractDocument).mockResolvedValue({
      kind: "XLSX",
      sha256: "hash",
      mimeType: "xlsx",
      fileSizeBytes: 3,
      items: [{
        content: "03.04\tConcreto ciclópeo",
        location: { sheet: "Metrados APU", range: "A2:J2" },
        metadata: {
          code: "03.04",
          description: "Concreto ciclópeo",
          quantity: "12,50",
          unit: "M2",
          yield: "0.75",
          technicalSpec: "f'c 140",
          discipline: "Estructuras",
          apuComponents: ["cemento", "arena"],
          attributes: { "Tipo recurso": "Material", "Cantidad recurso": "3.25" },
        },
      }, {
        content: "sin cantidad",
        location: { sheet: "Metrados APU", range: "A3:J3" },
        metadata: { quantity: "=SUM(A1:A2)", unit: "m3" },
      }],
      warnings: [],
    });
    const client = { reviewEvidence: { upsert: vi.fn().mockResolvedValue({}) }, documentVersion: { update: vi.fn().mockResolvedValue({}) } };

    await extractAndPersistDocumentVersion({ file: new File(["x"], "file.xlsx"), version: { id: "version-1", sha256: "hash" }, companyId: "company-1", projectId: "project-1" }, client);

    expect(client.reviewEvidence.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      create: expect.objectContaining({
        value: "12.5",
        unit: "m²",
        locationJson: { sheet: "Metrados APU", range: "A2:J2" },
        metadataJson: expect.objectContaining({
          code: "03.04",
          yield: "0.75",
          technicalSpecification: "f'c 140",
          apuComponents: ["cemento", "arena"],
          attributes: { "Tipo recurso": "Material", "Cantidad recurso": "3.25" },
          extractionMethod: "XLSX_CELL_RANGE",
        }),
      }),
    }));
    expect(client.reviewEvidence.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      create: expect.objectContaining({ value: undefined, unit: "m³", metadataJson: expect.not.objectContaining({ quantity: expect.anything() }) }),
    }));
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

  it("reprocesses only the requested pages and merges coverage without deleting existing evidence", async () => {
    vi.mocked(extractDocument).mockResolvedValue({
      kind: "PDF",
      sha256: "hash",
      mimeType: "application/pdf",
      fileSizeBytes: 3,
      items: [{ content: "02.01 Acero 10 kg", location: { page: 2 }, extractionMethod: "OCR_PROVIDER", confidence: "HIGH" }],
      coverage: [{ page: 2, coverage: "PROCESSED", method: "OCR_PROVIDER", confidence: "HIGH", warnings: [] }],
      warnings: [],
      pageCount: 3,
    });
    const client = {
      reviewEvidence: { upsert: vi.fn().mockResolvedValue({}) },
      documentVersion: {
        findFirst: vi.fn().mockResolvedValue({ id: "version-1", sha256: "hash", mimeType: "application/pdf", originalFileName: "file.pdf", extractionCoverage: [{ page: 1, coverage: "PROCESSED" }, { page: 2, coverage: "OCR_REQUIRED" }] }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await reprocessDocumentCoverage({
      companyId: "company-1",
      projectId: "project-1",
      documentVersionId: "version-1",
      file: new File(["pdf"], "file.pdf", { type: "application/pdf" }),
      pages: [2],
    }, client);

    expect(extractDocument).toHaveBeenCalledWith(expect.objectContaining({ selectedPageNumbers: [2] }));
    expect(result.coverage).toEqual(expect.arrayContaining([
      expect.objectContaining({ page: 1, coverage: "PROCESSED" }),
      expect.objectContaining({ page: 2, coverage: "PROCESSED" }),
    ]));
    expect(client.documentVersion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ extractionCoverage: expect.arrayContaining([expect.objectContaining({ page: 1 })]) }) }));
  });
});
