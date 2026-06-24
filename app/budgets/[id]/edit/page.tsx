import { FileSpreadsheet } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { BudgetForm } from "@/components/budget/budget-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetById } from "@/lib/data/budgets";
import { getProjectsByUser } from "@/lib/data/projects";

export default async function EditBudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const [budget, projects] = await Promise.all([getBudgetById(id, session.user.id), getProjectsByUser(session.user.id)]);

  if (!budget) {
    notFound();
  }

  return (
    <AppShell>
      <Card className="theme-surface-card">
        <CardHeader className="theme-surface-card-gradient rounded-2xl">
          <PageHeaderCard
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title="Editar presupuesto"
            description="Ajusta nombre, proyecto base, moneda y parametros principales del presupuesto."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <BudgetForm
            projects={projects.map((project) => ({ id: project.id, name: project.name }))}
            budget={{
              id: budget.id,
              name: budget.name,
              projectId: budget.projectId,
              currency: budget.currency,
              igvRate: budget.igvRate,
              generalExpensesRate: budget.generalExpensesRate,
              utilityRate: budget.utilityRate,
            }}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
