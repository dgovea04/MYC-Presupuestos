import Decimal from "decimal.js";
import type {
  CalculatedGeneralExpenseStructureRecord,
  GeneralExpenseStructureRecord,
  GeneralExpenseItemRecord,
} from "@/lib/general-expenses/types";

export function calculateGeneralExpenseStructure(input: {
  totalDirectCost: number;
  groups: GeneralExpenseStructureRecord["groups"];
  currencyDecimals?: number;
}): CalculatedGeneralExpenseStructureRecord {
  const decimals = normalizeCurrencyDecimals(input.currencyDecimals);
  const groups = input.groups.map((group) => {
    const titles = group.titles.map((title) => {
      const items = title.items.map((item) => {
        const participationPercentage = normalizeParticipationPercentage(item);
        const normalizedItem =
          item.category === "DIRECT_COST_BASED"
            ? {
                ...item,
                participationPercentage,
                unitPrice: roundDecimal(input.totalDirectCost, decimals),
              }
            : {
                ...item,
                participationPercentage,
                unitPrice: roundDecimal(item.unitPrice, decimals),
              };

        return {
          ...normalizedItem,
          partial: calculateGeneralExpenseItemPartial(normalizedItem, input.totalDirectCost, decimals),
        };
      });

      return {
        ...title,
        items,
        subtotal: roundDecimal(items.reduce((sum, item) => sum + item.partial, 0), decimals),
      };
    });

    return {
      ...group,
      titles,
      subtotal: roundDecimal(titles.reduce((sum, title) => sum + title.subtotal, 0), decimals),
    };
  });

  return {
    groups,
    total: roundDecimal(groups.reduce((sum, group) => sum + group.subtotal, 0), decimals),
    totalDirectCost: roundDecimal(input.totalDirectCost, decimals),
  };
}

export function calculateGeneralExpenseItemPartial(
  item: GeneralExpenseItemRecord,
  totalDirectCost: number,
  currencyDecimals = 2,
) {
  const decimals = normalizeCurrencyDecimals(currencyDecimals);
  const quantityDescriptionFactor = parseQuantityDescriptionFactor(item.quantityDescription);

  if (item.category === "DIRECT_COST_BASED") {
    return roundDecimal(
      quantityDescriptionFactor
        .times(item.quantity)
        .times(item.participationPercentage)
        .dividedBy(100)
        .times(totalDirectCost),
      decimals,
    );
  }

  if (item.category === "PERSONAL") {
    return roundDecimal(
      quantityDescriptionFactor
        .times(item.quantity)
        .times(item.participationPercentage)
        .dividedBy(100)
        .times(item.unitPrice),
      decimals,
    );
  }

  return roundDecimal(quantityDescriptionFactor.times(item.quantity).times(item.unitPrice), decimals);
}

function normalizeParticipationPercentage(item: GeneralExpenseItemRecord) {
  if (item.category !== "PERSONAL") {
    return item.participationPercentage;
  }

  if (item.participationPercentage > 0 && item.participationPercentage <= 1) {
    return new Decimal(item.participationPercentage).times(100).toNumber();
  }

  return item.participationPercentage;
}

function parseQuantityDescriptionFactor(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "-") {
    return new Decimal(1);
  }

  const numericTokens = trimmed.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  if (numericTokens.length === 0) {
    return new Decimal(1);
  }

  if (numericTokens.length === 1) {
    return parseDecimalToken(numericTokens[0]);
  }

  if (!/[xX*]/.test(trimmed)) {
    return new Decimal(1);
  }

  return numericTokens.reduce((product, token) => product.times(parseDecimalToken(token)), new Decimal(1));
}

function parseDecimalToken(value: string) {
  return new Decimal(value.replace(",", "."));
}

function normalizeCurrencyDecimals(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return 2;
  }

  return Math.min(4, Math.max(0, Math.trunc(value)));
}

function roundDecimal(value: Decimal.Value, decimals: number) {
  return new Decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}
