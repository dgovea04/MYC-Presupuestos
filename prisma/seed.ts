import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import { PrismaClient, ProjectStatus, ResourceCategory } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { calculateBudgetRecord } from "@/lib/calculations/budget";
import { loadUnifiedIndexWorkbook } from "@/lib/polynomial-formula/index-source";
import { buildUnifiedIndexSeedPayload } from "@/lib/polynomial-formula/unified-index-seed";

const prisma = new PrismaClient();
const UNIFIED_INDEX_WORKBOOK_PATH = path.resolve(
  process.cwd(),
  "presupuesto-ejemplo",
  "formula-polinomica",
  "07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx",
);

const resourceCodePrefixes: Record<ResourceCategory, string> = {
  MATERIAL: "MAT",
  LABOR: "MO",
  EQUIPMENT: "EQ",
  TOOLS: "HER",
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

  if (!existingDemoUserCompany) {
    await prisma.company.create({
      data: {
        userId: demoUser.id,
        name: "Constructora Demo",
        ruc: "20987654321",
      },
    });
  }

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

  await seedGeneralResourcesCatalog();
  await seedGeneralPartidasCatalog();
  await seedUnifiedIndicesFromWorkbook();

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
}

async function seedMembershipPlans() {
  const plans = [
    { name: "Starter", slug: "starter", monthlyTokenLimit: 100000 },
    { name: "Pro", slug: "pro", monthlyTokenLimit: 500000 },
    { name: "Empresa", slug: "empresa", monthlyTokenLimit: 2000000 },
  ];

  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        monthlyTokenLimit: plan.monthlyTokenLimit,
        isActive: true,
      },
      create: plan,
    });
  }
}

async function seedGeneralResourcesCatalog() {
  const workbook = new ExcelJS.Workbook();
  const catalogPath = path.join(process.cwd(), "presupuesto-ejemplo", "Listado de Insumos General.xlsx");
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
  const sequencesByCategory = buildCategorySequenceMap(existingGlobalResources);

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const description = normalizeCellText(row.getCell(2).value);
    const unit = normalizeCellText(row.getCell(3).value);
    const unitPrice = parseSpreadsheetNumber(normalizeCellText(row.getCell(4).value));
    const category = normalizeCatalogCategory(normalizeCellText(row.getCell(5).value));
    const iu = normalizeCellText(row.getCell(6).value);

    if (!description || !unit) {
      continue;
    }

    const key = buildResourceKey(description, category, unit, iu);
    const existingResource = existingResourcesByKey.get(key);
    if (existingResource) {
      const nextData = {
        description,
        category,
        iu: iu || null,
        subcategory: null,
        unit,
        unitPrice,
        currency: "PEN",
        source: "Catalogo general precargado",
      };

      const shouldUpdate =
        existingResource.description !== nextData.description ||
        existingResource.category !== nextData.category ||
        existingResource.iu !== nextData.iu ||
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

    const nextSequence = (sequencesByCategory.get(category) ?? 0) + 1;
    sequencesByCategory.set(category, nextSequence);

    const createdResource = await prisma.resource.create({
      data: {
        companyId: null,
        code: `${resourceCodePrefixes[category]}-${String(nextSequence).padStart(3, "0")}`,
        description,
        category,
        iu: iu || null,
        subcategory: null,
        unit,
        unitPrice,
        currency: "PEN",
        source: "Catalogo general precargado",
      },
    });

    existingResourcesByKey.set(key, createdResource);
  }
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
  normalizedDescription: string;
  unit: string | null;
  unitPrice: number;
  performance: number;
  performanceUnit: string | null;
  performanceRate: string | null;
  apuRows: SeedPartidaApuRow[];
};

async function seedGeneralPartidasCatalog() {
  const catalogWorkbook = new ExcelJS.Workbook();
  const catalogPath = path.join(process.cwd(), "presupuesto-ejemplo", "Catalogo de partidas.xlsx");
  await catalogWorkbook.xlsx.readFile(catalogPath);

  const catalogWorksheet = catalogWorkbook.worksheets[0];
  const apuByDescription = await buildPartidaApuCatalog();
  const resources = await prisma.resource.findMany({
    where: { companyId: null },
    select: {
      id: true,
      code: true,
      description: true,
      unit: true,
      category: true,
      iu: true,
    },
  });
  const resourceLookup = buildResourceLookupIndexes(resources);
  const resourceSequences = buildCategorySequenceMap(resources);
  const existingPartidas = await prisma.catalogPartida.findMany({
    include: {
      apuRows: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  await seedMissingResourcesFromPartidasApu(apuByDescription, resourceLookup, resourceSequences);
  const refreshedResources = await prisma.resource.findMany({
    where: { companyId: null },
    select: {
      id: true,
      description: true,
      unit: true,
      category: true,
      iu: true,
      code: true,
    },
  });
  const refreshedLookup = buildResourceLookupIndexes(refreshedResources);

  const existingPartidasByKey = new Map(
    existingPartidas.map((partida) => [buildPartidaKey(partida.description, partida.unit), partida]),
  );

  for (let rowNumber = 2; rowNumber <= catalogWorksheet.rowCount; rowNumber++) {
    const row = catalogWorksheet.getRow(rowNumber);
    const description = normalizeCellText(row.getCell(1).value);
    const unit = normalizeCellText(row.getCell(2).value);
    const listedUnitPrice = parseSpreadsheetNumber(normalizeCellText(row.getCell(3).value));

    if (!description || !unit) {
      continue;
    }

    const partidaApu = apuByDescription.get(normalizeCatalogText(description));
    const apuRows =
      partidaApu?.apuRows.map((apuRow, index) => ({
        resourceId: findResourceIdForApuRow(apuRow.description, apuRow.unit, refreshedLookup),
        description: apuRow.description,
        unit: apuRow.unit,
        crew: apuRow.crew,
        quantity: apuRow.quantity,
        unitPrice: apuRow.unitPrice,
        subtotal: apuRow.subtotal,
        resourceType: apuRow.resourceType,
        groupLabel: apuRow.groupLabel,
        sortOrder: index,
      })) ?? [];

    const performance = partidaApu?.performance ?? 1;
    const performanceUnit = partidaApu?.performanceUnit ?? unit;
    const performanceRate = partidaApu?.performanceRate ?? (performanceUnit ? `${performance.toFixed(4)} ${performanceUnit}/DIA` : null);
    const unitPrice = apuRows.length ? apuRows.reduce((sum, apuRow) => sum + apuRow.subtotal, 0) : listedUnitPrice;
    const existingPartida = existingPartidasByKey.get(buildPartidaKey(description, unit));

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
            create: apuRows,
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
          create: apuRows,
        },
      },
    });
  }
}

async function seedMissingResourcesFromPartidasApu(
  apuByDescription: Map<string, SeedPartidaApu>,
  resourceLookup: ReturnType<typeof buildResourceLookupIndexes>,
  resourceSequences: Map<ResourceCategory, number>,
) {
  const uniqueRows = new Map<
    string,
    { description: string; unit: string; unitPrice: number; resourceType: string | null; groupLabel: string | null }
  >();

  for (const partida of apuByDescription.values()) {
    for (const row of partida.apuRows) {
      if (!row.description || !row.unit) continue;
      if (findResourceIdForApuRow(row.description, row.unit, resourceLookup)) continue;

      const key = buildCanonicalResourceLookupKey(row.description, row.unit);
      if (!uniqueRows.has(key)) {
        uniqueRows.set(key, {
          description: row.description,
          unit: row.unit,
          unitPrice: row.unitPrice,
          resourceType: row.resourceType,
          groupLabel: row.groupLabel,
        });
      }
    }
  }

  for (const row of uniqueRows.values()) {
    if (!shouldAutocreateResourceFromApuRow(row.description, row.unit)) continue;

    const category = inferResourceCategoryFromDescription(row.description, row.resourceType ?? row.groupLabel);
    const nextSequence = (resourceSequences.get(category) ?? 0) + 1;
    resourceSequences.set(category, nextSequence);

    const created = await prisma.resource.create({
      data: {
        companyId: null,
        code: `${resourceCodePrefixes[category]}-${String(nextSequence).padStart(3, "0")}`,
        description: normalizeSeedResourceDescription(row.description),
        category,
        iu: null,
        subcategory: null,
        unit: normalizeSeedResourceUnit(row.unit),
        unitPrice: row.unitPrice,
        currency: "PEN",
        source: "Autocreado desde APU del catalogo de partidas",
      },
    });

    registerResourceLookup(resourceLookup, created.id, created.description, created.unit);
  }
}

async function buildPartidaApuCatalog() {
  const workbook = new ExcelJS.Workbook();
  const exampleDir = path.join(process.cwd(), "presupuesto-ejemplo");
  const preferredFileName = "analisis-de-costos-unitarios.xlsx";
  const fileName =
    fs.readdirSync(exampleDir).find((entry) => entry.toLowerCase() === preferredFileName) ??
    fs.readdirSync(exampleDir).find((entry) => normalizeCatalogText(entry).includes("ANALISIS DE COSTOS UNITARIOS"));

  if (!fileName) {
    throw new Error("No se encontro el archivo de Analisis de Costos Unitarios dentro de presupuesto-ejemplo");
  }

  const apuPath = path.join(exampleDir, fileName);
  await workbook.xlsx.readFile(apuPath);

  const worksheet = workbook.worksheets[0];
  const catalog = new Map<string, SeedPartidaApu>();
  let currentPartida: SeedPartidaApu | null = null;
  let groupBuffer: SeedPartidaApuRow[] = [];

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
    catalog.set(currentPartida.normalizedDescription, currentPartida);
  }

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const titleText = normalizeCellText(row.getCell(1).value);
    const titleMatch = titleText.match(/^\d+(?:\.\d+)+\s+(.+)$/);

    if (titleMatch) {
      commitCurrentPartida();

      const description = titleMatch[1].trim();
      const performanceLine = worksheet.getRow(rowNumber + 1);
      const performanceText = normalizeCellText(performanceLine.getCell(1).value);
      const unitText = normalizeCellText(performanceLine.getCell(3).value);
      const performanceMatch = performanceText.match(/^Rendimiento:\s*([\d.,]+)\s+(.+)$/i);
      const performance = performanceMatch ? parseSpreadsheetNumber(performanceMatch[1]) : 1;
      const performanceRate = performanceMatch ? `${performanceMatch[1]} ${performanceMatch[2].trim()}` : null;
      const unit = unitText.replace(/^Unidad:\s*/i, "").trim() || null;
      const unitPrice = parseSpreadsheetNumber(normalizeCellText(performanceLine.getCell(6).value));

      currentPartida = {
        description,
        normalizedDescription: normalizeCatalogText(description),
        unit,
        unitPrice,
        performance,
        performanceUnit: unit,
        performanceRate,
        apuRows: [],
      };
      groupBuffer = [];
      continue;
    }

    if (!currentPartida) {
      continue;
    }

    const summaryLabel = normalizeCellText(row.getCell(5).value);
    if (summaryLabel.endsWith(":")) {
      flushGroup(summaryLabel.replace(/:$/, ""));
      continue;
    }

    const detailDescription = normalizeCellText(row.getCell(1).value).replace(/^\s+/, "");
    const detailUnit = normalizeCellText(row.getCell(2).value);
    const hasNumbers =
      normalizeCellText(row.getCell(3).value) ||
      normalizeCellText(row.getCell(4).value) ||
      normalizeCellText(row.getCell(5).value) ||
      normalizeCellText(row.getCell(6).value);

    if (!detailDescription || /^Insumo$/i.test(detailDescription) || !hasNumbers) {
      continue;
    }

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
  }

  commitCurrentPartida();
  return catalog;
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
  return ResourceCategory.MATERIAL;
}

function normalizeCellText(value: ExcelJS.CellValue) {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }

  return String(value).trim();
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

function buildResourceLookupKey(description: string, unit: string) {
  return [normalizeCatalogText(description), normalizeCatalogText(unit)].join("|");
}

function buildCanonicalResourceLookupKey(description: string, unit: string) {
  return [normalizeResourceDescription(description), normalizeUnitAlias(unit)].join("|");
}

function buildPartidaKey(description: string, unit: string) {
  return [normalizeCatalogText(description), normalizeCatalogText(unit)].join("|");
}

function normalizeCatalogText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
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

function registerResourceLookup(
  lookup: ReturnType<typeof buildResourceLookupIndexes>,
  id: string,
  description: string,
  unit: string,
) {
  registerResourceLookupInternal(lookup.exact, lookup.canonical, lookup.byUnit, lookup.byDescription, id, description, unit);
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

function shouldAutocreateResourceFromApuRow(description: string, unit: string) {
  const normalizedDescription = normalizeResourceDescription(description);
  const normalizedUnit = normalizeUnitAlias(unit);

  if (!normalizedDescription || normalizedDescription === "ANALISIS DE COSTOS UNITARIOS") return false;
  if (!normalizedUnit) return false;
  return true;
}

function normalizeSeedResourceDescription(description: string) {
  const aliases: Record<string, string> = {
    [normalizeResourceDescription("ACERO CORRUGADO F´Y = 4200 KG/CM2 GRADO 60")]: "ACERO CORRUGADO F'Y 4,200 KG/CM2",
    [normalizeResourceDescription('CLAVOS C/C 3/4"')]: 'CLAVOS 3/4"',
    [normalizeResourceDescription('TUBO PVC C/CAMPANA SAL 3M. °  2"')]: 'TUBO PVC C/CAMPANA SAL 2" x 3M',
    [normalizeResourceDescription('TUBO PVC C/CAMPANA SAL 3M. °  4"')]: 'TUBO PVC C/CAMPANA SAL 4" x 3M',
  };

  return aliases[normalizeResourceDescription(description)] ?? description.trim();
}

function normalizeSeedResourceUnit(unit: string) {
  const normalized = normalizeUnitAlias(unit);
  if (normalized === "UND") return "UND";
  if (normalized === "BLS") return "BLS";
  if (normalized === "ML") return "ML";
  return unit.trim();
}

function inferResourceCategoryFromDescription(description: string, resourceType: string | null | undefined): ResourceCategory {
  const normalizedType = normalizeCatalogText(resourceType ?? "");
  if (normalizedType === "LABOR" || normalizedType === "MANO DE OBRA") return ResourceCategory.LABOR;
  if (normalizedType === "EQUIPMENT" || normalizedType === "EQUIPO" || normalizedType === "SUBCONTRACT" || normalizedType === "SUBCONTRATOS") {
    return ResourceCategory.EQUIPMENT;
  }

  const normalizedDescription = normalizeResourceDescription(description);
  if (normalizedDescription.includes("HERRAMIENTAS")) return ResourceCategory.TOOLS;
  return ResourceCategory.MATERIAL;
}

function mapPartidaGroupToResourceType(groupLabel: string | null) {
  if (!groupLabel) return null;

  const normalized = normalizeCatalogText(groupLabel);
  if (normalized === "MANO DE OBRA") return "LABOR";
  if (normalized === "MATERIALES") return "MATERIAL";
  if (normalized === "EQUIPO") return "EQUIPMENT";
  if (normalized === "SUBCONTRATOS") return "SUBCONTRACT";
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
