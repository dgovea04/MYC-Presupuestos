import { describe, expect, it, vi } from "vitest";

import { createOpenAiPdfImportOcrProvider, PdfImportOcrUnavailableError, requireConfiguredPdfImportOcrProvider } from "./ocr";

describe("pdf import OCR provider", () => {
  it("sends PDF bytes to OpenAI Responses as an input_file and returns extracted text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: "01.01 Trazo y replanteo m2 10 2.50 25.00" }),
    });
    const provider = createOpenAiPdfImportOcrProvider({ apiKey: "sk-test", fetchImpl, model: "gpt-test" });

    const result = await provider.extractText({
      fileName: "scan.pdf",
      pageNumber: 1,
      pdfBytes: new Uint8Array([1, 2, 3]),
    });

    expect(result).toMatchObject({ text: "01.01 Trazo y replanteo m2 10 2.50 25.00", confidence: 0.75 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer sk-test" }),
        body: expect.stringContaining('"type":"input_file"'),
      }),
    );
    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1].body as string);
    expect(body.input[0].content).toContainEqual(
      expect.objectContaining({
        type: "input_file",
        filename: "scan.pdf",
        file_data: "AQID",
      }),
    );
  });

  it("throws a clear error when no OCR provider is configured", async () => {
    await expect(requireConfiguredPdfImportOcrProvider(undefined)).rejects.toBeInstanceOf(PdfImportOcrUnavailableError);
  });
});
