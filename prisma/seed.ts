import path from "node:path";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import { ProjectStatus, ResourceCategory } from "@prisma/client";
import { createPrismaClient } from "@/lib/db/prisma-client";
import { hashPassword } from "@/lib/auth/password";
import { calculateBudgetRecord } from "@/lib/calculations/budget";
import { loadUnifiedIndexWorkbook } from "@/lib/polynomial-formula/index-source";
import { buildUnifiedIndexSeedPayload } from "@/lib/polynomial-formula/unified-index-seed";
import { unifiedIndexDictionaryData } from "@/lib/polynomial-formula/unified-index-dictionary-data";
import { resolveCurrentResourceIu } from "@/lib/resources/current-iu-assignment";
import { findSeedPartidaApuMatch } from "@/lib/seed/catalog-partida-matching";
import { priceSeedCatalogPartidaApuRows } from "@/lib/seed/catalog-partida-pricing";
import { normalizeExcelCellText } from "@/lib/seed/excel-cell-text";
import { isSubpartidaResourceType, SUBPARTIDA_RESOURCE_TYPE } from "@/lib/apu/subpartidas";
import { seedAgentWorkflows } from "@/lib/data/seed-agent-workflows";

const prisma = createPrismaClient(["warn", "error"]);
const DATA_FOR_SEED_DIR = path.resolve(process.cwd(), "data-for-seed");
const SEED_PARTIDAS_WORKBOOK_PATHS = [
  path.join(DATA_FOR_SEED_DIR, "catalogo-de-partidas.xlsx"),
  path.join(DATA_FOR_SEED_DIR, "catalogo-de-partidas-adicionales.xlsx"),
];
const UNIFIED_INDEX_WORKBOOK_PATH = path.resolve(
  process.cwd(),
  "data-for-seed",
  "formula-polinomica",
  "07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx",
);

const resourceCodePrefixes: Record<ResourceCategory, string> = {
  MATERIAL: "MAT",
  LABOR: "MO",
  EQUIPMENT: "EQ",
  TOOLS: "HER",
  SUBCONTRACT: "SUB",
};

async function seedUnifiedIndicesFromWorkbook() {
  const workbookSource = await loadUnifiedIndexWorkbook(UNIFIED_INDEX_WORKBOOK_PATH);
  const sourceFilename = path.basename(UNIFIED_INDEX_WORKBOOK_PATH);
  const payloadRows = buildUnifiedIndexSeedPayload(workbookSource, sourceFilename);

  for (const row of payloadRows) {
    await prisma.unifiedIndex.upsert({
      where: {
        code_geographicArea_month_year: {
          code: row.code,
          geographicArea: row.geographicArea,
          month: row.month,
          year: row.year,
        },
      },
      update: {
        name: row.name,
        value: row.value,
        source: row.source,
      },
      create: row,
    });
  }

  console.info(
    `Seeded ${payloadRows.length} unified indices from ${sourceFilename}.`,
  );
}

async function main() {
  const passwordHash = await hashPassword("Demo12345");
  await seedMembershipPlans();

  const user = await prisma.user.upsert({
    where: { email: "demo@mycpresupuestos.pe" },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      membershipPlan: {
        connect: { slug: "empresa" },
      },
    },
    create: {
      email: "demo@mycpresupuestos.pe",
      name: "Usuario Demo",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      membershipPlan: {
        connect: { slug: "empresa" },
      },
    },
  });
  const demoUser = await prisma.user.upsert({
    where: { email: "usuario@mycpresupuestos.pe" },
    update: {
      role: "USER",
      status: "ACTIVE",
      membershipPlan: {
        connect: { slug: "starter" },
      },
    },
    create: {
      email: "usuario@mycpresupuestos.pe",
      name: "Usuario Operativo",
      passwordHash,
      role: "USER",
      status: "ACTIVE",
      membershipPlan: {
        connect: { slug: "starter" },
      },
    },
  });

  const existingDemoUserCompany = await prisma.company.findFirst({
    where: { userId: demoUser.id },
    orderBy: { createdAt: "asc" },
  });

  const demoCompany =
    existingDemoUserCompany ??
    (await prisma.company.create({
      data: {
        userId: demoUser.id,
        name: "Constructora Demo",
        ruc: "20987654321",
      },
    }));

  await prisma.companyMembership.upsert({
    where: { companyId_userId: { companyId: demoCompany.id, userId: demoUser.id } },
    update: { role: "OWNER", status: "ACTIVE" },
    create: { companyId: demoCompany.id, userId: demoUser.id, role: "OWNER", status: "ACTIVE" },
  });

  const existingCompany = await prisma.company.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const company =
    existingCompany ??
    (await prisma.company.create({
      data: {
        userId: user.id,
        name: "MYC Ingenieria",
        ruc: "20123456789",
      },
    }));

  await prisma.companyMembership.upsert({
    where: { companyId_userId: { companyId: company.id, userId: user.id } },
    update: { role: "OWNER", status: "ACTIVE" },
    create: { companyId: company.id, userId: user.id, role: "OWNER", status: "ACTIVE" },
  });

  const empresaPlan = await prisma.membershipPlan.findUnique({ where: { slug: "empresa" } });
  if (empresaPlan) {
    await prisma.companySubscription.upsert({
      where: { companyId: company.id },
      update: { membershipPlanId: empresaPlan.id, provider: "MANUAL", status: "ACTIVE" },
      create: {
        companyId: company.id,
        membershipPlanId: empresaPlan.id,
        provider: "MANUAL",
        status: "ACTIVE",
      },
    });
  }

  await seedUnifiedIndicesFromWorkbook();
  await seedGeneralResourcesCatalog();
  await seedGeneralPartidasCatalog();
  await seedAutocreatedPartidaResourceCurrentIus();

  const demoResources = await Promise.all([
    findCatalogResource("CEMENTO PORTLAND TIPO I (42.5KG)", ResourceCategory.MATERIAL, "BLS"),
    findCatalogResource("OPERARIO", ResourceCategory.LABOR, "HH"),
    findCatalogResource("HERRAMIENTAS MANUALES", ResourceCategory.EQUIPMENT, "%MO"),
  ]);

  const [cementResource, laborResource, toolsResource] = demoResources;

  const existingProject = await prisma.project.findFirst({
    where: {
      companyId: company.id,
      name: "Vivienda Multifamiliar San Miguel",
    },
  });

  const project =
    existingProject ??
    (await prisma.project.create({
      data: {
        companyId: company.id,
        name: "Vivienda Multifamiliar San Miguel",
        clientName: "Constructora Lima Norte",
        location: "San Miguel, Lima",
        projectType: "Edificacion",
        status: ProjectStatus.IN_PROGRESS,
      },
    }));

  const budgetBase = calculateBudgetRecord({
    id: "seed-budget",
    projectId: project.id,
    parentBudgetId: "seed-general-budget",
    kind: "SUB_BUDGET",
    name: "Arquitectura",
    currency: "PEN",
    igvRate: 0.18,
    generalExpensesRate: 0.1,
    utilityRate: 0.08,
    totalDirectCost: 0,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: 0,
    levels: [
      { id: "seed-level-title", budgetId: "seed-budget", parentId: null, type: "TITLE", code: "01", name: "Arquitectura", sortOrder: 1 },
      { id: "seed-level-subtitle", budgetId: "seed-budget", parentId: "seed-level-title", type: "SUBTITLE", code: "01.01", name: "Muros", sortOrder: 2 },
    ],
    items: [
      {
        id: "seed-item-1",
        budgetId: "seed-budget",
        levelId: "seed-level-subtitle",
        code: "01.01.01",
        description: "Muro de ladrillo king kong",
        unit: "m2",
        quantity: 120,
        unitPrice: 0,
        partial: 0,
        sortOrder: 1,
        apu: {
          id: "seed-apu-1",
          budgetItemId: "seed-item-1",
          name: "APU Muro de ladrillo king kong",
          unit: "m2",
          performance: 1,
          totalUnitCost: 0,
          resources: [
            {
              id: "seed-ar-1",
              apuId: "seed-apu-1",
              resourceId: cementResource.id,
              resourceType: "MATERIAL",
              quantity: 1.6,
              unitPrice: Number(cementResource.unitPrice),
              subtotal: 0,
            },
            {
              id: "seed-ar-2",
              apuId: "seed-apu-1",
              resourceId: laborResource.id,
              resourceType: "LABOR",
              quantity: 0.8,
              unitPrice: Number(laborResource.unitPrice),
              subtotal: 0,
            },
            {
              id: "seed-ar-3",
              apuId: "seed-apu-1",
              resourceId: toolsResource.id,
              resourceType: "EQUIPMENT",
              quantity: 1,
              unitPrice: Number(toolsResource.unitPrice),
              subtotal: 0,
            },
          ],
        },
      },
    ],
  });

  const existingGeneralBudget = await prisma.budget.findFirst({
    where: {
      projectId: project.id,
      kind: "GENERAL",
      name: "Presupuesto General",
    },
  });

  const generalBudget =
    existingGeneralBudget ??
    (await prisma.budget.create({
      data: {
        projectId: project.id,
        kind: "GENERAL",
        name: "Presupuesto General",
        currency: budgetBase.currency,
        igvRate: budgetBase.igvRate,
        generalExpensesRate: budgetBase.generalExpensesRate,
        utilityRate: budgetBase.utilityRate,
        totalDirectCost: 0,
        totalGeneralExpenses: 0,
        totalUtility: 0,
        totalTax: 0,
        totalAmount: 0,
      },
    }));

  const existingBudget = await prisma.budget.findFirst({
    where: {
      projectId: project.id,
      name: budgetBase.name,
    },
  });

  const budget =
    existingBudget ??
    (await prisma.budget.create({
      data: {
        projectId: project.id,
        parentBudgetId: generalBudget.id,
        kind: "SUB_BUDGET",
        name: budgetBase.name,
        currency: budgetBase.currency,
        igvRate: budgetBase.igvRate,
        generalExpensesRate: budgetBase.generalExpensesRate,
        utilityRate: budgetBase.utilityRate,
        totalDirectCost: budgetBase.totalDirectCost,
        totalGeneralExpenses: budgetBase.totalGeneralExpenses,
        totalUtility: budgetBase.totalUtility,
        totalTax: budgetBase.totalTax,
        totalAmount: budgetBase.totalAmount,
      },
    }));

  const defaultSubBudgets = [
    "Estructuras",
    "Arquitectura",
    "Instalaciones Sanitarias",
    "Instalaciones Electricas",
  ];

  for (const name of defaultSubBudgets) {
    const existingSubBudget = await prisma.budget.findFirst({
      where: {
        projectId: project.id,
        parentBudgetId: generalBudget.id,
        name,
      },
    });

    if (!existingSubBudget) {
      await prisma.budget.create({
        data: {
          projectId: project.id,
          parentBudgetId: generalBudget.id,
          kind: "SUB_BUDGET",
          name,
          currency: budgetBase.currency,
          igvRate: budgetBase.igvRate,
          generalExpensesRate: budgetBase.generalExpensesRate,
          utilityRate: budgetBase.utilityRate,
          totalDirectCost: 0,
          totalGeneralExpenses: 0,
          totalUtility: 0,
          totalTax: 0,
          totalAmount: 0,
        },
      });
    }
  }

  const existingLevel = await prisma.budgetLevel.findFirst({
    where: {
      budgetId: budget.id,
      code: "01",
    },
  });

  if (!existingLevel) {
    const title = await prisma.budgetLevel.create({
      data: {
        budgetId: budget.id,
        code: "01",
        name: "Arquitectura",
        type: "TITLE",
        sortOrder: 1,
      },
    });

    const subtitle = await prisma.budgetLevel.create({
      data: {
        budgetId: budget.id,
        parentId: title.id,
        code: "01.01",
        name: "Muros",
        type: "SUBTITLE",
        sortOrder: 2,
      },
    });

    const item = await prisma.budgetItem.create({
      data: {
        budgetId: budget.id,
        levelId: subtitle.id,
        code: "01.01.01",
        description: "Muro de ladrillo king kong",
        unit: "m2",
        quantity: budgetBase.items[0].quantity,
        unitPrice: budgetBase.items[0].unitPrice,
        partial: budgetBase.items[0].partial,
        sortOrder: 1,
      },
    });

    const apu = await prisma.apu.create({
      data: {
        budgetItemId: item.id,
        name: "APU Muro de ladrillo king kong",
        unit: "m2",
        performance: 1,
        totalUnitCost: budgetBase.items[0].unitPrice,
      },
    });

    await prisma.apuResource.createMany({
      data: [
        {
          apuId: apu.id,
          resourceId: cementResource.id,
          resourceType: "MATERIAL",
          quantity: 1.6,
          unitPrice: Number(cementResource.unitPrice),
          subtotal: 1.6 * Number(cementResource.unitPrice),
        },
        {
          apuId: apu.id,
          resourceId: laborResource.id,
          resourceType: "LABOR",
          quantity: 0.8,
          unitPrice: Number(laborResource.unitPrice),
          subtotal: 0.8 * Number(laborResource.unitPrice),
        },
        {
          apuId: apu.id,
          resourceId: toolsResource.id,
          resourceType: "EQUIPMENT",
          quantity: 1,
          unitPrice: Number(toolsResource.unitPrice),
          subtotal: Number(toolsResource.unitPrice),
        },
      ],
    });
  }

  await refreshBudgetTotals(budget.id);
  await refreshGeneralBudgetTotals(generalBudget.id);
  const workflowResult = await seedAgentWorkflows(prisma);
  console.info(
    `Seeded ${workflowResult.upserted} agent workflows from templates.`,
  );

  if (workflowResult.errors.length > 0) {
    console.warn(
      `Seed workflows: ${workflowResult.errors.length} errores`,
      workflowResult.errors,
    );
  }
}

async function seedMembershipPlans() {
  const proEntitlements = [
    "ai.local",
    "khipu.agent",
    "partidas.similarity",
    "work_schedule.intelligent",
    "polynomial_formula",
    "polynomial_formula.adjustments",
    "risk_analysis",
    "exports.advanced",
    "exports.basic",
  ];
  const plans = [
    {
      name: "Starter",
      slug: "starter",
      monthlyTokenLimit: 100000,
      billingMode: "FREE" as const,
      projectLimit: 3,
      budgetLimit: 5,
      entitlements: ["exports.basic", "polynomial_formula"],
    },
    {
      name: "Pro",
      slug: "pro",
      monthlyTokenLimit: 500000,
      billingMode: "STRIPE" as const,
      projectLimit: null,
      budgetLimit: null,
      entitlements: proEntitlements,
    },
    {
      name: "Empresa",
      slug: "empresa",
      monthlyTokenLimit: 2000000,
      billingMode: "MANUAL" as const,
      projectLimit: null,
      budgetLimit: null,
      entitlements: proEntitlements,
    },
  ];

  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        monthlyTokenLimit: plan.monthlyTokenLimit,
        billingMode: plan.billingMode,
        projectLimit: plan.projectLimit,
        budgetLimit: plan.budgetLimit,
        entitlements: plan.entitlements,
        isActive: true,
      },
      create: plan,
    });
  }
}

async function seedGeneralResourcesCatalog() {
  const workbook = new ExcelJS.Workbook();
  const catalogPath = path.join(DATA_FOR_SEED_DIR, "catalogo-de-insumos.xlsx");
  await workbook.xlsx.readFile(catalogPath);

  const worksheet = workbook.worksheets[0];
  const existingGlobalResources = await prisma.resource.findMany({
    where: {
      companyId: null,
    },
    select: {
      id: true,
      code: true,
      description: true,
      category: true,
      unit: true,
      iu: true,
      iuCurrent: true,
      subcategory: true,
      unitPrice: true,
      currency: true,
      source: true,
    },
  });

  const existingResourcesByKey = new Map(
    existingGlobalResources.map((resource) => [
      buildResourceKey(resource.description, resource.category, resource.unit, resource.iu),
      resource,
    ]),
  );
  const existingResourcesByIdentityKey = new Map(
    existingGlobalResources.map((resource) => [
      buildResourceIdentityKey(resource.description, resource.category, resource.unit),
      resource,
    ]),
  );
  const existingResourcesByDescriptionUnitKey = new Map(
    existingGlobalResources.map((resource) => [
      buildResourceDescriptionUnitKey(resource.description, resource.unit),
      resource,
    ]),
  );
  const sequencesByCategory = buildCategorySequenceMap(existingGlobalResources);
  const unifiedIndexRows = await prisma.unifiedIndex.findMany({
    select: {
      code: true,
      name: true,
    },
    distinct: ["code", "name"],
  });

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const description = normalizeCellText(row.getCell(1).value);
    const unit = normalizeCellText(row.getCell(2).value);
    const unitPrice = parseSpreadsheetNumber(normalizeCellText(row.getCell(3).value));
    const category = normalizeCatalogCategory(normalizeCellText(row.getCell(4).value));
    const iu = normalizeSeedResourceIu(normalizeCellText(row.getCell(5).value));

    if (!description || !unit) {
      continue;
    }

    const key = buildResourceKey(description, category, unit, iu);
    const fallbackKey = buildResourceIdentityKey(description, category, unit);
    const descriptionUnitKey = buildResourceDescriptionUnitKey(description, unit);
    const existingResource =
      existingResourcesByKey.get(key) ??
      existingResourcesByIdentityKey.get(fallbackKey) ??
      existingResourcesByDescriptionUnitKey.get(descriptionUnitKey);
    if (existingResource) {
      const effectiveIu = iu || existingResource.iu || null;
      const iuCurrent = resolveCurrentResourceIu({
        description,
        category,
        legacyIu: effectiveIu,
        unifiedIndices: unifiedIndexRows,
        dictionaryRows: unifiedIndexDictionaryData,
      });
      const categoryChanged = existingResource.category !== category;
      const code =
        categoryChanged || !existingResource.code
          ? buildNextSeedResourceCode(sequencesByCategory, category)
          : existingResource.code;
      const nextData = {
        code,
        description,
        category,
        iu: effectiveIu,
        iuCurrent,
        subcategory: null,
        unit,
        unitPrice,
        currency: "PEN",
        source: "Catalogo general precargado",
      };

      const shouldUpdate =
        existingResource.code !== nextData.code ||
        existingResource.description !== nextData.description ||
        existingResource.category !== nextData.category ||
        existingResource.iu !== nextData.iu ||
        existingResource.iuCurrent !== nextData.iuCurrent ||
        existingResource.subcategory !== nextData.subcategory ||
        existingResource.unit !== nextData.unit ||
        Number(existingResource.unitPrice) !== nextData.unitPrice ||
        existingResource.currency !== nextData.currency ||
        existingResource.source !== nextData.source;

      if (shouldUpdate) {
        await prisma.resource.update({
          where: { id: existingResource.id },
          data: nextData,
        });
      }

      continue;
    }

    const iuCurrent = resolveCurrentResourceIu({
      description,
      category,
      legacyIu: iu,
      unifiedIndices: unifiedIndexRows,
      dictionaryRows: unifiedIndexDictionaryData,
    });

    const createdResource = await prisma.resource.create({
      data: {
        companyId: null,
        code: buildNextSeedResourceCode(sequencesByCategory, category),
        description,
        category,
        iu: iu || null,
        iuCurrent,
        subcategory: null,
        unit,
        unitPrice,
        currency: "PEN",
        source: "Catalogo general precargado",
      },
    });

    existingResourcesByKey.set(key, createdResource);
    existingResourcesByIdentityKey.set(fallbackKey, createdResource);
    existingResourcesByDescriptionUnitKey.set(descriptionUnitKey, createdResource);
  }
}

function buildNextSeedResourceCode(sequencesByCategory: Map<ResourceCategory, number>, category: ResourceCategory) {
  const nextSequence = (sequencesByCategory.get(category) ?? 0) + 1;
  sequencesByCategory.set(category, nextSequence);
  return `${resourceCodePrefixes[category]}-${String(nextSequence).padStart(3, "0")}`;
}

type SeedPartidaApuRow = {
  description: string;
  unit: string;
  crew: number | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  resourceType: string | null;
  groupLabel: string | null;
  resourceId: string | null;
  sortOrder: number;
};

type SeedPartidaApu = {
  description: string;
  matchKey: string;
  unit: string | null;
  unitPrice: number;
  performance: number;
  performanceUnit: string | null;
  performanceRate: string | null;
  apuRows: SeedPartidaApuRow[];
};

type SeedCatalogPartidaRow = {
  description: string;
  unit: string;
  listedUnitPrice: number;
};

type SeedPartidaUnitCandidate = {
  description: string;
  unit: string;
};

async function seedGeneralPartidasCatalog() {
  const { partidas, apuByDescription } = await loadSeedPartidasWorkbooks(SEED_PARTIDAS_WORKBOOK_PATHS);
  const resources = await prisma.resource.findMany({
    where: { companyId: null },
    select: {
      id: true,
      code: true,
      description: true,
      unit: true,
      unitPrice: true,
      category: true,
      iu: true,
    },
  });
  const resourceLookup = buildResourceLookupIndexes(resources);
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
  const existingPartidas = await prisma.catalogPartida.findMany({
    include: {
      apuRows: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const existingPartidasByKey = new Map(
    existingPartidas.map((partida) => [buildSeedPartidaMatchKey(partida.description, partida.unit), partida]),
  );
  const unitCandidates = buildSeedPartidaUnitCandidates(partidas, apuByDescription);
  const processedPartidaKeys = new Set<string>();
  const fallbackMatchedPartidaKeys = new Set<string>();
  const unresolvedCatalogInsumos = new Map<string, { description: string; unit: string }>();

  for (const { description, unit, listedUnitPrice } of partidas) {
    const partidaKey = buildSeedPartidaMatchKey(description, unit);
    processedPartidaKeys.add(partidaKey);
    const partidaApuMatch = findSeedPartidaApuMatch({
      description,
      unit,
      apuByKey: apuByDescription,
      buildMatchKey: buildSeedPartidaMatchKey,
      normalizeDescription: normalizeStrictCatalogText,
    });
    const partidaApu = partidaApuMatch?.apu;
    if (partidaApuMatch) {
      processedPartidaKeys.add(partidaApuMatch.key);
      if (partidaApuMatch.matchedBy === "description") {
        fallbackMatchedPartidaKeys.add(partidaApuMatch.key);
      }
    }
    const apuRows =
      partidaApu?.apuRows.map((apuRow, index) => ({
        resourceId: isSubpartidaResourceType(apuRow.resourceType ?? apuRow.groupLabel)
          ? null
          : findResourceIdForApuRow(apuRow.description, apuRow.unit, resourceLookup),
        description: apuRow.description,
        unit: apuRow.unit,
        crew: apuRow.crew,
        quantity: apuRow.quantity,
        unitPrice: isSubpartidaResourceType(apuRow.resourceType ?? apuRow.groupLabel) ? apuRow.unitPrice : 0,
        subtotal: 0,
        resourceType: isSubpartidaResourceType(apuRow.resourceType ?? apuRow.groupLabel) ? SUBPARTIDA_RESOURCE_TYPE : apuRow.resourceType,
        groupLabel: apuRow.groupLabel,
        sortOrder: index,
      })) ?? [];

    const performance = partidaApu?.performance ?? 1;
    const performanceUnit = partidaApu?.performanceUnit ?? unit;
    const performanceRate = partidaApu?.performanceRate ?? (performanceUnit ? `${performance.toFixed(4)} ${performanceUnit}/DIA` : null);
    const pricedApu = priceSeedCatalogPartidaApuRows({ rows: apuRows, performance, resourcesById });
    for (const unresolvedRow of pricedApu.unresolvedRows) {
      unresolvedCatalogInsumos.set(buildCanonicalResourceLookupKey(unresolvedRow.description, unresolvedRow.unit), unresolvedRow);
    }
    const unitPrice = pricedApu.rows.length ? pricedApu.unitPrice : listedUnitPrice;
    const existingPartida = existingPartidasByKey.get(partidaKey);

    if (existingPartida) {
      await prisma.catalogPartida.update({
        where: { id: existingPartida.id },
        data: {
          description,
          unit,
          unitPrice,
          currency: "PEN",
          source: "Catalogo de partidas precargado",
          performance,
          performanceUnit,
          performanceRate,
          apuRows: {
            deleteMany: {},
            create: pricedApu.rows,
          },
        },
      });

      continue;
    }

    await prisma.catalogPartida.create({
      data: {
        description,
        unit,
        unitPrice,
        currency: "PEN",
        source: "Catalogo de partidas precargado",
        performance,
        performanceUnit,
        performanceRate,
        apuRows: {
          create: pricedApu.rows,
        },
      },
    });
  }

  for (const partidaApu of apuByDescription.values()) {
    const unit = partidaApu.unit?.trim() || inferSeedPartidaUnit(partidaApu.description, unitCandidates);
    if (!unit) {
      continue;
    }
    const partidaKey = buildSeedPartidaMatchKey(partidaApu.description, unit);
    if (processedPartidaKeys.has(partidaKey)) {
      continue;
    }

    const apuRows = partidaApu.apuRows.map((apuRow, index) => ({
      resourceId: isSubpartidaResourceType(apuRow.resourceType ?? apuRow.groupLabel)
        ? null
        : findResourceIdForApuRow(apuRow.description, apuRow.unit, resourceLookup),
      description: apuRow.description,
      unit: apuRow.unit,
      crew: apuRow.crew,
      quantity: apuRow.quantity,
      unitPrice: isSubpartidaResourceType(apuRow.resourceType ?? apuRow.groupLabel) ? apuRow.unitPrice : 0,
      subtotal: 0,
      resourceType: isSubpartidaResourceType(apuRow.resourceType ?? apuRow.groupLabel) ? SUBPARTIDA_RESOURCE_TYPE : apuRow.resourceType,
      groupLabel: apuRow.groupLabel,
      sortOrder: index,
    }));
    const performanceUnit = partidaApu.performanceUnit ?? unit;
    const performanceRate = partidaApu.performanceRate ?? `${partidaApu.performance.toFixed(4)} ${performanceUnit}/DIA`;
    const pricedApu = priceSeedCatalogPartidaApuRows({ rows: apuRows, performance: partidaApu.performance, resourcesById });
    for (const unresolvedRow of pricedApu.unresolvedRows) {
      unresolvedCatalogInsumos.set(buildCanonicalResourceLookupKey(unresolvedRow.description, unresolvedRow.unit), unresolvedRow);
    }
    const unitPrice = pricedApu.rows.length ? pricedApu.unitPrice : partidaApu.unitPrice;
    const existingPartida = existingPartidasByKey.get(partidaKey);

    if (existingPartida) {
      await prisma.catalogPartida.update({
        where: { id: existingPartida.id },
        data: {
          description: partidaApu.description,
          unit,
          unitPrice,
          currency: "PEN",
          source: "Catalogo de partidas precargado",
          performance: partidaApu.performance,
          performanceUnit,
          performanceRate,
          apuRows: {
            deleteMany: {},
            create: pricedApu.rows,
          },
        },
      });

      continue;
    }

    await prisma.catalogPartida.create({
      data: {
        description: partidaApu.description,
        unit,
        unitPrice,
        currency: "PEN",
        source: "Catalogo de partidas precargado",
        performance: partidaApu.performance,
        performanceUnit,
        performanceRate,
        apuRows: {
          create: pricedApu.rows,
        },
      },
    });
  }

  const linkedSubpartidaRows = await linkSeedCatalogSubpartidaRows();

  if (unresolvedCatalogInsumos.size > 0) {
    console.warn(
      `Catalogo de partidas: ${unresolvedCatalogInsumos.size} insumos de APU no existen en catalogo-de-insumos.xlsx; se cargaron con PU 0.`,
    );
    for (const row of [...unresolvedCatalogInsumos.values()].slice(0, 20)) {
      console.warn(`- ${row.description} (${row.unit})`);
    }
  }

  const fallbackDuplicateIds = [...fallbackMatchedPartidaKeys]
    .map((key) => existingPartidasByKey.get(key)?.id)
    .filter((id): id is string => Boolean(id));

  if (fallbackDuplicateIds.length > 0) {
    await prisma.catalogPartida.deleteMany({
      where: {
        id: { in: fallbackDuplicateIds },
        source: "Catalogo de partidas precargado",
      },
    });
  }

  if (linkedSubpartidaRows > 0) {
    console.log(`Catalogo de partidas: ${linkedSubpartidaRows} filas de subpartidas enlazadas a su APU.`);
  }

  await pruneDuplicateCatalogPartidasWithoutApu();
}

async function seedAutocreatedPartidaResourceCurrentIus() {
  const source = "Autocreado desde APU del catalogo de partidas";
  const [resources, unifiedIndexRows] = await Promise.all([
    prisma.resource.findMany({
      where: {
        companyId: null,
        source,
        iuCurrent: null,
      },
      select: {
        id: true,
        description: true,
        category: true,
        iu: true,
      },
    }),
    prisma.unifiedIndex.findMany({
      select: {
        code: true,
        name: true,
      },
      distinct: ["code", "name"],
    }),
  ]);
  let updated = 0;

  for (const resource of resources) {
    const iuCurrent = resolveCurrentResourceIu({
      description: resource.description,
      category: resource.category,
      legacyIu: resource.iu,
      unifiedIndices: unifiedIndexRows,
      dictionaryRows: unifiedIndexDictionaryData,
    });

    if (!iuCurrent) {
      continue;
    }

    await prisma.resource.update({
      where: {
        id: resource.id,
      },
      data: {
        iuCurrent,
      },
    });
    updated += 1;
  }

  if (updated > 0) {
    console.info(`Seeded IU 2026 for ${updated} autocreated partida resources.`);
  }
}

async function linkSeedCatalogSubpartidaRows() {
  const partidas = await prisma.catalogPartida.findMany({
    include: {
      apuRows: {
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });
  const partidasByKey = new Map(
    partidas.map((partida) => [buildSeedPartidaMatchKey(partida.description, partida.unit), partida.id]),
  );
  const subpartidaRows = await prisma.partidaApuRow.findMany({
    where: {
      OR: [
        { resourceType: SUBPARTIDA_RESOURCE_TYPE },
        { resourceType: "SUB PARTIDAS" },
        { groupLabel: "Sub Partidas" },
        { groupLabel: "SUB PARTIDAS" },
      ],
    },
    select: {
      id: true,
      catalogPartidaId: true,
      description: true,
      unit: true,
    },
  });
  let linkedRows = 0;

  for (const row of subpartidaRows) {
    const alias = resolveManualCatalogSubpartidaAlias(row.description, row.unit);
    const linkedPartidaId = partidasByKey.get(
      alias ? buildSeedPartidaMatchKey(alias.description, alias.unit) : buildSeedPartidaMatchKey(row.description, row.unit),
    );
    if (!linkedPartidaId || linkedPartidaId === row.catalogPartidaId) continue;

    await prisma.partidaApuRow.update({
      where: { id: row.id },
      data: {
        catalogSubpartidaId: linkedPartidaId,
        resourceId: null,
        resourceType: SUBPARTIDA_RESOURCE_TYPE,
      },
    });
    linkedRows += 1;
  }

  return linkedRows;
}

function resolveManualCatalogSubpartidaAlias(description: string, unit: string) {
  const aliases: Record<string, { description: string; unit: string }> = {
    [buildSeedPartidaMatchKey("ACERO REFUERZO Fy=4200 kg/cm2", "kg")]: {
      description: "ACERO DE REFUERZO F´Y = 4200 KG/CM2",
      unit: "KG",
    },
    [buildSeedPartidaMatchKey("PRODUCCION CONCRETO CLASE C (F'C=280 KG/CM2)", "M3")]: {
      description: "CONCRETO CLASE C (F'C=280 KG/CM2)",
      unit: "M3",
    },
    [buildSeedPartidaMatchKey("PRODUCCION CONCRETO CLASE D (F'C=210 KG/CM2)", "M3")]: {
      description: "CONCRETO CLASE D (F'C=210 KG/CM2)",
      unit: "M3",
    },
    [buildSeedPartidaMatchKey("PRODUCCION CONCRETO CLASE E (F'C=175 KG/CM2)", "M3")]: {
      description: "CONCRETO CLASE E (F'C=175 KG/CM2)",
      unit: "M3",
    },
    [buildSeedPartidaMatchKey("PRODUCCION CONCRETO CLASE H (F'C=100 KG/CM2)", "M3")]: {
      description: "CONCRETO CLASE H (F'C=100 KG/CM2)",
      unit: "M3",
    },
    [buildSeedPartidaMatchKey("CONCRETO F'C=100 KG/CM2 (A)", "M3")]: {
      description: "CONCRETO F'C=100 KG/CM2",
      unit: "M3",
    },
    [buildSeedPartidaMatchKey("CONCRETO FLUIDO F'C=280 KG/CM2 PARA INYECCIÓN", "M3")]: {
      description: "INYECCIÓN DE CONCRETO FLUIDO (F'C=280 KG/CM2)",
      unit: "M3",
    },
    [buildSeedPartidaMatchKey("CONCRETO HIDRAULICO MR=45 KG/CM2 (MANUAL)", "M3")]: {
      description: "PAVIMENTO DE CONCRETO HIDRAULICO S'C=45 KG/CM2 (MANUAL)",
      unit: "M3",
    },
    [buildSeedPartidaMatchKey("CONCRETO HIDRAULICO MR=45 KG/CM2 (PARA PAVIMENTADORA)", "M3")]: {
      description: "PAVIMENTO DE CONCRETO HIDRAULICO S'C=45 KG/CM2 (PAVIMENTADORA)",
      unit: "M3",
    },
    [buildSeedPartidaMatchKey("EXCAVACION Y DESQUINCHE EN ROCA FIJA", "M3")]: {
      description: "EXCAVACION EN EXPLANACIONES EN ROCA FIJA",
      unit: "M3",
    },
    [buildSeedPartidaMatchKey("EXCAVACION Y DESQUINCHE EN ROCA SUELTA", "M3")]: {
      description: "EXCAVACION EN EXPLANACIONES EN ROCA SUELTA",
      unit: "M3",
    },
    [buildSeedPartidaMatchKey("MATERIAL DE PRESTAMO", "M3")]: {
      description: "MATERIAL DE PRESTAMO PARA RELLENOS",
      unit: "M3",
    },
    [buildSeedPartidaMatchKey("TRATAMIENTO SUPERFICIAL BICAPA (1RA CAPA)", "M2")]: {
      description: "TRATAMIENTO SUPERFICIAL BICAPA",
      unit: "M2",
    },
    [buildSeedPartidaMatchKey("TRATAMIENTO SUPERFICIAL BICAPA (2DA CAPA)", "M2")]: {
      description: "TRATAMIENTO SUPERFICIAL BICAPA",
      unit: "M2",
    },
    [buildSeedPartidaMatchKey("ENCOFRADO Y DESENCOFRADO PARA CUNETAS", "M2")]: {
      description: "ENCOFRADO Y DESENCOFRADO PARA OBRAS DE ARTE",
      unit: "M2",
    },
    [buildSeedPartidaMatchKey("PERFILADO Y COMPACTADO DE CUNETA", "M2")]: {
      description: "PERFILADO Y COMPACTADO EN ZONAS DE CORTE",
      unit: "M2",
    },
    [buildSeedPartidaMatchKey("JUNTA DE CONSTRUCCION (0.01x0.01 m)", "ML")]: {
      description: "JUNTA DE CONSTRUCCION",
      unit: "ML",
    },
    [buildSeedPartidaMatchKey("JUNTA DE DILATACION (0.02x0.01 m)", "ML")]: {
      description: "JUNTAS DE DILATACION METALICA 2\"",
      unit: "ML",
    },
  };

  return aliases[buildSeedPartidaMatchKey(description, unit)] ?? null;
}

async function pruneDuplicateCatalogPartidasWithoutApu() {
  await prisma.catalogPartida.deleteMany({
    where: {
      source: "Catalogo de partidas precargado",
      OR: [
        { description: { contains: "[object Object]", mode: "insensitive" } },
        { unit: { contains: "[object Object]", mode: "insensitive" } },
      ],
    },
  });

  const catalogPartidas = await prisma.catalogPartida.findMany({
    include: {
      apuRows: {
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const partidasByStrictKey = new Map<string, typeof catalogPartidas>();
  const partidasWithApu = catalogPartidas.filter((partida) => partida.apuRows.length > 0);

  for (const partida of catalogPartidas) {
    const key = buildStrictPartidaDuplicateKey(partida.description, partida.unit);
    partidasByStrictKey.set(key, [...(partidasByStrictKey.get(key) ?? []), partida]);
  }

  const duplicateIdsWithoutApu = [...partidasByStrictKey.values()].flatMap((group) => {
    if (group.length < 2) return [];
    if (!group.some((partida) => partida.apuRows.length > 0)) return [];

    return group.filter((partida) => partida.apuRows.length === 0).map((partida) => partida.id);
  });
  const typoIdsWithoutApu = catalogPartidas
    .filter((partida) => partida.apuRows.length === 0)
    .filter((partida) => partida.source === "Catalogo de partidas precargado")
    .filter((partida) => !hasInequalityMarker(partida.description))
    .filter((partida) =>
      partidasWithApu.some((candidate) => {
        if (candidate.unit.trim().toUpperCase() !== partida.unit.trim().toUpperCase()) return false;
        if (hasInequalityMarker(candidate.description)) return false;

        return isLikelyCorrectedPartidaTypo(partida.description, candidate.description);
      }),
    )
    .map((partida) => partida.id);
  const idsToDelete = [...new Set([...duplicateIdsWithoutApu, ...typoIdsWithoutApu])];

  if (idsToDelete.length === 0) {
    return;
  }

  await prisma.catalogPartida.deleteMany({
    where: {
      id: {
        in: idsToDelete,
      },
    },
  });
}

function isLikelyCorrectedPartidaTypo(left: string, right: string) {
  if (normalizeStrictCatalogText(left) === normalizeStrictCatalogText(right)) return false;

  const normalizedLeft = normalizeCorrectionCatalogText(left);
  const normalizedRight = normalizeCorrectionCatalogText(right);

  if (!hasSingleCorrectedToken(left, right)) return false;
  if (normalizedLeft === normalizedRight) return true;

  return calculateLevenshteinDistance(normalizedLeft, normalizedRight) <= 2;
}

function hasSingleCorrectedToken(left: string, right: string) {
  const leftTokens = getCatalogTokens(left);
  const rightTokens = getCatalogTokens(right);

  if (leftTokens.length !== rightTokens.length) return false;

  let correctedTokenCount = 0;
  for (let index = 0; index < leftTokens.length; index++) {
    if (leftTokens[index] === rightTokens[index]) continue;
    if (!isLikelyCorrectedToken(leftTokens[index], rightTokens[index])) return false;
    correctedTokenCount++;
  }

  return correctedTokenCount === 1;
}

function isLikelyCorrectedToken(left: string, right: string) {
  if (expandCatalogCorrectionToken(left) === expandCatalogCorrectionToken(right)) return true;
  return calculateLevenshteinDistance(left, right) <= 2;
}

function normalizeCorrectionCatalogText(value: string) {
  return getCatalogTokens(value).map(expandCatalogCorrectionToken).join(" ");
}

function expandCatalogCorrectionToken(token: string) {
  if (token === "PAND") return "PANDERETA";
  return token;
}

function hasInequalityMarker(value: string) {
  return /[<>≤≥]/.test(value);
}

function buildSeedPartidaUnitCandidates(
  partidas: SeedCatalogPartidaRow[],
  apuByDescription: Map<string, SeedPartidaApu>,
) {
  const candidatesByKey = new Map<string, SeedPartidaUnitCandidate>();

  for (const partida of partidas) {
    if (!partida.unit.trim()) continue;
    candidatesByKey.set(buildSeedPartidaMatchKey(partida.description, partida.unit), {
      description: partida.description,
      unit: partida.unit,
    });
  }

  for (const partidaApu of apuByDescription.values()) {
    const unit = partidaApu.unit?.trim();
    if (!unit) continue;
    candidatesByKey.set(buildSeedPartidaMatchKey(partidaApu.description, unit), {
      description: partidaApu.description,
      unit,
    });
  }

  return [...candidatesByKey.values()];
}

function inferSeedPartidaUnit(description: string, candidates: SeedPartidaUnitCandidate[]) {
  const targetTokens = getCatalogTokens(description);
  if (targetTokens.length === 0) return null;

  const ranked = candidates
    .map((candidate) => {
      const candidateTokens = getCatalogTokens(candidate.description);
      const overlap = targetTokens.filter((token) => candidateTokens.includes(token)).length;
      const score = overlap / Math.max(targetTokens.length, candidateTokens.length);

      return {
        unit: candidate.unit,
        score,
      };
    })
    .filter((candidate) => candidate.score >= 0.7)
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best) return null;

  const tiedBestUnits = new Set(ranked.filter((candidate) => candidate.score === best.score).map((candidate) => candidate.unit));
  if (tiedBestUnits.size === 1) {
    return best.unit;
  }

  return null;
}

async function loadSeedPartidasWorkbook(workbookPath: string) {
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(workbookPath, {
    worksheets: "emit",
    sharedStrings: "cache",
    styles: "ignore",
    hyperlinks: "ignore",
    entries: "ignore",
  });
  const partidas: SeedCatalogPartidaRow[] = [];
  const apuByDescription = new Map<string, SeedPartidaApu>();
  let foundPartidasSheet = false;
  let foundApuSheet = false;

  for await (const worksheetReader of workbookReader) {
    const worksheetName = getStreamingWorksheetName(worksheetReader);

    if (worksheetName === "PARTIDAS") {
      foundPartidasSheet = true;
      await readSeedPartidasSheet(worksheetReader, partidas);
      continue;
    }

    if (worksheetName === "APU") {
      foundApuSheet = true;
      await readSeedApuSheet(worksheetReader, apuByDescription);
    }
  }

  if (!foundPartidasSheet) {
    throw new Error(`No se encontro la pestana "PARTIDAS" en ${workbookPath}`);
  }

  if (!foundApuSheet) {
    throw new Error(`No se encontro la pestana "APU" en ${workbookPath}`);
  }

  return { partidas, apuByDescription };
}

async function loadSeedPartidasWorkbooks(workbookPaths: string[]) {
  const partidasByKey = new Map<string, SeedCatalogPartidaRow>();
  const apuByDescription = new Map<string, SeedPartidaApu>();

  for (const workbookPath of workbookPaths) {
    const loaded = await loadSeedPartidasWorkbook(workbookPath);

    for (const partida of loaded.partidas) {
      partidasByKey.set(buildSeedPartidaMatchKey(partida.description, partida.unit), partida);
    }

    for (const [key, apu] of loaded.apuByDescription) {
      apuByDescription.set(key, apu);
    }
  }

  return {
    partidas: [...partidasByKey.values()],
    apuByDescription,
  };
}

function getStreamingWorksheetName(worksheetReader: ExcelJS.stream.xlsx.WorksheetReader) {
  const record = worksheetReader as unknown as { name?: unknown };
  return typeof record.name === "string" ? record.name : "";
}

async function readSeedPartidasSheet(
  worksheetReader: ExcelJS.stream.xlsx.WorksheetReader,
  partidas: SeedCatalogPartidaRow[],
) {
  for await (const rowOrRows of worksheetReader) {
    for (const row of normalizeStreamingRows(rowOrRows)) {
      const description = normalizeCellText(row.getCell(1).value);
      const unit = normalizeCellText(row.getCell(2).value);
      const listedUnitPrice = parseSpreadsheetNumber(normalizeCellText(row.getCell(3).value));

      if (!description || !unit || isSeedPartidasHeaderDescription(description)) {
        continue;
      }

      partidas.push({ description, unit, listedUnitPrice });
    }
  }
}

function isSeedPartidasHeaderDescription(description: string) {
  const normalized = normalizeCatalogText(description);
  return normalized === "PARTIDA" || normalized === "PARTIDAS ADICIONALES";
}

async function readSeedApuSheet(
  worksheetReader: ExcelJS.stream.xlsx.WorksheetReader,
  catalog: Map<string, SeedPartidaApu>,
) {
  let currentPartida: SeedPartidaApu | null = null;
  let groupBuffer: SeedPartidaApuRow[] = [];
  let pendingTitle: string | null = null;

  function flushGroup(groupLabel: string | null) {
    if (!currentPartida || !groupBuffer.length) return;

    for (const row of groupBuffer) {
      row.groupLabel = groupLabel;
      row.resourceType = mapPartidaGroupToResourceType(groupLabel);
      row.sortOrder = currentPartida.apuRows.length;
      currentPartida.apuRows.push(row);
    }

    groupBuffer = [];
  }

  function commitCurrentPartida() {
    if (!currentPartida) return;
    flushGroup(null);
    catalog.set(currentPartida.matchKey, currentPartida);
  }

  for await (const rowOrRows of worksheetReader) {
    for (const row of normalizeStreamingRows(rowOrRows)) {
      const firstCellText = normalizeCellText(row.getCell(1).value);

      if (pendingTitle && /^Rendimiento:\s*/i.test(firstCellText)) {
        commitCurrentPartida();

        const unitText = normalizeCellText(row.getCell(3).value);
        const performanceMatch = firstCellText.match(/^Rendimiento:\s*([\d.,]+)\s+(.+)$/i);
        const performance = performanceMatch ? parseSpreadsheetNumber(performanceMatch[1]) : 1;
        const performanceRate = performanceMatch ? `${performanceMatch[1]} ${performanceMatch[2].trim()}` : null;
        const unit = unitText.replace(/^Unidad:\s*/i, "").trim() || null;
        const unitPrice = parseSpreadsheetNumber(normalizeCellText(row.getCell(6).value));

        currentPartida = {
          description: pendingTitle,
          matchKey: buildSeedPartidaMatchKey(pendingTitle, unit ?? ""),
          unit,
          unitPrice,
          performance,
          performanceUnit: unit,
          performanceRate,
          apuRows: [],
        };
        groupBuffer = [];
        pendingTitle = null;
        continue;
      }

      if (currentPartida) {
        const summaryLabel = normalizeCellText(row.getCell(5).value);
        if (summaryLabel.endsWith(":")) {
          flushGroup(summaryLabel.replace(/:$/, ""));
          pendingTitle = null;
          continue;
        }

        const detailDescription = firstCellText.replace(/^\s+/, "");
        const detailUnit = normalizeCellText(row.getCell(2).value);
        const hasNumbers =
          normalizeCellText(row.getCell(3).value) ||
          normalizeCellText(row.getCell(4).value) ||
          normalizeCellText(row.getCell(5).value) ||
          normalizeCellText(row.getCell(6).value);

        if (detailDescription && !/^Insumo$/i.test(detailDescription) && hasNumbers) {
          groupBuffer.push({
            description: detailDescription,
            unit: detailUnit,
            crew: parseOptionalSpreadsheetNumber(normalizeCellText(row.getCell(3).value)),
            quantity: parseSpreadsheetNumber(normalizeCellText(row.getCell(4).value)),
            unitPrice: parseSpreadsheetNumber(normalizeCellText(row.getCell(5).value)),
            subtotal: parseSpreadsheetNumber(normalizeCellText(row.getCell(6).value)),
            resourceType: null,
            groupLabel: null,
            resourceId: null,
            sortOrder: 0,
          });
          pendingTitle = null;
          continue;
        }
      }

      const hasOnlyFirstCell =
        Boolean(firstCellText) &&
        !normalizeCellText(row.getCell(2).value) &&
        !normalizeCellText(row.getCell(3).value) &&
        !normalizeCellText(row.getCell(4).value) &&
        !normalizeCellText(row.getCell(5).value) &&
        !normalizeCellText(row.getCell(6).value);

      if (hasOnlyFirstCell && normalizeCatalogText(firstCellText) !== "ANALISIS DE COSTOS UNITARIOS") {
        pendingTitle = firstCellText;
      }
    }
  }

  commitCurrentPartida();
}

function normalizeStreamingRows(rowOrRows: ExcelJS.Row | ExcelJS.Row[]) {
  return Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
}

function buildCategorySequenceMap(
  resources: Array<{ code: string; category: ResourceCategory }>,
) {
  const sequences = new Map<ResourceCategory, number>();

  for (const resource of resources) {
    const prefix = resourceCodePrefixes[resource.category];
    const match = resource.code.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) continue;

    const sequence = Number(match[1]);
    if (!Number.isFinite(sequence)) continue;

    sequences.set(resource.category, Math.max(sequences.get(resource.category) ?? 0, sequence));
  }

  return sequences;
}

function normalizeCatalogCategory(value: string): ResourceCategory {
  const normalized = value.trim().toLowerCase();

  if (normalized === "mano de obra") return ResourceCategory.LABOR;
  if (normalized === "equipo") return ResourceCategory.EQUIPMENT;
  if (normalized === "sub contrato" || normalized === "subcontrato" || normalized === "sub contratos" || normalized === "subcontratos") {
    return ResourceCategory.SUBCONTRACT;
  }
  return ResourceCategory.MATERIAL;
}

function normalizeCellText(value: ExcelJS.CellValue) {
  return normalizeExcelCellText(value);
}

function parseSpreadsheetNumber(value: string) {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return 0;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    return Number(trimmed.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".")) || 0;
  }

  if (lastComma !== -1) {
    return Number(trimmed.replaceAll(".", "").replace(",", ".")) || 0;
  }

  return Number(trimmed.replaceAll(",", "")) || 0;
}

function parseOptionalSpreadsheetNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return parseSpreadsheetNumber(trimmed);
}

function buildResourceKey(description: string, category: ResourceCategory, unit: string, iu: string | null) {
  return [description.trim().toUpperCase(), category, unit.trim().toUpperCase(), (iu ?? "").trim().toUpperCase()].join("|");
}

function buildResourceIdentityKey(description: string, category: ResourceCategory, unit: string) {
  return [description.trim().toUpperCase(), category, unit.trim().toUpperCase()].join("|");
}

function buildResourceDescriptionUnitKey(description: string, unit: string) {
  return [description.trim().toUpperCase(), unit.trim().toUpperCase()].join("|");
}

function normalizeSeedResourceIu(value: string) {
  const trimmed = value.trim();
  return trimmed === ":" ? "" : trimmed;
}

function buildResourceLookupKey(description: string, unit: string) {
  return [normalizeCatalogText(description), normalizeCatalogText(unit)].join("|");
}

function buildCanonicalResourceLookupKey(description: string, unit: string) {
  return [normalizeResourceDescription(description), normalizeUnitAlias(unit)].join("|");
}

function buildSeedPartidaMatchKey(description: string, unit: string) {
  return [normalizeStrictCatalogText(description), normalizeStrictCatalogText(unit)].join("|");
}

function buildStrictPartidaDuplicateKey(description: string, unit: string) {
  return [normalizeStrictCatalogText(description), normalizeStrictCatalogText(unit)].join("|");
}

function normalizeCatalogText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeStrictCatalogText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getCatalogTokens(value: string) {
  return normalizeCatalogText(value).split(" ").filter(Boolean);
}

function calculateLevenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex++) {
    const currentRow = [leftIndex + 1];

    for (let rightIndex = 0; rightIndex < right.length; rightIndex++) {
      const insertionCost = currentRow[rightIndex] + 1;
      const deletionCost = previousRow[rightIndex + 1] + 1;
      const substitutionCost = previousRow[rightIndex] + (left[leftIndex] === right[rightIndex] ? 0 : 1);

      currentRow.push(Math.min(insertionCost, deletionCost, substitutionCost));
    }

    previousRow = currentRow;
  }

  return previousRow[right.length];
}

function normalizeResourceDescription(value: string) {
  return normalizeCatalogText(value)
    .replace(/\bELECTRICO\b/g, "ELECTR")
    .replace(/\bELECTRICA\b/g, "ELECTR")
    .replace(/\bRECTANGULAR\b/g, "RECTANG")
    .replace(/\bGRADO 60\b/g, "")
    .replace(/\bS DISENO\b/g, "")
    .replace(/\bS DISENO\b/g, "")
    .replace(/\bF O G O\b/g, "FOGO")
    .replace(/\bFO GO\b/g, "FOGO")
    .replace(/\bBOLSA\b/g, "BLS")
    .replace(/\bBOL\b/g, "BLS")
    .replace(/\bPZA\b/g, "PZ")
    .replace(/\bUNIDAD\b/g, "UND")
    .replace(/\bX 3M\b/g, "")
    .replace(/\bDE\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnitAlias(value: string) {
  const normalized = normalizeCatalogText(value);

  if (["PZ", "PZA", "UND", "UNIDAD"].includes(normalized)) return "UND";
  if (["BLS", "BOL", "BOLSA"].includes(normalized)) return "BLS";
  if (["ML", "M"].includes(normalized)) return "ML";
  return normalized;
}

function buildResourceLookupIndexes(
  resources: Array<{ id: string; description: string; unit: string }>,
) {
  const exact = new Map<string, string>();
  const canonical = new Map<string, string[]>();
  const byUnit = new Map<string, Array<{ id: string; description: string; unit: string; canonicalDescription: string; tokens: string[] }>>();
  const byDescription = new Map<string, Array<{ id: string; description: string; unit: string; resourceType: string | null }>>();

  for (const resource of resources) {
    registerResourceLookupInternal(exact, canonical, byUnit, byDescription, resource.id, resource.description, resource.unit);
  }

  return { exact, canonical, byUnit, byDescription };
}

function registerResourceLookupInternal(
  exact: Map<string, string>,
  canonical: Map<string, string[]>,
  byUnit: Map<string, Array<{ id: string; description: string; unit: string; canonicalDescription: string; tokens: string[] }>>,
  byDescription: Map<string, Array<{ id: string; description: string; unit: string; resourceType: string | null }>>,
  id: string,
  description: string,
  unit: string,
) {
  exact.set(buildResourceLookupKey(description, unit), id);

  const canonicalDescription = normalizeResourceDescription(description);
  const canonicalUnit = normalizeUnitAlias(unit);
  const canonicalKey = buildCanonicalResourceLookupKey(description, unit);
  canonical.set(canonicalKey, [...(canonical.get(canonicalKey) ?? []), id]);

  const entry = {
    id,
    description,
    unit,
    canonicalDescription,
    tokens: canonicalDescription.split(" ").filter(Boolean),
  };

  byUnit.set(canonicalUnit, [...(byUnit.get(canonicalUnit) ?? []), entry]);
  byDescription.set(canonicalDescription, [...(byDescription.get(canonicalDescription) ?? []), { id, description, unit, resourceType: null }]);
}

function findResourceIdForApuRow(
  description: string,
  unit: string,
  indexes: ReturnType<typeof buildResourceLookupIndexes>,
) {
  if (!description || !unit) return null;

  const alias = resolveManualResourceAlias(description, unit);
  if (alias) {
    const aliasExact = indexes.exact.get(buildResourceLookupKey(alias.description, alias.unit));
    if (aliasExact) return aliasExact;
  }

  const exact = indexes.exact.get(buildResourceLookupKey(description, unit));
  if (exact) return exact;

  const canonicalKey = buildCanonicalResourceLookupKey(description, unit);
  const canonicalMatches = indexes.canonical.get(canonicalKey) ?? [];
  if (canonicalMatches.length >= 1) return canonicalMatches[0];

  const rowCanonicalDescription = normalizeResourceDescription(description);
  if (!rowCanonicalDescription || rowCanonicalDescription === "ANALISIS DE COSTOS UNITARIOS") return null;

  const rowTokens = rowCanonicalDescription.split(" ").filter(Boolean);
  const rowNumericTokens = rowTokens.filter((token) => /\d/.test(token));
  const unitCandidates = indexes.byUnit.get(normalizeUnitAlias(unit)) ?? [];

  const ranked = unitCandidates
    .map((candidate) => {
      if (rowNumericTokens.length > 0 && rowNumericTokens.some((token) => !candidate.tokens.includes(token))) {
        return null;
      }

      const overlap = rowTokens.filter((token) => candidate.tokens.includes(token)).length;
      if (overlap === 0) return null;

      return {
        id: candidate.id,
        overlap,
        score: overlap / rowTokens.length,
      };
    })
    .filter((candidate): candidate is { id: string; overlap: number; score: number } => candidate !== null)
    .sort((left, right) => right.score - left.score || right.overlap - left.overlap);

  const best = ranked[0];
  const second = ranked[1];

  if (!best) return null;
  if (best.score < 0.6) return null;
  if (second && best.score === second.score && best.overlap === second.overlap) return null;

  return best.id;
}

function resolveManualResourceAlias(description: string, unit: string) {
  const aliases: Record<string, { description: string; unit: string }> = {
    [`${normalizeResourceDescription("ACERO CORRUGADO F´Y = 4200 KG/CM2 GRADO 60")}|${normalizeUnitAlias("KG")}`]: {
      description: "ACERO CORRUGADO F'Y 4,200 KG/CM2",
      unit: "KG",
    },
    [`${normalizeResourceDescription('TUBO PVC C/CAMPANA SAL 3M. °  2"')}|${normalizeUnitAlias("UND")}`]: {
      description: 'TUBO PVC C/CAMPANA SAL 2" x 3M',
      unit: "UND",
    },
    [`${normalizeResourceDescription('TUBO PVC C/CAMPANA SAL 3M. °  4"')}|${normalizeUnitAlias("UND")}`]: {
      description: 'TUBO PVC C/CAMPANA SAL 4" x 3M',
      unit: "UND",
    },
    [`${normalizeResourceDescription("MOVILIZACION Y DESMOVILIZACION DE EQUIPOS")}|${normalizeUnitAlias("GLB")}`]: {
      description: "MOVILIZACION Y DESMOVILIZACION DE EQUIPOS",
      unit: "GLB",
    },
  };

  return aliases[`${normalizeResourceDescription(description)}|${normalizeUnitAlias(unit)}`] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalizeSeedResourceDescription(description: string) {
  const aliases: Record<string, string> = {
    [normalizeResourceDescription("ACERO CORRUGADO F´Y = 4200 KG/CM2 GRADO 60")]: "ACERO CORRUGADO F'Y 4,200 KG/CM2",
    [normalizeResourceDescription('CLAVOS C/C 3/4"')]: 'CLAVOS 3/4"',
    [normalizeResourceDescription('TUBO PVC C/CAMPANA SAL 3M. °  2"')]: 'TUBO PVC C/CAMPANA SAL 2" x 3M',
    [normalizeResourceDescription('TUBO PVC C/CAMPANA SAL 3M. °  4"')]: 'TUBO PVC C/CAMPANA SAL 4" x 3M',
  };

  return aliases[normalizeResourceDescription(description)] ?? description.trim();
}

function mapPartidaGroupToResourceType(groupLabel: string | null) {
  if (!groupLabel) return null;

  const normalized = normalizeCatalogText(groupLabel);
  if (normalized === "MANO DE OBRA") return "LABOR";
  if (normalized === "MATERIALES") return "MATERIAL";
  if (normalized === "EQUIPO") return "EQUIPMENT";
  if (normalized === "SUBCONTRATOS") return "SUBCONTRACT";
  if (isSubpartidaResourceType(normalized)) return SUBPARTIDA_RESOURCE_TYPE;
  return normalized;
}

async function findCatalogResource(description: string, category: ResourceCategory, unit: string) {
  const resource = await prisma.resource.findFirst({
    where: {
      companyId: null,
      description,
      category,
      unit,
    },
  });

  if (!resource) {
    throw new Error(`No se encontro el insumo base del catalogo: ${description}`);
  }

  return resource;
}

async function refreshBudgetTotals(budgetId: string) {
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    include: {
      levels: {
        orderBy: { sortOrder: "asc" },
      },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          apu: {
            include: {
              resources: true,
            },
          },
        },
      },
    },
  });

  if (!budget) return;

  const calculated = calculateBudgetRecord({
    id: budget.id,
    projectId: budget.projectId,
    parentBudgetId: budget.parentBudgetId,
    kind: budget.kind,
    name: budget.name,
    currency: budget.currency,
    igvRate: Number(budget.igvRate),
    generalExpensesRate: Number(budget.generalExpensesRate),
    utilityRate: Number(budget.utilityRate),
    totalDirectCost: Number(budget.totalDirectCost),
    totalGeneralExpenses: Number(budget.totalGeneralExpenses),
    totalUtility: Number(budget.totalUtility),
    totalTax: Number(budget.totalTax),
    totalAmount: Number(budget.totalAmount),
    levels: budget.levels.map((level) => ({
      id: level.id,
      budgetId: level.budgetId,
      parentId: level.parentId,
      type: level.type,
      code: level.code,
      name: level.name,
      sortOrder: level.sortOrder,
    })),
    items: budget.items.map((item) => ({
      id: item.id,
      budgetId: item.budgetId,
      levelId: item.levelId,
      code: item.code,
      description: item.description,
      unit: item.unit,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      partial: Number(item.partial),
      sortOrder: item.sortOrder,
      apu: item.apu
        ? {
            id: item.apu.id,
            budgetItemId: item.apu.budgetItemId,
            name: item.apu.name,
            unit: item.apu.unit,
            performance: Number(item.apu.performance),
            totalUnitCost: Number(item.apu.totalUnitCost),
            resources: item.apu.resources.map((resource) => ({
              id: resource.id,
              apuId: resource.apuId,
              resourceId: resource.resourceId,
              resourceType: resource.resourceType,
              quantity: Number(resource.quantity),
              unitPrice: Number(resource.unitPrice),
              subtotal: Number(resource.subtotal),
            })),
          }
        : null,
    })),
  });

  await prisma.budget.update({
    where: { id: budget.id },
    data: {
      totalDirectCost: calculated.totalDirectCost,
      totalGeneralExpenses: calculated.totalGeneralExpenses,
      totalUtility: calculated.totalUtility,
      totalTax: calculated.totalTax,
      totalAmount: calculated.totalAmount,
    },
  });
}

async function refreshGeneralBudgetTotals(generalBudgetId: string) {
  const generalBudget = await prisma.budget.findUnique({
    where: { id: generalBudgetId },
    include: {
      childBudgets: true,
    },
  });

  if (!generalBudget) return;

  const totals = generalBudget.childBudgets.reduce(
    (sum, budget) => ({
      totalDirectCost: sum.totalDirectCost + Number(budget.totalDirectCost),
      totalGeneralExpenses: sum.totalGeneralExpenses + Number(budget.totalGeneralExpenses),
      totalUtility: sum.totalUtility + Number(budget.totalUtility),
      totalTax: sum.totalTax + Number(budget.totalTax),
      totalAmount: sum.totalAmount + Number(budget.totalAmount),
    }),
    {
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
    },
  );

  await prisma.budget.update({
    where: { id: generalBudgetId },
    data: totals,
  });
}

const isSeedEntrypoint =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isSeedEntrypoint) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
