import Link from "next/link";
import type { Metadata } from "next";
import { type ReactNode } from "react";
import { Activity, ArrowRight, Calculator, ClipboardCheck, FileSpreadsheet, ReceiptText, Sigma, Wrench } from "lucide-react";
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
import { getBudgetById } from "@/lib/data/budgets";
import { BudgetFlowWrapper } from "@/components/budget/budget-flow-wrapper";
import { BudgetCollaborationWrapper } from "@/components/budget/budget-collaboration-wrapper";
import { DemoProjectTour } from "@/components/onboarding/demo-project-tour";
import { getProjectBudgetOverviewById } from "@/lib/data/projects";
import { getUserSettings } from "@/lib/data/settings";
import { listMetradoSheetsByUser } from "@/lib/data/metrados";
import { orderSubBudgetsBySpecialty } from "@/lib/budgets/sub-budget-order";
import { decimalToNumber, stripBudgetProjectForClient } from "@/lib/db/serializers";
import { measureAsync } from "@/lib/platform/performance";
import { cn, ensureDate, formatCurrency, formatDate } from "@/lib/utils";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";
import { ProjectPackageExportPanel } from "@/components/exports/project-package-export-panel";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) return { title: "Presupuesto | MC Presupuestos" };

  const budget = await getBudgetById(id, session.user.id);
  if (!budget) return { title: "Presupuesto | MC Presupuestos" };

  const isGeneral = budget.kind === "GENERAL";
  const kindLabel = isGeneral ? "Presupuesto General" : "Sub Presupuesto";

  return {
    title: `${budget.name} | MC Presupuestos`,
    description: `${kindLabel} — ${budget.name}. Moneda: ${budget.currency}. Total: ${budget.totalAmount}. Presupuesto de obra para construcción.`,
    openGraph: {
      title: `${budget.name} | MC Presupuestos`,
      description: `${kindLabel}: ${budget.name}. Gestión de costos y presupuestos de obra.`,
    },
  };
}

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await measureAsync("page.budgetDetail.session", () => getAuthSession(), { budgetId: id });
  if (!session) {
    console.error("BudgetDetailPage missing session", { budgetId: id });
    notFound();
  }

  const [budget, settings] = await measureAsync("page.budgetDetail.initialData", () => Promise.all([
    getBudgetById(id, session.user.id),
    getUserSettings(session.user.id),
  ]), { budgetId: id });

  if (!budget) {
    console.error("BudgetDetailPage budget not found", { budgetId: id, userId: session.user.id });
    notFound();
  }

  const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
  const license = await getEffectiveWorkspaceLicense({ userId: session.user.id, companyId: activeWorkspaceId });
  const canUseKhipu = hasFeatureAccess(license, "khipu.agent");
  const canUsePartidaGenerator = hasFeatureAccess(license, "partidas.similarity");
  const canUseTemplates = hasFeatureAccess(license, "templates.budget");
  const canUseRiskAnalysis = hasFeatureAccess(license, "risk_analysis");
  const canUseCollaboration = hasFeatureAccess(license, "collaboration.realtime");

  const project = await measureAsync("page.budgetDetail.projectOverview", () => getProjectBudgetOverviewById(budget.projectId, session.user.id), {
    budgetId: budget.id,
    projectId: budget.projectId,
  });

  if (!project) {
    console.error("BudgetDetailPage project not found", { budgetId: budget.id, projectId: budget.projectId, userId: session.user.id });
    notFound();
  }

  if (budget.kind === "GENERAL") {
    const templateTraceability = canUseTemplates
      ? await getBudgetTemplateCreationTraceability({ userId: session.user.id, budgetId: budget.id })
      : null;
    const subBudgets = orderSubBudgetsBySpecialty(project.budgets.filter((item) => item.kind === "SUB_BUDGET"));
    const structuresBudget = subBudgets.find((item) => item.name === "Estructuras") ?? null;
    const metradoSheets = await listMetradoSheetsByUser(session.user.id, { includeInactive: true });

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
        {project.isDemo ? (
          <DemoProjectTour
            config={{
              projectId: project.id,
              generalBudgetId: budget.id,
              structuresBudgetId: structuresBudget?.id ?? null,
            }}
          />
        ) : null}
        <BudgetCollaborationWrapper budgetId={budget.id} projectId={project.id} budgetName={budget.name} userId={session.user.id} canUseCollaboration={canUseCollaboration}>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <ProjectPackageExportPanel projectId={project.id} />
                    <Link href={`/projects/${project.id}`}>
                      <ActionButton action="open" label="Volver al proyecto" variant="outline" />
                    </Link>
                  </div>
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
                        <ActionButton
                          action="open"
                          label="Abrir Sub Presupuesto"
                          data-demo-tour-target={subBudget.name === "Estructuras" ? "open-structures" : undefined}
                        />
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
                      tourTarget="open-formula"
                      description="Bloque listo para recuperar la fórmula polinómica dentro del flujo principal."
                      icon={<Sigma className="h-5 w-5" />}
                    />
                    <BudgetQuickActionLink
                      href={`/budgets/${budget.id}/work-schedule`}
                      title="Programacion de obra"
                      description="Cronograma consolidado, calendario valorizado, insumos por periodo y curva S basica."
                      icon={<FileSpreadsheet className="h-5 w-5" />}
                    />
                    {hasFeatureAccess(license, "risk_analysis") ? (
                      <BudgetQuickActionLink
                        href={`/budgets/${budget.id}/risk-analysis`}
                        title="Riesgos Monte Carlo"
                        description="Simulacion probabilistica de metrados con percentiles y contingencias del presupuesto."
                        icon={<Activity className="h-5 w-5" />}
                      />
                    ) : null}
                    <BudgetQuickActionLink
                      href={`/budgets/${budget.id}/review-intelligence`}
                      title="Revisión Inteligente"
                      description="Contrasta partidas con documentos fuente y registra decisiones humanas auditables."
                      icon={<ClipboardCheck className="h-5 w-5" />}
                      tone="primary"
                    />
                  </div>
                </CardContent>
              </Card>
            </section>
          </section>

          <GeneralBudgetOverview
            projectId={project.id}
            generalBudgetId={budget.id}
            metradoItems={metradoSheets
              .filter((sheet) => sheet.projectId === project.id && sheet.partidaLink)
              .map((sheet) => ({
                itemId: sheet.partidaLink!.budgetItemId,
                projectId: sheet.projectId,
                budgetId: sheet.budgetId,
                totalQuantity: sheet.totalQuantity,
                isActive: sheet.isActive,
              }))}
            subBudgets={subBudgets.map((subBudget) => ({
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
              updatedAt: ensureDate(subBudget.updatedAt).toISOString(),
              levelsCount: subBudget._count.levels,
              itemsCount: subBudget._count.items,
            }))}
          />
        </div>
        </BudgetCollaborationWrapper>
      </AppShell>
    );
  }

  // BUGFIX: `getBudgetById()` returns `{ ...BudgetRecord, project: Project }`
  // where `project` is the raw Prisma row with Decimal columns. Next.js 16
  // rejects Prisma Decimals across the Server→Client boundary ("Only plain
  // objects can be passed to Client Components"). `stripBudgetProjectForClient`
  // drops the raw `project` so only the serializable `BudgetRecord` reaches
  // <BudgetFlowWrapper />; the page already receives the project separately
  // and passes `projectName` as a string.
  const budgetForClient = stripBudgetProjectForClient(budget);

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
      {project.isDemo ? (
        <DemoProjectTour
          config={{
            projectId: project.id,
            generalBudgetId: budget.parentBudgetId ?? null,
            structuresBudgetId: budget.name === "Estructuras" ? budget.id : null,
          }}
        />
      ) : null}
      <BudgetCollaborationWrapper budgetId={budget.id} projectId={project.id} budgetName={budget.name} userId={session.user.id} canUseCollaboration={canUseCollaboration}>
      <BudgetFlowWrapper
        budget={budgetForClient}
        activeMetradoSheets={(await listMetradoSheetsByUser(session.user.id)).filter((sheet) => sheet.projectId === project.id && sheet.budgetId === budget.id && sheet.isActive && sheet.partidaLink).map((sheet) => ({ itemId: sheet.partidaLink!.budgetItemId, sheetId: sheet.id }))}
        projectName={project.name}
        templateTraceability={null}
        templateTraceabilityBudgetId={budget.id}
        catalogBudgetId={budget.id}
        partidasCatalog={[]}
        resourcesCatalog={[]}
        canUseKhipu={canUseKhipu}
        canUsePartidaGenerator={canUsePartidaGenerator}
        canUseTemplates={canUseTemplates}
        canUseRiskAnalysis={canUseRiskAnalysis}
        canUseCollaboration={canUseCollaboration}
      />
      </BudgetCollaborationWrapper>
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
  tourTarget,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  tone?: "default" | "primary";
  tourTarget?: string;
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
      data-demo-tour-target={tourTarget}
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
