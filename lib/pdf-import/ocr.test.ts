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

  it("uses Gemini when selected in the user's PDF provider settings", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "Gemini OCR" }] } }] }),
    });
    const { createPdfImportOcrProvider } = await import("./ocr");
    const provider = createPdfImportOcrProvider({ provider: "gemini", apiKey: "gemini-test", fetchImpl, model: "gemini-test" });

    const result = await provider.extractText({ fileName: "scan.pdf", pageNumber: 1, pdfBytes: new Uint8Array([1, 2, 3]) });

    expect(result.text).toBe("Gemini OCR");
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("generativelanguage.googleapis.com/v1beta/models/gemini-test"),
      expect.objectContaining({ body: expect.stringContaining('"inline_data"') }),
    );
  });

  it("uses OpenRouter when selected in the user's PDF provider settings", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "OpenRouter OCR" } }] }),
    });
    const { createPdfImportOcrProvider } = await import("./ocr");
    const provider = createPdfImportOcrProvider({ provider: "openrouter", apiKey: "router-test", fetchImpl, model: "vision-model" });

    const result = await provider.extractText({ fileName: "scan.pdf", pageNumber: 1, pdfBytes: new Uint8Array([1, 2, 3]) });

    expect(result.text).toBe("OpenRouter OCR");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer router-test" }),
        body: expect.stringContaining('"type":"file"'),
      }),
    );
  });

  it("throws a clear error when no OCR provider is configured", async () => {
    await expect(requireConfiguredPdfImportOcrProvider(undefined)).rejects.toBeInstanceOf(PdfImportOcrUnavailableError);
  });
});
