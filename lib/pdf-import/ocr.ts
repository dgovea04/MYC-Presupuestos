export type PdfImportOcrResult = {
  text: string;
  confidence: number;
};

export type PdfImportOcrProvider = {
  extractText(input: { fileName: string; pageNumber: number; pdfBytes: Uint8Array }): Promise<PdfImportOcrResult>;
};

export const OPENAI_PDF_OCR_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const DEFAULT_OPENAI_PDF_OCR_MODEL = "gpt-5-mini";

export type OpenAiPdfImportOcrProviderOptions = {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

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

export function createOpenAiPdfImportOcrProvider({
  apiKey,
  fetchImpl = fetch,
  model = process.env.OPENAI_PDF_OCR_MODEL || process.env.OPENAI_MODEL || DEFAULT_OPENAI_PDF_OCR_MODEL,
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
                text: [
                  "Extrae texto y tablas del PDF para importacion de presupuesto de obra.",
                  "Preserva codigos, descripciones, unidades, cantidades, precios unitarios y parciales.",
                  "Devuelve solo texto plano. No inventes datos faltantes.",
                  `Pagina solicitada: ${input.pageNumber}.`,
                ].join("\n"),
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
      const text = parseOpenAiOcrText(payload);
      return {
        text,
        confidence: text.trim().length > 0 ? 0.75 : 0.25,
      };
    },
  };
}

export function createOpenAiPdfImportOcrProviderFromEnv(): PdfImportOcrProvider | undefined {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? createOpenAiPdfImportOcrProvider({ apiKey }) : undefined;
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

    if (nestedText) {
      return nestedText.trim();
    }
  }

  throw new Error("OpenAI OCR devolvio una respuesta sin texto.");
}

function encodeBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
