import type {
  BudgetFooterRowRecord,
  CalculatedBudgetFooterRowRecord,
  CalculatedBudgetFooterStructureRecord,
} from "@/lib/budget-footer/types";

export function calculateBudgetFooterBuilder(input: {
  rows: BudgetFooterRowRecord[];
  totalDirectCost: number;
  totalGeneralExpenses: number;
  totalUtility?: number;
  subtotal?: number;
  totalTax?: number;
  totalAmount?: number;
  currencyDecimals?: number;
}): CalculatedBudgetFooterStructureRecord {
  const decimals = normalizeCurrencyDecimals(input.currencyDecimals);
  const rowsByVariable = new Map(
    input.rows.map((row) => [row.variable.trim().toUpperCase(), row] as const).filter(([variable]) => variable.length > 0),
  );

  const cache = new Map<string, { value: number; error: string | null; isCalculated: boolean }>();
  const visiting = new Set<string>();

  const calculatedRows = input.rows.map((row) => {
    const result = evaluateRow(row);
    return {
      ...row,
      value: result.value,
      error: result.error,
      isCalculated: result.isCalculated,
    } satisfies CalculatedBudgetFooterRowRecord;
  });

  const totalRow =
    calculatedRows.find((row) => row.variable.trim().toUpperCase() === "TOTAL") ??
    calculatedRows[calculatedRows.length - 1] ??
    null;

  return {
    rows: calculatedRows,
    amountInWords: formatAmountInWords(totalRow?.value ?? 0),
  };

  function evaluateRow(row: BudgetFooterRowRecord): { value: number; error: string | null; isCalculated: boolean } {
    const key = row.variable.trim().toUpperCase();
    if (cache.has(row.id)) {
      return cache.get(row.id)!;
    }

    const formula = row.formula?.trim();

    if (!formula && row.manualValue !== 0) {
      const result = {
        value: round(row.manualValue, decimals),
        error: null,
        isCalculated: false,
      };
      cache.set(row.id, result);
      return result;
    }

    const systemValue = getSystemVariableValue(key);
    if (systemValue !== null) {
      const result = { value: systemValue, error: null, isCalculated: true };
      cache.set(row.id, result);
      return result;
    }

    if (formula) {
      if (visiting.has(row.id)) {
        return { value: 0, error: "Dependencia circular detectada", isCalculated: true };
      }

      visiting.add(row.id);
      const resolved = evaluateFormula(formula);
      visiting.delete(row.id);
      cache.set(row.id, { ...resolved, isCalculated: true });
      return cache.get(row.id)!;
    }

    if (row.manualValue !== 0) {
      const result = {
        value: round(row.manualValue, decimals),
        error: null,
        isCalculated: false,
      };
      cache.set(row.id, result);
      return result;
    }

    const result = {
      value: round(row.manualValue, decimals),
      error: null,
      isCalculated: false,
    };
    cache.set(row.id, result);
    return result;
  }

  function evaluateFormula(formula: string) {
    const referencedVariables = [...new Set(formula.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])];
    const variableValues = new Map<string, number>();

    for (const rawVariable of referencedVariables) {
      const variable = rawVariable.toUpperCase();
      const referencedRow = rowsByVariable.get(variable);
      if (referencedRow) {
        const referencedResult = evaluateRow(referencedRow);
        if (referencedResult.error) {
          return { value: 0, error: referencedResult.error };
        }

        variableValues.set(variable, referencedResult.value);
        continue;
      }

      const systemValue = getSystemVariableValue(variable);
      if (systemValue !== null) {
        variableValues.set(variable, systemValue);
        continue;
      }

      return { value: 0, error: `Variable no encontrada: ${variable}` };
    }

    const sanitizedExpression = formula.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (match) => {
      const value = variableValues.get(match.toUpperCase());
      return value === undefined ? "0" : String(value);
    });

    if (!/^[\d+\-*/().\s]+$/.test(sanitizedExpression)) {
      return { value: 0, error: "Formula invalida" };
    }

    try {
      const value = Function(`"use strict"; return (${sanitizedExpression});`)();
      if (!Number.isFinite(value)) {
        return { value: 0, error: "Formula invalida" };
      }

      return { value: round(value, decimals), error: null };
    } catch {
      return { value: 0, error: "Formula invalida" };
    }
  }

  function getSystemVariableValue(variable: string) {
    if (variable === "CD") {
      return round(input.totalDirectCost, decimals);
    }

    if (variable === "PGG") {
      return round(input.totalGeneralExpenses, decimals);
    }

    if (variable === "UTI" && input.totalUtility !== undefined) {
      return round(input.totalUtility, decimals);
    }

    if (variable === "IGV" && input.totalTax !== undefined) {
      return round(input.totalTax, decimals);
    }

    return null;
  }
}

function normalizeCurrencyDecimals(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return 2;
  }

  return Math.min(4, Math.max(0, Math.trunc(value)));
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatAmountInWords(amount: number) {
  const absolute = Math.abs(amount);
  const integerPart = Math.floor(absolute);
  const decimalPart = Math.round((absolute - integerPart) * 100);
  return `SON: ${toSpanishWords(integerPart)} CON ${decimalPart.toString().padStart(2, "0")}/100 SOLES`;
}

function toSpanishWords(value: number): string {
  if (value === 0) return "CERO";
  if (value < 0) return `MENOS ${toSpanishWords(Math.abs(value))}`;
  if (value >= 1_000_000) {
    const millions = Math.floor(value / 1_000_000);
    const remainder = value % 1_000_000;
    const millionsText = millions === 1 ? "UN MILLON" : `${toSpanishWords(millions)} MILLONES`;
    return remainder === 0 ? millionsText : `${millionsText} ${toSpanishWords(remainder)}`;
  }
  if (value >= 1000) {
    const thousands = Math.floor(value / 1000);
    const remainder = value % 1000;
    const thousandsText = thousands === 1 ? "MIL" : `${toSpanishWords(thousands)} MIL`;
    return remainder === 0 ? thousandsText : `${thousandsText} ${toSpanishWords(remainder)}`;
  }
  if (value >= 100) {
    const hundredsMap: Record<number, string> = {
      1: value === 100 ? "CIEN" : "CIENTO",
      2: "DOSCIENTOS",
      3: "TRESCIENTOS",
      4: "CUATROCIENTOS",
      5: "QUINIENTOS",
      6: "SEISCIENTOS",
      7: "SETECIENTOS",
      8: "OCHOCIENTOS",
      9: "NOVECIENTOS",
    };
    const hundreds = Math.floor(value / 100);
    const remainder = value % 100;
    return remainder === 0 ? hundredsMap[hundreds] : `${hundredsMap[hundreds]} ${toSpanishWords(remainder)}`;
  }
  if (value >= 30) {
    const tensMap: Record<number, string> = {
      3: "TREINTA",
      4: "CUARENTA",
      5: "CINCUENTA",
      6: "SESENTA",
      7: "SETENTA",
      8: "OCHENTA",
      9: "NOVENTA",
    };
    const tens = Math.floor(value / 10);
    const remainder = value % 10;
    return remainder === 0 ? tensMap[tens] : `${tensMap[tens]} Y ${toSpanishWords(remainder)}`;
  }
  const directMap: Record<number, string> = {
    1: "UNO", 2: "DOS", 3: "TRES", 4: "CUATRO", 5: "CINCO", 6: "SEIS", 7: "SIETE", 8: "OCHO", 9: "NUEVE",
    10: "DIEZ", 11: "ONCE", 12: "DOCE", 13: "TRECE", 14: "CATORCE", 15: "QUINCE", 16: "DIECISEIS", 17: "DIECISIETE",
    18: "DIECIOCHO", 19: "DIECINUEVE", 20: "VEINTE", 21: "VEINTIUNO", 22: "VEINTIDOS", 23: "VEINTITRES",
    24: "VEINTICUATRO", 25: "VEINTICINCO", 26: "VEINTISEIS", 27: "VEINTISIETE", 28: "VEINTIOCHO", 29: "VEINTINUEVE",
  };
  return directMap[value];
}
