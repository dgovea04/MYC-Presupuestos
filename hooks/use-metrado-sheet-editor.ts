"use client";

import { useMemo } from "react";
import { calculateMetradoSheet } from "@/lib/calculations/metrados";
import { validateMetradoSheet } from "@/lib/metrados/validation";
import type {
  MetradoFormulaRecord,
  MetradoRowRecord,
  MetradoSheetRecord,
  MetradoUnit,
} from "@/types/metrado";

type UseMetradoSheetEditorInput = {
  sheet?: MetradoSheetRecord | null;
  rows: MetradoRowRecord[];
  unit: MetradoUnit;
  formulas: MetradoFormulaRecord[];
  linkedPartidaUnit?: string | null;
};

export function useMetradoSheetEditor({
  rows,
  unit,
  formulas,
  linkedPartidaUnit,
}: UseMetradoSheetEditorInput) {
  const calculation = useMemo(
    () => calculateMetradoSheet({ unit, rows, formulas }),
    [formulas, rows, unit],
  );
  const issues = useMemo(
    () => validateMetradoSheet({
      sheetUnit: unit,
      templateFormulaKeys: formulas.map((formula) => formula.key),
      formulas,
      linkedPartidaUnit,
      rows: calculation.rows,
    }),
    [calculation.rows, formulas, linkedPartidaUnit, unit],
  );

  return {
    calculation,
    issues,
    hasBlockingIssues: issues.some((issue) => issue.severity === "error"),
  };
}
