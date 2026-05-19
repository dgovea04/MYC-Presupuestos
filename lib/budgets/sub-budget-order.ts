const DEFAULT_SPECIALTY_ORDER = [
  "Estructuras",
  "Arquitectura",
  "Instalaciones Sanitarias",
  "Instalaciones Electricas",
  "Instalaciones Eléctricas",
] as const;

function normalizeSubBudgetName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("es-PE");
}

export function orderSubBudgetsBySpecialty<T extends { name: string }>(subBudgets: readonly T[]) {
  const preferredNames = DEFAULT_SPECIALTY_ORDER.map(normalizeSubBudgetName);
  const indexedBudgets = subBudgets.map((budget, index) => ({
    budget,
    index,
    normalizedName: normalizeSubBudgetName(budget.name),
  }));

  return [...indexedBudgets]
    .sort((left, right) => {
      const leftPriority = preferredNames.indexOf(left.normalizedName);
      const rightPriority = preferredNames.indexOf(right.normalizedName);
      const leftRank = leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority;
      const rightRank = rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.index - right.index;
    })
    .map(({ budget }) => budget);
}
