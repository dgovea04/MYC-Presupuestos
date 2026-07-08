import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectForm } from "@/components/projects/project-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getUserCompanies } from "@/lib/data/projects";
import { getTemplateLibraryItem } from "@/lib/templates/template-library";
import { getWorkCalendars } from "@/lib/data/work-calendars";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams?: Promise<{ template?: string | string[] }>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = await searchParams;
  const templateId = Array.isArray(resolvedSearchParams?.template)
    ? resolvedSearchParams?.template[0]
    : resolvedSearchParams?.template;
  const selectedTemplate = templateId ? getTemplateLibraryItem(templateId) : null;
  const [companies, activeWorkspaceId, workCalendars] = await Promise.all([
    getUserCompanies(session!.user.id),
    getActiveWorkspaceId(session!.user.id),
    getWorkCalendars(),
  ]);

  return (
    <AppShell>
      <Card className="theme-surface-card">
        <CardHeader className="theme-surface-card-gradient rounded-2xl">
          <PageHeaderCard
            icon={<FolderKanban className="h-5 w-5" />}
            title="Crear proyecto"
            description={
              selectedTemplate?.module === "BUDGET"
                ? `Registra una nueva obra usando la plantilla ${selectedTemplate.name}.`
                : "Registra una nueva obra y dejala lista para presupuestar."
            }
          />
        </CardHeader>
        <CardContent className="pt-6">
          {companies.length > 0 ? (
            <ProjectForm
              companies={companies}
              workCalendars={workCalendars}
              selectedTemplate={selectedTemplate?.module === "BUDGET" ? selectedTemplate : null}
              activeWorkspaceId={activeWorkspaceId ?? undefined}
            />
          ) : (
            <div className="theme-status-warning theme-status-warning-strong space-y-4 rounded-2xl border p-5">
              <p className="font-medium">Primero necesitas una empresa o perfil profesional.</p>
              <p className="text-sm">
                Los proyectos se crean dentro de una empresa. Configura esa base en la seccion de configuracion y luego vuelve aqui para generar tus Sub Presupuestos iniciales.
              </p>
              <Link href="/settings">
                <Button variant="outline">Ir a configuracion</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
