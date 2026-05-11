import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetForm } from "@/components/budget/budget-form";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectsByUser } from "@/lib/data/projects";

export default async function NewBudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await getAuthSession();
  const { projectId } = await searchParams;
  const projects = await getProjectsByUser(session!.user.id);

  return (
    <AppShell>
      <Card>
        <CardHeader>
          <CardTitle>Crear presupuesto</CardTitle>
          <CardDescription>Configura moneda, tasas y proyecto base.</CardDescription>
        </CardHeader>
        <CardContent>
          <BudgetForm
            projects={projects.map((project) => ({ id: project.id, name: project.name }))}
            defaultProjectId={projectId}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
