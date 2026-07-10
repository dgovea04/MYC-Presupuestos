/**
 * Minimal fixture for testing MCP import/export flows.
 * Represents the smallest valid .mcp package structure.
 */
import { buildStoredZip } from "@/lib/mcp/archive";
import { createSha256Checksums } from "@/lib/mcp/checksums";
import { createMcpManifest } from "@/lib/mcp/manifest";
import type { McpModuleId } from "@/lib/mcp/types";

function buildManifestFiles() {
  const projectJson = JSON.stringify(
    {
      id: "project-1",
      name: "Proyecto de prueba",
      clientName: null,
      location: null,
      projectType: null,
      startDate: null,
      endDate: null,
      status: "PLANNING",
      currency: "PEN",
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  const budgetTreeJson = JSON.stringify(
    {
      budgets: [
        {
          id: "budget-g-1",
          parentBudgetId: null,
          kind: "GENERAL",
          name: "Presupuesto General",
          currency: "PEN",
          igvRate: "0.1800",
          generalExpensesRate: "0.1000",
          utilityRate: "0.0800",
          totalDirectCost: "0",
          totalGeneralExpenses: "0",
          totalUtility: "0",
          totalTax: "0",
          totalAmount: "0",
        },
      ],
    },
    null,
    2,
  );

  const budgetItemsJson = JSON.stringify({ budgets: [] }, null, 2);
  const apusJson = JSON.stringify({ apus: [] }, null, 2);

  const rawFiles: Array<{ path: string; content: string }> = [
    { path: "project.json", content: projectJson },
    { path: "budgets/budget-tree.json", content: budgetTreeJson },
    { path: "budgets/budget-items.json", content: budgetItemsJson },
    { path: "budgets/apus.json", content: apusJson },
    { path: "budgets/general-expenses.json", content: JSON.stringify({ generalExpenses: [] }) },
    { path: "budgets/footer.json", content: JSON.stringify({ footers: [] }) },
    { path: "polynomial-formula/formula.json", content: JSON.stringify({ formula: null }) },
    { path: "takeoffs/sheets.json", content: JSON.stringify({ sheets: [] }) },
    { path: "schedule/work-schedule.json", content: JSON.stringify({ schedule: null }) },
    { path: "risk/risk-analysis.json", content: JSON.stringify({ variables: [], correlations: [], simulationRuns: [] }) },
  ];

  const checksums = createSha256Checksums(rawFiles);

  const modules: Array<{ id: McpModuleId; path: string; required: boolean }> = [
    { id: "project", path: "project.json", required: true },
    { id: "budgets", path: "budgets/budget-tree.json", required: true },
    { id: "budget_items", path: "budgets/budget-items.json", required: true },
    { id: "apus", path: "budgets/apus.json", required: true },
    { id: "general_expenses", path: "budgets/general-expenses.json", required: false },
    { id: "budget_footer", path: "budgets/footer.json", required: false },
    { id: "polynomial_formula", path: "polynomial-formula/formula.json", required: false },
    { id: "risk_analysis", path: "risk/risk-analysis.json", required: false },
    { id: "takeoffs", path: "takeoffs/sheets.json", required: false },
    { id: "work_schedule", path: "schedule/work-schedule.json", required: false },
    { id: "project_resources", path: "budgets/project-resources.json", required: false },
  ];

  const manifest = createMcpManifest({
    projectId: "project-1",
    projectName: "Proyecto de prueba",
    appVersion: "0.1.0",
    currency: "PEN",
    modules,
    checksums,
  });

  rawFiles.push({ path: "checksums/sha256.json", content: JSON.stringify(checksums, null, 2) });
  rawFiles.unshift({ path: "manifest.json", content: JSON.stringify(manifest, null, 2) });

  return { manifest, rawFiles };
}

export function buildMinimalProjectPackageBuffer(): Buffer {
  const { rawFiles } = buildManifestFiles();

  return buildStoredZip(
    rawFiles.map((file) => ({
      fileName: file.path,
      content: file.content,
    })),
  );
}

export function buildMinimalProjectPackageManifest() {
  return buildManifestFiles().manifest;
}
