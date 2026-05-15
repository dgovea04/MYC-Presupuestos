import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { BudgetsTable } from "@/components/budget/budgets-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetsByUser } from "@/lib/data/budgets";

export default async function BudgetsPage() {
  const session = await getAuthSession();
  const budgets = await getBudgetsByUser(session!.user.id);

  return (
    <AppShell>
      <Card className="border-slate-200">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] md:flex-row md:items-start md:justify-between">
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
            budgets={budgets.map((budget) => ({
              id: budget.id,
              name: budget.name,
              currency: budget.currency,
              totalAmount: Number(budget.totalAmount),
              updatedAt: budget.updatedAt.toISOString(),
              projectName: budget.project.name,
            }))}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
