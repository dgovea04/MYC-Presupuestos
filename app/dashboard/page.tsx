import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  ChevronRight,
  CircleDollarSign,
  FileSpreadsheet,
  FolderKanban,
  Settings2,
  Sigma,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CompactStatCard } from "@/components/ui/compact-stat-card";
import { ProjectStatusBadge } from "@/components/ui/context-badges";
import { FilterPillLink } from "@/components/ui/filter-pill-link";
import { ToneBadge } from "@/components/ui/context-badges";
import { OperationalPanel, OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import { getAuthSession } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/data/dashboard";
import { getProjectStatusLabel } from "@/lib/project-status";
import { getUserSettings } from "@/lib/data/settings";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ priority?: string; pendingPage?: string; activityPage?: string }>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const [stats, settings] = await Promise.all([getDashboardStats(session!.user.id), getUserSettings(session!.user.id)]);
  const selectedPriority = resolvePendingPriorityFilter(resolvedSearchParams.priority);
  const requestedPendingPage = resolvePageNumber(resolvedSearchParams.pendingPage);
  const requestedActivityPage = resolvePageNumber(resolvedSearchParams.activityPage);
  const pendingCounts = {
    all: stats.pendingItems.length,
    high: stats.pendingItems.filter((item) => item.priority === "high").length,
    medium: stats.pendingItems.filter((item) => item.priority === "medium").length,
    low: stats.pendingItems.filter((item) => item.priority === "low").length,
  };
  const filteredPendingItems =
    selectedPriority === "all"
      ? stats.pendingItems
      : stats.pendingItems.filter((item) => item.priority === selectedPriority);
  const recentActivitySummary = summarizeRecentActivity(stats.recentActivity);
  const pendingTypeSummary = summarizePendingTypes(stats.pendingItems);
  const paginatedPendingItems = paginateItems(filteredPendingItems, requestedPendingPage, DASHBOARD_SECTION_PAGE_SIZE);
  const paginatedRecentActivity = paginateItems(stats.recentActivity, requestedActivityPage, DASHBOARD_SECTION_PAGE_SIZE);
  const groupedPendingItems = groupPendingItemsByPriority(paginatedPendingItems.items);

  return (
    <AppShell settings={settings}>
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

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="h-full border-slate-200 bg-[linear-gradient(180deg,#f7fbff_0%,#eef7ff_100%)]">
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
                      <p className="text-2xl font-semibold text-slate-900">{stats.recentProject.name}</p>
                      <ProjectStatusBadge status={stats.recentProject.status} />
                    </div>
                    <p className="text-sm text-slate-600">{stats.recentProject.companyName}</p>
                    <p className="text-sm text-slate-500">
                      Ultima actualizacion {formatDate(stats.recentProject.updatedAt, settings.dateFormat)}
                    </p>
                  </div>
                  {stats.recentProject.generalBudget ? (
                    <div className="min-w-[220px] rounded-2xl border border-sky-100 bg-white/85 px-4 py-3 text-right shadow-sm shadow-sky-100/40">
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

        <Card className="h-full border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
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

      <section className="grid items-start gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="min-h-full">
          <CardContent className="space-y-4 p-6">
            <OperationalPanel
              title="Pendientes por atender"
              description="Bandeja operativa para detectar proyectos sin presupuesto, formula o reajustes registrados."
            />
            {stats.pendingItems.length > 0 ? (
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
                  priority: undefined,
                  pendingPage: 1,
                  activityPage: paginatedRecentActivity.page,
                })}
                label="Todos"
                count={pendingCounts.all}
                active={selectedPriority === "all"}
              />
              <FilterPillLink
                href={buildDashboardHref({
                  priority: "high",
                  pendingPage: 1,
                  activityPage: paginatedRecentActivity.page,
                })}
                label="Alta"
                count={pendingCounts.high}
                active={selectedPriority === "high"}
                tone="rose"
              />
              <FilterPillLink
                href={buildDashboardHref({
                  priority: "medium",
                  pendingPage: 1,
                  activityPage: paginatedRecentActivity.page,
                })}
                label="Media"
                count={pendingCounts.medium}
                active={selectedPriority === "medium"}
                tone="amber"
              />
              <FilterPillLink
                href={buildDashboardHref({
                  priority: "low",
                  pendingPage: 1,
                  activityPage: paginatedRecentActivity.page,
                })}
                label="Baja"
                count={pendingCounts.low}
                active={selectedPriority === "low"}
                tone="slate"
              />
            </div>
            {filteredPendingItems.length === 0 ? (
              <EmptyState
                title={stats.pendingItems.length === 0 ? "Todo al dia" : "Sin pendientes en este filtro"}
                description={
                  stats.pendingItems.length === 0
                    ? "No encontramos pendientes operativos en proyectos, presupuestos ni reajustes."
                    : "Prueba otra prioridad para revisar el resto de pendientes operativos."
                }
              />
            ) : (
              <div className="space-y-3">
                {groupedPendingItems.map((group) => (
                  <details
                    key={group.priority}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100/60"
                    open
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 marker:hidden">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ToneBadge label={getPriorityLabel(group.priority)} tone={getPriorityTone(group.priority)} />
                          <span className="text-sm font-medium text-slate-900">
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
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition group-hover:bg-slate-100 group-open:rotate-90 group-open:bg-slate-100">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </summary>
                    <div className="space-y-3 border-t border-slate-100 px-4 py-4">
                      {group.items.map((item) => (
                        <DashboardRecordLink
                          key={`${item.projectId}-${item.type}`}
                          href={item.href}
                          tone="amber"
                          metaTitle={getPendingActionLabel(item.type)}
                          metaDetail={`Actualizado ${formatDate(item.updatedAt, settings.dateFormat)}`}
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-slate-900">{item.projectName}</p>
                              <ProjectStatusBadge status={item.status} />
                              <ToneBadge label={getPendingTypeLabel(item.type)} tone={getPendingTypeTone(item.type)} />
                            </div>
                            <p className="text-sm text-slate-600">{item.companyName}</p>
                            <p className="text-sm text-slate-500">{item.observation}</p>
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
                    priority: selectedPriority === "all" ? undefined : selectedPriority,
                    pendingPage: paginatedPendingItems.page - 1,
                    activityPage: paginatedRecentActivity.page,
                  })}
                  nextHref={buildDashboardHref({
                    priority: selectedPriority === "all" ? undefined : selectedPriority,
                    pendingPage: paginatedPendingItems.page + 1,
                    activityPage: paginatedRecentActivity.page,
                  })}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-full border-slate-200 bg-[linear-gradient(180deg,#f8fcff_0%,#f3f9ff_100%)]">
          <CardContent className="space-y-3 p-6">
            <OperationalSectionHeader
              title="Actividad reciente"
              description="Rastro operativo reciente para retomar contexto sin abrir varias vistas."
            />
            {stats.recentActivity.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <CompactStatCard label="Esta semana" value={String(recentActivitySummary.thisWeekCount)} tone="sky" />
                <CompactStatCard label="Mas reciente" value={recentActivitySummary.latestLabel} tone="slate" />
                <CompactStatCard label="Tipo dominante" value={recentActivitySummary.topTypeLabel} tone="violet" />
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
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <EventTypeBadge type={item.type} />
                            <p className="font-medium text-slate-900">{item.title}</p>
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-600">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  </DashboardRecordLink>
                ))}
                <SectionPagination
                  currentPage={paginatedRecentActivity.page}
                  totalPages={paginatedRecentActivity.totalPages}
                  previousHref={buildDashboardHref({
                    priority: selectedPriority === "all" ? undefined : selectedPriority,
                    pendingPage: paginatedPendingItems.page,
                    activityPage: paginatedRecentActivity.page - 1,
                  })}
                  nextHref={buildDashboardHref({
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
                      <p className="font-medium text-slate-900">{project.name}</p>
                      <ProjectStatusBadge status={project.status} />
                    </div>
                    <p className="text-sm text-slate-600">{project.companyName}</p>
                    <p className="text-sm text-slate-500">{project.location || "Ubicacion pendiente"}</p>
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
                      <p className="font-medium text-slate-900">{budget.name}</p>
                      <Badge className="bg-sky-100 text-sky-700">Presupuesto general</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{budget.projectName}</p>
                    <p className="text-sm text-slate-500">
                      {formatCurrency(budget.totalAmount, budget.currency, settings.currencyDecimals)}
                    </p>
                  </div>
                </DashboardRecordLink>
              ))
            )}
          </CardContent>
        </Card>
      </section>
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
      card: "border-slate-200 bg-white",
      iconWrap: "bg-slate-100 text-slate-700",
      value: "text-slate-900",
      footer: "border-slate-100 text-slate-500",
    },
    attention: {
      card: "border-amber-200 bg-[linear-gradient(180deg,#fffaf0_0%,#fff1df_100%)] shadow-amber-100/70",
      iconWrap: "bg-amber-500 text-white",
      value: "text-amber-950",
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
    <Card className={cn("overflow-hidden border-slate-200/90 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)] transition-colors", palette.card)}>
      <CardContent className="space-y-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-slate-500">{title}</p>
            <p className={cn("text-3xl font-semibold tracking-tight", palette.value)}>{value}</p>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          <span
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-[0_14px_28px_-18px_rgba(15,23,42,0.24)]",
              palette.iconWrap,
            )}
          >
            {icon}
          </span>
        </div>
        {footer ? (
          <div className={cn("rounded-xl border px-3 py-2 text-xs font-medium", palette.footer)}>{footer}</div>
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
        <span className="mt-1 block text-sm text-slate-500">{description}</span>
      </span>
      <span className={cn("mt-1 inline-flex shrink-0 transition", palette.arrow)}>
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
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
        "flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition lg:flex-row lg:items-center lg:justify-between",
        tones[tone],
      )}
    >
      {children}
      <DashboardRecordMeta title={metaTitle} detail={metaDetail} />
    </Link>
  );
}

function DashboardRecordMeta({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500 lg:text-right">
      <p className="font-medium text-slate-700">{title}</p>
      <p>{detail}</p>
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(241,245,249,0.9)_100%)] px-4 py-6 text-sm text-slate-600">
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
      className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium !text-white transition hover:bg-slate-800"
    >
      {children}
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
    >
      {children}
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
  priority,
  pendingPage,
  activityPage,
}: {
  priority?: "high" | "medium" | "low";
  pendingPage?: number;
  activityPage?: number;
}) {
  const searchParams = new URLSearchParams();

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

function SectionPagination({
  currentPage,
  totalPages,
  previousHref,
  nextHref,
}: {
  currentPage: number;
  totalPages: number;
  previousHref: string;
  nextHref: string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
      <span className="mr-auto text-xs text-slate-500">
        Pagina {currentPage} de {totalPages}
      </span>
      <MinimalPaginationLink href={previousHref} disabled={currentPage <= 1}>
        Anterior
      </MinimalPaginationLink>
      <MinimalPaginationLink href={nextHref} disabled={currentPage >= totalPages}>
        Siguiente
      </MinimalPaginationLink>
    </div>
  );
}

function MinimalPaginationLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:border-sky-300 hover:text-sky-700"
    >
      {children}
    </Link>
  );
}

function EventTypeBadge({
  type,
}: {
  type:
    | "PROJECT_UPDATED"
    | "PROJECT_CREATED"
    | "GENERAL_BUDGET_UPDATED"
    | "GENERAL_BUDGET_CREATED"
    | "POLYNOMIAL_FORMULA_UPDATED"
    | "POLYNOMIAL_FORMULA_GENERATED"
    | "ADJUSTMENT_REGISTERED";
}) {
  const config = getEventTypeBadgeConfig(type);

  return <ToneBadge label={config.label} tone={config.tone} />;
}

function EventTypeIcon({
  type,
}: {
  type:
    | "PROJECT_UPDATED"
    | "PROJECT_CREATED"
    | "GENERAL_BUDGET_UPDATED"
    | "GENERAL_BUDGET_CREATED"
    | "POLYNOMIAL_FORMULA_UPDATED"
    | "POLYNOMIAL_FORMULA_GENERATED"
    | "ADJUSTMENT_REGISTERED";
}) {
  const config = getEventTypeIconConfig(type);
  const Icon = config.icon;

  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.className}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function getActivityActionLabel(
  type:
    | "PROJECT_UPDATED"
    | "PROJECT_CREATED"
    | "GENERAL_BUDGET_UPDATED"
    | "GENERAL_BUDGET_CREATED"
    | "POLYNOMIAL_FORMULA_UPDATED"
    | "POLYNOMIAL_FORMULA_GENERATED"
    | "ADJUSTMENT_REGISTERED",
) {
  if (type === "PROJECT_UPDATED" || type === "PROJECT_CREATED") {
    return "Abrir proyecto";
  }

  if (type === "GENERAL_BUDGET_UPDATED" || type === "GENERAL_BUDGET_CREATED") {
    return "Ver presupuesto";
  }

  if (type === "POLYNOMIAL_FORMULA_UPDATED" || type === "POLYNOMIAL_FORMULA_GENERATED") {
    return "Revisar formula";
  }

  return "Ver reajuste";
}

function getEventTypeBadgeConfig(
  type:
    | "PROJECT_UPDATED"
    | "PROJECT_CREATED"
    | "GENERAL_BUDGET_UPDATED"
    | "GENERAL_BUDGET_CREATED"
    | "POLYNOMIAL_FORMULA_UPDATED"
    | "POLYNOMIAL_FORMULA_GENERATED"
    | "ADJUSTMENT_REGISTERED",
) {
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

  return {
    label: "Reajuste",
    tone: "emerald" as const,
  };
}

function getEventTypeIconConfig(
  type:
    | "PROJECT_UPDATED"
    | "PROJECT_CREATED"
    | "GENERAL_BUDGET_UPDATED"
    | "GENERAL_BUDGET_CREATED"
    | "POLYNOMIAL_FORMULA_UPDATED"
    | "POLYNOMIAL_FORMULA_GENERATED"
    | "ADJUSTMENT_REGISTERED",
) {
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

  return {
    icon: Calculator,
    className: "bg-emerald-100 text-emerald-700",
  };
}

function getPendingTypeLabel(
  type: "MISSING_GENERAL_BUDGET" | "MISSING_POLYNOMIAL_FORMULA" | "MISSING_ADJUSTMENTS" | "NO_RECENT_ACTIVITY",
) {
  if (type === "MISSING_GENERAL_BUDGET") return "Presupuesto";
  if (type === "MISSING_POLYNOMIAL_FORMULA") return "Formula";
  if (type === "MISSING_ADJUSTMENTS") return "Reajuste";
  return "Seguimiento";
}

function getPendingActionLabel(
  type: "MISSING_GENERAL_BUDGET" | "MISSING_POLYNOMIAL_FORMULA" | "MISSING_ADJUSTMENTS" | "NO_RECENT_ACTIVITY",
) {
  if (type === "MISSING_GENERAL_BUDGET") return "Crear presupuesto";
  if (type === "MISSING_POLYNOMIAL_FORMULA") return "Generar formula";
  if (type === "MISSING_ADJUSTMENTS") return "Registrar reajuste";
  return "Revisar proyecto";
}

function getPendingTypeTone(
  type: "MISSING_GENERAL_BUDGET" | "MISSING_POLYNOMIAL_FORMULA" | "MISSING_ADJUSTMENTS" | "NO_RECENT_ACTIVITY",
) {
  if (type === "MISSING_GENERAL_BUDGET") return "rose" as const;
  if (type === "MISSING_POLYNOMIAL_FORMULA") return "amber" as const;
  if (type === "MISSING_ADJUSTMENTS") return "sky" as const;
  return "slate" as const;
}

function getPendingSummaryBadgeClass(
  type: "MISSING_GENERAL_BUDGET" | "MISSING_POLYNOMIAL_FORMULA" | "MISSING_ADJUSTMENTS" | "NO_RECENT_ACTIVITY",
) {
  if (type === "MISSING_GENERAL_BUDGET") return "bg-rose-50 text-rose-700";
  if (type === "MISSING_POLYNOMIAL_FORMULA") return "bg-amber-50 text-amber-700";
  if (type === "MISSING_ADJUSTMENTS") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

function summarizeRecentActivity(
  items: Array<{
    type:
      | "PROJECT_UPDATED"
      | "PROJECT_CREATED"
      | "GENERAL_BUDGET_UPDATED"
      | "GENERAL_BUDGET_CREATED"
      | "POLYNOMIAL_FORMULA_UPDATED"
      | "POLYNOMIAL_FORMULA_GENERATED"
      | "ADJUSTMENT_REGISTERED";
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
    type: "MISSING_GENERAL_BUDGET" | "MISSING_POLYNOMIAL_FORMULA" | "MISSING_ADJUSTMENTS" | "NO_RECENT_ACTIVITY";
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
    type: "MISSING_GENERAL_BUDGET" | "MISSING_POLYNOMIAL_FORMULA" | "MISSING_ADJUSTMENTS" | "NO_RECENT_ACTIVITY";
  }>,
) {
  const orderedTypes = [
    "MISSING_GENERAL_BUDGET",
    "MISSING_POLYNOMIAL_FORMULA",
    "MISSING_ADJUSTMENTS",
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
    projectId: string;
    projectName: string;
    companyName: string;
    status: string;
    observation: string;
    priority: "high" | "medium" | "low";
    updatedAt: Date;
    href: string;
    type: "MISSING_GENERAL_BUDGET" | "MISSING_POLYNOMIAL_FORMULA" | "MISSING_ADJUSTMENTS" | "NO_RECENT_ACTIVITY";
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

