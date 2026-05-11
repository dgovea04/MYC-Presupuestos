import Decimal from "decimal.js";

import { prisma } from "@/lib/db/prisma";
import {
  decimalToString,
  serializeAdjustmentCalculation,
  serializePolynomialFormula,
} from "@/lib/db/serializers";
import {
  calculateAdjustmentAmounts,
  calculateBudgetCostGroups,
  calculateCoefficientK,
  calculateMonomialCoefficients,
  validatePolynomialFormula,
} from "@/lib/calculations/polynomial-formula";
import type { PolynomialFormulaSectionData } from "@/types/budget-sections";
import type {
  AdjustmentCalculationRecord,
  PolynomialCostGroupKey,
  PolynomialFormulaRecord,
  PolynomialFormulaStatus,
  PolynomialMonomialInput,
  UnifiedIndexRecord,
  ValuationRecord,
} from "@/types/polynomial-formula";

const ZERO = new Decimal(0);
const PLACEHOLDER_BASE_INDEX_NAME = "Pendiente de asignar";
type GeneratedCostGroupKey =
  | "LABOR"
  | "MATERIALS"
  | "EQUIPMENT"
  | "OTHERS"
  | "GENERAL_EXPENSES_PROFIT";

const GROUP_ORDER: GeneratedCostGroupKey[] = [
  "LABOR",
  "MATERIALS",
  "EQUIPMENT",
  "OTHERS",
  "GENERAL_EXPENSES_PROFIT",
];

const MONOMIAL_METADATA: Record<
  PolynomialCostGroupKey,
  { code: string; name: string; baseIndexCode: string; baseIndexName: string }
> = {
  LABOR: {
    code: "MO",
    name: "Mano de obra",
    baseIndexCode: "MO",
    baseIndexName: PLACEHOLDER_BASE_INDEX_NAME,
  },
  MATERIALS: {
    code: "MAT",
    name: "Materiales",
    baseIndexCode: "MAT",
    baseIndexName: PLACEHOLDER_BASE_INDEX_NAME,
  },
  EQUIPMENT: {
    code: "EQ",
    name: "Equipos",
    baseIndexCode: "EQ",
    baseIndexName: PLACEHOLDER_BASE_INDEX_NAME,
  },
  OTHERS: {
    code: "V",
    name: "Varios",
    baseIndexCode: "V",
    baseIndexName: PLACEHOLDER_BASE_INDEX_NAME,
  },
  GENERAL_EXPENSES_PROFIT: {
    code: "GU",
    name: "Gastos generales y utilidad",
    baseIndexCode: "GU",
    baseIndexName: PLACEHOLDER_BASE_INDEX_NAME,
  },
  STEEL: {
    code: "AC",
    name: "Acero",
    baseIndexCode: "AC",
    baseIndexName: PLACEHOLDER_BASE_INDEX_NAME,
  },
  CEMENT: {
    code: "CE",
    name: "Cemento",
    baseIndexCode: "CE",
    baseIndexName: PLACEHOLDER_BASE_INDEX_NAME,
  },
  MASONRY: {
    code: "ALB",
    name: "Albanileria",
    baseIndexCode: "ALB",
    baseIndexName: PLACEHOLDER_BASE_INDEX_NAME,
  },
  INSTALLATIONS: {
    code: "INST",
    name: "Instalaciones",
    baseIndexCode: "INST",
    baseIndexName: PLACEHOLDER_BASE_INDEX_NAME,
  },
};

type FormulaBudgetResourceInput = {
  id: string;
  resourceType?: string | null;
  subtotal: number | Decimal;
  resource?: {
    category?: "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS" | null;
    iu?: string | null;
  };
};

type FormulaBudgetItemInput = {
  id: string;
  quantity: number | Decimal;
  apu?: {
    resources: FormulaBudgetResourceInput[];
  } | null;
};

type ComposeBudgetPolynomialFormulaBudgetInput = {
  id: string;
  projectId: string;
  totalGeneralExpenses: number | Decimal;
  totalUtility: number | Decimal;
  items: FormulaBudgetItemInput[];
};

type MonomialComponentDraft = {
  budgetItemId?: string;
  apuResourceId?: string;
  resourceType?: string;
  amount: string;
};

type PersistedMonomialComponentDraft = {
  budgetItemId: string | null;
  apuResourceId: string | null;
  resourceType: string | null;
  amount: string;
};

type ComposedBudgetPolynomialFormulaInput = {
  directCostBreakdown: {
    labor: string;
    materials: string;
    equipment: string;
    others: string;
  };
  totalBaseAmount: string;
  monomials: PolynomialMonomialInput[];
  componentsByGroup: Map<GeneratedCostGroupKey, MonomialComponentDraft[]>;
};

type SavePolynomialFormulaInput = {
  name: string;
  baseMonth: number;
  baseYear: number;
  status?: PolynomialFormulaStatus;
  monomials: PolynomialMonomialInput[];
};

type PolynomialAdjustmentInput = {
  month: number;
  year: number;
  originalAmount?: string;
  valuationId?: string;
};

type FormulaAccessRecord = Awaited<ReturnType<typeof getAccessibleBudgetFormula>>;

function toDecimal(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) {
    return value;
  }

  return new Decimal(value);
}

function formatFixed(value: Decimal.Value, decimalPlaces: number): string {
  return new Decimal(value).toDecimalPlaces(decimalPlaces).toFixed(decimalPlaces);
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function hasAssignedBaseIndex(monomial: PolynomialMonomialInput): boolean {
  return (
    monomial.baseIndexCode.trim().length > 0 &&
    monomial.baseIndexName.trim().length > 0 &&
    monomial.baseIndexName !== PLACEHOLDER_BASE_INDEX_NAME
  );
}

function deriveCostGroupKey(
  resourceType: string | null | undefined,
  category: "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS" | null | undefined,
): GeneratedCostGroupKey {
  const typeToken = normalizeToken(resourceType);
  const categoryToken = normalizeToken(category);
  const matchesLabor =
    typeToken === "LABOR" ||
    typeToken === "MO" ||
    typeToken === "MANO DE OBRA" ||
    categoryToken === "LABOR";
  const matchesMaterials =
    typeToken === "MATERIAL" ||
    typeToken === "MATERIALS" ||
    typeToken === "MAT" ||
    typeToken === "MATERIALES" ||
    categoryToken === "MATERIAL";
  const matchesEquipment =
    typeToken === "EQUIPMENT" ||
    typeToken === "EQUIPO" ||
    typeToken === "EQ" ||
    typeToken === "TOOLS" ||
    typeToken === "TOOL" ||
    typeToken === "HERRAMIENTAS" ||
    categoryToken === "EQUIPMENT" ||
    categoryToken === "TOOLS";

  if (matchesLabor) {
    return "LABOR";
  }

  if (matchesMaterials) {
    return "MATERIALS";
  }

  if (matchesEquipment) {
    return "EQUIPMENT";
  }

  return "OTHERS";
}

function createMonomialId(budgetId: string, groupKey: PolynomialCostGroupKey): string {
  return `${budgetId}-${groupKey.toLowerCase()}`;
}

function buildMonomialPreview(formula: PolynomialFormulaRecord | null) {
  if (!formula) {
    return [
      {
        symbol: "K",
        label: "Formula polinomica",
        detail: "Genera la formula desde los APU del presupuesto y consolida GU sin incluir IGV.",
      },
    ];
  }

  return formula.monomials.map((monomial) => ({
    symbol: monomial.code,
    label: monomial.name,
    detail: `${monomial.coefficient} sobre base ${monomial.amount}`,
  }));
}

function buildSectionSummary(formula: PolynomialFormulaRecord | null) {
  return {
    hasFormula: formula !== null,
    monomialCount: formula?.monomials.length ?? 0,
    totalBaseAmount: formula?.totalBaseAmount ?? "0",
    status: formula?.status ?? "NOT_CREATED",
  } as const;
}

function formatBaseAmount(value: Decimal.Value): string {
  return formatFixed(value, 4);
}

export function composeBudgetPolynomialFormulaInput(
  budget: ComposeBudgetPolynomialFormulaBudgetInput,
): ComposedBudgetPolynomialFormulaInput {
  const totals = {
    LABOR: ZERO,
    MATERIALS: ZERO,
    EQUIPMENT: ZERO,
    OTHERS: ZERO,
  };
  const componentsByGroup = new Map<GeneratedCostGroupKey, MonomialComponentDraft[]>();

  for (const groupKey of GROUP_ORDER) {
    componentsByGroup.set(groupKey, []);
  }

  for (const item of budget.items) {
    if (!item.apu) {
      continue;
    }

    const itemQuantity = toDecimal(item.quantity);

    for (const resource of item.apu.resources) {
      const amount = itemQuantity.times(resource.subtotal);
      const groupKey = deriveCostGroupKey(resource.resourceType, resource.resource?.category);

      if (groupKey === "GENERAL_EXPENSES_PROFIT") {
        continue;
      }

      totals[groupKey] = totals[groupKey].plus(amount);
      componentsByGroup.get(groupKey)?.push({
        apuResourceId: resource.id,
        resourceType: resource.resourceType ?? resource.resource?.category ?? undefined,
        amount: formatFixed(amount, 4),
      });
    }
  }

  const directCostBreakdown = {
    labor: formatFixed(totals.LABOR, 4),
    materials: formatFixed(totals.MATERIALS, 4),
    equipment: formatFixed(totals.EQUIPMENT, 4),
    others: formatFixed(totals.OTHERS, 4),
  };
  const groupedAmounts = calculateBudgetCostGroups({
    directCostBreakdown,
    generalExpenses: formatFixed(budget.totalGeneralExpenses, 4),
    utility: formatFixed(budget.totalUtility, 4),
  });

  const coefficients = calculateMonomialCoefficients(groupedAmounts.groups);
  const monomials = coefficients.map((group, index) => {
    const metadata = MONOMIAL_METADATA[group.key];

    return {
      id: createMonomialId(budget.id, group.key),
      code: metadata.code,
      name: metadata.name,
      costGroupKey: group.key,
      amount: group.amount,
      coefficient: group.coefficient,
      baseIndexCode: metadata.baseIndexCode,
      baseIndexName: metadata.baseIndexName,
      baseIndexValue: "100",
      sortOrder: index,
    };
  });

  return {
    directCostBreakdown,
    totalBaseAmount: groupedAmounts.totalBaseAmount,
    monomials,
    componentsByGroup,
  };
}

export function sanitizePolynomialMonomialComponents(
  components: ReadonlyArray<MonomialComponentDraft>,
): PersistedMonomialComponentDraft[] {
  return components.flatMap((component) => {
    const apuResourceId = component.apuResourceId ?? null;
    const budgetItemId = apuResourceId ? null : component.budgetItemId ?? null;

    if (!apuResourceId && !budgetItemId) {
      return [];
    }

    return [
      {
        budgetItemId,
        apuResourceId,
        resourceType: component.resourceType ?? null,
        amount: component.amount,
      },
    ];
  });
}

export async function getBudgetPolynomialFormulaSectionData(
  budgetId: string,
  userId: string,
): Promise<PolynomialFormulaSectionData> {
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      kind: "GENERAL",
      project: {
        company: {
          userId,
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!budget) {
    throw new Error("No tienes permisos para acceder a este presupuesto general");
  }

  const latestFormula = await prisma.polynomialFormula.findFirst({
    where: {
      budgetId: budget.id,
      budget: {
        project: {
          company: {
            userId,
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      monomials: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  const formula = latestFormula ? serializePolynomialFormula(latestFormula) : null;

  return {
    title: "Formula polinomica",
    coefficients: buildMonomialPreview(formula),
    notes:
      formula === null
        ? [
            "Todavia no existe una formula guardada para este presupuesto.",
            "La generacion usa partidas con APU, clasifica MO, materiales, equipos, varios y suma GU.",
          ]
        : [
            "Los coeficientes se generan con aritmetica decimal segura.",
            "El IGV no participa en la base de la formula polinomica.",
          ],
    budgetId: budget.id,
    formula,
    summary: buildSectionSummary(formula),
  };
}

export async function generatePolynomialFormulaFromBudget(
  budgetId: string,
  userId: string,
  input: {
    name?: string;
    baseMonth: number;
    baseYear: number;
  },
): Promise<PolynomialFormulaRecord> {
  const budget = await loadBudgetForFormulaGeneration(budgetId, userId);
  const composed = composeBudgetPolynomialFormulaInput({
    id: budget.id,
    projectId: budget.projectId,
    totalGeneralExpenses: budget.totalGeneralExpenses,
    totalUtility: budget.totalUtility,
    items: budget.items,
  });

  const savedFormula = await prisma.$transaction(async (tx) => {
    const existing = await tx.polynomialFormula.findFirst({
      where: {
        budgetId: budget.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
      },
    });

    const persisted = existing
      ? await tx.polynomialFormula.update({
          where: {
            id: existing.id,
          },
          data: {
            name: input.name?.trim() || `Formula polinomica ${budget.name}`,
            baseMonth: input.baseMonth,
            baseYear: input.baseYear,
            totalBaseAmount: formatBaseAmount(composed.totalBaseAmount),
            status: "DRAFT",
            monomials: {
              deleteMany: {},
              create: composed.monomials.map((monomial) => ({
                code: monomial.code,
                name: monomial.name,
                costGroupKey: monomial.costGroupKey,
                amount: formatBaseAmount(monomial.amount),
                coefficient: monomial.coefficient,
                baseIndexCode: monomial.baseIndexCode,
                baseIndexName: monomial.baseIndexName,
                baseIndexValue: monomial.baseIndexValue,
                sortOrder: monomial.sortOrder,
                components: {
                  create: sanitizePolynomialMonomialComponents(
                    composed.componentsByGroup.get(monomial.costGroupKey as GeneratedCostGroupKey) ?? [],
                  ).map((component) => ({
                    budgetItemId: component.budgetItemId,
                    apuResourceId: component.apuResourceId,
                    resourceType: component.resourceType,
                    amount: formatBaseAmount(component.amount),
                  })),
                },
              })),
            },
          },
          include: {
            monomials: {
              orderBy: {
                sortOrder: "asc",
              },
            },
          },
        })
      : await tx.polynomialFormula.create({
          data: {
            projectId: budget.projectId,
            budgetId: budget.id,
            name: input.name?.trim() || `Formula polinomica ${budget.name}`,
            baseMonth: input.baseMonth,
            baseYear: input.baseYear,
            totalBaseAmount: formatBaseAmount(composed.totalBaseAmount),
            status: "DRAFT",
            monomials: {
              create: composed.monomials.map((monomial) => ({
                code: monomial.code,
                name: monomial.name,
                costGroupKey: monomial.costGroupKey,
                amount: formatBaseAmount(monomial.amount),
                coefficient: monomial.coefficient,
                baseIndexCode: monomial.baseIndexCode,
                baseIndexName: monomial.baseIndexName,
                baseIndexValue: monomial.baseIndexValue,
                sortOrder: monomial.sortOrder,
                components: {
                  create: sanitizePolynomialMonomialComponents(
                    composed.componentsByGroup.get(monomial.costGroupKey as GeneratedCostGroupKey) ?? [],
                  ).map((component) => ({
                    budgetItemId: component.budgetItemId,
                    apuResourceId: component.apuResourceId,
                    resourceType: component.resourceType,
                    amount: formatBaseAmount(component.amount),
                  })),
                },
              })),
            },
          },
          include: {
            monomials: {
              orderBy: {
                sortOrder: "asc",
              },
            },
          },
        });

    return persisted;
  });

  return serializePolynomialFormula(savedFormula);
}

export async function savePolynomialFormula(
  formulaId: string,
  userId: string,
  input: SavePolynomialFormulaInput,
): Promise<PolynomialFormulaRecord> {
  const accessibleFormula = await getAccessibleBudgetFormula(formulaId, userId);
  const existingFormula = await prisma.polynomialFormula.findFirst({
    where: {
      id: formulaId,
      budget: {
        project: {
          company: {
            userId,
          },
        },
      },
    },
    include: {
      monomials: {
        include: {
          components: true,
        },
      },
    },
  });

  if (!existingFormula) {
    throw new Error("No tienes permisos para acceder a esta formula polinomica");
  }

  const validation = validatePolynomialFormula(
    input.monomials.map((monomial) => ({
      coefficient: monomial.coefficient,
      baseIndexValue: monomial.baseIndexValue,
      adjustmentIndexValue: "1",
      name: monomial.name,
    })),
  );

  const componentsByMonomialId = new Map(
    existingFormula.monomials.map((monomial) => [monomial.id, monomial.components]),
  );
  const componentsByCostGroup = new Map(
    existingFormula.monomials.map((monomial) => [monomial.costGroupKey, monomial.components]),
  );
  const canMarkAsValid =
    validation.isValid && input.monomials.every(hasAssignedBaseIndex);
  const requestedStatus =
    input.status ?? (canMarkAsValid ? "VALID" : "DRAFT");
  const status: PolynomialFormulaStatus =
    requestedStatus === "VALID" && !canMarkAsValid ? "DRAFT" : requestedStatus;
  const totalBaseAmount = input.monomials.reduce(
    (total, monomial) => total.plus(monomial.amount),
    ZERO,
  );

  const formula = await prisma.polynomialFormula.update({
    where: {
      id: accessibleFormula.id,
    },
    data: {
      name: input.name.trim(),
      baseMonth: input.baseMonth,
      baseYear: input.baseYear,
      totalBaseAmount: formatBaseAmount(totalBaseAmount),
      status,
      monomials: {
        deleteMany: {},
        create: input.monomials.map((monomial) => {
          const preservedComponents =
            componentsByMonomialId.get(monomial.id) ??
            componentsByCostGroup.get(monomial.costGroupKey) ??
            [];

          return {
            code: monomial.code,
            name: monomial.name,
            costGroupKey: monomial.costGroupKey,
            amount: formatBaseAmount(monomial.amount),
            coefficient: monomial.coefficient,
            baseIndexCode: monomial.baseIndexCode,
            baseIndexName: monomial.baseIndexName,
            baseIndexValue: monomial.baseIndexValue,
            adjustmentIndexCode: monomial.adjustmentIndexCode ?? null,
            adjustmentIndexName: monomial.adjustmentIndexName ?? null,
            adjustmentIndexValue: monomial.adjustmentIndexValue ?? null,
            sortOrder: monomial.sortOrder,
            components: {
              create: sanitizePolynomialMonomialComponents(
                preservedComponents.map((component) => ({
                  budgetItemId: component.budgetItemId ?? undefined,
                  apuResourceId: component.apuResourceId ?? undefined,
                  resourceType: component.resourceType ?? undefined,
                  amount: component.amount.toFixed(4),
                })),
              ).map((component) => ({
                budgetItemId: component.budgetItemId,
                apuResourceId: component.apuResourceId,
                resourceType: component.resourceType,
                amount: component.amount,
              })),
            },
          };
        }),
      },
    },
    include: {
      monomials: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  return serializePolynomialFormula(formula);
}

export async function calculatePolynomialFormulaAdjustment(
  formulaId: string,
  userId: string,
  input: PolynomialAdjustmentInput,
): Promise<AdjustmentCalculationRecord> {
  const formula = await getAccessibleBudgetFormula(formulaId, userId);

  if (formula.monomials.some((monomial) => !hasAssignedBaseIndex(monomial))) {
    throw new Error(
      "La formula tiene monomios con indice base pendiente de asignar. Completa la asignacion INEI antes de calcular el reajuste.",
    );
  }

  const valuation = await upsertFormulaValuation(formula, input);
  const unifiedIndices = await loadUnifiedIndicesForFormula(formula, input.month, input.year);
  const unifiedIndexByCode = new Map(unifiedIndices.map((index) => [index.code, index]));

  const kCalculation = calculateCoefficientK(
    formula.monomials.map((monomial) => {
      const index = unifiedIndexByCode.get(monomial.baseIndexCode);

      if (!index) {
        throw new Error(`No se encontro un indice unificado para el codigo ${monomial.baseIndexCode}`);
      }

      return {
        coefficient: monomial.coefficient,
        baseIndexValue: monomial.baseIndexValue,
        adjustmentIndexValue: index.value,
        name: monomial.name,
      };
    }),
  );

  const amountCalculation = calculateAdjustmentAmounts({
    originalAmount: valuation.amount,
    kRounded: kCalculation.kRounded,
  });

  const adjustment = await prisma.adjustmentCalculation.upsert({
    where: {
      formulaId_year_month: {
        formulaId: formula.id,
        year: input.year,
        month: input.month,
      },
    },
    update: {
      valuationId: valuation.id,
      originalAmount: amountCalculation.originalAmount,
      adjustedAmount: amountCalculation.adjustedAmount,
      adjustmentAmount: amountCalculation.adjustmentAmount,
      kRaw: kCalculation.kRaw,
      kRounded: kCalculation.kRounded,
      terms: {
        deleteMany: {},
        create: kCalculation.terms.map((term, index) => ({
          monomialId: formula.monomials[index]?.id,
          name: term.name,
          coefficient: term.coefficient,
          baseIndexValue: term.baseIndexValue,
          adjustmentIndexValue: term.adjustmentIndexValue,
          ratio: term.ratio,
          partial: term.partial,
          sortOrder: index,
        })),
      },
    },
    create: {
      formulaId: formula.id,
      valuationId: valuation.id,
      month: input.month,
      year: input.year,
      originalAmount: amountCalculation.originalAmount,
      adjustedAmount: amountCalculation.adjustedAmount,
      adjustmentAmount: amountCalculation.adjustmentAmount,
      kRaw: kCalculation.kRaw,
      kRounded: kCalculation.kRounded,
      terms: {
        create: kCalculation.terms.map((term, index) => ({
          monomialId: formula.monomials[index]?.id,
          name: term.name,
          coefficient: term.coefficient,
          baseIndexValue: term.baseIndexValue,
          adjustmentIndexValue: term.adjustmentIndexValue,
          ratio: term.ratio,
          partial: term.partial,
          sortOrder: index,
        })),
      },
    },
    include: {
      terms: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  return serializeAdjustmentCalculation(adjustment);
}

export async function calculatePolynomialFormulaKPreview(
  formulaId: string,
  userId: string,
  input: {
    month: number;
    year: number;
  },
) {
  const formula = await getAccessibleBudgetFormula(formulaId, userId);

  if (formula.monomials.some((monomial) => !hasAssignedBaseIndex(monomial))) {
    throw new Error(
      "La formula tiene monomios con indice base pendiente de asignar. Completa la asignacion INEI antes de calcular K.",
    );
  }

  const unifiedIndices = await loadUnifiedIndicesForFormula(formula, input.month, input.year);
  const unifiedIndexByCode = new Map(unifiedIndices.map((index) => [index.code, index]));

  return calculateCoefficientK(
    formula.monomials.map((monomial) => {
      const index = unifiedIndexByCode.get(monomial.baseIndexCode);

      if (!index) {
        throw new Error(`No se encontro un indice unificado para el codigo ${monomial.baseIndexCode}`);
      }

      return {
        coefficient: monomial.coefficient,
        baseIndexValue: monomial.baseIndexValue,
        adjustmentIndexValue: index.value,
        name: monomial.name,
      };
    }),
  );
}

export async function listPolynomialFormulaAdjustments(
  formulaId: string,
  userId: string,
): Promise<AdjustmentCalculationRecord[]> {
  const formula = await getAccessibleBudgetFormula(formulaId, userId);
  const adjustments = await prisma.adjustmentCalculation.findMany({
    where: {
      formulaId: formula.id,
    },
    orderBy: [
      {
        year: "desc",
      },
      {
        month: "desc",
      },
    ],
    include: {
      terms: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  return adjustments.map(serializeAdjustmentCalculation);
}

async function loadBudgetForFormulaGeneration(budgetId: string, userId: string) {
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      kind: "GENERAL",
      project: {
        company: {
          userId,
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      name: true,
      totalGeneralExpenses: true,
      totalUtility: true,
      items: {
        select: {
          id: true,
          quantity: true,
          apu: {
            select: {
              resources: {
                select: {
                  id: true,
                  resourceType: true,
                  subtotal: true,
                  resource: {
                    select: {
                      category: true,
                      iu: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      childBudgets: {
        select: {
          items: {
            select: {
              id: true,
              quantity: true,
              apu: {
                select: {
                  resources: {
                    select: {
                      id: true,
                      resourceType: true,
                      subtotal: true,
                      resource: {
                        select: {
                          category: true,
                          iu: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!budget) {
    throw new Error("No tienes permisos para acceder a este presupuesto general");
  }

  const childItems = budget.childBudgets.flatMap((childBudget) => childBudget.items);
  const items = [...budget.items, ...childItems];

  return {
    id: budget.id,
    projectId: budget.projectId,
    name: budget.name,
    totalGeneralExpenses: budget.totalGeneralExpenses,
    totalUtility: budget.totalUtility,
    items,
  };
}

async function getAccessibleBudgetFormula(formulaId: string, userId: string) {
  const formula = await prisma.polynomialFormula.findFirst({
    where: {
      id: formulaId,
      budget: {
        project: {
          company: {
            userId,
          },
        },
      },
    },
    include: {
      monomials: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      budget: {
        select: {
          id: true,
          projectId: true,
        },
      },
    },
  });

  if (!formula) {
    throw new Error("No tienes permisos para acceder a esta formula polinomica");
  }

  return serializePolynomialFormula(formula);
}

async function upsertFormulaValuation(
  formula: FormulaAccessRecord,
  input: PolynomialAdjustmentInput,
): Promise<ValuationRecord> {
  if (input.valuationId) {
    const valuation = await prisma.valuation.findFirst({
      where: {
        id: input.valuationId,
        budgetId: formula.budgetId,
      },
    });

    if (!valuation) {
      throw new Error("La valorizacion solicitada no pertenece a esta formula");
    }

    if (valuation.month !== input.month || valuation.year !== input.year) {
      throw new Error(
        "La valorizacion seleccionada no corresponde al mismo mes y anio del reajuste solicitado",
      );
    }

    if (valuation.formulaId !== formula.id) {
      const linked = await prisma.valuation.update({
        where: {
          id: valuation.id,
        },
        data: {
          formulaId: formula.id,
        },
      });

      return {
        id: linked.id,
        formulaId: linked.formulaId ?? undefined,
        month: linked.month,
        year: linked.year,
        amount: decimalToString(linked.amount),
        createdAt: linked.createdAt.toISOString(),
        updatedAt: linked.updatedAt.toISOString(),
      };
    }

    return {
      id: valuation.id,
      formulaId: valuation.formulaId ?? undefined,
      month: valuation.month,
      year: valuation.year,
      amount: decimalToString(valuation.amount),
      createdAt: valuation.createdAt.toISOString(),
      updatedAt: valuation.updatedAt.toISOString(),
    };
  }

  if (!input.originalAmount) {
    throw new Error("Se requiere un monto original o una valorizacion existente");
  }

  const valuation = await prisma.valuation.upsert({
    where: {
      budgetId_year_month: {
        budgetId: formula.budgetId,
        year: input.year,
        month: input.month,
      },
    },
    update: {
      formulaId: formula.id,
      amount: input.originalAmount,
    },
    create: {
      budgetId: formula.budgetId,
      formulaId: formula.id,
      month: input.month,
      year: input.year,
      amount: input.originalAmount,
    },
  });

  return {
    id: valuation.id,
    formulaId: valuation.formulaId ?? undefined,
    month: valuation.month,
    year: valuation.year,
    amount: decimalToString(valuation.amount),
    createdAt: valuation.createdAt.toISOString(),
    updatedAt: valuation.updatedAt.toISOString(),
  };
}

async function loadUnifiedIndicesForFormula(
  formula: FormulaAccessRecord,
  month: number,
  year: number,
): Promise<UnifiedIndexRecord[]> {
  const codes = [...new Set(formula.monomials.map((monomial) => monomial.baseIndexCode))];
  const indices = await prisma.unifiedIndex.findMany({
    where: {
      code: {
        in: codes,
      },
      month,
      year,
    },
    orderBy: [
      {
        code: "asc",
      },
      {
        geographicArea: "asc",
      },
    ],
  });

  const indicesByCode = new Map<string, UnifiedIndexRecord[]>();

  for (const index of indices) {
    const record = {
      id: index.id,
      code: index.code,
      name: index.name,
      geographicArea: index.geographicArea,
      month: index.month,
      year: index.year,
      value: decimalToString(index.value),
      source: index.source ?? undefined,
      createdAt: index.createdAt.toISOString(),
      updatedAt: index.updatedAt.toISOString(),
    } satisfies UnifiedIndexRecord;
    const existing = indicesByCode.get(index.code) ?? [];

    existing.push(record);
    indicesByCode.set(index.code, existing);
  }

  return [...indicesByCode.entries()].map(([code, matches]) => {
    if (matches.length > 1) {
      const areas = matches
        .map((match) => match.geographicArea ?? "SIN_AREA")
        .join(", ");

      throw new Error(
        `El indice ${code} tiene multiples ambitos geograficos para ${month}/${year}: ${areas}. Selecciona un ambito antes de calcular el reajuste.`,
      );
    }

    return matches[0]!;
  });
}
