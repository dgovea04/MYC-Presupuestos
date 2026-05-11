import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";
import { ProjectForm } from "@/components/projects/project-form";

export default async function NewProjectPage() {
  const session = await getAuthSession();
  const companies = await getUserCompanies(session!.user.id);

  return (
    <AppShell>
      <Card>
        <CardHeader>
          <CardTitle>Crear proyecto</CardTitle>
          <CardDescription>Registra una nueva obra y déjala lista para presupuestar.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm companies={companies} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
