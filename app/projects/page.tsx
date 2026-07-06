import Link from "next/link";
import type { Metadata } from "next";
import { FolderKanban, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectsTable } from "@/components/projects/projects-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectsListByUser } from "@/lib/data/projects";
import { ensureDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Proyectos | MC Presupuestos",
  description:
    "Gestiona obras, clientes y accesos rápidos a presupuestos desde una tabla operativa. Proyectos de construcción, ingeniería y costos.",
  openGraph: {
    title: "Proyectos | MC Presupuestos",
    description: "Panel de gestión de proyectos de construcción con presupuestos, cronogramas y control de costos.",
  },
};
export default async function ProjectsPage() {
  const session = await getAuthSession();
  const projects = await getProjectsListByUser(session!.user.id);

  return (
    <AppShell currentUser={session!.user}>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[var(--app-surface-elevated)] md:flex-row md:items-start md:justify-between">
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
              startDate: project.startDate ? ensureDate(project.startDate).toISOString() : undefined,
              endDate: project.endDate ? ensureDate(project.endDate).toISOString() : undefined,
              status: project.status,
              createdAt: ensureDate(project.createdAt).toISOString(),
              updatedAt: ensureDate(project.updatedAt).toISOString(),
              budgetsCount: project._count.budgets,
            }))}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
