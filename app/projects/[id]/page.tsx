import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextBadge, ProjectStatusBadge } from "@/components/ui/context-badges";
import { InfoCard } from "@/components/ui/info-cards";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectOverviewById } from "@/lib/data/projects";
import { getUserSettings } from "@/lib/data/settings";
import { decimalToNumber } from "@/lib/db/serializers";
import { ProjectBudgetSections } from "@/components/projects/project-budget-sections";
import { getProjectOtherSections } from "@/lib/projects/other-sections";
import { formatDate } from "@/lib/utils";

const projectSections = [
  {
    id: "presupuesto-general",
    title: "Presupuesto General",
    description: "Consolida el presupuesto padre del proyecto y su lectura ejecutiva.",
  },
  {
    id: "subpresupuestos",
    title: "Sub Presupuestos",
    description: "Organiza estructuras, arquitectura e instalaciones como paquetes de trabajo separados.",
  },
  {
    id: "otras-secciones",
    title: "Otras secciones",
    description: "APU, lista de insumos, gastos generales, pie de presupuesto y fórmula polinómica del proyecto.",
  },
] as const;

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  const [project, settings] = await Promise.all([getProjectOverviewById(id, session!.user.id), getUserSettings(session!.user.id)]);

  if (!project) {
    notFound();
  }

  const generalBudget =
    project.budgets.find((budget) => budget.kind === "GENERAL") ??
    project.budgets.find((budget) => budget.parentBudgetId == null) ??
    null;
  const generalBudgetsCount = generalBudget ? 1 : 0;
  const subBudgets = project.budgets.filter((budget) => budget.kind === "SUB_BUDGET");
  const otherSections = getProjectOtherSections(generalBudget?.id ?? null);

  return (
    <AppShell settings={settings}>
      <div className="space-y-5">
        <Card className="border-slate-200">
          <CardHeader className="gap-4 rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
            <PageHeaderCard
              icon={<FolderKanban className="h-5 w-5" />}
              title={project.name}
              description="Cada proyecto ahora funciona como contenedor de su presupuesto general, subpresupuestos y demás secciones técnicas."
              badges={
                <>
                  <ProjectStatusBadge status={project.status} />
                  <ContextBadge label={project.company.name} />
                </>
              }
              actions={
                <>
                  <Link href={`/projects/${project.id}/edit`}>
                    <ActionButton action="edit" label="Editar proyecto" variant="outline" />
                  </Link>
                  {generalBudget ? (
                    <Link href={`/budgets/${generalBudget.id}`}>
                      <ActionButton action="open" label="Abrir presupuesto general" />
                    </Link>
                  ) : null}
                </>
              }
            />
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <InfoCard label="Cliente" value={project.clientName || "Pendiente"} />
              <InfoCard label="Ubicación" value={project.location || "Pendiente"} />
              <InfoCard label="Tipo de obra" value={project.projectType || "Pendiente"} />
              <InfoCard label="Presupuestos" value={String(generalBudgetsCount)} />
              <InfoCard label="Actualizado" value={formatDate(project.updatedAt, settings.dateFormat)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {projectSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <ProjectBudgetSections
          projectId={project.id}
          generalBudget={
            generalBudget
              ? {
                  id: generalBudget.id,
                  projectId: project.id,
                  parentBudgetId: generalBudget.parentBudgetId,
                  name: generalBudget.name,
                  kind: generalBudget.kind,
                  currency: generalBudget.currency,
                  totalAmount: decimalToNumber(generalBudget.totalAmount),
                  updatedAt: generalBudget.updatedAt.toISOString(),
                }
              : null
          }
          subBudgets={subBudgets.map((budget) => ({
            id: budget.id,
            projectId: project.id,
            parentBudgetId: budget.parentBudgetId,
            name: budget.name,
            kind: budget.kind,
            currency: budget.currency,
            totalAmount: decimalToNumber(budget.totalAmount),
            updatedAt: budget.updatedAt.toISOString(),
          }))}
        />

        <section id="otras-secciones">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Otras secciones del proyecto</CardTitle>
              <CardDescription>
                Accesos directos a las secciones funcionales del presupuesto general desde el contexto del proyecto.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {otherSections.length ? (
                otherSections.map((section) => (
                  <SectionCard key={section.href} title={section.title} detail={section.detail} href={section.href} />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 md:col-span-2 xl:col-span-4">
                  <p className="font-medium text-slate-900">Presupuesto general pendiente</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Esta sección se habilitará cuando el proyecto tenga un presupuesto general disponible.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function SectionCard({ title, detail, href }: { title: string; detail: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-sky-300 hover:bg-sky-50"
    >
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
    </Link>
  );
}
