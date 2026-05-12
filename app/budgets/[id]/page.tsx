import Link from "next/link";
import { notFound } from "next/navigation";
import { BudgetFlow } from "@/components/budget/budget-flow";
import { AppShell } from "@/components/layout/app-shell";
import { GeneralBudgetOverview } from "@/components/budget/general-budget-overview";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetById, getProjectSubBudgetDetails, getProjectSubBudgetSummaries } from "@/lib/data/budgets";
import { getCatalogPartidas } from "@/lib/data/partidas";
import { getProjectById } from "@/lib/data/projects";
import { getResourcesByUser } from "@/lib/data/resources";
import { getUserSettings } from "@/lib/data/settings";
import { decimalToNumber } from "@/lib/db/serializers";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) {
    console.error("BudgetDetailPage missing session", { budgetId: id });
    notFound();
  }

  const [budget, resources, partidasCatalog, settings] = await Promise.all([
    getBudgetById(id, session.user.id),
    getResourcesByUser(session.user.id),
    getCatalogPartidas(),
    getUserSettings(session.user.id),
  ]);

  if (!budget) {
    console.error("BudgetDetailPage budget not found", { budgetId: id, userId: session.user.id });
    notFound();
  }

  const project = await getProjectById(budget.projectId, session.user.id);

  if (!project) {
    console.error("BudgetDetailPage project not found", { budgetId: budget.id, projectId: budget.projectId, userId: session.user.id });
    notFound();
  }

  if (budget.kind === "GENERAL") {
    const [subBudgetSummaries, subBudgetDetails] = await Promise.all([
      getProjectSubBudgetSummaries(project.id, session.user.id),
      getProjectSubBudgetDetails(project.id, session.user.id),
    ]);

    const subBudgets = [
      "Estructuras",
      "Arquitectura",
      "Instalaciones Sanitarias",
      "Instalaciones Electricas",
    ]
      .map((name) => project.budgets.find((item) => item.kind === "SUB_BUDGET" && item.name === name))
      .filter((item) => item != null);

    return (
      <AppShell>
        <div className="space-y-5">
          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Presupuesto General</Badge>
                    <Badge className="bg-sky-100 text-sky-700">{project.name}</Badge>
                  </div>
                  <div>
                    <CardTitle>{budget.name}</CardTitle>
                    <CardDescription>
                      Este presupuesto es un consolidado del proyecto. Sus partidas viven dentro de los Sub Presupuestos.
                    </CardDescription>
                  </div>
                </div>
                <Link href={`/projects/${project.id}`}>
                  <ActionButton action="open" label="Volver al proyecto" variant="outline" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Metric label="Total Presupuesto" value={formatCurrency(budget.totalAmount, budget.currency, settings.currencyDecimals)} />
              <Metric label="Sub Presupuestos" value={String(subBudgets.length)} />
              <Metric label="Cliente" value={project.clientName || "Pendiente"} />
              <Metric label="Actualizado" value={formatDate(project.updatedAt, settings.dateFormat)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sub Presupuestos</CardTitle>
              <CardDescription>
                Abre cada especialidad para editar partidas, APUs y costos. El total de este presupuesto se consolida automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {subBudgets.map((subBudget) => (
                <div key={subBudget.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{subBudget.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Total actual: {formatCurrency(decimalToNumber(subBudget.totalAmount), subBudget.currency, settings.currencyDecimals)}
                      </p>
                    </div>
                    <Badge className="bg-slate-200 text-slate-700">Sub Presupuesto</Badge>
                  </div>
                  <div className="mt-4">
                    <Link href={`/budgets/${subBudget.id}`}>
                      <ActionButton action="open" label="Abrir presupuesto" />
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <GeneralBudgetOverview
            projectId={project.id}
            generalBudgetId={budget.id}
            subBudgets={subBudgetSummaries.map((subBudget) => ({
              id: subBudget.id,
              projectId: subBudget.projectId,
              parentBudgetId: subBudget.parentBudgetId ?? undefined,
              name: subBudget.name,
              currency: subBudget.currency,
              totalDirectCost: decimalToNumber(subBudget.totalDirectCost),
              totalGeneralExpenses: decimalToNumber(subBudget.totalGeneralExpenses),
              totalUtility: decimalToNumber(subBudget.totalUtility),
              totalTax: decimalToNumber(subBudget.totalTax),
              totalAmount: decimalToNumber(subBudget.totalAmount),
              updatedAt: subBudget.updatedAt.toISOString(),
              levelsCount: subBudget._count.levels,
              itemsCount: subBudget._count.items,
            }))}
            subBudgetDetails={subBudgetDetails}
          />

          <section id="otras-secciones">
            <Card>
              <CardHeader>
                <CardTitle>Otras secciones del presupuesto</CardTitle>
                <CardDescription>
                  Recuperamos la vista de trabajo para las secciones tecnicas complementarias del presupuesto dentro de
                  esta pantalla inicial.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SectionCard
                  title="Lista de insumos"
                  detail="Base para volver a trabajar el listado de insumos asociado al presupuesto."
                  href={`/budgets/${budget.id}/resources`}
                />
                <SectionCard
                  title="Gastos generales"
                  detail="Espacio visible para reincorporar el detalle de gastos generales del presupuesto."
                  href={`/budgets/${budget.id}/general-expenses`}
                />
                <SectionCard
                  title="Pie de presupuesto"
                  detail="Reservado para observaciones finales, alcances y cierre del presupuesto."
                  href={`/budgets/${budget.id}/footer`}
                />
                <SectionCard
                  title="Formula polinomica"
                  detail="Bloque listo para recuperar la formula polinomica dentro del flujo principal."
                  href={`/budgets/${budget.id}/polynomial-formula`}
                />
              </CardContent>
            </Card>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <BudgetFlow
        budget={budget}
        projectName={project.name}
        partidasCatalog={partidasCatalog}
        resourcesCatalog={resources.map((resource) => ({
          id: resource.id,
          companyId: resource.companyId ?? undefined,
          code: resource.code,
          description: resource.description,
          category: resource.category,
          iu: resource.iu ?? undefined,
          subcategory: resource.subcategory ?? undefined,
          unit: resource.unit,
          unitPrice: decimalToNumber(resource.unitPrice),
          currency: resource.currency,
          source: resource.source ?? undefined,
        }))}
      />
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
