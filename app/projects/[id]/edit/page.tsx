import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectById, getUserCompanies } from "@/lib/data/projects";
import { ProjectForm } from "@/components/projects/project-form";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  const [project, companies] = await Promise.all([getProjectById(id, session!.user.id), getUserCompanies(session!.user.id)]);

  if (!project) {
    notFound();
  }

  return (
    <AppShell>
      <Card>
        <CardHeader>
          <CardTitle>Editar proyecto</CardTitle>
          <CardDescription>Ajusta datos generales de la obra y su estado actual.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm companies={companies} project={project} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
