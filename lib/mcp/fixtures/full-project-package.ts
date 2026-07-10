/**
 * Full fixture for MCP roundtrip testing.
 * Contains a complete project with budgets, items, APUs, and formula polinomica.
 */
import { buildStoredZip } from "@/lib/mcp/archive";
import { createSha256Checksums } from "@/lib/mcp/checksums";
import { createMcpManifest } from "@/lib/mcp/manifest";
import type { McpModuleId } from "@/lib/mcp/types";

export function buildFullProjectPackageBuffer(): Buffer {
  const projectJson = JSON.stringify(
    {
      id: "project-full-1",
      name: "Hospital Norte",
      clientName: "Gobierno Regional",
      location: "Lima, Peru",
      projectType: "Edificacion",
      startDate: "2026-01-15T00:00:00.000Z",
      endDate: "2027-06-30T00:00:00.000Z",
      status: "IN_PROGRESS",
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
          id: "budget-full-g",
          parentBudgetId: null,
          kind: "GENERAL",
          name: "Presupuesto General",
          currency: "PEN",
          igvRate: "0.1800",
          generalExpensesRate: "0.1000",
          utilityRate: "0.0800",
          totalDirectCost: "1500000.0000",
          totalGeneralExpenses: "150000.0000",
          totalUtility: "120000.0000",
          totalTax: "318600.0000",
          totalAmount: "2088600.0000",
        },
        {
          id: "budget-full-1",
          parentBudgetId: "budget-full-g",
          kind: "SUB_BUDGET",
          name: "Estructuras",
          currency: "PEN",
          igvRate: "0.1800",
          generalExpensesRate: "0.1000",
          utilityRate: "0.0800",
          totalDirectCost: "800000.0000",
          totalGeneralExpenses: "80000.0000",
          totalUtility: "64000.0000",
          totalTax: "169920.0000",
          totalAmount: "1113920.0000",
        },
      ],
    },
    null,
    2,
  );

  const budgetItemsJson = JSON.stringify(
    {
      budgets: [
        {
          budgetId: "budget-full-1",
          budgetName: "Estructuras",
          levels: [
            {
              id: "level-1",
              parentId: null,
              type: "TITLE",
              code: "01",
              name: "Estructuras",
              sortOrder: 1,
            },
          ],
          items: [
            {
              id: "item-1",
              levelId: "level-1",
              code: "01.01",
              description: "Concreto f'c=210 kg/cm2",
              unit: "m3",
              quantity: "125.5000",
              unitPrice: "450.7500",
              partial: "56569.1250",
              sortOrder: 1,
            },
          ],
        },
      ],
    },
    null,
    2,
  );

  const apusJson = JSON.stringify(
    {
      apus: [
        {
          id: "apu-1",
          budgetItemId: "item-1",
          name: "Concreto f'c=210 kg/cm2",
          unit: "m3",
          performance: "25.0000",
          totalUnitCost: "450.7500",
          resources: [
            {
              id: "apu-res-1",
              resourceId: "res-1",
              resourceType: "MATERIAL",
              crew: null,
              quantity: "1.0500",
              unitPrice: "280.0000",
              subtotal: "294.0000",
              resourceDescription: "Cemento Portland Tipo I",
            },
            {
              id: "apu-res-2",
              resourceId: null,
              resourceType: "LABOR",
              crew: "2.0000",
              quantity: "0.0400",
              unitPrice: "120.0000",
              subtotal: "9.6000",
              resourceDescription: "Operario",
            },
          ],
        },
      ],
    },
    null,
    2,
  );

  const polynomialFormulaJson = JSON.stringify(
    {
      formula: {
        id: "formula-1",
        budgetId: "budget-full-1",
        name: "Formula Polinomica N1",
        baseMonth: 1,
        baseYear: 2026,
        totalBaseAmount: "1500000.0000",
        status: "DRAFT",
        monomials: [
          {
            id: "monomial-1",
            code: "M1",
            name: "Mano de Obra",
            costGroupKey: "LABOR",
            amount: "300000.0000",
            coefficient: "0.347",
            baseIndexCode: "47",
            baseIndexName: "Mano de Obra",
            baseIndexValue: "450.123",
            adjustmentIndexCode: "47",
            adjustmentIndexName: "Mano de Obra",
            adjustmentIndexValue: "465.789",
            sortOrder: 1,
            components: [
              {
                id: "comp-1",
                budgetItemId: "item-1",
                apuResourceId: null,
                resourceType: "LABOR",
                amount: "300000.00",
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  );

  const generalExpensesJson = JSON.stringify({ generalExpenses: [] }, null, 2);
  const footerJson = JSON.stringify({ footers: [] }, null, 2);
  const takeoffsJson = JSON.stringify({ sheets: [] }, null, 2);
  const scheduleJson = JSON.stringify({ schedule: null }, null, 2);
  const riskJson = JSON.stringify({ variables: [], correlations: [], simulationRuns: [] }, null, 2);

  const rawFiles: Array<{ path: string; content: string }> = [
    { path: "project.json", content: projectJson },
    { path: "budgets/budget-tree.json", content: budgetTreeJson },
    { path: "budgets/budget-items.json", content: budgetItemsJson },
    { path: "budgets/apus.json", content: apusJson },
    { path: "budgets/general-expenses.json", content: generalExpensesJson },
    { path: "budgets/footer.json", content: footerJson },
    { path: "polynomial-formula/formula.json", content: polynomialFormulaJson },
    { path: "takeoffs/sheets.json", content: takeoffsJson },
    { path: "schedule/work-schedule.json", content: scheduleJson },
    { path: "risk/risk-analysis.json", content: riskJson },
  ];

  const checksums = createSha256Checksums(rawFiles);

  const modules: Array<{ id: McpModuleId; path: string; required: boolean }> = [
    { id: "project", path: "project.json", required: true },
    { id: "budgets", path: "budgets/budget-tree.json", required: true },
    { id: "budget_items", path: "budgets/budget-items.json", required: true },
    { id: "apus", path: "budgets/apus.json", required: true },
    { id: "polynomial_formula", path: "polynomial-formula/formula.json", required: false },
    { id: "general_expenses", path: "budgets/general-expenses.json", required: false },
    { id: "budget_footer", path: "budgets/footer.json", required: false },
    { id: "risk_analysis", path: "risk/risk-analysis.json", required: false },
    { id: "takeoffs", path: "takeoffs/sheets.json", required: false },
    { id: "work_schedule", path: "schedule/work-schedule.json", required: false },
    { id: "project_resources", path: "budgets/project-resources.json", required: false },
  ];

  const manifest = createMcpManifest({
    projectId: "project-full-1",
    projectName: "Hospital Norte",
    appVersion: "0.1.0",
    currency: "PEN",
    modules,
    checksums,
  });

  rawFiles.push({ path: "checksums/sha256.json", content: JSON.stringify(checksums, null, 2) });
  rawFiles.unshift({ path: "manifest.json", content: JSON.stringify(manifest, null, 2) });

  return buildStoredZip(
    rawFiles.map((file) => ({
      fileName: file.path,
      content: file.content,
    })),
  );
}
