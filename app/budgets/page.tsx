import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { BudgetsTable } from "@/components/budget/budgets-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetsByUser } from "@/lib/data/budgets";
import { ensureDate } from "@/lib/utils";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams?: Promise<{ template?: string }>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const budgets = await getBudgetsByUser(session!.user.id);
  const templateIntent = resolveGeneralExpenseTemplateIntent(resolvedSearchParams.template);

  return (
    <AppShell currentUser={session!.user}>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[var(--app-surface-elevated)] md:flex-row md:items-start md:justify-between">
          <PageHeaderCard
            className="w-full"
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title="Presupuestos"
            description="Abre, filtra y limpia presupuestos rapidamente desde una tabla de trabajo."
            actions={
              <Link href="/budgets/new">
                <Button className="gap-2 shadow-sm shadow-sky-950/10">
                  <Plus className="h-4 w-4" />
                  Nuevo presupuesto
                </Button>
              </Link>
            }
          />
        </CardHeader>
        <CardContent className="pt-6">
          <BudgetsTable
            templateIntent={templateIntent}
            budgets={budgets.map((budget) => ({
              id: budget.id,
              name: budget.name,
              currency: budget.currency,
              totalAmount: Number(budget.totalAmount),
              updatedAt: ensureDate(budget.updatedAt).toISOString(),
              projectName: budget.project.name,
            }))}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}

function resolveGeneralExpenseTemplateIntent(templateId: string | undefined) {
  if (templateId === "general-expenses-fixed-workbook") {
    return {
      id: templateId,
      label: "Plantilla de gastos generales fijos",
      description: "Abre el desagregado operativo y revisa el grupo de costos indirectos permanentes de obra.",
    } as const;
  }

  if (templateId === "general-expenses-variable-workbook") {
    return {
      id: templateId,
      label: "Plantilla de gastos generales variables",
      description: "Abre el desagregado operativo y revisa el grupo proporcional al plazo y operacion de obra.",
    } as const;
  }

  return null;
}
