import { describe, expect, it, vi } from "vitest";
import { extractAndPersistDocumentVersion } from "./extraction-persistence";

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
});
