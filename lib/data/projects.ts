import { prisma } from "@/lib/db/prisma";
import { getUserSettings } from "@/lib/data/settings";
import { projectSchema, type ProjectInput } from "@/lib/validations/project";
import { Prisma } from "@prisma/client";
import { DEFAULT_INITIAL_SUB_BUDGET_NAMES } from "@/types/settings";
import { assertWithinPlanLimit } from "@/lib/billing/entitlements";
import { getTemplateLibraryItem } from "@/lib/templates/template-library";

const defaultBudgetTotals = {
  totalDirectCost: 0,
  totalGeneralExpenses: 0,
  totalUtility: 0,
  totalTax: 0,
  totalAmount: 0,
} as const;

type BudgetDefaultsContext = {
  currency: string;
  igvRate: Prisma.Decimal | number;
  generalExpensesRate: Prisma.Decimal | number;
  utilityRate: Prisma.Decimal | number;
};

type BudgetDefaultsSource = BudgetDefaultsContext & {
  kind: "GENERAL" | "SUB_BUDGET";
  name: string;
};

type SourceProjectGraph = Prisma.ProjectGetPayload<{
  include: {
    budgets: {
      include: {
        levels: true;
        items: {
          include: {
            apu: {
              include: {
                resources: true;
              };
            };
          };
        };
        generalExpenses: true;
        generalExpenseGroups: {
          include: {
            titles: {
              include: {
                items: true;
              };
            };
          };
        };
        footerRows: true;
      };
    };
    polynomialFormulas: {
      include: {
        monomials: {
          include: {
            components: true;
          };
        };
      };
    };
  };
}>;

function createDefaultBudgetContext(settings: Awaited<ReturnType<typeof getUserSettings>>): BudgetDefaultsContext {
  return {
    currency: settings.defaultCurrency,
    igvRate: settings.defaultIgvRate,
    generalExpensesRate: settings.defaultGeneralExpensesRate,
    utilityRate: settings.defaultUtilityRate,
  };
}

function createBudgetData(context: BudgetDefaultsContext) {
  return {
    currency: context.currency,
    igvRate: context.igvRate,
    generalExpensesRate: context.generalExpensesRate,
    utilityRate: context.utilityRate,
    ...defaultBudgetTotals,
  };
}

function resolveBudgetDefaultsContext(
  budgets: BudgetDefaultsSource[],
  fallbackContext: BudgetDefaultsContext,
): BudgetDefaultsContext {
  const compatibleBudget =
    budgets.find((budget) => budget.kind === "GENERAL" && budget.name === "Presupuesto General") ??
    budgets.find((budget) => budget.kind === "GENERAL") ??
    budgets[0];

  if (!compatibleBudget) {
    return fallbackContext;
  }

  return {
    currency: compatibleBudget.currency,
    igvRate: compatibleBudget.igvRate,
    generalExpensesRate: compatibleBudget.generalExpensesRate,
    utilityRate: compatibleBudget.utilityRate,
  };
}

function createZeroDecimalBudgetTotals() {
  return {
    totalDirectCost: new Prisma.Decimal(0),
    totalGeneralExpenses: new Prisma.Decimal(0),
    totalUtility: new Prisma.Decimal(0),
    totalTax: new Prisma.Decimal(0),
    totalAmount: new Prisma.Decimal(0),
  };
}

function getDefaultSubBudgetNames(settings: Awaited<ReturnType<typeof getUserSettings>>) {
  if (settings.defaultSubBudgetNames.length > 0) {
    return [...settings.defaultSubBudgetNames];
  }

  return [...DEFAULT_INITIAL_SUB_BUDGET_NAMES];
}

function getFallbackSubBudgetNames(defaultSubBudgetNames: readonly string[]) {
  if (defaultSubBudgetNames.length > 0) {
    return [...defaultSubBudgetNames];
  }

  return [...DEFAULT_INITIAL_SUB_BUDGET_NAMES];
}

export async function getUserCompanies(userId: string) {
  return prisma.company.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getProjectsByUser(userId: string) {
  const settings = await getUserSettings(userId);

  return prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: {
        company: {
          userId,
        },
      },
      include: {
        company: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const hydratedProjects = [];
    for (const project of projects) {
      const budgets = await ensureProjectBudgetStructure(
        tx,
        project.id,
        createDefaultBudgetContext(settings),
        settings.defaultSubBudgetNames,
      );
      hydratedProjects.push({
        ...project,
        budgets,
      });
    }

    return hydratedProjects;
  });
}

export async function getProjectsListByUser(userId: string) {
  return prisma.project.findMany({
    where: {
      company: {
        userId,
      },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      clientName: true,
      location: true,
      projectType: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          budgets: {
            where: {
              kind: "GENERAL",
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getProjectById(id: string, userId: string) {
  const settings = await getUserSettings(userId);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: {
        id,
        company: {
          userId,
        },
      },
      include: {
        company: true,
      },
    });

    if (!project) {
      return null;
    }

    const budgets = await ensureProjectBudgetStructure(
      tx,
      project.id,
      createDefaultBudgetContext(settings),
      settings.defaultSubBudgetNames,
    );

    return {
      ...project,
      budgets,
    };
  });
}

export async function getProjectOverviewById(id: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id,
      company: {
        userId,
      },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      clientName: true,
      location: true,
      projectType: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          name: true,
        },
      },
      budgets: {
        select: {
          id: true,
          projectId: true,
          parentBudgetId: true,
          kind: true,
          name: true,
          currency: true,
          totalAmount: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function getProjectHeaderById(id: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id,
      company: {
        userId,
      },
    },
    select: {
      id: true,
      name: true,
      clientName: true,
      location: true,
      projectType: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function createProject(userId: string, input: ProjectInput) {
  const data = projectSchema.parse(input);
  await assertWithinPlanLimit({ userId, resource: "projects" });

  const company = await prisma.company.findFirst({
    where: {
      id: data.companyId,
      userId,
    },
    select: { id: true },
  });

  if (!company) {
    throw new Error("No puedes crear proyectos en una empresa que no te pertenece");
  }

  const settings = await getUserSettings(userId);
  const template = data.templateId ? getTemplateLibraryItem(data.templateId) : null;
  if (data.templateId && template?.module !== "BUDGET") {
    throw new Error("La plantilla seleccionada no esta disponible para crear proyectos");
  }

  const defaultBudgetData = createBudgetData(createDefaultBudgetContext(settings));
  const defaultBudgetNames = getDefaultSubBudgetNames(settings);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        clientName: data.clientName,
        location: data.location,
        projectType: data.projectType || (template?.id === "budget-edificacion-base" ? "Edificacion" : undefined),
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });

    const generalBudget = await tx.budget.create({
      data: {
        projectId: project.id,
        kind: "GENERAL",
        name: "Presupuesto General",
        ...defaultBudgetData,
      },
    });

    await tx.budget.createMany({
      data: defaultBudgetNames.map((name) => ({
        projectId: project.id,
        parentBudgetId: generalBudget.id,
        kind: "SUB_BUDGET",
        name,
        ...defaultBudgetData,
      })),
    });

    return project;
  });
}

export async function updateProject(id: string, userId: string, input: Partial<ProjectInput>) {
  const current = await prisma.project.findFirstOrThrow({
    where: {
      id,
      company: {
        userId,
      },
    },
  });
  const merged = {
    companyId: input.companyId ?? current.companyId,
    name: input.name ?? current.name,
    clientName: input.clientName ?? current.clientName ?? "",
    location: input.location ?? current.location ?? "",
    projectType: input.projectType ?? current.projectType ?? "",
    startDate: input.startDate ?? current.startDate?.toISOString().slice(0, 10) ?? "",
    endDate: input.endDate ?? current.endDate?.toISOString().slice(0, 10) ?? "",
    status: input.status ?? current.status,
  };
  const data = projectSchema.parse(merged);

  return prisma.project.update({
    where: { id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  });
}

export async function deleteProject(id: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id,
      company: {
        userId,
      },
    },
    select: { id: true },
  });

  if (!project) {
    throw new Error("No tienes permisos para eliminar este proyecto");
  }

  await prisma.project.delete({
    where: { id },
  });
}

export async function duplicateProject(sourceProjectId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const sourceProject = await tx.project.findFirst({
      where: {
        id: sourceProjectId,
        company: {
          userId,
        },
      },
      include: {
        budgets: {
          include: {
            levels: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
            items: {
              include: {
                apu: {
                  include: {
                    resources: {
                      orderBy: {
                        createdAt: "asc",
                      },
                    },
                  },
                },
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
            generalExpenses: {
              orderBy: [{ createdAt: "asc" }],
            },
            generalExpenseGroups: {
              include: {
                titles: {
                  include: {
                    items: {
                      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                    },
                  },
                  orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                },
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
            footerRows: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
          orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
        },
        polynomialFormulas: {
          include: {
            monomials: {
              include: {
                components: {
                  orderBy: {
                    createdAt: "asc",
                  },
                },
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!sourceProject) {
      throw new Error("No tienes permisos para duplicar este proyecto");
    }

    const duplicatedName = await resolveDuplicateProjectName(tx, sourceProject.companyId, sourceProject.name);

    return createDuplicatedProjectGraph(tx, sourceProject, duplicatedName);
  });
}

async function resolveDuplicateProjectName(
  tx: Prisma.TransactionClient,
  companyId: string,
  sourceName: string,
) {
  const baseName = `${sourceName} (copia)`;
  const copyPrefix = `${sourceName} (copia`;
  const validCopyNamePattern = new RegExp(`^${escapeForRegExp(sourceName)} \\(copia(?: \\d+)?\\)$`);
  const siblingProjects = await tx.project.findMany({
    where: {
      companyId,
      name: {
        startsWith: copyPrefix,
      },
    },
    select: {
      name: true,
    },
  });
  const takenNames = new Set(
    siblingProjects.map((project) => project.name).filter((projectName) => validCopyNamePattern.test(projectName)),
  );

  if (!takenNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  let candidate = `${sourceName} (copia ${suffix})`;

  while (takenNames.has(candidate)) {
    suffix += 1;
    candidate = `${sourceName} (copia ${suffix})`;
  }

  return candidate;
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requireMappedId(idMap: Map<string, string>, sourceId: string, message: string) {
  const mappedId = idMap.get(sourceId);

  if (!mappedId) {
    throw new Error(message);
  }

  return mappedId;
}

async function createDuplicatedProjectGraph(
  tx: Prisma.TransactionClient,
  sourceProject: SourceProjectGraph,
  duplicatedName: string,
) {
  const duplicatedProject = await tx.project.create({
    data: {
      companyId: sourceProject.companyId,
      name: duplicatedName,
      clientName: sourceProject.clientName,
      location: sourceProject.location,
      projectType: sourceProject.projectType,
      startDate: sourceProject.startDate,
      endDate: sourceProject.endDate,
      status: sourceProject.status,
    },
  });

  const budgetIdMap = new Map<string, string>();
  const levelIdMap = new Map<string, string>();
  const itemIdMap = new Map<string, string>();
  const apuResourceIdMap = new Map<string, string>();

  for (const sourceBudget of sourceProject.budgets) {
    const createdBudget = await tx.budget.create({
      data: {
        projectId: duplicatedProject.id,
        parentBudgetId: sourceBudget.parentBudgetId
          ? requireMappedId(
              budgetIdMap,
              sourceBudget.parentBudgetId,
              "No se pudo remapear el presupuesto padre al duplicar el proyecto",
            )
          : null,
        kind: sourceBudget.kind,
        name: sourceBudget.name,
        currency: sourceBudget.currency,
        igvRate: sourceBudget.igvRate,
        generalExpensesRate: sourceBudget.generalExpensesRate,
        utilityRate: sourceBudget.utilityRate,
        totalDirectCost: sourceBudget.totalDirectCost,
        totalGeneralExpenses: sourceBudget.totalGeneralExpenses,
        totalUtility: sourceBudget.totalUtility,
        totalTax: sourceBudget.totalTax,
        totalAmount: sourceBudget.totalAmount,
      },
    });

    budgetIdMap.set(sourceBudget.id, createdBudget.id);

    await cloneBudgetLevels(tx, sourceBudget.levels, createdBudget.id, levelIdMap);

    for (const sourceGeneralExpense of sourceBudget.generalExpenses) {
      await tx.generalExpense.create({
        data: {
          budgetId: createdBudget.id,
          name: sourceGeneralExpense.name,
          type: sourceGeneralExpense.type,
          amount: sourceGeneralExpense.amount,
          percentage: sourceGeneralExpense.percentage,
        },
      });
    }

    for (const sourceItem of sourceBudget.items) {
      const createdItem = await tx.budgetItem.create({
        data: {
          budgetId: createdBudget.id,
          levelId: sourceItem.levelId
            ? requireMappedId(
                levelIdMap,
                sourceItem.levelId,
                "No se pudo remapear el nivel del item al duplicar el proyecto",
              )
            : null,
          code: sourceItem.code,
          description: sourceItem.description,
          unit: sourceItem.unit,
          quantity: sourceItem.quantity,
          unitPrice: sourceItem.unitPrice,
          partial: sourceItem.partial,
          sortOrder: sourceItem.sortOrder,
        },
      });

      itemIdMap.set(sourceItem.id, createdItem.id);

      if (!sourceItem.apu) {
        continue;
      }

      const createdApu = await tx.apu.create({
        data: {
          budgetItemId: createdItem.id,
          name: sourceItem.apu.name,
          unit: sourceItem.apu.unit,
          performance: sourceItem.apu.performance,
          totalUnitCost: sourceItem.apu.totalUnitCost,
        },
      });

      for (const sourceApuResource of sourceItem.apu.resources) {
        const createdApuResource = await tx.apuResource.create({
          data: {
            apuId: createdApu.id,
            resourceId: sourceApuResource.resourceId,
            resourceType: sourceApuResource.resourceType,
            crew: sourceApuResource.crew,
            quantity: sourceApuResource.quantity,
            unitPrice: sourceApuResource.unitPrice,
            subtotal: sourceApuResource.subtotal,
          },
        });

        apuResourceIdMap.set(sourceApuResource.id, createdApuResource.id);
      }
    }

    for (const sourceGroup of sourceBudget.generalExpenseGroups) {
      const createdGroup = await tx.generalExpenseGroup.create({
        data: {
          budgetId: createdBudget.id,
          name: sourceGroup.name,
          kind: sourceGroup.kind,
          sortOrder: sourceGroup.sortOrder,
        },
      });

      for (const sourceTitle of sourceGroup.titles) {
        const createdTitle = await tx.generalExpenseTitle.create({
          data: {
            groupId: createdGroup.id,
            code: sourceTitle.code,
            name: sourceTitle.name,
            category: sourceTitle.category,
            sortOrder: sourceTitle.sortOrder,
          },
        });

        for (const sourceExpenseItem of sourceTitle.items) {
          await tx.generalExpenseItem.create({
            data: {
              titleId: createdTitle.id,
              code: sourceExpenseItem.code,
              description: sourceExpenseItem.description,
              category: sourceExpenseItem.category,
              unit: sourceExpenseItem.unit,
              quantityDescription: sourceExpenseItem.quantityDescription,
              quantity: sourceExpenseItem.quantity,
              participationPercentage: sourceExpenseItem.participationPercentage,
              unitPrice: sourceExpenseItem.unitPrice,
              sortOrder: sourceExpenseItem.sortOrder,
            },
          });
        }
      }
    }

    for (const sourceFooterRow of sourceBudget.footerRows) {
      await tx.budgetFooterRow.create({
        data: {
          budgetId: createdBudget.id,
          variable: sourceFooterRow.variable,
          description: sourceFooterRow.description,
          formula: sourceFooterRow.formula,
          manualValue: sourceFooterRow.manualValue,
          iu: sourceFooterRow.iu,
          highlight: sourceFooterRow.highlight,
          sortOrder: sourceFooterRow.sortOrder,
        },
      });
    }
  }

  for (const sourceFormula of sourceProject.polynomialFormulas) {
    const createdFormula = await tx.polynomialFormula.create({
      data: {
        projectId: duplicatedProject.id,
        budgetId: requireMappedId(
          budgetIdMap,
          sourceFormula.budgetId,
          "No se pudo remapear el presupuesto de la formula polinomica al duplicar el proyecto",
        ),
        name: sourceFormula.name,
        baseMonth: sourceFormula.baseMonth,
        baseYear: sourceFormula.baseYear,
        totalBaseAmount: sourceFormula.totalBaseAmount,
        status: sourceFormula.status,
      },
    });

    for (const sourceMonomial of sourceFormula.monomials) {
      const createdMonomial = await tx.polynomialMonomial.create({
        data: {
          formulaId: createdFormula.id,
          code: sourceMonomial.code,
          name: sourceMonomial.name,
          costGroupKey: sourceMonomial.costGroupKey,
          amount: sourceMonomial.amount,
          coefficient: sourceMonomial.coefficient,
          baseIndexCode: sourceMonomial.baseIndexCode,
          baseIndexName: sourceMonomial.baseIndexName,
          baseIndexValue: sourceMonomial.baseIndexValue,
          adjustmentIndexCode: sourceMonomial.adjustmentIndexCode,
          adjustmentIndexName: sourceMonomial.adjustmentIndexName,
          adjustmentIndexValue: sourceMonomial.adjustmentIndexValue,
          sortOrder: sourceMonomial.sortOrder,
        },
      });

      for (const sourceComponent of sourceMonomial.components) {
        await tx.polynomialMonomialComponent.create({
          data: {
            monomialId: createdMonomial.id,
            budgetItemId: sourceComponent.budgetItemId
              ? requireMappedId(
                  itemIdMap,
                  sourceComponent.budgetItemId,
                  "No se pudo remapear el item del monomio al duplicar el proyecto",
                )
              : null,
            apuResourceId: sourceComponent.apuResourceId
              ? requireMappedId(
                  apuResourceIdMap,
                  sourceComponent.apuResourceId,
                  "No se pudo remapear el recurso APU del monomio al duplicar el proyecto",
                )
              : null,
            resourceType: sourceComponent.resourceType,
            amount: sourceComponent.amount,
          },
        });
      }
    }
  }

  return duplicatedProject;
}

async function cloneBudgetLevels(
  tx: Prisma.TransactionClient,
  sourceLevels: SourceProjectGraph["budgets"][number]["levels"],
  budgetId: string,
  levelIdMap: Map<string, string>,
) {
  let pendingLevels = [...sourceLevels];

  while (pendingLevels.length > 0) {
    const nextPendingLevels: typeof pendingLevels = [];
    let createdLevels = 0;

    for (const sourceLevel of pendingLevels) {
      if (sourceLevel.parentId && !levelIdMap.has(sourceLevel.parentId)) {
        nextPendingLevels.push(sourceLevel);
        continue;
      }

      const createdLevel = await tx.budgetLevel.create({
        data: {
          budgetId,
          parentId: sourceLevel.parentId ? levelIdMap.get(sourceLevel.parentId) ?? null : null,
          type: sourceLevel.type,
          code: sourceLevel.code,
          name: sourceLevel.name,
          sortOrder: sourceLevel.sortOrder,
        },
      });

      levelIdMap.set(sourceLevel.id, createdLevel.id);
      createdLevels += 1;
    }

    if (createdLevels === 0) {
      throw new Error("No se pudo duplicar la jerarquia de niveles del presupuesto");
    }

    pendingLevels = nextPendingLevels;
  }
}

async function ensureProjectBudgetStructure(
  tx: Prisma.TransactionClient,
  projectId: string,
  fallbackBudgetContext: BudgetDefaultsContext,
  defaultSubBudgetNames: string[],
) {
  const budgets = await tx.budget.findMany({
    where: { projectId },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });

  const recoveryBudgetDefaults = createBudgetData(
    resolveBudgetDefaultsContext(budgets, fallbackBudgetContext),
  );

  let generalBudget =
    budgets.find((budget) => budget.kind === "GENERAL" && budget.name === "Presupuesto General") ??
    budgets.find((budget) => budget.kind === "GENERAL") ??
    null;

  if (!generalBudget) {
    generalBudget = await tx.budget.create({
      data: {
        projectId,
        kind: "GENERAL",
        name: "Presupuesto General",
        ...recoveryBudgetDefaults,
      },
    });
  } else if (generalBudget.name !== "Presupuesto General") {
    generalBudget = await tx.budget.update({
      where: { id: generalBudget.id },
      data: { name: "Presupuesto General" },
    });
  }

  const budgetsByName = new Map(budgets.map((budget) => [budget.name, budget]));
  const childBudgetDefaults = createBudgetData({
    currency: generalBudget.currency,
    igvRate: generalBudget.igvRate,
    generalExpensesRate: generalBudget.generalExpensesRate,
    utilityRate: generalBudget.utilityRate,
  });

  const defaultBudgetNames = getFallbackSubBudgetNames(defaultSubBudgetNames);

  for (const name of defaultBudgetNames) {
    const existing = budgetsByName.get(name);

    if (existing) {
      if (existing.parentBudgetId !== generalBudget.id || existing.kind !== "SUB_BUDGET") {
        const updated = await tx.budget.update({
          where: { id: existing.id },
          data: {
            parentBudgetId: generalBudget.id,
            kind: "SUB_BUDGET",
          },
        });
        budgetsByName.set(name, updated);
      }
      continue;
    }

    const created = await tx.budget.create({
      data: {
        projectId,
        parentBudgetId: generalBudget.id,
        kind: "SUB_BUDGET",
        name,
        ...childBudgetDefaults,
      },
    });

    budgetsByName.set(name, created);
  }

  await refreshGeneralBudgetTotals(tx, generalBudget.id);

  return tx.budget.findMany({
    where: { projectId },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
}

async function refreshGeneralBudgetTotals(tx: Prisma.TransactionClient, generalBudgetId: string) {
  const generalBudget = await tx.budget.findUnique({
    where: { id: generalBudgetId },
    include: {
      childBudgets: {
        select: {
          totalDirectCost: true,
          totalGeneralExpenses: true,
          totalUtility: true,
          totalTax: true,
          totalAmount: true,
        },
      },
    },
  });

  if (!generalBudget) return;

  const consolidated = generalBudget.childBudgets.reduce(
    (totals, childBudget) => ({
      totalDirectCost: totals.totalDirectCost.plus(childBudget.totalDirectCost),
      totalGeneralExpenses: totals.totalGeneralExpenses.plus(childBudget.totalGeneralExpenses),
      totalUtility: totals.totalUtility.plus(childBudget.totalUtility),
      totalTax: totals.totalTax.plus(childBudget.totalTax),
      totalAmount: totals.totalAmount.plus(childBudget.totalAmount),
    }),
    createZeroDecimalBudgetTotals(),
  );

  await tx.budget.update({
    where: { id: generalBudgetId },
    data: consolidated,
  });
}
