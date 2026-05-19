import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectsTable } from "@/components/projects/projects-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectsListByUser } from "@/lib/data/projects";

export default async function ProjectsPage() {
  const session = await getAuthSession();
  const projects = await getProjectsListByUser(session!.user.id);

  return (
    <AppShell>
      <Card className="border-slate-200">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] md:flex-row md:items-start md:justify-between">
          <PageHeaderCard
            className="w-full"
            icon={<FolderKanban className="h-5 w-5" />}
            title="Proyectos / Obras"
            description="Gestiona obras, clientes y accesos rápidos a presupuestos desde una tabla operativa."
            actions={
              <Link href="/projects/new">
                <Button className="gap-2 shadow-sm shadow-sky-950/10">
                  <Plus className="h-4 w-4" />
                  Nuevo proyecto
                </Button>
              </Link>
            }
          />
        </CardHeader>
        <CardContent className="pt-6">
          <ProjectsTable
            projects={projects.map((project) => ({
              id: project.id,
              companyId: project.companyId,
              name: project.name,
              clientName: project.clientName,
              location: project.location,
              projectType: project.projectType,
              startDate: project.startDate?.toISOString(),
              endDate: project.endDate?.toISOString(),
              status: project.status,
              createdAt: project.createdAt.toISOString(),
              updatedAt: project.updatedAt.toISOString(),
              budgetsCount: project._count.budgets,
            }))}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
