import path from "node:path";
import type { Prisma } from "@prisma/client";
import { parseBudgetFooterTemplate } from "@/lib/budget-footer/template-parser";

const TEMPLATE_FILE_PATH = path.join(process.cwd(), "presupuesto-ejemplo", "pie-presupuesto.xlsx");

export async function ensureBudgetFooterTemplate(
  tx: Prisma.TransactionClient,
  budgetId: string,
  input: { totalDirectCost: number; totalGeneralExpenses: number },
) {
  const existingCount = await tx.budgetFooterRow.count({
    where: { budgetId },
  });

  if (existingCount > 0) {
    return;
  }

  const template = await parseBudgetFooterTemplate(TEMPLATE_FILE_PATH);

  for (const row of template.rows) {
    await tx.budgetFooterRow.create({
      data: {
        budgetId,
        variable: row.variable,
        description: row.description,
        formula: getSeedFormula(row.variable, row.formula),
        manualValue: getSeedManualValue(row.variable, row.manualValue, input),
        iu: row.iu,
        highlight: row.highlight,
        sortOrder: row.sortOrder,
      },
    });
  }
}

function getSeedFormula(variable: string, formula: string | null) {
  if (variable === "CD" || variable === "PGG") {
    return null;
  }

  return formula;
}

function getSeedManualValue(
  variable: string,
  manualValue: number,
  input: { totalDirectCost: number; totalGeneralExpenses: number },
) {
  if (variable === "CD") {
    return input.totalDirectCost;
  }

  if (variable === "PGG") {
    return input.totalGeneralExpenses;
  }

  return manualValue;
}
