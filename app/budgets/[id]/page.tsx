import Link from "next/link";
import dynamic from "next/dynamic";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Activity, ArrowRight, Calculator, FileSpreadsheet, ReceiptText, Sigma, Wrench } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { GeneralBudgetOverview } from "@/components/budget/general-budget-overview";
import { SubBudgetCreateSheet } from "@/components/budget/sub-budget-create-sheet";
import { SubBudgetDeleteButton } from "@/components/budget/sub-budget-delete-button";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextBadge } from "@/components/ui/context-badges";
import { InfoCard } from "@/components/ui/info-cards";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetTemplateCreationTraceability } from "@/lib/data/activity-events";
import { getBudgetById, getProjectSubBudgetDetails, getProjectSubBudgetSummaries } from "@/lib/data/budgets";

const BudgetFlowDynamic = dynamic(() =>
  import("@/components/budget/budget-flow").then((mod) => ({ default: mod.BudgetFlow })),
);
import { getCatalogPartidas } from "@/lib/data/partidas";
import { getProjectOverviewById } from "@/lib/data/projects";
import { getResourcesByUser } from "@/lib/data/resources";
import { getUserSettings } from "@/lib/data/settings";
import { orderSubBudgetsBySpecialty } from "@/lib/budgets/sub-budget-order";
import { decimalToNumber } from "@/lib/db/serializers";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) return { title: "Presupuesto | MYC Presupuestos" };

  const budget = await getBudgetById(id, session.user.id);
  if (!budget) return { title: "Presupuesto | MYC Presupuestos" };

  const isGeneral = budget.kind === "GENERAL";
  const kindLabel = isGeneral ? "Presupuesto General" : "Sub Presupuesto";

  return {
    title: `${budget.name} | MYC Presupuestos`,
    description: `${kindLabel} — ${budget.name}. Moneda: ${budget.currency}. Total: ${budget.totalAmount}. Presupuesto de obra para construcción.`,
    openGraph: {
      title: `${budget.name} | MYC Presupuestos`,
      description: `${kindLabel}: ${budget.name}. Gestión de costos y presupuestos de obra.`,
    },
  };
}

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) {
    console.error("BudgetDetailPage missing session", { budgetId: id });
    notFound();
  }

  const [budget, settings, templateTraceability] = await Promise.all([
    getBudgetById(id, session.user.id),
    getUserSettings(session.user.id),
    getBudgetTemplateCreationTraceability({ userId: session.user.id, budgetId: id }),
  ]);

  if (!budget) {
    console.error("BudgetDetailPage budget not found", { budgetId: id, userId: session.user.id });
    notFound();
  }

  const project = await getProjectOverviewById(budget.projectId, session.user.id);

  if (!project) {
    console.error("BudgetDetailPage project not found", { budgetId: budget.id, projectId: budget.projectId, userId: session.user.id });
    notFound();
  }

  if (budget.kind === "GENERAL") {
    const [subBudgetSummaries, subBudgetDetails] = await Promise.all([
      getProjectSubBudgetSummaries(project.id, session.user.id),
      getProjectSubBudgetDetails(project.id, session.user.id),
    ]);

    const subBudgets = orderSubBudgetsBySpecialty(project.budgets.filter((item) => item.kind === "SUB_BUDGET"));

    return (
      <AppShell
        currentUser={session.user}
        settings={settings}
        aiContext={{
          route: `/budgets/${budget.id}`,
          project: project.name,
          projectId: project.id,
          budgetId: budget.id,
          module: "Presupuesto",
          selectionType: "budget",
          selectionId: budget.id,
          activeTable: "Sub presupuestos",
          viewSummary: `Presupuesto general ${budget.name} del proyecto ${project.name}.`,
        }}
      >
        <div className="space-y-5">
          <Card className="theme-surface-card rounded-2xl">
            <CardHeader className="theme-surface-card-gradient gap-4 rounded-2xl">
              <PageHeaderCard
                icon={<FileSpreadsheet className="h-5 w-5" />}
                title={budget.name}
                description="Este presupuesto es un consolidado del proyecto. Sus partidas viven dentro de los Sub Presupuestos."
                badges={
                  <>
                    <ContextBadge label="Presupuesto General" tone="slate" />
                    <ContextBadge label={project.name} />
                  </>
                }
                actions={
                  <Link href={`/projects/${project.id}`}>
                    <ActionButton action="open" label="Volver al proyecto" variant="outline" />
                  </Link>
                }
              />
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              {templateTraceability ? <BudgetTemplateTraceabilityNotice detail={templateTraceability.detail} /> : null}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <InfoCard label="Total Presupuesto" value={formatCurrency(budget.totalAmount, budget.currency, settings.currencyDecimals)} />
                <InfoCard label="Sub Presupuestos" value={String(subBudgets.length)} />
                <InfoCard label="Cliente" value={project.clientName || "Pendiente"} />
                <InfoCard label="Moneda" value={budget.currency} />
                <InfoCard label="Actualizado" value={formatDate(project.updatedAt, settings.dateFormat)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href="#subpresupuestos"
                  className="theme-filter-button-inactive rounded-full border px-4 py-2 text-sm transition"
                >
                  Sub Presupuestos
                </a>
                <a
                  href="#otras-secciones"
                  className="theme-filter-button-inactive rounded-full border px-4 py-2 text-sm transition"
                >
                  Otras secciones
                </a>
              </div>
            </CardContent>
          </Card>

          <section id="subpresupuestos" className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <Card className="theme-surface-card rounded-2xl">
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>Sub Presupuestos</CardTitle>
                    <CardDescription>
                      Abre cada Sub Presupuesto para editar partidas, APUs y costos. El total de este presupuesto se consolida automáticamente.
                    </CardDescription>
                  </div>
                  <SubBudgetCreateSheet
                    projectId={project.id}
                    parentBudgetId={budget.id}
                    parentBudgetName={budget.name}
                    currency={budget.currency}
                    igvRate={budget.igvRate}
                    generalExpensesRate={budget.generalExpensesRate}
                    utilityRate={budget.utilityRate}
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                {subBudgets.map((subBudget) => (
                  <div key={subBudget.id} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm shadow-slate-950/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[var(--app-text-strong)]">{subBudget.name}</p>
                        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                          Total actual: {formatCurrency(decimalToNumber(subBudget.totalAmount), subBudget.currency, settings.currencyDecimals)}
                        </p>
                      </div>
                      <ContextBadge label="Sub Presupuesto" tone="slate" />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link href={`/budgets/${subBudget.id}`}>
                        <ActionButton action="open" label="Abrir Sub Presupuesto" />
                      </Link>
                      <SubBudgetDeleteButton subBudgetId={subBudget.id} subBudgetName={subBudget.name} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <section id="otras-secciones">
              <Card className="h-full border-[var(--app-border)] bg-[var(--app-surface)]">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <OperationalSectionHeader
                    title="Otras secciones del presupuesto"
                    description="Atajos directos para entrar al flujo complementario del presupuesto general."
                  />
                  <div className="grid flex-1 content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <BudgetQuickActionLink
                      href={`/budgets/${budget.id}/resources`}
                      title="Lista de insumos"
                      description="Base para volver a trabajar el listado de insumos asociado al presupuesto."
                      icon={<Wrench className="h-5 w-5" />}
                      tone="primary"
                    />
                    <BudgetQuickActionLink
                      href={`/budgets/${budget.id}/general-expenses`}
                      title="Gastos generales"
                      description="Espacio visible para reincorporar el detalle de gastos generales del presupuesto."
                      icon={<Calculator className="h-5 w-5" />}
                    />
                    <BudgetQuickActionLink
                      href={`/budgets/${budget.id}/footer`}
                      title="Pie de presupuesto"
                      description="Edita variables, observaciones, firma y datos de cierre del presupuesto."
                      icon={<ReceiptText className="h-5 w-5" />}
                    />
                    <BudgetQuickActionLink
                      href={`/budgets/${budget.id}/polynomial-formula`}
                      title="Fórmula polinómica"
                      description="Bloque listo para recuperar la fórmula polinómica dentro del flujo principal."
                      icon={<Sigma className="h-5 w-5" />}
                    />
                    <BudgetQuickActionLink
                      href={`/budgets/${budget.id}/work-schedule`}
                      title="Programacion de obra"
                      description="Cronograma consolidado, calendario valorizado, insumos por periodo y curva S basica."
                      icon={<FileSpreadsheet className="h-5 w-5" />}
                    />
                    <BudgetQuickActionLink
                      href={`/budgets/${budget.id}/risk-analysis`}
                      title="Riesgos Monte Carlo"
                      description="Simulacion probabilistica de metrados con percentiles y contingencias del presupuesto."
                      icon={<Activity className="h-5 w-5" />}
                    />
                  </div>
                </CardContent>
              </Card>
            </section>
          </section>

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
        </div>
      </AppShell>
    );
  }

  const [resources, partidasCatalog] = await Promise.all([getResourcesByUser(session.user.id), getCatalogPartidas()]);

  return (
    <AppShell
      currentUser={session.user}
      settings={settings}
      aiContext={{
        route: `/budgets/${budget.id}`,
        project: project.name,
        projectId: project.id,
        budgetId: budget.id,
        module: "Presupuesto",
        selectionType: "budget",
        selectionId: budget.id,
        activeTable: "Partidas",
        viewSummary: `Sub presupuesto ${budget.name} del proyecto ${project.name}.`,
      }}
    >
      <BudgetFlowDynamic
        budget={budget}
        projectName={project.name}
        templateTraceability={templateTraceability}
        partidasCatalog={partidasCatalog}
        resourcesCatalog={resources.map((resource) => ({
          id: resource.id,
          companyId: resource.companyId ?? undefined,
          code: resource.code,
          description: resource.description,
          category: resource.category,
          iu: resource.iu ?? undefined,
          iuCurrent: resource.iuCurrent ?? undefined,
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

function BudgetTemplateTraceabilityNotice({ detail }: { detail: string }) {
  return (
    <div className="theme-status-success theme-status-success-strong rounded-2xl border px-4 py-3 text-sm">
      <span className="font-medium">Presupuesto creado desde plantilla.</span>{" "}
      <span>{detail}</span>
    </div>
  );
}

function BudgetQuickActionLink({
  href,
  title,
  description,
  icon,
  tone = "default",
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  tone?: "default" | "primary";
}) {
  const tones = {
    default: {
      link: "border-[var(--app-border)] bg-[var(--app-surface)] hover:border-sky-300 hover:bg-[var(--app-primary-muted)]/60",
      iconWrap: "bg-[var(--app-surface-strong)] text-[var(--app-text)]",
      title: "text-[var(--app-text-strong)]",
      arrow: "text-[var(--app-text-subtle)] group-hover:text-sky-700",
    },
    primary: {
      link: "theme-quick-action-primary",
      iconWrap: "theme-quick-action-primary-icon",
      title: "text-[var(--app-text-strong)]",
      arrow: "theme-quick-action-primary-arrow group-hover:translate-x-0.5",
    },
  } as const;

  const palette = tones[tone];

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.22)] transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-26px_rgba(15,23,42,0.26)]",
        palette.link,
      )}
    >
      <span
        className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm", palette.iconWrap)}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block font-medium", palette.title)}>{title}</span>
        <span className="mt-1 block text-sm text-[var(--app-text-muted)]">{description}</span>
      </span>
      <span className={cn("mt-1 inline-flex shrink-0 transition", palette.arrow)}>
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
