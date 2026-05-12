import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectForm } from "@/components/projects/project-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";

export default async function NewProjectPage() {
  const session = await getAuthSession();
  const companies = await getUserCompanies(session!.user.id);

  return (
    <AppShell>
      <Card>
        <CardHeader>
          <CardTitle>Crear proyecto</CardTitle>
          <CardDescription>Registra una nueva obra y dejala lista para presupuestar.</CardDescription>
        </CardHeader>
        <CardContent>
          {companies.length > 0 ? (
            <ProjectForm companies={companies} />
          ) : (
            <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-medium text-amber-900">Primero necesitas una empresa o perfil profesional.</p>
              <p className="text-sm text-amber-800">
                Los proyectos se crean dentro de una empresa. Configura esa base en la seccion de configuracion y luego vuelve aqui para generar tus sub presupuestos iniciales.
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
