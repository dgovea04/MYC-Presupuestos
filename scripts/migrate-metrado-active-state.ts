import "dotenv/config";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { refreshGeneralBudgetTotals } from "@/lib/data/budgets";

async function main() {
  const sheets = await prisma.metradoSheet.findMany({
    include: {
      partidaLinks: { select: { budgetItemId: true }, orderBy: { createdAt: "asc" }, take: 1 },
      rows: { select: { partial: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const byItem = new Map<string, typeof sheets>();
  for (const sheet of sheets) {
    const itemId = sheet.partidaLinks[0]?.budgetItemId;
    if (!itemId) continue;
    const group = byItem.get(itemId) ?? [];
    group.push(sheet);
    byItem.set(itemId, group);
  }

  let normalizedSheets = 0;
  let synchronizedItems = 0;
  const affectedBudgetIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const [itemId, candidates] of byItem) {
      const active = candidates[0];
      const total = active.rows.reduce((sum, row) => sum.plus(row.partial), new Decimal(0));
      const quantity = total.toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

      for (const [index, sheet] of candidates.entries()) {
        const shouldBeActive = index === 0;
        if (sheet.isActive !== shouldBeActive) {
          await tx.metradoSheet.update({ where: { id: sheet.id }, data: { isActive: shouldBeActive } });
          normalizedSheets += 1;
        }
      }

      const item = await tx.budgetItem.findUnique({
        where: { id: itemId },
        select: { id: true, budgetId: true, quantity: true, unitPrice: true },
      });
      if (!item) continue;

      const partial = quantity.times(item.unitPrice).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      if (!new Decimal(item.quantity).eq(quantity) || !new Decimal(item.unitPrice).times(quantity).eq(partial)) {
        await tx.budgetItem.update({
          where: { id: item.id },
          data: { quantity: quantity.toNumber(), partial: partial.toNumber() },
        });
        synchronizedItems += 1;
      }
      affectedBudgetIds.add(item.budgetId);
    }

    for (const budgetId of affectedBudgetIds) {
      const budget = await tx.budget.findUnique({
        where: { id: budgetId },
        select: { id: true, parentBudgetId: true, igvRate: true, generalExpensesRate: true, utilityRate: true },
      });
      if (!budget) continue;

      const items = await tx.budgetItem.findMany({ where: { budgetId }, select: { quantity: true, unitPrice: true } });
      const directCost = items.reduce((sum, item) => sum.plus(new Decimal(item.quantity).times(item.unitPrice)), new Decimal(0));
      const generalExpenses = directCost.times(budget.generalExpensesRate);
      const utility = directCost.times(budget.utilityRate);
      const tax = directCost.plus(generalExpenses).plus(utility).times(budget.igvRate);
      await tx.budget.update({
        where: { id: budget.id },
        data: {
          totalDirectCost: directCost.toDecimalPlaces(4).toNumber(),
          totalGeneralExpenses: generalExpenses.toDecimalPlaces(4).toNumber(),
          totalUtility: utility.toDecimalPlaces(4).toNumber(),
          totalTax: tax.toDecimalPlaces(4).toNumber(),
          totalAmount: directCost.plus(generalExpenses).plus(utility).plus(tax).toDecimalPlaces(4).toNumber(),
        },
      });
      if (budget.parentBudgetId) await refreshGeneralBudgetTotals(tx, budget.parentBudgetId);
    }
  });

  console.info(JSON.stringify({ normalizedSheets, synchronizedItems, linkedItems: byItem.size, budgetsRecalculated: affectedBudgetIds.size }));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
