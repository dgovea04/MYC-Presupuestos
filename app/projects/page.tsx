import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectsTable } from "@/components/projects/projects-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectsByUser } from "@/lib/data/projects";

export default async function ProjectsPage() {
  const session = await getAuthSession();
  const projects = await getProjectsByUser(session!.user.id);

  return (
    <AppShell>
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Proyectos / Obras</CardTitle>
            <CardDescription>Gestiona obras, clientes y accesos rapidos a presupuestos desde una tabla operativa.</CardDescription>
          </div>
          <Link href="/projects/new">
            <Button>Nuevo proyecto</Button>
          </Link>
        </CardHeader>
        <CardContent>
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
              budgetsCount: project.budgets.filter((budget) => budget.kind === "GENERAL").length,
            }))}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
