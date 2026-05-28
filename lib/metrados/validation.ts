import { evaluateMetradoFormula } from "@/lib/metrados/formula-engine";
import type {
  MetradoFormulaKey,
  MetradoRowRecord,
  MetradoUnit,
  MetradoValidationIssue,
} from "@/types/metrado";

const validUnits = new Set<MetradoUnit>(["m", "m2", "m3", "kg", "und", "glb"]);

function normalizeLinkedUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

export function validateMetradoSheet({
  sheetUnit,
  templateFormulaKeys,
  linkedPartidaUnit,
  rows,
}: {
  sheetUnit: MetradoUnit;
  templateFormulaKeys: MetradoFormulaKey[];
  linkedPartidaUnit?: string | null;
  rows: MetradoRowRecord[];
}): MetradoValidationIssue[] {
  const issues: MetradoValidationIssue[] = [];

  if (rows.length === 0) {
    issues.push({
      id: "sheet-empty",
      severity: "error",
      message: "La hoja debe tener al menos una fila de metrado.",
    });
  }

  if (!validUnits.has(sheetUnit)) {
    issues.push({
      id: "sheet-unit-unsupported",
      severity: "error",
      field: "unit",
      message: "La unidad principal de la hoja no esta soportada.",
    });
  }

  if (linkedPartidaUnit && normalizeLinkedUnit(linkedPartidaUnit) !== sheetUnit) {
    issues.push({
      id: "sheet-linked-unit-mismatch",
      severity: "error",
      field: "unit",
      message: "La unidad de la hoja no coincide con la unidad de la partida vinculada.",
    });
  }

  for (const row of rows) {
    if (!validUnits.has(row.unit)) {
      issues.push({
        id: `${row.id}-unit-unsupported`,
        severity: "error",
        rowId: row.id,
        field: "unit",
        message: "La unidad de la fila no esta soportada.",
      });
    }

    if (!templateFormulaKeys.includes(row.formulaKey)) {
      issues.push({
        id: `${row.id}-formula-unsupported`,
        severity: "error",
        rowId: row.id,
        field: "formulaKey",
        message: "La formula no pertenece a la plantilla seleccionada.",
      });
    }

    issues.push(...evaluateMetradoFormula(row.formulaKey, row.inputs, row.id).issues);
  }

  return issues;
}

export function hasBlockingMetradoIssues(issues: MetradoValidationIssue[]) {
  return issues.some((issue) => issue.severity === "error");
}
