export type S2kDetectedKind = "zip" | "sql-server-backup" | "sqlite" | "unknown";

export type S2kAnalysis = {
  detectedKind: S2kDetectedKind;
  signature: string;
  sizeBytes: number;
  hexPreview: string;
  asciiPreview: string;
  recommendedAction: string;
};

export type S10ImportPreview = {
  fileName: string;
  status: "needs-decoder";
  analysis: S2kAnalysis;
  messages: string[];
};

export const s2kAnalysisReadBytes = 4096;
const defaultPreviewBytes = 128;

export function analyzeS2kBuffer(
  buffer: Uint8Array,
  previewBytes = defaultPreviewBytes,
  sizeBytes = buffer.length,
): S2kAnalysis {
  const preview = buffer.subarray(0, Math.max(0, previewBytes));
  const asciiPreview = toVisibleAscii(preview);
  const utf16Preview = toVisibleUtf16Le(preview);
  const hexPreview = toHexPreview(preview);
  const signature = detectSignature(buffer, asciiPreview, utf16Preview);
  const detectedKind = detectKind(buffer, asciiPreview, utf16Preview);

  return {
    detectedKind,
    signature,
    sizeBytes,
    hexPreview,
    asciiPreview,
    recommendedAction: getRecommendedAction(detectedKind),
  };
}

export function createS10ImportPreview({
  fileName,
  buffer,
  sizeBytes,
}: {
  fileName: string;
  buffer: Uint8Array;
  sizeBytes?: number;
}): S10ImportPreview {
  const analysis = analyzeS2kBuffer(buffer, defaultPreviewBytes, sizeBytes);

  return {
    fileName,
    status: "needs-decoder",
    analysis,
    messages: [
      `Se analizo ${fileName} y se detecto el contenedor probable: ${analysis.detectedKind}.`,
      analysis.recommendedAction,
      "La importacion de partidas, APUs e insumos se habilitara cuando exista un decoder validado para este tipo de respaldo S10.",
    ],
  };
}

function detectKind(buffer: Uint8Array, asciiPreview: string, utf16Preview: string): S2kDetectedKind {
  if (startsWithBytes(buffer, [0x50, 0x4b])) {
    return "zip";
  }

  if (asciiPreview.includes("Microsoft Tape Format") || isSqlServerTapeBackup(buffer, utf16Preview)) {
    return "sql-server-backup";
  }

  if (asciiPreview.startsWith("SQLite format 3")) {
    return "sqlite";
  }

  return "unknown";
}

function detectSignature(buffer: Uint8Array, asciiPreview: string, utf16Preview: string) {
  if (startsWithBytes(buffer, [0x50, 0x4b])) {
    return "PK";
  }

  if (startsWithBytes(buffer, [0x54, 0x41, 0x50, 0x45])) {
    return "TAPE";
  }

  if (asciiPreview.includes("Microsoft Tape Format") || utf16Preview.includes("Microsoft Tape Format")) {
    return "Microsoft Tape Format";
  }

  if (asciiPreview.startsWith("SQLite format 3")) {
    return "SQLite format 3";
  }

  return buffer.length > 0 ? toHexPreview(buffer.subarray(0, Math.min(8, buffer.length))) : "";
}

function getRecommendedAction(kind: S2kDetectedKind) {
  if (kind === "zip") {
    return "Abrir como ZIP y revisar nombres de archivos internos para ubicar tablas, dumps o bases embebidas.";
  }

  if (kind === "sql-server-backup") {
    return "Restaurar en una instancia aislada de SQL Server y extraer tablas S10 hacia un formato intermedio verificable.";
  }

  if (kind === "sqlite") {
    return "Abrir como SQLite en modo solo lectura y mapear tablas de proyecto, presupuesto, partidas, APUs e insumos.";
  }

  return "Comparar la cabecera con respaldos S10 conocidos o enviar una muestra para construir un decoder especifico.";
}

function startsWithBytes(buffer: Uint8Array, bytes: readonly number[]) {
  if (buffer.length < bytes.length) {
    return false;
  }

  return bytes.every((byte, index) => buffer[index] === byte);
}

function isSqlServerTapeBackup(buffer: Uint8Array, utf16Preview: string) {
  return startsWithBytes(buffer, [0x54, 0x41, 0x50, 0x45]) && utf16Preview.includes("Microsoft SQL");
}

function toHexPreview(buffer: Uint8Array) {
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

function toVisibleAscii(buffer: Uint8Array) {
  return Array.from(buffer)
    .map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : "."))
    .join("");
}

function toVisibleUtf16Le(buffer: Uint8Array) {
  return [0, 1].map((offset) => decodeUtf16LeFromOffset(buffer, offset)).join("\n");
}

function decodeUtf16LeFromOffset(buffer: Uint8Array, offset: number) {
  if (buffer.length <= offset) {
    return "";
  }

  const availableLength = buffer.length - offset;
  const evenLength = availableLength - (availableLength % 2);

  return new TextDecoder("utf-16le")
    .decode(buffer.subarray(offset, offset + evenLength))
    .replace(/[^\x20-\x7e]/g, ".");
}
