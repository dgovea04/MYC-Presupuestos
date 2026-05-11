import type {
  CalculatedGeneralExpenseStructureRecord,
  GeneralExpenseStructureRecord,
  GeneralExpenseItemRecord,
} from "@/lib/general-expenses/types";

export function calculateGeneralExpenseStructure(input: {
  totalDirectCost: number;
  groups: GeneralExpenseStructureRecord["groups"];
}): CalculatedGeneralExpenseStructureRecord {
  const groups = input.groups.map((group) => {
    const titles = group.titles.map((title) => {
      const items = title.items.map((item) => {
        const normalizedItem =
          item.category === "DIRECT_COST_BASED"
            ? {
                ...item,
                unitPrice: round(input.totalDirectCost),
              }
            : item;

        return {
          ...normalizedItem,
          partial: calculateGeneralExpenseItemPartial(normalizedItem, input.totalDirectCost),
        };
      });

      return {
        ...title,
        items,
        subtotal: round(items.reduce((sum, item) => sum + item.partial, 0)),
      };
    });

    return {
      ...group,
      titles,
      subtotal: round(titles.reduce((sum, title) => sum + title.subtotal, 0)),
    };
  });

  return {
    groups,
    total: round(groups.reduce((sum, group) => sum + group.subtotal, 0)),
    totalDirectCost: round(input.totalDirectCost),
  };
}

export function calculateGeneralExpenseItemPartial(item: GeneralExpenseItemRecord, totalDirectCost: number) {
  if (item.category === "DIRECT_COST_BASED") {
    return round(item.quantity * item.participationPercentage * totalDirectCost);
  }

  return round(item.quantity * item.unitPrice);
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
