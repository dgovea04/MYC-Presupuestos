import { notFound } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
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
      <Card className="theme-surface-card">
        <CardHeader className="theme-surface-card-gradient rounded-2xl">
          <PageHeaderCard
            icon={<FolderKanban className="h-5 w-5" />}
            title="Editar proyecto"
            description="Ajusta datos generales de la obra y su estado actual."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <ProjectForm companies={companies} project={project} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
