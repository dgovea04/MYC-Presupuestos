import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Calculator,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileSpreadsheet,
  FolderKanban,
  ListChecks,
  Ruler,
  Settings2,
  Sigma,
  StickyNote,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CompactStatCard } from "@/components/ui/compact-stat-card";
import { ProjectStatusBadge } from "@/components/ui/context-badges";
import { FilterPillLink } from "@/components/ui/filter-pill-link";
import { ToneBadge } from "@/components/ui/context-badges";
import { OperationalPanel, OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import { SectionPagination } from "@/components/ui/section-pagination";
import { getAuthSession } from "@/lib/auth/session";
import {
  buildDashboardOnboardingSteps,
  shouldShowDashboardOnboarding,
  type DashboardOnboardingStep,
} from "@/lib/dashboard/onboarding";
import {
  getDashboardStats,
  type DashboardActivityItem,
  type DashboardPendingItem,
} from "@/lib/data/dashboard";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";
import { DashboardAnalyticsSection } from "@/components/dashboard/dashboard-analytics-section";
import { DashboardAnalyticsSectionSkeleton } from "@/components/dashboard/dashboard-analytics-section-skeleton";
import { getProjectStatusLabel } from "@/lib/project-status";
import { getUserSettings } from "@/lib/data/settings";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { KhipuQualityMetrics } from "@/components/dashboard/khipu-quality-metrics";
import { KhipuQualityMetricsSkeleton } from "@/components/dashboard/khipu-quality-metrics-skeleton";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ priority?: string; pendingPage?: string; activityPage?: string; pendingTab?: string }>;
}) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
  const [stats, settings, license] = await Promise.all([
    getDashboardStats(session.user.id, activeWorkspaceId),
    getUserSettings(session.user.id),
    getEffectiveWorkspaceLicense({ userId: session.user.id, companyId: activeWorkspaceId }),
  ]);
  const canUseKhipu = hasFeatureAccess(license, "khipu.agent");
  const canUseTemplates = hasFeatureAccess(license, "templates.budget");
  const selectedPriority = resolvePendingPriorityFilter(resolvedSearchParams.priority);
  const selectedPendingTab = resolvePendingTab(resolvedSearchParams.pendingTab);
  const requestedPendingPage = resolvePageNumber(resolvedSearchParams.pendingPage);
  const requestedActivityPage = resolvePageNumber(resolvedSearchParams.activityPage);
  const actionPendingItems = stats.pendingItems.filter((item) => item.type !== "USER_NOTE_TASK");
  const notePendingItems = stats.pendingItems.filter((item) => item.type === "USER_NOTE_TASK");
  const visiblePendingItems = selectedPendingTab === "notes" ? notePendingItems : actionPendingItems;
  const pendingCounts = {
    all: stats.pendingItems.length,
    high: stats.pendingItems.filter((item) => item.priority === "high").length,
    medium: stats.pendingItems.filter((item) => item.priority === "medium").length,
    low: stats.pendingItems.filter((item) => item.priority === "low").length,
  };
  const visiblePendingCounts = {
    all: visiblePendingItems.length,
    high: visiblePendingItems.filter((item) => item.priority === "high").length,
    medium: visiblePendingItems.filter((item) => item.priority === "medium").length,
    low: visiblePendingItems.filter((item) => item.priority === "low").length,
  };
  const filteredPendingItems =
    selectedPriority === "all"
      ? visiblePendingItems
      : visiblePendingItems.filter((item) => item.priority === selectedPriority);
  const recentActivitySummary = summarizeRecentActivity(stats.recentActivity);
  const pendingTypeSummary = summarizePendingTypes(actionPendingItems);
  const paginatedPendingItems = paginateItems(filteredPendingItems, requestedPendingPage, DASHBOARD_SECTION_PAGE_SIZE);
  const paginatedRecentActivity = paginateItems(stats.recentActivity, requestedActivityPage, DASHBOARD_SECTION_PAGE_SIZE);
  const groupedPendingItems = groupPendingItemsByPriority(paginatedPendingItems.items);
  const onboardingSteps = buildDashboardOnboardingSteps(stats);
  const showOnboarding = shouldShowDashboardOnboarding(stats);

  return (
    <AppShell
      currentUser={session!.user}
      settings={settings}
      aiContext={{
        route: "/dashboard",
        module: "Dashboard",
        viewSummary: "Resumen operativo del portafolio con proyectos activos, pendientes y analitica.",
      }}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Proyectos activos"
          value={String(stats.projectsCount)}
          description="Obras visibles y listas para continuar."
          icon={<FolderKanban className="h-5 w-5" />}
          footer={`${stats.projects.length} proyectos con movimiento reciente`}
        />
        <StatCard
          title="Pendientes por atender"
          value={String(stats.pendingCount)}
          description="Proyectos que requieren una accion concreta."
          icon={<AlertTriangle className="h-5 w-5" />}
          footer={`Alta ${pendingCounts.high} - Media ${pendingCounts.medium} - Baja ${pendingCounts.low}`}
          tone={stats.pendingCount > 0 ? "attention" : "default"}
        />
        <StatCard
          title="Reajustes del mes"
          value={String(stats.monthlyAdjustmentsCount)}
          description="Movimientos registrados en el periodo actual."
          icon={<Calculator className="h-5 w-5" />}
          footer="Seguimiento del periodo actual"
        />
        <StatCard
          title="Presupuesto total"
          value={formatCurrency(stats.portfolioValue, "PEN", settings.currencyDecimals)}
          description="Suma de presupuestos generales vigentes."
          icon={<CircleDollarSign className="h-5 w-5" />}
          footer={`${stats.budgetsCount} presupuestos generales vigentes`}
          tone="primary"
        />
      </section>

      {showOnboarding ? (
        <Card className="dashboard-section-surface dashboard-surface-card dashboard-surface-card-primary bg-[var(--app-surface)]">
          <CardContent className="space-y-4 p-6">
            <OperationalSectionHeader
              title="Primeros pasos"
              description="Completa el flujo base para dejar lista la obra: empresa, proyecto, presupuesto, formula y primer seguimiento."
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {onboardingSteps.map((step) => (
                <OnboardingStepCard key={step.title} {...step} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="dashboard-section-surface dashboard-surface-card dashboard-surface-card-soft h-full bg-[linear-gradient(180deg,#f7fbff_0%,#eef7ff_100%)]">
          <CardContent className="flex h-full flex-col gap-5 p-6">
            <OperationalSectionHeader
              title="Continua donde te quedaste"
              description="Retoma rapido el proyecto con actividad mas reciente y salta directo a su detalle."
            />
            {stats.recentProject ? (
              <div className="flex flex-1 flex-col justify-between gap-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-2xl font-semibold text-[var(--app-text-strong)]">{stats.recentProject.name}</p>
                      <ProjectStatusBadge status={stats.recentProject.status} />
                    </div>
                    <p className="text-sm text-[var(--app-text-muted)]">{stats.recentProject.companyName}</p>
                    <p className="text-sm text-[var(--app-text-subtle)]">
                      Ultima actualizacion {formatDate(stats.recentProject.updatedAt, settings.dateFormat)}
                    </p>
                  </div>
                  {stats.recentProject.generalBudget ? (
                    <div className="dashboard-recent-budget-summary min-w-[220px] rounded-2xl border border-[var(--app-border-soft)] bg-white/85 px-4 py-3 text-right shadow-sm shadow-sky-100/40">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Presupuesto general</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCurrency(
                          stats.recentProject.generalBudget.totalAmount,
                          stats.recentProject.generalBudget.currency,
                          settings.currencyDecimals,
                        )}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <CompactStatCard label="Empresa" value={stats.recentProject.companyName} tone="slate" />
                  <CompactStatCard label="Estado" value={getProjectStatusLabel(stats.recentProject.status)} tone="sky" />
                  <CompactStatCard
                    label="Presupuesto"
                    value={stats.recentProject.generalBudget ? "Disponible" : "Pendiente"}
                    tone={stats.recentProject.generalBudget ? "emerald" : "amber"}
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <PrimaryLink href={`/projects/${stats.recentProject.id}`}>Continuar proyecto</PrimaryLink>
                  {stats.recentProject.generalBudget ? (
                    <SecondaryLink href={`/budgets/${stats.recentProject.generalBudget.id}`}>
                      Abrir presupuesto general
                    </SecondaryLink>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Aun no tienes proyectos activos"
                description="Crea tu primer proyecto para comenzar a trabajar con presupuestos, reajustes y seguimiento."
                href="/projects/new"
                action="Crear proyecto"
              />
            )}
          </CardContent>
        </Card>

        <Card className="dashboard-section-surface dashboard-surface-card dashboard-surface-card-soft h-full bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <CardContent className="flex h-full flex-col gap-4 p-6">
            <OperationalSectionHeader title="Acciones rapidas" description="Atajos para entrar al flujo principal sin rodeos." />
            <ActionLink
              href="/projects/new"
              title="Nuevo proyecto"
              description="Crea una obra y arranca con sus Sub Presupuestos base."
              icon={<FolderKanban className="h-5 w-5" />}
              tone="primary"
            />
            <div className="grid flex-1 content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <ActionLink
                href="/budgets/new"
                title="Nuevo presupuesto"
                description="Genera un presupuesto y conectalo a un proyecto."
                icon={<FileSpreadsheet className="h-5 w-5" />}
              />
              <ActionLink
                href="/projects"
                title="Ver proyectos"
                description="Revisa el portafolio completo y su estado actual."
                icon={<FolderKanban className="h-5 w-5" />}
              />
              <ActionLink
                href="/settings"
                title="Configuracion"
                description="Ajusta moneda, fechas y Sub Presupuestos iniciales."
                icon={<Settings2 className="h-5 w-5" />}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="min-h-full">
          <CardContent className="space-y-4 p-6">
            <OperationalPanel
              title="Pendientes por atender"
              description="Bandeja operativa para separar acciones automaticas y notas creadas por el equipo."
            />
            <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1">
              <PendingTabLink
                href={buildDashboardHref({
                  pendingTab: "actions",
                  priority: undefined,
                  pendingPage: 1,
                  activityPage: paginatedRecentActivity.page,
                })}
                label="Acciones pendientes"
                count={actionPendingItems.length}
                active={selectedPendingTab === "actions"}
              />
              <PendingTabLink
                href={buildDashboardHref({
                  pendingTab: "notes",
                  priority: undefined,
                  pendingPage: 1,
                  activityPage: paginatedRecentActivity.page,
                })}
                label="Notas por atender"
                count={notePendingItems.length}
                active={selectedPendingTab === "notes"}
                icon={<StickyNote className="h-3.5 w-3.5" />}
              />
            </div>
            {selectedPendingTab === "actions" && actionPendingItems.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <CompactStatCard label="Sin presupuesto" value={String(pendingTypeSummary.missingGeneralBudget)} tone="rose" />
                <CompactStatCard label="Sin formula" value={String(pendingTypeSummary.missingFormula)} tone="amber" />
                <CompactStatCard label="Sin reajustes" value={String(pendingTypeSummary.missingAdjustments)} tone="sky" />
                <CompactStatCard label="Sin actividad" value={String(pendingTypeSummary.noRecentActivity)} tone="slate" />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <FilterPillLink
                href={buildDashboardHref({
                  pendingTab: selectedPendingTab,
                  priority: undefined,
                  pendingPage: 1,
                  activityPage: paginatedRecentActivity.page,
                })}
                label="Todos"
                count={visiblePendingCounts.all}
                active={selectedPriority === "all"}
              />
              <FilterPillLink
                href={buildDashboardHref({
                  pendingTab: selectedPendingTab,
                  priority: "high",
                  pendingPage: 1,
                  activityPage: paginatedRecentActivity.page,
                })}
                label="Alta"
                count={visiblePendingCounts.high}
                active={selectedPriority === "high"}
                tone="rose"
              />
              <FilterPillLink
                href={buildDashboardHref({
                  pendingTab: selectedPendingTab,
                  priority: "medium",
                  pendingPage: 1,
                  activityPage: paginatedRecentActivity.page,
                })}
                label="Media"
                count={visiblePendingCounts.medium}
                active={selectedPriority === "medium"}
                tone="amber"
              />
              <FilterPillLink
                href={buildDashboardHref({
                  pendingTab: selectedPendingTab,
                  priority: "low",
                  pendingPage: 1,
                  activityPage: paginatedRecentActivity.page,
                })}
                label="Baja"
                count={visiblePendingCounts.low}
                active={selectedPriority === "low"}
                tone="slate"
              />
            </div>
            {filteredPendingItems.length === 0 ? (
              <EmptyState
                title={
                  visiblePendingItems.length === 0
                    ? selectedPendingTab === "notes"
                      ? "Sin notas por atender"
                      : "Todo al dia"
                    : "Sin pendientes en este filtro"
                }
                description={
                  visiblePendingItems.length === 0
                    ? selectedPendingTab === "notes"
                      ? "Las notas abiertas apareceran aqui como una lista separada de seguimiento."
                      : "No encontramos pendientes operativos en proyectos, presupuestos ni reajustes."
                    : "Prueba otra prioridad para revisar el resto de pendientes operativos."
                }
              />
            ) : (
              <div className="space-y-3">
                {groupedPendingItems.map((group) => (
                  <details
                    key={group.priority}
                    className="group overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm"
                    open
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 transition hover:bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)] marker:hidden">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ToneBadge label={getPriorityLabel(group.priority)} tone={getPriorityTone(group.priority)} />
                          <span className="text-sm font-medium text-[var(--app-text-strong)]">
                            {group.items.length} {group.items.length === 1 ? "pendiente" : "pendientes"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {summarizePendingGroupTypes(group.items).map((entry) => (
                            <span
                              key={`${group.priority}-${entry.type}`}
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                                getPendingSummaryBadgeClass(entry.type),
                              )}
                            >
                              {entry.count} {getPendingTypeLabel(entry.type)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition group-hover:bg-[var(--app-surface-muted)] group-open:rotate-90 group-open:bg-[var(--app-surface-muted)]">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </summary>
                    <div className="space-y-3 border-t border-[var(--app-border-soft)] px-4 py-4">
                      {group.items.map((item) => (
                        <DashboardRecordLink
                          key={item.id}
                          href={item.href}
                          tone="amber"
                          metaTitle={getPendingActionLabel(item.type)}
                          metaDetail={`Actualizado ${formatDate(item.updatedAt, settings.dateFormat)}`}
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-[var(--app-text-strong)]">{item.projectName}</p>
                              {item.type === "USER_NOTE_TASK" ? null : <ProjectStatusBadge status={item.status} />}
                              <ToneBadge label={getPendingTypeLabel(item.type)} tone={getPendingTypeTone(item.type)} />
                            </div>
                            <p className="text-sm text-[var(--app-text-muted)]">{item.companyName}</p>
                            <p className="text-sm text-[var(--app-text-subtle)]">{item.observation}</p>
                          </div>
                        </DashboardRecordLink>
                      ))}
                    </div>
                  </details>
                ))}
                <SectionPagination
                  currentPage={paginatedPendingItems.page}
                  totalPages={paginatedPendingItems.totalPages}
                  previousHref={buildDashboardHref({
                    pendingTab: selectedPendingTab,
                    priority: selectedPriority === "all" ? undefined : selectedPriority,
                    pendingPage: paginatedPendingItems.page - 1,
                    activityPage: paginatedRecentActivity.page,
                  })}
                  nextHref={buildDashboardHref({
                    pendingTab: selectedPendingTab,
                    priority: selectedPriority === "all" ? undefined : selectedPriority,
                    pendingPage: paginatedPendingItems.page + 1,
                    activityPage: paginatedRecentActivity.page,
                  })}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dashboard-surface-card dashboard-surface-card-soft min-h-full border-slate-200 bg-[linear-gradient(180deg,#f8fcff_0%,#f3f9ff_100%)]">
          <CardContent className="space-y-3 p-6">
            <OperationalSectionHeader
              title="Actividad reciente"
              description="Rastro operativo reciente para retomar contexto sin abrir varias vistas."
            />
            {stats.recentActivity.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <CompactStatCard label="Esta semana" value={String(recentActivitySummary.thisWeekCount)} tone="sky" />
                <CompactStatCard label="Mas reciente" value={recentActivitySummary.latestLabel} tone="slate" />
                <CompactStatCard label="Tipo dominante" value={recentActivitySummary.topTypeLabel} tone="sky" />
              </div>
            ) : null}
            {stats.recentActivity.length === 0 ? (
              <EmptyState
                title="Sin actividad reciente"
                description="Cuando edites proyectos, presupuestos o reajustes, veras aqui el rastro mas reciente."
              />
            ) : (
              <div className="space-y-3">
                {paginatedRecentActivity.items.map((item) => (
                  <DashboardRecordLink
                    key={item.id}
                    href={item.href}
                    tone="sky"
                    metaTitle={getActivityActionLabel(item.type)}
                    metaDetail={`Actualizado ${formatDate(item.createdAt, settings.dateFormat)}`}
                  >
                    <div className="flex items-start gap-3">
                      <EventTypeIcon type={item.type} />
                      <div className="min-w-0 flex-1">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <EventTypeBadge type={item.type} />
                            {item.projectName ? <ProjectActivityBadge projectName={item.projectName} /> : null}
                          </div>
                          <p className="truncate font-medium text-[var(--app-text-strong)]">{item.title}</p>
                          <p className="max-w-full truncate text-sm text-[var(--app-text-muted)]">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  </DashboardRecordLink>
                ))}
                <SectionPagination
                  currentPage={paginatedRecentActivity.page}
                  totalPages={paginatedRecentActivity.totalPages}
                  previousHref={buildDashboardHref({
                    pendingTab: selectedPendingTab,
                    priority: selectedPriority === "all" ? undefined : selectedPriority,
                    pendingPage: paginatedPendingItems.page,
                    activityPage: paginatedRecentActivity.page - 1,
                  })}
                  nextHref={buildDashboardHref({
                    pendingTab: selectedPendingTab,
                    priority: selectedPriority === "all" ? undefined : selectedPriority,
                    pendingPage: paginatedPendingItems.page,
                    activityPage: paginatedRecentActivity.page + 1,
                  })}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {canUseTemplates ? (
        <Card className="dashboard-surface-card dashboard-surface-card-soft border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <OperationalSectionHeader
              title="Plantillas reutilizables"
              description="Indicadores de biblioteca para acelerar nuevos presupuestos sin perder trazabilidad tecnica."
            />
            <SecondaryLink href="/templates">Abrir biblioteca</SecondaryLink>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <CompactStatCard
              label="Guardadas"
              value={String(stats.templateSummary.savedTemplatesCount)}
              tone="emerald"
            />
            <CompactStatCard
              label="Aplicadas"
              value={String(stats.templateSummary.templateBudgetApplicationCount)}
              tone="sky"
            />
            <CompactStatCard
              label="Mantenimiento"
              value={String(stats.templateSummary.templateMaintenanceEventCount)}
              tone="sky"
            />
            <CompactStatCard
              label="Partidas capturadas"
              value={String(stats.templateSummary.totalTemplateItems)}
              tone="amber"
            />
            <CompactStatCard
              label="Promedio por plantilla"
              value={String(stats.templateSummary.averageItemsPerTemplate)}
              tone="slate"
            />
          </div>
          {stats.templateSummary.latestTemplate ? (
            <DashboardRecordLink
              href={`/templates/budget/${stats.templateSummary.latestTemplate.id}`}
              tone="sky"
              metaTitle="Ver plantilla"
              metaDetail={`Actualizada ${formatDate(stats.templateSummary.latestTemplate.updatedAt, settings.dateFormat)}`}
            >
              <div className="flex items-start gap-3">
                <span className="dashboard-template-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <BookOpenCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-[var(--app-text-strong)]">{stats.templateSummary.latestTemplate.name}</p>
                  <p className="text-sm text-[var(--app-text-muted)]">
                    Ultima plantilla guardada con {stats.templateSummary.latestTemplate.itemCount} partidas capturadas.
                  </p>
                </div>
              </div>
            </DashboardRecordLink>
          ) : (
            <EmptyState
              title="Aun no hay plantillas guardadas"
              description="Guarda un presupuesto como plantilla para reutilizar estructura, partidas y APU en futuros proyectos."
              href="/templates"
              action="Explorar biblioteca"
            />
          )}
          </CardContent>
        </Card>
      ) : (
        <UpgradeCTA
          title="Plantillas disponibles en Pro"
          description="Guarda y reutiliza estructuras técnicas de presupuestos, partidas y APU sin reconstruir tu flujo."
          benefits={["Biblioteca de presupuestos", "Reutilización de estructuras y APU", "Aplicación rápida en nuevos proyectos"]}
        />
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="min-h-full">
          <CardContent className="space-y-4 p-6">
            <OperationalSectionHeader
              title="Proyectos recientes"
              description="Accesos directos para volver a las obras con mas movimiento."
            />
            {stats.projects.length === 0 ? (
              <EmptyState
                title="Aun no hay proyectos recientes"
                description="Empieza creando un proyecto y aqui apareceran sus accesos recientes."
              />
            ) : (
              stats.projects.map((project) => (
                <DashboardRecordLink
                  key={project.id}
                  href={`/projects/${project.id}`}
                  tone="sky"
                  metaTitle="Ver proyecto"
                  metaDetail={`Actualizado ${formatDate(project.updatedAt, settings.dateFormat)}`}
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[var(--app-text-strong)]">{project.name}</p>
                      <ProjectStatusBadge status={project.status} />
                    </div>
                    <p className="text-sm text-[var(--app-text-muted)]">{project.companyName}</p>
                    <p className="text-sm text-[var(--app-text-subtle)]">{project.location || "Ubicacion pendiente"}</p>
                  </div>
                </DashboardRecordLink>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-h-full">
          <CardContent className="space-y-4 p-6">
            <OperationalSectionHeader
              title="Presupuestos recientes"
              description="Ultimos movimientos del presupuesto general por proyecto."
            />
            {stats.budgets.length === 0 ? (
              <EmptyState
                title="Aun no hay presupuestos recientes"
                description="Cuando registres presupuestos generales, apareceran aqui para retomarlos rapido."
              />
            ) : (
              stats.budgets.map((budget) => (
                <DashboardRecordLink
                  key={budget.id}
                  href={`/budgets/${budget.id}`}
                  tone="sky"
                  metaTitle="Ver presupuesto"
                  metaDetail={`Actualizado ${formatDate(budget.updatedAt, settings.dateFormat)}`}
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[var(--app-text-strong)]">{budget.name}</p>
                      <Badge className="dashboard-budget-badge bg-sky-100 text-sky-700">Presupuesto general</Badge>
                    </div>
                    <p className="text-sm text-[var(--app-text-muted)]">{budget.projectName}</p>
                    <p className="text-sm text-[var(--app-text-subtle)]">
                      {formatCurrency(budget.totalAmount, budget.currency, settings.currencyDecimals)}
                    </p>
                  </div>
                </DashboardRecordLink>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Suspense fallback={<DashboardAnalyticsSectionSkeleton />}>
        <DashboardAnalyticsSection />
      </Suspense>

      {canUseKhipu ? (
        <Suspense fallback={<KhipuQualityMetricsSkeleton />}>
          <KhipuQualityMetrics />
        </Suspense>
      ) : null}
    </AppShell>
  );
}

const DASHBOARD_SECTION_PAGE_SIZE = 5;

function StatCard({
  title,
  value,
  description,
  icon,
  footer,
  tone = "default",
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  footer?: string;
  tone?: "default" | "attention" | "primary";
}) {
  const tones = {
    default: {
      card: "border-[var(--app-border-soft)] bg-[var(--app-surface)]",
      iconWrap: "bg-slate-100 text-slate-700",
      value: "text-slate-900",
      footer: "border-slate-100 text-slate-500",
    },
    attention: {
      card: "border-amber-200 bg-[linear-gradient(180deg,#fffaf0_0%,#fff1df_100%)] shadow-amber-100/70",
      iconWrap: "bg-amber-500 text-white",
      value: "text-slate-900",
      footer: "border-amber-200/80 text-amber-800",
    },
    primary: {
      card: "border-sky-200 bg-[linear-gradient(135deg,#f5fbff_0%,#e8f4ff_55%,#dcecff_100%)] shadow-sky-100/80",
      iconWrap: "bg-sky-600 text-white",
      value: "text-slate-950",
      footer: "border-sky-200/80 text-sky-800",
    },
  } as const;

  const palette = tones[tone];

  return (
    <Card className={cn(`dashboard-stat-card dashboard-stat-card-${tone}`, "overflow-hidden shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]", palette.card)}>
      <CardContent className="space-y-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-slate-500">{title}</p>
            <p className={cn("text-3xl font-semibold tracking-tight", palette.value)}>{value}</p>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          <span
            className={cn(
              "dashboard-stat-card-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-[0_14px_28px_-18px_rgba(15,23,42,0.24)]",
              palette.iconWrap,
            )}
          >
            {icon}
          </span>
        </div>
        {footer ? (
          <div className={cn("dashboard-stat-card-footer rounded-xl border px-3 py-2 text-xs font-medium", palette.footer)}>{footer}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActionLink({
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
      link: "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50",
      iconWrap: "bg-slate-100 text-slate-700",
      title: "text-slate-900",
      arrow: "text-slate-400 group-hover:text-sky-700",
    },
    primary: {
      link: "border-sky-200 bg-[linear-gradient(135deg,#f5fbff_0%,#edf7ff_100%)] hover:border-sky-300 hover:bg-sky-50",
      iconWrap: "bg-sky-600 text-white",
      title: "text-slate-950",
      arrow: "text-sky-600 group-hover:translate-x-0.5",
    },
  } as const;

  const palette = tones[tone];

  return (
    <Link
      href={href}
      className={cn(
        `dashboard-action-link dashboard-action-link-${tone} group flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.22)] transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-26px_rgba(15,23,42,0.26)]`,
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
        <span className="mt-1 block text-sm text-slate-500">{description}</span>
      </span>
      <span className={cn("mt-1 inline-flex shrink-0 transition", palette.arrow)}>
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

function OnboardingStepCard({
  completed,
  description,
  href,
  title,
}: {
} & DashboardOnboardingStep) {
  const content = (
    <div
      className={cn(
        `dashboard-onboarding-card ${completed ? "dashboard-onboarding-card-completed" : "dashboard-onboarding-card-pending"} group flex h-full flex-col justify-between rounded-2xl border px-4 py-4 transition`,
        completed
          ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
          : "border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] text-[var(--app-text-muted)] hover:border-sky-300 hover:bg-sky-50/50",
      )}
    >
      <div className="space-y-3">
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl",
            completed
              ? "bg-emerald-100 text-emerald-700"
              : "bg-[var(--app-surface-strong)] text-[var(--app-text-muted)] group-hover:bg-sky-100 group-hover:text-sky-700",
          )}
        >
          {completed ? <CheckCircle2 className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
        </span>
        <div>
          <p className="font-medium text-[var(--app-text-strong)]">{title}</p>
          <p className={cn("mt-1 text-sm leading-5", completed ? "text-emerald-800" : "text-[var(--app-text-muted)]")}>
            {description}
          </p>
        </div>
      </div>
      <span className={cn("mt-4 text-xs font-semibold uppercase tracking-[0.16em]", completed ? "text-emerald-700" : "text-sky-700")}>
        {completed ? "Completado" : "Continuar"}
      </span>
    </div>
  );

  if (completed) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

function DashboardRecordLink({
  href,
  children,
  metaTitle,
  metaDetail,
  tone = "sky",
}: {
  href: string;
  children: ReactNode;
  metaTitle: string;
  metaDetail: string;
  tone?: "sky" | "amber";
}) {
  const tones = {
    sky: "hover:border-sky-300 hover:bg-sky-50/40",
    amber: "hover:border-amber-300 hover:bg-amber-50/30",
  } as const;

  return (
    <Link
      href={href}
      className={cn(
        `dashboard-record-link dashboard-record-link-${tone} flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition lg:flex-row lg:items-center lg:justify-between`,
        tones[tone],
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <DashboardRecordMeta title={metaTitle} detail={metaDetail} />
    </Link>
  );
}

function DashboardRecordMeta({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="dashboard-record-meta w-full min-w-0 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500 lg:w-44 lg:shrink-0 lg:text-right">
      <p className="truncate font-medium text-slate-900">{title}</p>
      <p className="truncate">{detail}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="dashboard-empty-state rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-2">{description}</p>
      {href && action ? (
        <div className="mt-4">
          <PrimaryLink href={href}>{action}</PrimaryLink>
        </div>
      ) : null}
    </div>
  );
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="dashboard-primary-link inline-flex items-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium !text-white transition hover:bg-sky-700"
    >
      {children}
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="dashboard-secondary-link inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
    >
      {children}
    </Link>
  );
}

function PendingTabLink({
  href,
  label,
  count,
  active,
  icon,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "dashboard-pending-tab inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition sm:flex-none",
        active
          ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
          : "text-slate-500 hover:bg-white/70 hover:text-slate-900",
      )}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
      <span
        className={cn(
          "dashboard-pending-tab-count rounded-full px-2 py-0.5 text-[11px]",
          active ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

function getPriorityLabel(priority: "high" | "medium" | "low") {
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Media";
  return "Baja";
}

function getPriorityTone(priority: "high" | "medium" | "low") {
  if (priority === "high") return "rose" as const;
  if (priority === "medium") return "amber" as const;
  return "slate" as const;
}

function resolvePendingPriorityFilter(value: string | undefined) {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return "all";
}

function resolvePendingTab(value: string | undefined) {
  if (value === "notes") {
    return "notes";
  }

  return "actions";
}

function resolvePageNumber(value: string | undefined) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return parsedValue;
}

function paginateItems<T>(items: T[], requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const startIndex = (page - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page,
    totalPages,
  };
}

function buildDashboardHref({
  pendingTab,
  priority,
  pendingPage,
  activityPage,
}: {
  pendingTab?: "actions" | "notes";
  priority?: "high" | "medium" | "low";
  pendingPage?: number;
  activityPage?: number;
}) {
  const searchParams = new URLSearchParams();

  if (pendingTab === "notes") {
    searchParams.set("pendingTab", pendingTab);
  }

  if (priority) {
    searchParams.set("priority", priority);
  }

  if (pendingPage && pendingPage > 1) {
    searchParams.set("pendingPage", String(pendingPage));
  }

  if (activityPage && activityPage > 1) {
    searchParams.set("activityPage", String(activityPage));
  }

  const query = searchParams.toString();

  return query.length > 0 ? `/dashboard?${query}` : "/dashboard";
}

function EventTypeBadge({
  type,
}: {
  type: DashboardActivityItem["type"];
}) {
  const config = getEventTypeBadgeConfig(type);

  return <ToneBadge label={config.label} tone={config.tone} />;
}

function ProjectActivityBadge({ projectName }: { projectName: string }) {
  return (
    <span
      className="dashboard-project-activity-badge inline-flex max-w-[10rem] shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600"
      title={projectName}
    >
      <span className="block min-w-0 truncate whitespace-nowrap">{projectName}</span>
    </span>
  );
}

function EventTypeIcon({
  type,
}: {
  type: DashboardActivityItem["type"];
}) {
  const config = getEventTypeIconConfig(type);
  const Icon = config.icon;

  return (
    <span className={`dashboard-event-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.className}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function getActivityActionLabel(type: DashboardActivityItem["type"]) {
  if (type === "PROJECT_UPDATED" || type === "PROJECT_CREATED") {
    return "Abrir proyecto";
  }

  if (type === "GENERAL_BUDGET_UPDATED" || type === "GENERAL_BUDGET_CREATED") {
    return "Ver presupuesto";
  }

  if (type === "POLYNOMIAL_FORMULA_UPDATED" || type === "POLYNOMIAL_FORMULA_GENERATED") {
    return "Revisar formula";
  }

  if (type === "METRADO_DUPLICATED") {
    return "Abrir metrados";
  }

  if (type === "TEMPLATE_CHANGED") {
    return "Abrir biblioteca";
  }

  return "Ver reajuste";
}

function getEventTypeBadgeConfig(type: DashboardActivityItem["type"]) {
  if (type === "PROJECT_UPDATED" || type === "PROJECT_CREATED") {
    return {
      label: "Proyecto",
      tone: "slate" as const,
    };
  }

  if (type === "GENERAL_BUDGET_UPDATED" || type === "GENERAL_BUDGET_CREATED") {
    return {
      label: "Presupuesto",
      tone: "sky" as const,
    };
  }

  if (type === "POLYNOMIAL_FORMULA_UPDATED" || type === "POLYNOMIAL_FORMULA_GENERATED") {
    return {
      label: "Formula",
      tone: "violet" as const,
    };
  }

  if (type === "METRADO_DUPLICATED") {
    return {
      label: "Metrado",
      tone: "emerald" as const,
    };
  }

  if (type === "TEMPLATE_CHANGED") {
    return {
      label: "Plantilla",
      tone: "amber" as const,
    };
  }

  return {
    label: "Reajuste",
    tone: "emerald" as const,
  };
}

function getEventTypeIconConfig(type: DashboardActivityItem["type"]) {
  if (type === "PROJECT_UPDATED" || type === "PROJECT_CREATED") {
    return {
      icon: FolderKanban,
      className: "bg-slate-100 text-slate-700",
    };
  }

  if (type === "GENERAL_BUDGET_UPDATED" || type === "GENERAL_BUDGET_CREATED") {
    return {
      icon: FileSpreadsheet,
      className: "bg-sky-100 text-sky-700",
    };
  }

  if (type === "POLYNOMIAL_FORMULA_UPDATED" || type === "POLYNOMIAL_FORMULA_GENERATED") {
    return {
      icon: Sigma,
      className: "bg-violet-100 text-violet-700",
    };
  }

  if (type === "METRADO_DUPLICATED") {
    return {
      icon: Ruler,
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  if (type === "TEMPLATE_CHANGED") {
    return {
      icon: BookOpenCheck,
      className: "bg-amber-100 text-amber-700",
    };
  }

  return {
    icon: Calculator,
    className: "bg-emerald-100 text-emerald-700",
  };
}

function getPendingTypeLabel(type: DashboardPendingItem["type"]) {
  if (type === "MISSING_GENERAL_BUDGET") return "Presupuesto";
  if (type === "MISSING_POLYNOMIAL_FORMULA") return "Formula";
  if (type === "MISSING_ADJUSTMENTS") return "Reajuste";
  if (type === "USER_NOTE_TASK") return "Nota";
  return "Seguimiento";
}

function getPendingActionLabel(type: DashboardPendingItem["type"]) {
  if (type === "MISSING_GENERAL_BUDGET") return "Crear presupuesto";
  if (type === "MISSING_POLYNOMIAL_FORMULA") return "Generar formula";
  if (type === "MISSING_ADJUSTMENTS") return "Registrar reajuste";
  if (type === "USER_NOTE_TASK") return "Abrir nota";
  return "Revisar proyecto";
}

function getPendingTypeTone(type: DashboardPendingItem["type"]) {
  if (type === "MISSING_GENERAL_BUDGET") return "rose" as const;
  if (type === "MISSING_POLYNOMIAL_FORMULA") return "amber" as const;
  if (type === "MISSING_ADJUSTMENTS") return "sky" as const;
  if (type === "USER_NOTE_TASK") return "slate" as const;
  return "slate" as const;
}

function getPendingSummaryBadgeClass(type: DashboardPendingItem["type"]) {
  if (type === "MISSING_GENERAL_BUDGET") return "bg-rose-100 text-rose-700";
  if (type === "MISSING_POLYNOMIAL_FORMULA") return "bg-amber-100 text-amber-700";
  if (type === "MISSING_ADJUSTMENTS") return "bg-sky-100 text-sky-700";
  if (type === "USER_NOTE_TASK") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function summarizeRecentActivity(
  items: Array<{
    type: DashboardActivityItem["type"];
    createdAt: Date;
  }>,
) {
  const now = Date.now();
  const weekAgo = now - 1000 * 60 * 60 * 24 * 7;
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  }

  const topType = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  const latestItem = items[0];

  return {
    thisWeekCount: items.filter((item) => item.createdAt.getTime() >= weekAgo).length,
    latestLabel: latestItem ? formatRelativeActivityDay(latestItem.createdAt) : "Sin datos",
    topTypeLabel: topType ? getEventTypeBadgeConfig(topType as Parameters<typeof getEventTypeBadgeConfig>[0]).label : "Sin datos",
  };
}

function formatRelativeActivityDay(value: Date) {
  const diffDays = Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return "Hoy";
  }

  if (diffDays === 1) {
    return "Ayer";
  }

  if (diffDays < 7) {
    return `Hace ${diffDays} dias`;
  }

  return "Mas de 1 semana";
}

function summarizePendingTypes(
  items: Array<{
    type: DashboardPendingItem["type"];
  }>,
) {
  return {
    missingGeneralBudget: items.filter((item) => item.type === "MISSING_GENERAL_BUDGET").length,
    missingFormula: items.filter((item) => item.type === "MISSING_POLYNOMIAL_FORMULA").length,
    missingAdjustments: items.filter((item) => item.type === "MISSING_ADJUSTMENTS").length,
    noRecentActivity: items.filter((item) => item.type === "NO_RECENT_ACTIVITY").length,
  };
}

function summarizePendingGroupTypes(
  items: Array<{
    type: DashboardPendingItem["type"];
  }>,
) {
  const orderedTypes = [
    "MISSING_GENERAL_BUDGET",
    "MISSING_POLYNOMIAL_FORMULA",
    "MISSING_ADJUSTMENTS",
    "USER_NOTE_TASK",
    "NO_RECENT_ACTIVITY",
  ] as const;

  return orderedTypes
    .map((type) => ({
      type,
      count: items.filter((item) => item.type === type).length,
    }))
    .filter((entry) => entry.count > 0);
}

function groupPendingItemsByPriority(
  items: Array<{
    id: string;
    projectId: string;
    projectName: string;
    companyName: string;
    status: string;
    observation: string;
    priority: "high" | "medium" | "low";
    updatedAt: Date;
    href: string;
    type: DashboardPendingItem["type"];
  }>,
) {
  const orderedPriorities = ["high", "medium", "low"] as const;

  return orderedPriorities
    .map((priority) => ({
      priority,
      items: items.filter((item) => item.priority === priority),
    }))
    .filter((group) => group.items.length > 0);
}

