import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectById } from "@/lib/data/projects";
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
    description: "APU, lista de insumos, gastos generales, pie de presupuesto y formula polinomica del proyecto.",
  },
] as const;

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  const project = await getProjectById(id, session!.user.id);

  if (!project) {
    notFound();
  }

  const generalBudget =
    project.budgets.find((budget) => budget.kind === "GENERAL") ??
    project.budgets.find((budget) => budget.parentBudgetId == null) ??
    null;
  const subBudgets = project.budgets.filter((budget) => budget.kind === "SUB_BUDGET");
  const otherSections = getProjectOtherSections(generalBudget?.id ?? null);

  return (
    <AppShell>
      <div className="space-y-5">
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{project.status}</Badge>
                  <Badge className="bg-sky-100 text-sky-700">{project.company.name}</Badge>
                </div>
                <div>
                  <CardTitle className="text-2xl">{project.name}</CardTitle>
                  <CardDescription>
                    Cada proyecto ahora funciona como contenedor de su presupuesto general, subpresupuestos y demas
                    secciones tecnicas.
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/projects/${project.id}/edit`}>
                  <ActionButton action="edit" label="Editar proyecto" variant="outline" />
                </Link>
                {generalBudget ? (
                  <Link href={`/budgets/${generalBudget.id}`}>
                    <ActionButton action="open" label="Abrir presupuesto general" />
                  </Link>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Cliente" value={project.clientName || "Pendiente"} />
            <Metric label="Ubicacion" value={project.location || "Pendiente"} />
            <Metric label="Tipo de obra" value={project.projectType || "Pendiente"} />
            <Metric label="Actualizado" value={formatDate(project.updatedAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Presupuesto del proyecto</CardTitle>
            <CardDescription>
              Este flujo reemplaza la navegacion suelta de presupuestos por una lectura centrada en la obra.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {projectSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
              >
                {section.title}
              </a>
            ))}
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
          <Card>
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
                    Esta seccion se habilitara cuando el proyecto tenga un presupuesto general disponible.
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
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
