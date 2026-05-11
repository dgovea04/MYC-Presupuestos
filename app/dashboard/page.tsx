import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAuthSession } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/data/dashboard";
import { getUserSettings } from "@/lib/data/settings";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getAuthSession();
  const [stats, settings] = await Promise.all([getDashboardStats(session!.user.id), getUserSettings(session!.user.id)]);

  return (
    <AppShell>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Empresas" value={String(stats.companiesCount)} description="Perfil profesional o empresa creada" />
        <StatCard title="Proyectos" value={String(stats.projectsCount)} description="Obras activas en el sistema" />
        <StatCard title="Presupuestos" value={String(stats.budgetsCount)} description="Versiones listas para editar y exportar" />
        <StatCard title="Portafolio" value={formatCurrency(stats.portfolioValue, "PEN", settings.currencyDecimals)} description="Monto acumulado estimado" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Proyectos recientes</CardTitle>
            <CardDescription>Controla tus obras y salta directo a sus presupuestos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}/edit`} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-sky-300 hover:bg-sky-50/50">
                <div>
                  <p className="font-medium text-slate-900">{project.name}</p>
                  <p className="text-sm text-slate-500">{project.location || "Ubicación pendiente"}</p>
                </div>
                <Badge>{project.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Presupuestos recientes</CardTitle>
            <CardDescription>Últimas actualizaciones del motor APU.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.budgets.map((budget) => (
              <Link key={budget.id} href={`/budgets/${budget.id}`} className="block rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-sky-300 hover:bg-sky-50/50">
                <p className="font-medium text-slate-900">{budget.name}</p>
                <p className="mt-1 text-sm text-slate-500">Actualizado {formatDate(budget.updatedAt)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Catalogos base</CardTitle>
            <CardDescription>Accesos rapidos para mantener insumos y partidas reutilizables.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/resources" className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-sky-300 hover:bg-sky-50/50">
              <div>
                <p className="font-medium text-slate-900">Catalogo de Insumos</p>
                <p className="text-sm text-slate-500">Base general de materiales, mano de obra, equipos y herramientas.</p>
              </div>
              <Badge>Base</Badge>
            </Link>
            <Link href="/partidas" className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-sky-300 hover:bg-sky-50/50">
              <div>
                <p className="font-medium text-slate-900">Catalogo de Partidas</p>
                <p className="text-sm text-slate-500">Partidas precargadas con rendimiento y su tabla de precios unitarios.</p>
              </div>
              <Badge>APU</Badge>
            </Link>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function StatCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-6">
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-3xl font-semibold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}
