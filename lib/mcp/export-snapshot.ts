import { getProjectForPackageExport } from "@/lib/data/projects";
import type { McpProjectPackageSnapshot } from "./types";
import type { McpModuleId } from "./types";
import { createMcpManifest, buildMcpFileName } from "./manifest";
import { createSha256Checksums } from "./checksums";
import { buildStoredZip } from "./archive";
import { serializeProject } from "./serializers/project";
import { serializeBudgetTree } from "./serializers/budgets";
import { serializeBudgetItems } from "./serializers/apus";
import { serializePolynomialFormula } from "./serializers/polynomial-formula";

export async function buildProjectPackageSnapshot(
  projectId: string,
  userId: string,
): Promise<McpProjectPackageSnapshot> {
  const project = await getProjectForPackageExport(projectId, userId);

  if (!project) {
    throw new Error("Proyecto no encontrado o no tienes acceso.");
  }

  const appVersion = getAppVersion();

  const projectJson = serializeProject({
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    location: project.location,
    projectType: project.projectType,
    startDate: project.startDate,
    endDate: project.endDate,
    status: project.status,
    currency: project.budgets[0]?.currency ?? "PEN",
  });

  const budgetTree = serializeBudgetTree(
    project.budgets.map((budget) => ({
      id: budget.id,
      parentBudgetId: budget.parentBudgetId,
      kind: budget.kind,
      name: budget.name,
      currency: budget.currency,
      igvRate: budget.igvRate,
      generalExpensesRate: budget.generalExpensesRate,
      utilityRate: budget.utilityRate,
      totalDirectCost: budget.totalDirectCost,
      totalGeneralExpenses: budget.totalGeneralExpenses,
      totalUtility: budget.totalUtility,
      totalTax: budget.totalTax,
      totalAmount: budget.totalAmount,
    })),
  );

  const budgetItemsJson = serializeBudgetItems(
    project.budgets
      .filter((budget) => budget.kind === "SUB_BUDGET")
      .map((budget) => ({
        id: budget.id,
        name: budget.name,
        levels: budget.levels.map((level) => ({
          id: level.id,
          parentId: level.parentId,
          type: level.type,
          code: level.code,
          name: level.name,
          sortOrder: level.sortOrder,
        })),
        items: budget.items.map((item) => ({
          id: item.id,
          levelId: item.levelId,
          code: item.code,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          partial: item.partial,
          sortOrder: item.sortOrder,
        })),
      })),
  );

  // Collect APU data from all budgets
  const apusData = project.budgets
    .filter((budget) => budget.kind === "SUB_BUDGET")
    .flatMap((budget) =>
      budget.items
        .filter((item) => item.apu)
        .map((item) => ({
          id: item.apu!.id,
          budgetItemId: item.apu!.budgetItemId,
          name: item.apu!.name,
          unit: item.apu!.unit,
          performance: item.apu!.performance,
          totalUnitCost: item.apu!.totalUnitCost,
          resources: item.apu!.resources.map((res) => ({
            id: res.id,
            resourceId: res.resourceId,
            resourceType: res.resourceType,
            crew: res.crew,
            quantity: res.quantity,
            unitPrice: res.unitPrice,
            subtotal: res.subtotal,
            resourceDescription: res.resource?.description ?? null,
          })),
        })),
    );

  const apusJson = JSON.stringify({ apus: apusData }, null, 2);

  // Serialize general expenses
  const generalExpensesData = project.budgets
    .filter((budget) => budget.kind === "SUB_BUDGET")
    .map((budget) => ({
      budgetId: budget.id,
      budgetName: budget.name,
      groups: budget.generalExpenseGroups.map((group) => ({
        id: group.id,
        name: group.name,
        kind: group.kind,
        titles: group.titles.map((title) => ({
          id: title.id,
          code: title.code,
          name: title.name,
          category: title.category,
          items: title.items.map((item) => ({
            id: item.id,
            code: item.code,
            description: item.description,
            category: item.category,
            unit: item.unit,
            quantity: item.quantity,
            participationPercentage: item.participationPercentage,
            unitPrice: item.unitPrice,
            sortOrder: item.sortOrder,
          })),
        })),
      })),
    }));

  const generalExpensesJson = JSON.stringify({ generalExpenses: generalExpensesData }, null, 2);

  // Serialize footer rows
  const footerData = project.budgets
    .filter((budget) => budget.kind === "SUB_BUDGET")
    .map((budget) => ({
      budgetId: budget.id,
      budgetName: budget.name,
      rows: budget.footerRows.map((row) => ({
        id: row.id,
        variable: row.variable,
        description: row.description,
        formula: row.formula,
        manualValue: row.manualValue,
        iu: row.iu,
        highlight: row.highlight,
        sortOrder: row.sortOrder,
      })),
    }));

  const footerJson = JSON.stringify({ footers: footerData }, null, 2);

  // Serialize polynomial formula
  const firstFormula = project.polynomialFormulas[0];
  const formulaJson = JSON.stringify(
    serializePolynomialFormula(
      firstFormula
        ? {
            id: firstFormula.id,
            budgetId: firstFormula.budgetId,
            name: firstFormula.name,
            baseMonth: firstFormula.baseMonth,
            baseYear: firstFormula.baseYear,
            totalBaseAmount: firstFormula.totalBaseAmount,
            status: firstFormula.status,
            monomials: firstFormula.monomials.map((monomial) => ({
              id: monomial.id,
              code: monomial.code,
              name: monomial.name,
              costGroupKey: monomial.costGroupKey,
              amount: monomial.amount,
              coefficient: monomial.coefficient,
              baseIndexCode: monomial.baseIndexCode,
              baseIndexName: monomial.baseIndexName,
              baseIndexValue: monomial.baseIndexValue,
              adjustmentIndexCode: monomial.adjustmentIndexCode,
              adjustmentIndexName: monomial.adjustmentIndexName,
              adjustmentIndexValue: monomial.adjustmentIndexValue,
              sortOrder: monomial.sortOrder,
              components: monomial.components.map((component) => ({
                id: component.id,
                budgetItemId: component.budgetItemId,
                apuResourceId: component.apuResourceId,
                resourceType: component.resourceType,
                amount: component.amount,
              })),
            })),
          }
        : null,
    ),
    null,
    2,
  );

  // Build files list
  const rawFiles: Array<{ path: string; content: string }> = [
    { path: "project.json", content: JSON.stringify(projectJson, null, 2) },
    { path: "budgets/budget-tree.json", content: JSON.stringify(budgetTree, null, 2) },
    { path: "budgets/budget-items.json", content: JSON.stringify(budgetItemsJson, null, 2) },
    { path: "budgets/apus.json", content: apusJson },
    { path: "budgets/general-expenses.json", content: generalExpensesJson },
    { path: "budgets/footer.json", content: footerJson },
    { path: "polynomial-formula/formula.json", content: formulaJson },
    { path: "takeoffs/sheets.json", content: JSON.stringify({ sheets: [] }) },
    { path: "schedule/work-schedule.json", content: JSON.stringify({ schedule: null }) },
    { path: "risk/risk-analysis.json", content: JSON.stringify({ variables: [], correlations: [], simulationRuns: [] }) },
  ];

  // Collect all modules for manifest
  const manifestModules: Array<{ id: McpModuleId; path: string; required: boolean }> = [
    { id: "project", path: "project.json", required: true },
    { id: "budgets", path: "budgets/budget-tree.json", required: true },
    { id: "budget_items", path: "budgets/budget-items.json", required: true },
    { id: "apus", path: "budgets/apus.json", required: true },
    { id: "general_expenses", path: "budgets/general-expenses.json", required: false },
    { id: "budget_footer", path: "budgets/footer.json", required: false },
    { id: "polynomial_formula", path: "polynomial-formula/formula.json", required: false },
    { id: "project_resources", path: "budgets/project-resources.json", required: false },
    { id: "risk_analysis", path: "risk/risk-analysis.json", required: false },
    { id: "takeoffs", path: "takeoffs/sheets.json", required: false },
    { id: "work_schedule", path: "schedule/work-schedule.json", required: false },
  ];

  const checksums = createSha256Checksums(rawFiles);

  const manifest = createMcpManifest({
    projectId: project.id,
    projectName: project.name,
    appVersion,
    currency: project.budgets[0]?.currency ?? "PEN",
    modules: manifestModules,
    checksums,
  });

  // Add checksums file and manifest
  rawFiles.push({ path: "checksums/sha256.json", content: JSON.stringify(checksums, null, 2) });
  rawFiles.unshift({ path: "manifest.json", content: JSON.stringify(manifest, null, 2) });

  return {
    manifest,
    files: rawFiles.map((file) => ({
      fileName: file.path,
      content: file.content,
    })),
  };
}

export function buildProjectPackageArchive(
  snapshot: McpProjectPackageSnapshot,
): { content: Buffer; fileName: string } {
  // convert McpArchiveEntry[] to the format expected by buildStoredZip
  const entries = snapshot.files.map((entry) => ({
    fileName: entry.fileName,
    content: entry.content,
  }));
  const content = buildStoredZip(entries);
  const fileName = buildMcpFileName(snapshot.manifest.project.name);

  return { content, fileName };
}

export function getAppVersion(): string {
  return "0.1.0";
}


