import type { PdfImportDocumentRole } from "./types";

export const PDF_IMPORT_OUTPUT_JSON_SHAPE = {
  project: { name: "nombre del proyecto o null", currency: "PEN|USD|null" },
  budgets: [
    {
      name: "nombre del presupuesto o especialidad",
      items: [
        {
          code: "codigo observado",
          description: "descripcion observada",
          unit: "unidad observada",
          quantity: "cantidad como texto decimal",
          unitPrice: "precio unitario como texto decimal",
          partial: "parcial como texto decimal",
          sourcePage: 1,
          confidence: 0.85,
        },
      ],
    },
  ],
  apus: [
    {
      budgetItemCode: "codigo de partida o null",
      name: "nombre APU",
      unit: "unidad",
      performance: "rendimiento como texto decimal",
      totalUnitCost: "costo unitario como texto decimal",
      sourcePage: 1,
      confidence: 0.85,
      rows: [
        {
          description: "insumo o subpartida",
          unit: "unidad",
          resourceType: "MATERIAL|LABOR|EQUIPMENT|TOOLS|SUBPARTIDA|OTHER",
          quantity: "cantidad como texto decimal",
          unitPrice: "precio unitario como texto decimal",
          subtotal: "subtotal como texto decimal",
          sourcePage: 1,
          confidence: 0.8,
        },
      ],
    },
  ],
  subpartidas: [],
  resources: [],
  warnings: ["advertencias de datos faltantes o baja confianza"],
};

export type BuildPdfImportStructurePromptInput = {
  files: Array<{
    fileName: string;
    role: PdfImportDocumentRole;
    text: string;
  }>;
  outputShape?: object;
};

export function buildPdfImportStructurePrompt({ files, outputShape = PDF_IMPORT_OUTPUT_JSON_SHAPE }: BuildPdfImportStructurePromptInput) {
  return [
    "Estructura este paquete de PDFs de presupuesto de obra.",
    "Devuelve unicamente JSON valido. No uses markdown, no agregues explicaciones y no uses bloques de codigo.",
    "No inventes codigos, cantidades, precios, unidades ni rendimientos. Si un dato no esta observado, usa null o agrega una advertencia.",
    "Preserva los valores numericos como strings decimales sin simbolos de moneda.",
    "Marca confidence bajo cuando el texto sea OCR, incompleto o ambiguo.",
    "OUTPUT JSON SHAPE:",
    JSON.stringify(outputShape, null, 2),
    "DOCUMENTOS:",
    ...files.map((file) => [
      `Archivo: ${file.fileName}`,
      `Tipo declarado: ${file.role}`,
      "Texto extraido:",
      truncateForPrompt(file.text),
    ].join("\n")),
  ].join("\n\n");
}

function truncateForPrompt(text: string) {
  const maxLength = 24_000;
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n[TRUNCADO]` : text;
}
