/**
 * CSV import utility for metrados with spatial data support.
 *
 * Parses CSV files and normalizes column headers to match internal
 * metrado field names, including spatial/coordinate columns for
 * linear metrados (progresivas, coordenadas).
 */

/** Map of known CSV column headers to internal field keys */
const headerAliases: Record<string, string> = {
  // Standard metrado fields
  sector: "sector",
  Sector: "sector",
  SECTOR: "sector",
  Zona: "sector",
  zona: "sector",

  eje: "eje",
  Eje: "eje",
  EJE: "eje",

  nivel: "nivel",
  Nivel: "nivel",
  NIVEL: "nivel",

  description: "description",
  Description: "description",
  Descripción: "description",
  descripcion: "description",
  Descripcion: "description",
  DESCRIPCION: "description",
  DESCRIPCIÓN: "description",

  unit: "unit",
  Unit: "unit",
  Unidad: "unit",
  unidad: "unit",
  UND: "unit",
  und: "unit",

  formulaKey: "formulaKey",
  Formula: "formulaKey",
  formula: "formulaKey",
  FORMULA: "formulaKey",
  Fórmula: "formulaKey",

  // Standard formula inputs
  largo: "largo",
  Largo: "largo",
  LARGO: "largo",
  ancho: "ancho",
  Ancho: "ancho",
  ANCHO: "ancho",
  alto: "alto",
  Alto: "alto",
  ALTO: "alto",
  cantidad: "cantidad",
  Cantidad: "cantidad",
  CANTIDAD: "cantidad",
  longitud: "longitud",
  Longitud: "longitud",
  LONGITUD: "longitud",
  peso: "pesoUnitario",
  Peso: "pesoUnitario",
  "Peso unitario": "pesoUnitario",
  pesoUnitario: "pesoUnitario",
  perimetro: "perimetro",
  Perimetro: "perimetro",
  PERIMETRO: "perimetro",
  Perímetro: "perimetro",
  altura: "altura",
  Altura: "altura",
  ALTURA: "altura",
  area: "area",
  Area: "area",
  AREA: "area",
  Área: "area",
  factor: "factor",
  Factor: "factor",
  FACTOR: "factor",
  manual: "manual",
  Manual: "manual",
  MANUAL: "manual",

  // Spatial / coordinate fields for linear metrados
  "Progresiva inicio": "progresivaInicio",
  "Progresiva Inicio": "progresivaInicio",
  progresiva_inicio: "progresivaInicio",
  progresivaInicio: "progresivaInicio",
  "Progresiva inicial": "progresivaInicio",
  progInicio: "progresivaInicio",
  "P.Inicio": "progresivaInicio",
  "Estaca inicio": "progresivaInicio",
  estacaInicio: "progresivaInicio",

  "Progresiva final": "progresivaFin",
  "Progresiva Final": "progresivaFin",
  progresiva_fin: "progresivaFin",
  progresivaFin: "progresivaFin",
  "Progresiva fin": "progresivaFin",
  progFin: "progresivaFin",
  "P.Fin": "progresivaFin",
  "Estaca final": "progresivaFin",
  estacaFin: "progresivaFin",

  "Coord X": "coordenadaX",
  "Coord x": "coordenadaX",
  "coordenada X": "coordenadaX",
  coordenadaX: "coordenadaX",
  coordX: "coordenadaX",
  "coordenada_x": "coordenadaX",
  X: "coordenadaX",

  "Coord Y": "coordenadaY",
  "Coord y": "coordenadaY",
  "coordenada Y": "coordenadaY",
  coordenadaY: "coordenadaY",
  coordY: "coordenadaY",
  "coordenada_y": "coordenadaY",
  Y: "coordenadaY",

  "Coord Z": "coordenadaZ",
  "Coord z": "coordenadaZ",
  "coordenada Z": "coordenadaZ",
  coordenadaZ: "coordenadaZ",
  coordZ: "coordenadaZ",
  "coordenada_z": "coordenadaZ",
  Z: "coordenadaZ",
};

/**
 * Parse a CSV text string into an array of records (header → value).
 *
 * Handles:
 * - Comma and semicolon delimiters (auto-detect)
 * - Quoted fields with embedded commas, newlines, and quotes
 * - Header row normalization to internal field keys
 * - Empty rows skipped
 * - BOM removal
 */
export function parseCsvRows(csvText: string): Record<string, unknown>[] {
  const text = csvText.replace(/^\uFEFF/, "").trim();
  if (!text) return [];

  // Auto-detect delimiter: prefer semicolon if present in header, else comma
  const firstLine = text.split("\n")[0] ?? "";
  const delimiter = firstLine.includes(";") ? ";" : ",";

  const lines = splitCsvLines(text);
  if (lines.length < 2) return [];

  const rawHeaders = parseCsvLine(lines[0]!, delimiter);
  const headers = rawHeaders.map((h) => normalizeCsvHeader(h));
  const records: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!, delimiter);
    if (values.length === 0) continue;
    if (values.every((v) => v.trim() === "")) continue;

    const record: Record<string, unknown> = {};
    let hasValue = false;

    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (!key) continue;

      const raw = values[j] ?? "";
      const trimmed = raw.trim();

      if (trimmed !== "") {
        const parsed = tryParseNumber(trimmed);
        record[key] = parsed;
        hasValue = true;
      } else {
        record[key] = null;
      }
    }

    if (hasValue) {
      records.push(record);
    }
  }

  return records;
}

/**
 * Normalize a CSV header to its internal field key.
 * Unknown headers are returned as-is (clean identifier).
 */
export function normalizeCsvHeader(header: string): string {
  const trimmed = header.trim();

  // Direct match
  if (headerAliases[trimmed]) {
    return headerAliases[trimmed]!;
  }

  // Normalize to camelCase for dynamic keys: strip special chars, lowercase first word
  const cleaned = trimmed
    .replace(/[^A-Za-z0-9\s_-]/g, " ")
    .replace(/[-_\s]+/g, " ")
    .trim()
    .split(" ")
    .map((word, idx) =>
      idx === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");

  return cleaned || `col_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Try to parse a string as a finite number; returns the string if not numeric.
 */
function tryParseNumber(value: string): string | number {
  const trimmed = value.replace(/^[\s"']+|[\s"']+$/g, "");
  const num = Number(trimmed.replace(",", "."));
  if (Number.isFinite(num)) {
    return num;
  }
  return trimmed;
}

/**
 * Split CSV text into lines, respecting quoted fields that span multiple lines.
 */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') {
      inQuotes = !inQuotes;
    }
    if (char === "\n" && !inQuotes) {
      lines.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    lines.push(current);
  }

  return lines;
}

/**
 * Parse a single CSV line into field values, handling quoted fields.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;

    if (char === '"') {
      // Check for escaped quote ""
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

/**
 * Check if a file appears to be CSV based on extension or MIME type.
 */
export function isCsvFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "text/plain"
  );
}
