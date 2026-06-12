import type {
  MetradoFormulaInputKey,
  MetradoFormulaInputs,
  MetradoFormulaKey,
  MetradoRowRecord,
  MetradoUnit,
  MetradoValidationIssue,
} from "@/types/metrado";

type MetradoImportResult = {
  rows: MetradoRowRecord[];
  issues: MetradoValidationIssue[];
};

const validFormulaKeys = new Set<MetradoFormulaKey>([
  "volume",
  "area",
  "linear",
  "rebarWeight",
  "formworkArea",
  "factorArea",
  "manual",
]);

const validUnits = new Set<MetradoUnit>(["m", "m2", "m3", "kg", "und", "glb", "p2", "ml", "pza", "bol", "gal", "ton", "mes", "día", "viaje", "pto", "jgo", "pln", "mll"]);

const inputKeys = [
  "largo",
  "ancho",
  "alto",
  "cantidad",
  "longitud",
  "pesoUnitario",
  "perimetro",
  "altura",
  "area",
  "factor",
  "manual",
  // Spatial / coordinate inputs for linear metrados
  "progresivaInicio",
  "progresivaFin",
  "coordenadaX",
  "coordenadaY",
  "coordenadaZ",
] as const satisfies MetradoFormulaInputKey[];

export function normalizeMetradoImportRows(
  rawRows: Record<string, unknown>[],
): MetradoImportResult {
  const issues: MetradoValidationIssue[] = [];
  const rows = rawRows.map((rawRow, index): MetradoRowRecord => {
    const rowId = `import-row-${index + 1}`;
    const rawUnit = toText(rawRow.unit, "und");
    const rawFormulaKey = toText(rawRow.formulaKey, "manual");
    const unit = normalizeUnit(rawUnit, rowId, issues);
    const formulaKey = normalizeFormulaKey(rawFormulaKey, rowId, issues);

    return {
      id: rowId,
      sheetId: "",
      sector: toText(rawRow.sector),
      eje: toText(rawRow.eje),
      nivel: toText(rawRow.nivel),
      description: toText(rawRow.description, "Fila importada"),
      unit,
      formulaKey,
      inputs: normalizeInputs(rawRow),
      partial: 0,
      sortOrder: index + 1,
    };
  });

  return { rows, issues };
}

function normalizeUnit(
  value: string,
  rowId: string,
  issues: MetradoValidationIssue[],
): MetradoUnit {
  if (isMetradoUnit(value)) {
    return value;
  }

  issues.push({
    id: `${rowId}-unit`,
    severity: "error",
    rowId,
    field: "unit",
    message: "La unidad importada no esta soportada.",
  });
  return "und";
}

function normalizeFormulaKey(
  value: string,
  rowId: string,
  issues: MetradoValidationIssue[],
): MetradoFormulaKey {
  if (isMetradoFormulaKey(value)) {
    return value;
  }

  issues.push({
    id: `${rowId}-formula`,
    severity: "error",
    rowId,
    field: "formulaKey",
    message: "La formula importada no esta soportada.",
  });
  return "manual";
}

function normalizeInputs(rawRow: Record<string, unknown>): MetradoFormulaInputs {
  return inputKeys.reduce<MetradoFormulaInputs>((inputs, key) => {
    const value = toFiniteNumber(rawRow[key]);
    if (value !== null) {
      inputs[key] = value;
    }
    return inputs;
  }, {});
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function isMetradoFormulaKey(value: string): value is MetradoFormulaKey {
  return validFormulaKeys.has(value as MetradoFormulaKey);
}

function isMetradoUnit(value: string): value is MetradoUnit {
  return validUnits.has(value as MetradoUnit);
}
