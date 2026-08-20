import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/gateway/providers/gemini-provider";
import { DEFAULT_OPENROUTER_MODEL } from "@/lib/ai/gateway/providers/openrouter-provider";
import type { PdfImportProvider } from "@/types/settings";

export type PdfImportOcrResult = {
  text: string;
  confidence: number;
};

export type PdfImportOcrProvider = {
  extractText(input: { fileName: string; pageNumber: number; pdfBytes: Uint8Array }): Promise<PdfImportOcrResult>;
};

export const OPENAI_PDF_OCR_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const GEMINI_PDF_OCR_URL = "https://generativelanguage.googleapis.com/v1beta/models";
export const OPENROUTER_PDF_OCR_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_OPENAI_PDF_OCR_MODEL = "gpt-5-mini";

export type PdfImportOcrProviderOptions = {
  provider: PdfImportProvider;
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export type OpenAiPdfImportOcrProviderOptions = Omit<PdfImportOcrProviderOptions, "provider">;

export class PdfImportOcrUnavailableError extends Error {
  constructor() {
    super("OCR/vision no esta configurado para procesar PDFs escaneados.");
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
  return createOpenRouterPdfImportOcrProvider(options);
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

      if (!response.ok) {
        throw new Error(`OpenAI OCR respondio con estado ${response.status}.`);
      }

      const payload: unknown = await response.json();
      return createOcrResult(parseOpenAiOcrText(payload));
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

      if (!response.ok) {
        throw new Error(`Gemini OCR respondio con estado ${response.status}.`);
      }

      const payload: unknown = await response.json();
      return createOcrResult(parseGeminiOcrText(payload));
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

      if (!response.ok) {
        throw new Error(`OpenRouter OCR respondio con estado ${response.status}. Verifica que el modelo soporte PDFs/vision.`);
      }

      const payload: unknown = await response.json();
      return createOcrResult(parseOpenRouterOcrText(payload));
    },
  };
}

function buildOcrPrompt(pageNumber: number) {
  return [
    "Extrae texto y tablas del PDF para importacion de presupuesto de obra.",
    "Preserva codigos, descripciones, unidades, cantidades, precios unitarios y parciales.",
    "Devuelve solo texto plano. No inventes datos faltantes.",
    `Pagina solicitada: ${pageNumber}.`,
  ].join("\n");
}

function createOcrResult(text: string): PdfImportOcrResult {
  return {
    text,
    confidence: text.trim().length > 0 ? 0.75 : 0.25,
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

function encodeBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
