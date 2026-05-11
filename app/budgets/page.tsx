import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { BudgetsTable } from "@/components/budget/budgets-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetsByUser } from "@/lib/data/budgets";

export default async function BudgetsPage() {
  const session = await getAuthSession();
  const budgets = await getBudgetsByUser(session!.user.id);

  return (
    <AppShell>
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Presupuestos</CardTitle>
            <CardDescription>Abre, filtra y limpia presupuestos rapidamente desde una tabla de trabajo.</CardDescription>
          </div>
          <Link href="/budgets/new">
            <Button>Nuevo presupuesto</Button>
          </Link>
        </CardHeader>
        <CardContent>
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
