import Decimal from "decimal.js";

import {
  evaluateMetradoFormula,
  roundMetradoNumber,
} from "@/lib/metrados/formula-engine";
import type {
  MetradoCalculationResult,
  MetradoRowRecord,
  MetradoUnit,
  MetradoValidationIssue,
} from "@/types/metrado";

const metradoUnits: MetradoUnit[] = ["m", "m2", "m3", "kg", "und", "glb"];

function evaluateMetradoRow(row: MetradoRowRecord): {
  row: MetradoRowRecord;
  issues: MetradoValidationIssue[];
} {
  const result = evaluateMetradoFormula(row.formulaKey, row.inputs, row.id);

  return {
    row: {
      ...row,
      partial: result.value,
    },
    issues: result.issues,
  };
}

export function calculateMetradoRow(row: MetradoRowRecord): MetradoRowRecord {
  return evaluateMetradoRow(row).row;
}

export function calculateMetradoSheet(input: {
  unit: MetradoUnit;
  rows: MetradoRowRecord[];
}): MetradoCalculationResult {
  const evaluatedRows = input.rows.map(evaluateMetradoRow);
  const rows = evaluatedRows.map((evaluatedRow) => evaluatedRow.row);
  const totalsByUnit = metradoUnits.reduce<Record<MetradoUnit, number>>(
    (totals, unit) => {
      const total = rows
        .filter((row) => row.unit === unit)
        .reduce((sum, row) => sum.add(row.partial), new Decimal(0));

      totals[unit] = roundMetradoNumber(total);
      return totals;
    },
    { m: 0, m2: 0, m3: 0, kg: 0, und: 0, glb: 0 },
  );
  const issues = evaluatedRows.flatMap((evaluatedRow) => evaluatedRow.issues);

  return {
    rows,
    totalsByUnit,
    primaryTotal: totalsByUnit[input.unit],
    issues,
  };
}
