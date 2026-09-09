import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/gateway/providers/gemini-provider";
import { DEFAULT_OPENROUTER_MODEL } from "@/lib/ai/gateway/providers/openrouter-provider";
import type { PdfImportProvider } from "@/types/settings";
import type { PdfImportAiDebug } from "./types";

export type PdfImportOcrResult = {
  text: string;
  confidence: number;
  debug?: PdfImportAiDebug;
};

export type PdfImportOcrProvider = {
  extractText(input: { fileName: string; pdfBytes: Uint8Array; pageNumber?: number }): Promise<PdfImportOcrResult>;
};

export const OPENAI_PDF_OCR_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const GEMINI_PDF_OCR_URL = "https://generativelanguage.googleapis.com/v1beta/models";
export const OPENROUTER_PDF_OCR_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OLLAMA_PDF_OCR_URL = "http://localhost:11434/api/chat";
export const DEFAULT_OPENAI_PDF_OCR_MODEL = "gpt-5-mini";
export const DEFAULT_OLLAMA_PDF_OCR_MODEL = "qwen2.5vl:7b";

export type PdfImportOcrProviderOptions = {
  provider: PdfImportProvider;
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  renderImpl?: PdfImportPdfRenderer;
};

export type PdfImportImageSegment = {
  image: string;
  pageNumber: number;
  segmentNumber: number;
  segmentCount: number;
  preserveTableHeader: boolean;
};

export type PdfImportPdfRenderer = (
  pdfBytes: Uint8Array,
  options?: { model?: string },
) => Promise<Array<string | PdfImportImageSegment>>;

export type OpenAiPdfImportOcrProviderOptions = Omit<PdfImportOcrProviderOptions, "provider">;

export class PdfImportOcrUnavailableError extends Error {
  constructor() {
    super("OCR/vision no esta configurado para procesar PDFs escaneados.");
  }
}

export class PdfImportOcrProviderError extends Error {
  constructor(message: string, readonly status: number, readonly debug: PdfImportAiDebug) {
    super(message);
    this.name = "PdfImportOcrProviderError";
  }
}

export async function requireConfiguredPdfImportOcrProvider(provider?: PdfImportOcrProvider) {
  if (!provider) {
    throw new PdfImportOcrUnavailableError();
  }

  return provider;
}

export function createPdfImportOcrProvider(options: PdfImportOcrProviderOptions): PdfImportOcrProvider {
  if (options.provider === "openai") {
    return createOpenAiPdfImportOcrProvider(options);
  }
  if (options.provider === "gemini") {
    return createGeminiPdfImportOcrProvider(options);
  }
  if (options.provider === "ollama") {
    return createOllamaPdfImportOcrProvider(options);
  }
  return createOpenRouterPdfImportOcrProvider(options);
}

export function createOllamaPdfImportOcrProvider({
  fetchImpl = fetch,
  model = DEFAULT_OLLAMA_PDF_OCR_MODEL,
  renderImpl = renderPdfToPngBase64,
}: Omit<PdfImportOcrProviderOptions, "provider" | "apiKey"> & { apiKey?: string }): PdfImportOcrProvider {
  return {
    async extractText(input) {
      const images = await renderImpl(input.pdfBytes, { model });
      const pageTexts: string[] = [];
      const responses: unknown[] = [];

      for (const [index, renderedImage] of images.entries()) {
        const segment = normalizePdfImageSegment(renderedImage, index);
        const requestBody = {
          model,
          messages: [{
            role: "user",
            content: buildOllamaOcrPrompt(segment.preserveTableHeader),
            images: [segment.image],
          }],
          stream: false,
          options: { temperature: 0, num_predict: 1_800, num_ctx: 8_192 },
        };
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 120_000);
        let response: Response;
        try {
          response = await fetchImpl(OLLAMA_PDF_OCR_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: abortController.signal,
          });
        } catch (error) {
          if (abortController.signal.aborted) {
            throw new Error(`Ollama OCR supero el limite de 120 segundos en la pagina ${segment.pageNumber}, segmento ${segment.segmentNumber}.`);
          }
          throw error;
        } finally {
          clearTimeout(timeout);
        }
        const responseBody = await readResponseBody(response);
        responses.push(responseBody);
        if (!response.ok) {
          const debug = createOcrDebug({
            provider: "ollama",
            model,
            input: { ...input, pageNumber: segment.pageNumber },
            url: OLLAMA_PDF_OCR_URL,
            requestBody: { ...requestBody, messages: [{ ...requestBody.messages[0], images: ["<redacted>"] }] },
            response,
            responseBody,
          });
          throw new PdfImportOcrProviderError(`Ollama OCR respondio con estado ${response.status}. Verifica que Ollama este activo y que exista ${model}.`, response.status, { ...debug, error: `HTTP ${response.status}` });
        }
        pageTexts.push(`Pagina ${segment.pageNumber}, segmento ${segment.segmentNumber}:\n${normalizeOllamaOcrText(parseOllamaOcrText(responseBody))}`);
      }

      return createOcrResult(pageTexts.join("\n\n"), createOllamaBatchDebug(input, model, images.length, responses));
    },
  };
}

export function createOpenAiPdfImportOcrProvider({
  apiKey,
  fetchImpl = fetch,
  model = DEFAULT_OPENAI_PDF_OCR_MODEL,
}: OpenAiPdfImportOcrProviderOptions): PdfImportOcrProvider {
  return {
    async extractText(input) {
      const requestBody = {
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildOcrPrompt(input.pageNumber),
              },
              {
                type: "input_file",
                filename: input.fileName,
                file_data: encodeBase64(input.pdfBytes),
              },
            ],
          },
        ],
      };

      const response = await fetchImpl(OPENAI_PDF_OCR_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const responseBody = await readResponseBody(response);
      const debug = createOcrDebug({
        provider: "openai",
        model,
        input,
        url: OPENAI_PDF_OCR_RESPONSES_URL,
        requestBody: {
          ...requestBody,
          input: [{
            role: "user",
            content: [
              { type: "input_text", text: buildOcrPrompt(input.pageNumber) },
              { type: "input_file", filename: input.fileName, file_data: "<redacted>" },
            ],
          }],
          _debug: { pdfBytes: input.pdfBytes.byteLength },
        },
        response,
        responseBody,
      });

      if (!response.ok) {
        throw new PdfImportOcrProviderError(`OpenAI OCR respondio con estado ${response.status}.`, response.status, { ...debug, error: `HTTP ${response.status}` });
      }

      return createOcrResult(parseOpenAiOcrText(responseBody), debug);
    },
  };
}

export function createGeminiPdfImportOcrProvider({
  apiKey,
  fetchImpl = fetch,
  model = DEFAULT_GEMINI_MODEL,
}: OpenAiPdfImportOcrProviderOptions): PdfImportOcrProvider {
  return {
    async extractText(input) {
      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [
              { text: buildOcrPrompt(input.pageNumber) },
              {
                inline_data: {
                  mime_type: "application/pdf",
                  data: encodeBase64(input.pdfBytes),
                },
              },
            ],
          },
        ],
      };

      const response = await fetchImpl(`${GEMINI_PDF_OCR_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const responseBody = await readResponseBody(response);
      const debug = createOcrDebug({
        provider: "gemini",
        model,
        input,
        url: `${GEMINI_PDF_OCR_URL}/${encodeURIComponent(model)}:generateContent`,
        requestBody: {
          ...requestBody,
          contents: [{
            role: "user",
            parts: [
              { text: buildOcrPrompt(input.pageNumber) },
              { inline_data: { mime_type: "application/pdf", data: "<redacted>" } },
            ],
          }],
          _debug: { model, pdfFileName: input.fileName, pdfBytes: input.pdfBytes.byteLength },
        },
        response,
        responseBody,
      });

      if (!response.ok) {
        throw new PdfImportOcrProviderError(`Gemini OCR respondio con estado ${response.status}.`, response.status, { ...debug, error: `HTTP ${response.status}` });
      }

      return createOcrResult(parseGeminiOcrText(responseBody), debug);
    },
  };
}

export function createOpenRouterPdfImportOcrProvider({
  apiKey,
  fetchImpl = fetch,
  model = DEFAULT_OPENROUTER_MODEL,
}: OpenAiPdfImportOcrProviderOptions): PdfImportOcrProvider {
  return {
    async extractText(input) {
      const requestBody = {
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildOcrPrompt(input.pageNumber) },
              {
                type: "file",
                file: {
                  filename: input.fileName,
                  file_data: `data:application/pdf;base64,${encodeBase64(input.pdfBytes)}`,
                },
              },
            ],
          },
        ],
      };

      const response = await fetchImpl(OPENROUTER_PDF_OCR_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const responseBody = await readResponseBody(response);
      const debug = createOcrDebug({
        provider: "openrouter",
        model,
        input,
        url: OPENROUTER_PDF_OCR_URL,
        requestBody: {
          ...requestBody,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: buildOcrPrompt(input.pageNumber) },
              { type: "file", file: { filename: input.fileName, file_data: "data:application/pdf;base64,<redacted>" } },
            ],
          }],
          _debug: { pdfBytes: input.pdfBytes.byteLength },
        },
        response,
        responseBody,
      });

      if (!response.ok) {
        throw new PdfImportOcrProviderError(`OpenRouter OCR respondio con estado ${response.status}. Verifica que el modelo soporte PDFs/vision.`, response.status, { ...debug, error: `HTTP ${response.status}` });
      }

      return createOcrResult(parseOpenRouterOcrText(responseBody), debug);
    },
  };
}

function buildOcrPrompt(pageNumber?: number) {
  const pageInstruction = pageNumber === undefined
    ? "Procesa todas las paginas del PDF en una sola respuesta. Separa cada pagina con el marcador exacto 'Pagina N:' y conserva el orden original."
    : `Pagina solicitada: ${pageNumber}.`;

  return [
    "Extrae texto y tablas del PDF para importacion de presupuesto de obra.",
    "Preserva codigos, descripciones, unidades, cantidades, precios unitarios y parciales.",
    "Devuelve solo texto plano. No inventes datos faltantes.",
    pageInstruction,
  ].join("\n");
}

function buildOllamaOcrPrompt(preserveTableHeader = true) {
  return [
    "<|grounding|>Extract the document as plain text, one logical row per line.",
    "For budget tables, emit each row as: CODE<TAB>DESCRIPTION<TAB>UNIT<TAB>QUANTITY<TAB>UNIT PRICE<TAB>PARTIAL.",
    "Preserve codes, descriptions, units, quantities, unit prices and totals exactly as visible.",
    "Do not summarize, explain, invent missing values or repeat rows.",
    "The image may be a vertical section of a PDF page; transcribe the visible section once.",
    preserveTableHeader
      ? "If a table starts in this section, transcribe its column headers exactly once."
      : "The column headers may be repeated from an earlier section. Use them to understand the columns, but do not output them as a data row.",
  ].join("\n");
}

function createOcrResult(text: string, debug?: PdfImportAiDebug): PdfImportOcrResult {
  return {
    text,
    confidence: text.trim().length > 0 ? 0.75 : 0.25,
    debug,
  };
}

async function readResponseBody(response: Response | { json: () => Promise<unknown>; text?: () => Promise<string> }) {
  if (typeof response.text === "function") {
    const rawBody = await response.text();
    if (rawBody.trim().length === 0) return null;
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return rawBody;
    }
  }

  return response.json();
}

function createOcrDebug(input: {
  provider: PdfImportAiDebug["provider"];
  model: string;
  input: { fileName: string; pageNumber?: number };
  url: string;
  requestBody: Record<string, unknown>;
  response: { status: number; statusText?: string; headers?: Headers };
  responseBody: unknown;
}): PdfImportAiDebug {
  const headers: Record<string, string> = {};
  input.response.headers?.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    stage: "ocr",
    provider: input.provider,
    model: input.model,
    pageNumber: input.input.pageNumber ?? 0,
    fileName: input.input.fileName,
    request: { method: "POST", url: input.url, body: input.requestBody },
    response: {
      status: input.response.status,
      statusText: input.response.statusText ?? "",
      headers,
      body: input.responseBody,
    },
  };
}

function parseOpenAiOcrText(payload: unknown) {
  if (isRecord(payload) && typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  if (isRecord(payload) && Array.isArray(payload.output)) {
    const nestedText = payload.output
      .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
      .map((contentItem) => (isRecord(contentItem) && typeof contentItem.text === "string" ? contentItem.text : undefined))
      .find((text): text is string => typeof text === "string" && text.trim().length > 0);

    if (nestedText) return nestedText.trim();
  }

  throw new Error("OpenAI OCR devolvio una respuesta sin texto.");
}

function parseGeminiOcrText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) {
    throw new Error("Gemini OCR devolvio una respuesta sin candidatos.");
  }

  const text = payload.candidates
    .flatMap((candidate) => {
      if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) return [];
      return candidate.content.parts;
    })
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : undefined))
    .find((partText): partText is string => typeof partText === "string" && partText.trim().length > 0);

  if (!text) throw new Error("Gemini OCR devolvio una respuesta sin texto.");
  return text.trim();
}

function parseOpenRouterOcrText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw new Error("OpenRouter OCR devolvio una respuesta sin choices.");
  }

  const message = payload.choices[0];
  if (!isRecord(message) || !isRecord(message.message)) {
    throw new Error("OpenRouter OCR devolvio un mensaje invalido.");
  }

  const content = message.message.content;
  if (typeof content === "string" && content.trim().length > 0) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : undefined))
      .find((partText): partText is string => typeof partText === "string" && partText.trim().length > 0);
    if (text) return text.trim();
  }

  throw new Error("OpenRouter OCR devolvio una respuesta sin texto.");
}

function parseOllamaOcrText(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.message) || typeof payload.message.content !== "string" || payload.message.content.trim().length === 0) {
    throw new Error("Ollama OCR devolvio una respuesta sin texto.");
  }

  return payload.message.content.trim();
}

function normalizeOllamaOcrText(text: string) {
  return text
    .replace(/<\|[^|]+\|>/gi, "")
    .trim();
}

function createOllamaBatchDebug(input: { fileName: string; pageNumber?: number }, model: string, pageCount: number, responses: unknown[]): PdfImportAiDebug {
  return {
    stage: "ocr",
    provider: "ollama",
    model,
    pageNumber: 0,
    fileName: input.fileName,
    request: {
      method: "POST",
      url: OLLAMA_PDF_OCR_URL,
      body: { model, pages: pageCount, prompt: buildOllamaOcrPrompt(false), images: "<redacted>" },
    },
    response: {
      status: 200,
      statusText: "OK",
      headers: {},
      body: responses,
    },
  };
}

function encodeBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

async function renderPdfToPngBase64(pdfBytes: Uint8Array, options: { model?: string } = {}): Promise<PdfImportImageSegment[]> {
  const [{ getDocument }, canvas] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("@napi-rs/canvas"),
  ]);
  const pdf = await getDocument({ data: pdfBytes, useWorkerFetch: false }).promise;
  const images: PdfImportImageSegment[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    const source = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const sourceContext = source.getContext("2d");
    sourceContext.fillStyle = "#ffffff";
    sourceContext.fillRect(0, 0, source.width, source.height);
    await page.render({
      canvas: source as unknown as HTMLCanvasElement,
      canvasContext: sourceContext as unknown as CanvasRenderingContext2D,
      viewport,
      background: "#ffffff",
    }).promise;

    // DeepSeek-OCR handles dense tables more reliably when each table section
    // occupies more of the visual input. A small overlap prevents a row from
    // being cut at the segment boundary.
    const overlap = 48;
    const segmentHeight = Math.ceil((source.height + overlap) / 2);
    const starts = [0, Math.max(0, source.height - segmentHeight)];
    const baseWindows = starts.map((start, segmentIndex) => {
      // The first segment of continuation pages starts with the repeated
      // column header. Removing that visual band prevents DeepSeek-OCR from
      // looping over "ITEMS / DESCRIPTION / ..." instead of reading rows.
      const headerTrim = pageNumber > 1 && segmentIndex === 0
        ? Math.round(source.height * 0.13)
        : 0;
      const segmentStart = Math.min(source.height - 1, start + headerTrim);
      const end = Math.min(source.height, start + segmentHeight);
      return { start: segmentStart, end, preserveTableHeader: pageNumber === 1 };
    });
    const isQwenVision = options.model?.toLowerCase().startsWith("qwen2.5vl") === true;
    const windows = baseWindows.flatMap((window, index) => {
      const splitRatio = !isQwenVision && pageNumber === 1 && index === 1
        ? 0.7
        : !isQwenVision && pageNumber > 1 && index === 0
          ? 0.55
          : null;
      if (splitRatio === null) return [window];

      const splitOverlap = 64;
      const midpoint = Math.floor(window.start + (window.end - window.start) * splitRatio);
      return [
        { ...window, end: Math.min(window.end, midpoint + splitOverlap) },
        { ...window, start: Math.max(window.start, midpoint - splitOverlap), preserveTableHeader: false },
      ];
    });
    for (const [segmentIndex, window] of windows.entries()) {
      const segmentCanvas = canvas.createCanvas(source.width, window.end - window.start);
      const segmentContext = segmentCanvas.getContext("2d");
      segmentContext.fillStyle = "#ffffff";
      segmentContext.fillRect(0, 0, segmentCanvas.width, segmentCanvas.height);
      segmentContext.drawImage(source, 0, -window.start);
      images.push({
        image: (await segmentCanvas.encode("png")).toString("base64"),
        pageNumber,
        segmentNumber: segmentIndex + 1,
        segmentCount: windows.length,
        preserveTableHeader: window.preserveTableHeader,
      });
    }
  }

  return images;
}

function normalizePdfImageSegment(renderedImage: string | PdfImportImageSegment, index: number): PdfImportImageSegment {
  if (typeof renderedImage !== "string") return renderedImage;

  return {
    image: renderedImage,
    pageNumber: index + 1,
    segmentNumber: 1,
    segmentCount: 1,
    preserveTableHeader: index === 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
