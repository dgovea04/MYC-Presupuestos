import Decimal from "decimal.js";

const ZERO = new Decimal(0);
const ONE = new Decimal(1);
const ONE_HUNDRED = new Decimal(100);

function parseDecimalInput(value: Decimal.Value, invalidMessage: string): Decimal {
  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (trimmedValue.length === 0) {
      throw new Error(invalidMessage);
    }

    try {
      return new Decimal(trimmedValue);
    } catch {
      throw new Error(invalidMessage);
    }
  }

  try {
    return new Decimal(value);
  } catch {
    throw new Error(invalidMessage);
  }
}

function parsePercentageDecimal(value: string): Decimal {
  return parseDecimalInput(value, "Budget rate percentage must be a valid number");
}

function parseStoredRateDecimal(rate: Decimal.Value): Decimal {
  return parseDecimalInput(rate, "Budget rate must be a valid decimal");
}

function assertPercentageRange(percentage: Decimal): void {
  if (percentage.lessThan(ZERO) || percentage.greaterThan(ONE_HUNDRED)) {
    throw new Error("Budget rate percentage must be between 0 and 100");
  }
}

function assertStoredRateRange(rate: Decimal): void {
  if (rate.lessThan(ZERO) || rate.greaterThan(ONE)) {
    throw new Error("Budget rate must be between 0 and 1");
  }
}

export function formatBudgetRatePercentageInput(rate: Decimal.Value): string {
  const storedRate = parseStoredRateDecimal(rate);

  assertStoredRateRange(storedRate);

  return storedRate.times(ONE_HUNDRED).toString();
}

export function parseBudgetRatePercentageInput(value: string): number {
  const percentage = parsePercentageDecimal(value);

  assertPercentageRange(percentage);

  return percentage.dividedBy(ONE_HUNDRED).toNumber();
}
