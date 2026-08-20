import type { PdfImportDocumentRole } from "./types";

export function isLikelyScannedPdfPage(text: string) {
  const normalized = text.trim();
  if (normalized.length < 20) {
    return true;
  }

  const numericTokens = normalized.match(/\d+/g)?.length ?? 0;
  const wordTokens = normalized.match(/[a-zA-Z]{3,}/g)?.length ?? 0;
  return wordTokens < 3 && numericTokens < 3;
}

export function classifyPdfImportPage(text: string): Exclude<PdfImportDocumentRole, "AUTO"> {
  const normalized = normalize(text);

  if (normalized.includes("subpartida") || normalized.includes("sub partida")) {
    return "SUBPARTIDAS";
  }

  if (
    normalized.includes("analisis de precios unitarios") ||
    normalized.includes("analisis de costo unitario") ||
    normalized.includes("mano de obra") ||
    normalized.includes("materiales") && normalized.includes("equipos")
  ) {
    return "APU";
  }

  if (
    normalized.includes("presupuesto") ||
    normalized.includes("metrado") ||
    normalized.includes("precio") && normalized.includes("parcial")
  ) {
    return "BUDGET";
  }

  return "OTHER";
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
