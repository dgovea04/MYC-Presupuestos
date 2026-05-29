import Decimal from "decimal.js";

import type {
  MetradoFormulaInputKey,
  MetradoFormulaInputs,
  MetradoFormulaKey,
  MetradoFormulaRecord,
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

type ExpressionToken =
  | { type: "number"; value: string }
  | { type: "variable"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "leftParen" }
  | { type: "rightParen" };

const operatorPrecedence = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
} as const;

function tokenizeExpression(expression: string): ExpressionToken[] {
  const tokens: ExpressionToken[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (!char) {
      break;
    }

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let value = char;
      index += 1;
      while (index < expression.length && /[0-9.]/.test(expression[index] ?? "")) {
        value += expression[index];
        index += 1;
      }
      tokens.push({ type: "number", value });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let value = char;
      index += 1;
      while (index < expression.length && /[A-Za-z0-9_]/.test(expression[index] ?? "")) {
        value += expression[index];
        index += 1;
      }
      tokens.push({ type: "variable", value });
      continue;
    }

    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "leftParen" });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "rightParen" });
      index += 1;
      continue;
    }

    throw new Error(`Caracter no permitido en la formula: ${char}`);
  }

  return tokens;
}

function toReversePolishNotation(tokens: ExpressionToken[]): ExpressionToken[] {
  const output: ExpressionToken[] = [];
  const operators: ExpressionToken[] = [];

  for (const token of tokens) {
    if (token.type === "number" || token.type === "variable") {
      output.push(token);
      continue;
    }

    if (token.type === "operator") {
      while (operators.length > 0) {
        const top = operators.at(-1);
        if (
          top?.type !== "operator" ||
          operatorPrecedence[top.value] < operatorPrecedence[token.value]
        ) {
          break;
        }
        const popped = operators.pop();
        if (popped) {
          output.push(popped);
        }
      }
      operators.push(token);
      continue;
    }

    if (token.type === "leftParen") {
      operators.push(token);
      continue;
    }

    if (token.type === "rightParen") {
      let foundLeftParen = false;
      while (operators.length > 0) {
        const popped = operators.pop();
        if (popped?.type === "leftParen") {
          foundLeftParen = true;
          break;
        }
        if (popped) {
          output.push(popped);
        }
      }

      if (!foundLeftParen) {
        throw new Error("Los parentesis de la formula no estan balanceados.");
      }
    }
  }

  while (operators.length > 0) {
    const popped = operators.pop();
    if (popped?.type === "leftParen" || popped?.type === "rightParen") {
      throw new Error("Los parentesis de la formula no estan balanceados.");
    }
    if (popped) {
      output.push(popped);
    }
  }

  return output;
}

function evaluateCustomExpression(input: {
  formula: MetradoFormulaRecord;
  inputs: MetradoFormulaInputs;
  rowId?: string;
}): FormulaEvaluation {
  const issues: MetradoValidationIssue[] = [];
  const values = new Map<string, Decimal>();

  for (const key of input.formula.requiredInputs) {
    const value = readInput(input.inputs, key, input.rowId);
    if (value.issue) {
      issues.push(value.issue);
    }
    values.set(key, value.decimal);
  }

  if (issues.length > 0) {
    return { value: 0, issues };
  }

  try {
    const tokens = toReversePolishNotation(tokenizeExpression(input.formula.expression));
    const stack: Decimal[] = [];

    for (const token of tokens) {
      if (token.type === "number") {
        stack.push(new Decimal(token.value));
        continue;
      }

      if (token.type === "variable") {
        const value = values.get(token.value);
        if (!value) {
          throw new Error(`La variable ${token.value} no esta definida.`);
        }
        stack.push(value);
        continue;
      }

      if (token.type === "operator") {
        const right = stack.pop();
        const left = stack.pop();
        if (!left || !right) {
          throw new Error("La formula esta incompleta.");
        }

        if (token.value === "+") {
          stack.push(left.add(right));
        } else if (token.value === "-") {
          stack.push(left.sub(right));
        } else if (token.value === "*") {
          stack.push(left.mul(right));
        } else {
          if (right.isZero()) {
            throw new Error("La formula divide entre cero.");
          }
          stack.push(left.div(right));
        }
      }
    }

    if (stack.length !== 1) {
      throw new Error("La formula esta incompleta.");
    }

    return { value: roundMetradoNumber(stack[0] ?? new Decimal(0)), issues };
  } catch (error) {
    return {
      value: 0,
      issues: [
        {
          id: `${input.rowId ?? "row"}-custom-formula-invalid`,
          severity: "error",
          rowId: input.rowId,
          message: error instanceof Error ? error.message : "La formula personalizada no es valida.",
        },
      ],
    };
  }
}

export function evaluateMetradoFormula(
  formulaKey: MetradoFormulaKey,
  inputs: MetradoFormulaInputs,
  rowId?: string,
  formula?: MetradoFormulaRecord | null,
): FormulaEvaluation {
  if (formula && !["volume", "area", "linear", "rebarWeight", "formworkArea", "factorArea", "manual"].includes(formulaKey)) {
    return evaluateCustomExpression({ formula, inputs, rowId });
  }

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

export function validateCustomMetradoExpression(formula: MetradoFormulaRecord): string | null {
  const probeInputs = formula.requiredInputs.reduce<MetradoFormulaInputs>((inputs, key) => {
    inputs[key] = 1;
    return inputs;
  }, {});
  const result = evaluateCustomExpression({ formula, inputs: probeInputs });

  return result.issues[0]?.message ?? null;
}

export function roundMetradoNumber(value: Decimal): number {
  return value.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
}
