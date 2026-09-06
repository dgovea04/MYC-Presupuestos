export interface CsvExtractionResult { delimiter: "," | ";" | "\t"; headers: string[]; rows: Array<{ values: string[]; line: number; location: { row: number; column: number } }>; warnings: string[] }

export function parseReviewCsv(bytes: Uint8Array): CsvExtractionResult {
  const decoded = decodeCsv(bytes);
  const text = decoded.text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const records = parseRecords(text, delimiter);
  const headers = records.shift()?.values.map((value) => value.trim()) ?? [];
  const warnings: string[] = [];
  if (headers.length === 0) warnings.push("El CSV no contiene encabezados.");
  if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) warnings.push("El CSV contiene encabezados duplicados.");
  return { delimiter, headers, rows: records.filter((record) => record.values.some((value) => value.trim() !== "")).map((record) => ({ values: record.values, line: record.line, location: { row: record.line, column: 1 } })), warnings: decoded.warning ? [decoded.warning, ...warnings] : warnings };
}

function decodeCsv(bytes: Uint8Array): { text: string; warning?: string } {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(bytes), warning: "El CSV estaba codificado en UTF-16LE; fue normalizado a Unicode." };
  try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) }; } catch { return { text: new TextDecoder("windows-1252").decode(bytes), warning: "El CSV no era UTF-8; se utilizó una decodificación compatible." }; }
}
function detectDelimiter(text: string): "," | ";" | "\t" { const line = text.split(/\r?\n/, 1)[0] ?? ""; const counts = [",", ";", "\t"].map((delimiter) => [delimiter as "," | ";" | "\t", countOutsideQuotes(line, delimiter)] as const); return counts.sort((left, right) => right[1] - left[1])[0]?.[0] ?? ","; }
function countOutsideQuotes(line: string, delimiter: string): number { let quoted = false; let count = 0; for (const char of line) { if (char === '"') quoted = !quoted; else if (!quoted && char === delimiter) count += 1; } return count; }
function parseRecords(text: string, delimiter: string): Array<{ values: string[]; line: number }> { const records: Array<{ values: string[]; line: number }> = []; let values: string[] = []; let value = ""; let quoted = false; let line = 1; let startLine = 1; for (let index = 0; index < text.length; index += 1) { const char = text[index]!; const next = text[index + 1]; if (char === '"') { if (quoted && next === '"') { value += '"'; index += 1; } else quoted = !quoted; } else if (char === delimiter && !quoted) { values.push(value); value = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; values.push(value); records.push({ values, line: startLine }); values = []; value = ""; line += 1; startLine = line; } else { value += char; if (char === "\n") line += 1; } } if (value !== "" || values.length > 0) { values.push(value); records.push({ values, line: startLine }); } return records; }
