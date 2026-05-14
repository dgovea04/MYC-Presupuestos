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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/data/dashboard";
import { getUserSettings } from "@/lib/data/settings";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ priority?: string }>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const [stats, settings] = await Promise.all([getDashboardStats(session!.user.id), getUserSettings(session!.user.id)]);
  const selectedPriority = resolvePendingPriorityFilter(resolvedSearchParams.priority);
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
  const groupedPendingItems = groupPendingItemsByPriority(filteredPendingItems);

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

      <section className="grid items-start gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-slate-200 bg-[linear-gradient(180deg,#f7fbff_0%,#eef7ff_100%)]">
          <CardHeader>
            <CardTitle>Continua donde te quedaste</CardTitle>
            <CardDescription>
              Retoma rapido el proyecto con actividad mas reciente y salta directo a su detalle.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {stats.recentProject ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-2xl font-semibold text-slate-900">{stats.recentProject.name}</p>
                      <Badge>{stats.recentProject.status}</Badge>
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
                  <ContinueInfoCard
                    label="Empresa"
                    value={stats.recentProject.companyName}
                    tone="slate"
                  />
                  <ContinueInfoCard
                    label="Estado"
                    value={stats.recentProject.status}
                    tone="sky"
                  />
                  <ContinueInfoCard
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

        <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <CardHeader>
            <CardTitle>Acciones rapidas</CardTitle>
            <CardDescription>Atajos para entrar al flujo principal sin rodeos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActionLink
              href="/projects/new"
              title="Nuevo proyecto"
              description="Crea una obra y arranca con sus especialidades base."
              icon={<FolderKanban className="h-5 w-5" />}
              tone="primary"
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
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
                description="Ajusta moneda, fechas y especialidades iniciales."
                icon={<Settings2 className="h-5 w-5" />}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="min-h-full">
          <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#fffdf8_0%,#fffaf0_100%)]">
            <CardTitle>Pendientes por atender</CardTitle>
            <CardDescription>
              Bandeja operativa para detectar proyectos sin presupuesto, formula o reajustes registrados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.pendingItems.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MiniStat label="Sin presupuesto" value={String(pendingTypeSummary.missingGeneralBudget)} tone="rose" />
                <MiniStat label="Sin formula" value={String(pendingTypeSummary.missingFormula)} tone="amber" />
                <MiniStat label="Sin reajustes" value={String(pendingTypeSummary.missingAdjustments)} tone="sky" />
                <MiniStat label="Sin actividad" value={String(pendingTypeSummary.noRecentActivity)} tone="slate" />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <PriorityFilterLink href="/dashboard" label="Todos" count={pendingCounts.all} active={selectedPriority === "all"} />
              <PriorityFilterLink href="/dashboard?priority=high" label="Alta" count={pendingCounts.high} active={selectedPriority === "high"} />
              <PriorityFilterLink href="/dashboard?priority=medium" label="Media" count={pendingCounts.medium} active={selectedPriority === "medium"} />
              <PriorityFilterLink href="/dashboard?priority=low" label="Baja" count={pendingCounts.low} active={selectedPriority === "low"} />
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
                          <Badge className={getPriorityBadgeClass(group.priority)}>{getPriorityLabel(group.priority)}</Badge>
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
                        <Link
                          key={`${item.projectId}-${item.type}`}
                          href={item.href}
                          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-amber-300 hover:bg-amber-50/30 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-slate-900">{item.projectName}</p>
                              <Badge>{item.status}</Badge>
                              <Badge className={getPendingTypeBadgeClass(item.type)}>{getPendingTypeLabel(item.type)}</Badge>
                            </div>
                            <p className="text-sm text-slate-600">{item.companyName}</p>
                            <p className="text-sm text-slate-500">{item.observation}</p>
                          </div>
                          <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500 lg:text-right">
                            <p className="font-medium text-slate-700">{getPendingActionLabel(item.type)}</p>
                            <p>Actualizado {formatDate(item.updatedAt, settings.dateFormat)}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-full border-slate-200 bg-[linear-gradient(180deg,#f8fcff_0%,#f3f9ff_100%)]">
          <CardHeader className="bg-transparent">
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>Rastro operativo reciente para retomar contexto sin abrir varias vistas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentActivity.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Esta semana" value={String(recentActivitySummary.thisWeekCount)} tone="sky" />
                <MiniStat label="Mas reciente" value={recentActivitySummary.latestLabel} tone="slate" />
                <MiniStat label="Tipo dominante" value={recentActivitySummary.topTypeLabel} tone="violet" />
              </div>
            ) : null}
            {stats.recentActivity.length === 0 ? (
              <EmptyState
                title="Sin actividad reciente"
                description="Cuando edites proyectos, presupuestos o reajustes, veras aqui el rastro mas reciente."
              />
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-sky-300 hover:bg-sky-50/40 lg:flex-row lg:items-center lg:justify-between"
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
                    <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500 lg:text-right">
                      <p className="font-medium text-slate-700">{getActivityActionLabel(item.type)}</p>
                      <p>Actualizado {formatDate(item.createdAt, settings.dateFormat)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="min-h-full">
          <CardHeader>
            <CardTitle>Proyectos recientes</CardTitle>
            <CardDescription>Accesos directos para volver a las obras con mas movimiento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.projects.length === 0 ? (
              <EmptyState
                title="Aun no hay proyectos recientes"
                description="Empieza creando un proyecto y aqui apareceran sus accesos recientes."
              />
            ) : (
              stats.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-sky-300 hover:bg-sky-50/40 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{project.name}</p>
                      <Badge>{project.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{project.companyName}</p>
                    <p className="text-sm text-slate-500">{project.location || "Ubicacion pendiente"}</p>
                  </div>
                  <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500 lg:text-right">
                    <p className="font-medium text-slate-700">Ver proyecto</p>
                    <p>Actualizado {formatDate(project.updatedAt, settings.dateFormat)}</p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-h-full">
          <CardHeader>
            <CardTitle>Presupuestos recientes</CardTitle>
            <CardDescription>Ultimos movimientos del presupuesto general por proyecto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.budgets.length === 0 ? (
              <EmptyState
                title="Aun no hay presupuestos recientes"
                description="Cuando registres presupuestos generales, apareceran aqui para retomarlos rapido."
              />
            ) : (
              stats.budgets.map((budget) => (
                <Link
                  key={budget.id}
                  href={`/budgets/${budget.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-sky-300 hover:bg-sky-50/40 lg:flex-row lg:items-center lg:justify-between"
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
                  <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500 lg:text-right">
                    <p className="font-medium text-slate-700">Ver presupuesto</p>
                    <p>Actualizado {formatDate(budget.updatedAt, settings.dateFormat)}</p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

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
    <Card className={cn("overflow-hidden shadow-sm", palette.card)}>
      <CardContent className="space-y-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-slate-500">{title}</p>
            <p className={cn("text-3xl font-semibold tracking-tight", palette.value)}>{value}</p>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm", palette.iconWrap)}>
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
      className={cn("group flex items-start gap-3 rounded-2xl border px-4 py-3 transition", palette.link)}
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

function ContinueInfoCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "sky" | "emerald" | "amber";
}) {
  const tones = {
    slate: "border-slate-200 bg-white/80 text-slate-700",
    sky: "border-sky-100 bg-white/80 text-sky-700",
    emerald: "border-emerald-100 bg-white/80 text-emerald-700",
    amber: "border-amber-100 bg-white/80 text-amber-700",
  } as const;

  return (
    <div className={cn("rounded-2xl border px-4 py-3 shadow-sm", tones[tone])}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
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

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "sky" | "slate" | "violet" | "rose" | "amber";
}) {
  const tones = {
    sky: "border-sky-100 bg-white/80 text-sky-700",
    slate: "border-slate-200 bg-white/80 text-slate-700",
    violet: "border-violet-100 bg-white/80 text-violet-700",
    rose: "border-rose-100 bg-white/80 text-rose-700",
    amber: "border-amber-100 bg-white/80 text-amber-700",
  } as const;

  return (
    <div className={`rounded-2xl border px-3 py-3 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
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

function getPriorityBadgeClass(priority: "high" | "medium" | "low") {
  if (priority === "high") return "bg-rose-100 text-rose-700";
  if (priority === "medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function getPriorityLabel(priority: "high" | "medium" | "low") {
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Media";
  return "Baja";
}

function resolvePendingPriorityFilter(value: string | undefined) {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return "all";
}

function PriorityFilterLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  const palette = getPriorityFilterPalette(label);

  return (
    <Link
      href={href}
      className={
        active
          ? `inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium !text-white ${palette.active}`
          : `inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm font-medium transition ${palette.inactive}`
      }
    >
      {label}
      <span
        className={
          active
            ? `rounded-full px-2 py-0.5 text-[11px] font-semibold !text-white ${palette.activeCount}`
            : `rounded-full px-2 py-0.5 text-[11px] font-semibold ${palette.inactiveCount}`
        }
      >
        {count}
      </span>
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

  return <Badge className={config.className}>{config.label}</Badge>;
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
      className: "bg-slate-100 text-slate-700",
    };
  }

  if (type === "GENERAL_BUDGET_UPDATED" || type === "GENERAL_BUDGET_CREATED") {
    return {
      label: "Presupuesto",
      className: "bg-sky-100 text-sky-700",
    };
  }

  if (type === "POLYNOMIAL_FORMULA_UPDATED" || type === "POLYNOMIAL_FORMULA_GENERATED") {
    return {
      label: "Formula",
      className: "bg-violet-100 text-violet-700",
    };
  }

  return {
    label: "Reajuste",
    className: "bg-emerald-100 text-emerald-700",
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

function getPriorityFilterPalette(label: string) {
  if (label === "Alta") {
    return {
      active: "bg-rose-600 hover:bg-rose-700",
      inactive: "border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50",
      activeCount: "bg-white/15",
      inactiveCount: "bg-rose-100 text-rose-700",
    };
  }

  if (label === "Media") {
    return {
      active: "bg-amber-500 hover:bg-amber-600",
      inactive: "border-amber-200 text-amber-700 hover:border-amber-300 hover:bg-amber-50",
      activeCount: "bg-white/15",
      inactiveCount: "bg-amber-100 text-amber-700",
    };
  }

  if (label === "Baja") {
    return {
      active: "bg-slate-600 hover:bg-slate-700",
      inactive: "border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50",
      activeCount: "bg-white/15",
      inactiveCount: "bg-slate-100 text-slate-600",
    };
  }

  return {
    active: "bg-slate-900 hover:bg-slate-800",
    inactive: "border-slate-300 text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700",
    activeCount: "bg-white/15",
    inactiveCount: "bg-slate-100 text-slate-500",
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

function getPendingTypeBadgeClass(
  type: "MISSING_GENERAL_BUDGET" | "MISSING_POLYNOMIAL_FORMULA" | "MISSING_ADJUSTMENTS" | "NO_RECENT_ACTIVITY",
) {
  if (type === "MISSING_GENERAL_BUDGET") return "bg-rose-100 text-rose-700";
  if (type === "MISSING_POLYNOMIAL_FORMULA") return "bg-amber-100 text-amber-700";
  if (type === "MISSING_ADJUSTMENTS") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
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
