import { AppShell } from "@/components/layout/app-shell";
import { FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BudgetForm } from "@/components/budget/budget-form";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectsByUser } from "@/lib/data/projects";
import { getUserSettings } from "@/lib/data/settings";

export default async function NewBudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await getAuthSession();
  const { projectId } = await searchParams;
  const [projects, settings] = await Promise.all([getProjectsByUser(session!.user.id), getUserSettings(session!.user.id)]);

  return (
    <AppShell>
      <Card className="border-slate-200">
        <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <PageHeaderCard
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title="Crear presupuesto"
            description="Configura moneda, tasas y proyecto base."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <BudgetForm
            projects={projects.map((project) => ({ id: project.id, name: project.name }))}
            defaultProjectId={projectId}
            defaultCurrency={settings.defaultCurrency}
            defaultIgvRate={settings.defaultIgvRate}
            defaultGeneralExpensesRate={settings.defaultGeneralExpensesRate}
            defaultUtilityRate={settings.defaultUtilityRate}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
