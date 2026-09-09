import { describe, expect, it, vi } from "vitest";

import { createGeminiPdfImportOcrProvider, createOllamaPdfImportOcrProvider, createOpenAiPdfImportOcrProvider, PdfImportOcrProviderError, PdfImportOcrUnavailableError, requireConfiguredPdfImportOcrProvider } from "./ocr";

describe("pdf import OCR provider", () => {
  it("sends PDF bytes to OpenAI Responses as an input_file and returns extracted text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: "01.01 Trazo y replanteo m2 10 2.50 25.00" }),
    });
    const provider = createOpenAiPdfImportOcrProvider({ apiKey: "sk-test", fetchImpl, model: "gpt-test" });

    const result = await provider.extractText({
      fileName: "scan.pdf",
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
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ candidates: [{ content: { parts: [{ text: "Gemini OCR" }] } }] }),
    });
    const provider = createGeminiPdfImportOcrProvider({ apiKey: "gemini-test", fetchImpl, model: "gemini-test" });

    const result = await provider.extractText({ fileName: "scan.pdf", pdfBytes: new Uint8Array([1, 2, 3]) });

    expect(result.text).toBe("Gemini OCR");
    expect(result.debug).toMatchObject({
      provider: "gemini",
      model: "gemini-test",
      pageNumber: 0,
      response: { status: 200, body: { candidates: expect.any(Array) } },
    });
    expect(result.debug?.request.body).toMatchObject({
      _debug: { model: "gemini-test", pdfFileName: "scan.pdf", pdfBytes: 3 },
    });
    const debugParts = (result.debug?.request.body.contents as Array<{ parts: unknown[] }>)[0]?.parts;
    expect(debugParts?.[1]).toEqual({ inline_data: { mime_type: "application/pdf", data: "<redacted>" } });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("generativelanguage.googleapis.com/v1beta/models/gemini-test"),
      expect.objectContaining({ body: expect.stringContaining('"inline_data"') }),
    );
  });

  it("preserves Gemini's raw 503 response without exposing the API key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: { code: 503, message: "backend unavailable", status: "UNAVAILABLE" } }),
    });
    const provider = createGeminiPdfImportOcrProvider({ apiKey: "gemini-secret", fetchImpl, model: "gemini-test" });

    const error = await provider.extractText({ fileName: "scan.pdf", pdfBytes: new Uint8Array([1, 2, 3]) }).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(PdfImportOcrProviderError);
    expect(error).toMatchObject({ name: "PdfImportOcrProviderError", status: 503 });
    expect((error as PdfImportOcrProviderError).debug.response).toMatchObject({
      status: 503,
      body: { error: { code: 503, message: "backend unavailable", status: "UNAVAILABLE" } },
    });

    expect(JSON.stringify(error)).not.toContain("gemini-secret");
  });

  it("uses OpenRouter when selected in the user's PDF provider settings", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "OpenRouter OCR" } }] }),
    });
    const { createPdfImportOcrProvider } = await import("./ocr");
    const provider = createPdfImportOcrProvider({ provider: "openrouter", apiKey: "router-test", fetchImpl, model: "vision-model" });

    const result = await provider.extractText({ fileName: "scan.pdf", pdfBytes: new Uint8Array([1, 2, 3]) });

    expect(result.text).toBe("OpenRouter OCR");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer router-test" }),
        body: expect.stringContaining('"type":"file"'),
      }),
    );
    expect(fetchImpl.mock.calls[0]?.[1].body).toEqual(expect.stringContaining("Procesa todas las paginas del PDF en una sola respuesta"));
  });

  it("sends the PDF as a local image input to Ollama with qwen2.5vl:7b", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ message: { content: "01.01 Trazo y replanteo m2 10 2.50 25.00" } }),
    });
    const provider = createOllamaPdfImportOcrProvider({ fetchImpl, renderImpl: async () => ["rendered-page"] });

    const result = await provider.extractText({ fileName: "scan.pdf", pdfBytes: new Uint8Array([1, 2, 3]) });

    expect(result.text).toContain("Trazo y replanteo");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({ method: "POST", body: expect.stringContaining('"model":"qwen2.5vl:7b"') }),
    );
    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1].body as string) as { messages: Array<{ images?: string[] }> };
    expect(body.messages[0]?.images).toEqual(["rendered-page"]);
    expect(JSON.parse(fetchImpl.mock.calls[0]?.[1].body as string).options).toMatchObject({ num_predict: 1_800, num_ctx: 8_192 });
  });

  it("processes each rendered PDF page independently and preserves page markers", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK", headers: new Headers(), json: async () => ({ message: { content: "<|md_start|>Fila 1<|md_END|>" } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK", headers: new Headers(), json: async () => ({ message: { content: "Fila 2" } }) });
    const provider = createOllamaPdfImportOcrProvider({ fetchImpl, renderImpl: async () => ["page-one", "page-two"] });

    const result = await provider.extractText({ fileName: "scan.pdf", pdfBytes: new Uint8Array([1, 2, 3]) });

    expect(result.text).toBe("Pagina 1, segmento 1:\nFila 1\n\nPagina 2, segmento 1:\nFila 2");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstPrompt = JSON.parse(fetchImpl.mock.calls[0]?.[1].body as string).messages[0].content as string;
    const secondPrompt = JSON.parse(fetchImpl.mock.calls[1]?.[1].body as string).messages[0].content as string;
    expect(firstPrompt).toContain("one logical row per line");
    expect(firstPrompt).toContain("transcribe its column headers exactly once");
    expect(secondPrompt).toContain("do not output them as a data row");
  });

  it("throws a clear error when no OCR provider is configured", async () => {
    await expect(requireConfiguredPdfImportOcrProvider(undefined)).rejects.toBeInstanceOf(PdfImportOcrUnavailableError);
  });
});
