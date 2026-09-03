import { describe, expect, it } from "vitest";
import { assertReviewRunLimits } from "./limits";

const configuration = { maxFiles: 2, maxPdfPages: 3, maxFileSizeMb: 1, maxXlsxSheets: 2 };

describe("review run aggregate limits", () => {
  it("rejects aggregate files, bytes, PDF pages and XLSX sheets before processing", () => {
    expect(() => assertReviewRunLimits(configuration, [
      { id: "pdf", fileSizeBytes: 700_000, mimeType: "application/pdf", pageCount: 2 },
      { id: "xlsx", fileSizeBytes: 400_000, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sheetCount: 3 },
    ])).toThrow(/size|tama|hojas|sheets/i);
  });

  it("returns an explicit warning/error code for each exceeded aggregate", () => {
    expect(() => assertReviewRunLimits({ ...configuration, maxFiles: 1 }, [
      { id: "a", fileSizeBytes: 1, mimeType: "application/pdf", pageCount: 1 },
      { id: "b", fileSizeBytes: 1, mimeType: "application/pdf", pageCount: 1 },
    ])).toThrow("REVIEW_LIMIT_MAX_FILES");
  });
});
