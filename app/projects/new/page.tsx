import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectForm } from "@/components/projects/project-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";

export default async function NewProjectPage() {
  const session = await getAuthSession();
  const companies = await getUserCompanies(session!.user.id);

  return (
    <AppShell>
      <Card className="border-slate-200">
        <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <PageHeaderCard
            icon={<FolderKanban className="h-5 w-5" />}
            title="Crear proyecto"
            description="Registra una nueva obra y déjala lista para presupuestar."
          />
        </CardHeader>
        <CardContent className="pt-6">
          {companies.length > 0 ? (
            <ProjectForm companies={companies} />
          ) : (
            <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-medium text-amber-900">Primero necesitas una empresa o perfil profesional.</p>
              <p className="text-sm text-amber-800">
                Los proyectos se crean dentro de una empresa. Configura esa base en la sección de configuración y luego vuelve aquí para generar tus Sub Presupuestos iniciales.
              </p>
              <Link href="/settings">
                <Button variant="outline">Ir a configuración</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
