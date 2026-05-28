import Decimal from "decimal.js";

import type {
  MetradoFormulaInputKey,
  MetradoFormulaInputs,
  MetradoFormulaKey,
  MetradoValidationIssue,
} from "@/types/metrado";

type FormulaEvaluation = {
  value: number;
  issues: MetradoValidationIssue[];
};

function readInput(
  inputs: MetradoFormulaInputs,
  key: MetradoFormulaInputKey,
  rowId?: string,
): { decimal: Decimal; issue: MetradoValidationIssue | null } {
  const value = inputs[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      decimal: new Decimal(0),
      issue: {
        id: `${rowId ?? "row"}-${key}-missing`,
        severity: "error",
        rowId,
        field: key,
        message: `Falta el valor ${key}.`,
      },
    };
  }

  if (value < 0) {
    return {
      decimal: new Decimal(0),
      issue: {
        id: `${rowId ?? "row"}-${key}-negative`,
        severity: "error",
        rowId,
        field: key,
        message: `El valor ${key} no puede ser negativo.`,
      },
    };
  }

  return { decimal: new Decimal(value), issue: null };
}

function multiply(
  inputs: MetradoFormulaInputs,
  keys: MetradoFormulaInputKey[],
  rowId?: string,
): FormulaEvaluation {
  const issues: MetradoValidationIssue[] = [];
  let value = new Decimal(1);

  for (const key of keys) {
    const input = readInput(inputs, key, rowId);
    if (input.issue) {
      issues.push(input.issue);
    }
    value = value.mul(input.decimal);
  }

  if (issues.length > 0) {
    return { value: 0, issues };
  }

  return { value: roundMetradoNumber(value), issues };
}

export function evaluateMetradoFormula(
  formulaKey: MetradoFormulaKey,
  inputs: MetradoFormulaInputs,
  rowId?: string,
): FormulaEvaluation {
  if (formulaKey === "volume") {
    return multiply(inputs, ["largo", "ancho", "alto"], rowId);
  }

  if (formulaKey === "area") {
    return multiply(inputs, ["largo", "ancho"], rowId);
  }

  if (formulaKey === "linear") {
    return multiply(inputs, ["longitud", "cantidad"], rowId);
  }

  if (formulaKey === "rebarWeight") {
    return multiply(inputs, ["cantidad", "longitud", "pesoUnitario"], rowId);
  }

  if (formulaKey === "formworkArea") {
    return multiply(inputs, ["perimetro", "altura"], rowId);
  }

  if (formulaKey === "factorArea") {
    return multiply(inputs, ["area", "factor"], rowId);
  }

  return multiply(inputs, ["manual"], rowId);
}

export function roundMetradoNumber(value: Decimal): number {
  return value.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
}
