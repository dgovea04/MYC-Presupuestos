import { getStoredPackageContent } from "@/lib/data/stored-project-packages";
import { extractStoredZip } from "@/lib/mcp/archive";
import { normalizePartidaText } from "@/lib/partida-generation/text";
import type {
  McpBudgetBlueprint,
  McpSubBudgetBlueprint,
  McpBudgetLevelBlueprint,
  McpBudgetItemBlueprint,
  McpApuBlueprint,
  McpApuResourceBlueprint,
} from "./mcp-blueprint";

// ─── Public API ─────────────────────────────────────────────────────────────

export async function extractBudgetBlueprintFromStoredPackage(input: {
  packageId: string;
  userId: string;
}): Promise<McpBudgetBlueprint> {
  const content = await getStoredPackageContent(input.packageId, input.userId);
  const files = extractStoredZip(content);
  const readModule = (path: string) => {
    const fileContent = files.get(path);
    if (!fileContent) {
      throw new Error(`Módulo requerido no encontrado en .mcp: "${path}"`);
    }
    return JSON.parse(fileContent);
  };
  return extractBudgetBlueprintFromMcpModules({
    packageId: input.packageId,
    readModule,
  });
}

export function extractBudgetBlueprintFromMcpModules(input: {
  packageId: string;
  readModule: (path: string) => unknown;
}): McpBudgetBlueprint {
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // ── Parse manifest ───────────────────────────────────────────────────────
  const manifest = input.readModule("manifest.json") as {
    formatVersion: string;
    project: { name: string };
    checksums?: Record<string, string>;
  };

  // ── Parse project ────────────────────────────────────────────────────────
  const projectData = input.readModule("project.json") as {
    name: string;
    projectType?: string | null;
    location?: string | null;
    currency?: string;
  };

  // ── Parse budget tree ────────────────────────────────────────────────────
  const budgetTree = input.readModule("budgets/budget-tree.json") as {
    budgets: Array<{
      id: string;
      parentBudgetId: string | null;
      kind: string;
      name: string;
      currency: string;
      igvRate: string | number;
      generalExpensesRate: string | number;
      utilityRate: string | number;
    }>;
  };

  const generalBudget = budgetTree.budgets.find((b) => b.kind === "GENERAL");
  if (!generalBudget) {
    throw new Error("El .mcp no contiene un presupuesto general.");
  }

  // ── Parse budget items ───────────────────────────────────────────────────
  const budgetItemsData = input.readModule("budgets/budget-items.json") as {
    budgets: Array<{
      budgetId: string;
      budgetName: string;
      levels: Array<{
        id: string;
        parentId: string | null;
        type: string;
        code: string;
        name: string;
        sortOrder: number;
      }>;
      items: Array<{
        id: string;
        levelId: string | null;
        code: string;
        description: string;
        unit: string;
        quantity: string | number;
        unitPrice: string | number;
        partial: string | number;
        sortOrder: number;
      }>;
    }>;
  };

  // ── Parse project resources (optional for MVP) ────────────────────────────
  let projectResources: McpBudgetBlueprint["projectResources"] = [];

  try {
    const resourcesData = input.readModule("budgets/project-resources.json") as {
      resources: Array<{
        id: string;
        code: string;
        description: string;
        category: string;
        unit: string;
        currency: string;
        unitPrice: string | number;
        iu: string | null;
        iuCurrent: string | null;
      }>;
    };
    projectResources = resourcesData.resources.map((r) => ({
      id: r.id,
      code: r.code,
      description: r.description,
      category: r.category,
      unit: r.unit,
      currency: r.currency,
      unitPrice: String(r.unitPrice),
      iu: r.iu,
      iuCurrent: r.iuCurrent,
    }));
  } catch {
    warnings.push("No se encontraron project resources en el paquete .mcp (budgets/project-resources.json). Los insumos de los APU no tendrán referencia a la tabla Resource.");
  }

  // ── Parse APUs (optional for MVP) ────────────────────────────────────────
  let apuById: Map<
    string,
    {
      id: string;
      name: string;
      unit: string;
      performance: string | number;
      totalUnitCost: string | number;
      resources: Array<{
        id: string;
        resourceType: string;
        crew: string | number | null;
        quantity: string | number;
        unitPrice: string | number;
        subtotal: string | number;
        resourceDescription: string | null;
      }>;
    }
  > = new Map();

  try {
    const apusData = input.readModule("budgets/apus.json") as {
      apus: Array<{
        id: string;
        budgetItemId: string;
        name: string;
        unit: string;
        performance: string | number;
        totalUnitCost: string | number;
        resources: Array<{
          id: string;
          resourceId: string | null;
          resourceType: string;
          crew: string | number | null;
          quantity: string | number;
          unitPrice: string | number;
          subtotal: string | number;
          resourceDescription: string | null;
        }>;
      }>;
    };
    for (const apu of apusData.apus) {
      apuById.set(apu.budgetItemId, apu);
    }
  } catch {
    warnings.push("No se encontraron APUs en el paquete .mcp.");
  }

  // ── Build sub-budgets blueprint ─────────────────────────────────────────
  const itemsByBudgetId = new Map<string, (typeof budgetItemsData.budgets)[number]>();
  for (const budgetItems of budgetItemsData.budgets) {
    itemsByBudgetId.set(budgetItems.budgetId, budgetItems);
  }

  const subBudgets: McpSubBudgetBlueprint[] = [];

  for (const budgetNode of budgetTree.budgets) {
    if (budgetNode.kind !== "SUB_BUDGET") continue;

    const budgetItems = itemsByBudgetId.get(budgetNode.id);

    const levels: McpBudgetLevelBlueprint[] = (budgetItems?.levels ?? []).map(
      (level) => ({
        sourceLevelId: level.id,
        parentSourceLevelId: level.parentId ?? null,
        type: normalizeLevelType(level.type),
        code: level.code,
        name: level.name,
        sortOrder: level.sortOrder,
      }),
    );

    const items: McpBudgetItemBlueprint[] = (budgetItems?.items ?? []).map(
      (item) => {
        const apu = apuById.get(item.id);
        return {
          sourceItemId: item.id,
          sourceCode: item.code,
          description: item.description,
          normalizedDescription: normalizePartidaText(item.description),
          unit: item.unit,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          partial: String(item.partial),
          sortOrder: item.sortOrder,
          levelSourceId: item.levelId ?? null,
          apu: apu ? mapApuBlueprint(apu) : null,
        };
      },
    );

    subBudgets.push({
      sourceBudgetId: budgetNode.id,
      name: budgetNode.name,
      normalizedName: normalizePartidaText(budgetNode.name),
      currency: (budgetNode.currency === "USD" ? "USD" : "PEN") as "PEN" | "USD",
      igvRate: String(budgetNode.igvRate),
      generalExpensesRate: String(budgetNode.generalExpensesRate),
      utilityRate: String(budgetNode.utilityRate),
      levels,
      items,
    });
  }

  if (subBudgets.length === 0) {
    throw new Error("El .mcp no contiene sub-presupuestos.");
  }

  return {
    sourcePackageId: input.packageId,
    sourceProjectName: manifest.project.name,
    sourceFormatVersion: manifest.formatVersion,
    projectType: projectData.projectType ?? null,
    confidence: 1,
    assumptions,
    warnings,
    subBudgets,
    projectResources,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeLevelType(type: string): McpBudgetLevelBlueprint["type"] {
  const upper = type.toUpperCase();
  if (upper === "TITLE") return "TITLE";
  if (upper === "SUBTITLE") return "SUBTITLE";
  if (upper === "ITEM_GROUP") return "ITEM_GROUP";
  if (upper === "SUBITEM") return "SUBITEM";
  return "TITLE"; // default fallback
}

function mapApuBlueprint(apu: {
  name: string;
  unit: string;
  performance: string | number;
  totalUnitCost: string | number;
  resources: Array<{
    id: string;
    resourceType: string;
    crew: string | number | null;
    quantity: string | number;
    unitPrice: string | number;
    subtotal: string | number;
    resourceDescription: string | null;
  }>;
}): McpApuBlueprint {
  return {
    name: apu.name,
    unit: apu.unit,
    performance: String(apu.performance),
    totalUnitCost: String(apu.totalUnitCost),
    resources: apu.resources.map(mapApuResourceBlueprint),
  };
}

function mapApuResourceBlueprint(resource: {
  resourceType: string;
  crew: string | number | null;
  quantity: string | number;
  unitPrice: string | number;
  subtotal: string | number;
  resourceDescription: string | null;
  resourceId?: string | null;
}): McpApuResourceBlueprint {
  return {
    resourceType: resource.resourceType,
    crew: resource.crew != null ? String(resource.crew) : null,
    quantity: String(resource.quantity),
    unitPrice: String(resource.unitPrice),
    subtotal: String(resource.subtotal),
    resourceDescription: resource.resourceDescription ?? null,
    resourceSourceId: resource.resourceId ?? null,
  };
}
