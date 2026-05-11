import path from "node:path";
import type { Prisma } from "@prisma/client";
import { parseGeneralExpensesTemplate } from "@/lib/general-expenses/template-parser";

const TEMPLATE_FILE_PATH = path.join(process.cwd(), "presupuesto-ejemplo", "Gastos_Generales.xlsx");

export async function ensureBudgetGeneralExpensesTemplate(tx: Prisma.TransactionClient, budgetId: string) {
  const existingCount = await tx.generalExpenseGroup.count({
    where: { budgetId },
  });

  if (existingCount > 0) {
    return;
  }

  const template = await parseGeneralExpensesTemplate(TEMPLATE_FILE_PATH);

  for (const group of template.groups) {
    await tx.generalExpenseGroup.create({
      data: {
        budgetId,
        name: group.name,
        kind: group.kind,
        sortOrder: group.sortOrder,
        titles: {
          create: group.titles.map((title) => ({
            code: title.code,
            name: title.name,
            category: title.category,
            sortOrder: title.sortOrder,
            items: {
              create: title.items.map((item) => ({
                code: item.code,
                description: item.description,
                category: item.category,
                unit: item.unit,
                quantityDescription: item.quantityDescription || null,
                quantity: item.quantity,
                participationPercentage: item.participationPercentage,
                unitPrice: item.unitPrice,
                sortOrder: item.sortOrder,
              })),
            },
          })),
        },
      },
    });
  }
}
