import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, CalendarDays, ChevronLeft, FileSpreadsheet, Ruler } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getMetradoProjectSummary } from "@/lib/data/metrados";
import { formatNumber } from "@/lib/utils";

import { ProjectSummaryClient } from "./client";
import { ResumenDateFilter } from "./date-filter";

type SearchParams = Promise<{ projectId?: string; dateFrom?: string; dateTo?: string }>;

export default async function MetradosResumenPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  const resolved = await searchParams;
  const projectId = resolved.projectId;
  const dateFrom = resolved.dateFrom ?? "";
  const dateTo = resolved.dateTo ?? "";

  if (!projectId) {
    redirect("/metrados-avanzados");
  }

  const summary = await getMetradoProjectSummary(projectId, session.user.id, {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const visibleUnits = (Object.entries(summary.totalsByUnit) as [string, number][])
    .filter(([, value]) => value !== 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <AppShell currentUser={session.user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] px-4 py-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/metrados-avanzados"
              className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Volver a metrados
            </Link>
            <div className="mb-1 mt-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              <BarChart3 className="h-4 w-4" />
              Resumen del proyecto
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Agregacion de metrados</h1>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {summary.totalSheets} {summary.totalSheets === 1 ? "hoja" : "hojas"} de metrado {dateFrom || dateTo ? "en el período seleccionado" : ""} &middot; Totales agrupados por unidad y tipo de plantilla
            </p>
          </div>
        </div>

        {/* Date filter bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <CalendarDays className="h-4 w-4 text-blue-600" />
          <span className="mr-1 text-xs font-medium text-slate-600">Filtrar por fecha de creación</span>
          <ResumenDateFilter
            key={`${dateFrom}-${dateTo}`}
            projectId={projectId}
            activeDateFrom={dateFrom}
            activeDateTo={dateTo}
            filteredCount={summary.totalSheets}
          />
        </div>

        {/* Temporal aggregation by month */}
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">Hojas creadas por mes</h2>
            </div>
          </CardHeader>
          <CardContent>
            {summary.totalsByMonth.length === 0 ? (
              <p className="text-sm text-slate-500">No hay datos temporales disponibles.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.totalsByMonth.map((entry) => {
                  const date = new Date(entry.year, entry.month - 1);
                  const monthLabel = date.toLocaleDateString("es-PE", {
                    month: "long",
                    year: "numeric",
                  });
                  const barWidth = Math.max(
                    8,
                    (entry.sheetCount / Math.max(...summary.totalsByMonth.map((m) => m.sheetCount))) * 100,
                  );

                  return (
                    <div key={`${entry.year}-${entry.month}`} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <span className="w-28 shrink-0 text-sm font-medium capitalize text-slate-700">
                        {monthLabel}
                      </span>
                      <div className="flex h-7 flex-1 items-center gap-2">
                        <div
                          className="h-3 rounded-full bg-blue-500/70 transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                        <span className="text-xs font-semibold tabular-nums text-slate-600">
                          {entry.sheetCount} {entry.sheetCount === 1 ? "hoja" : "hojas"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global totals by unit */}
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">Totales por unidad</h2>
            </div>
          </CardHeader>
          <CardContent>
            {visibleUnits.length === 0 ? (
              <p className="text-sm text-slate-500">No hay metrados con cantidades registradas.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleUnits.map(([unit, total]) => (
                  <div
                    key={unit}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:shadow-md"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{unit}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
                      {formatNumber(total, 3)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Breakdown by template type */}
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Ruler className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">Por tipo de plantilla</h2>
            </div>
          </CardHeader>
          <CardContent>
            {summary.totalsByTemplate.length === 0 ? (
              <p className="text-sm text-slate-500">No hay plantillas con metrados.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.totalsByTemplate.map((template) => {
                  const tVisible = (Object.entries(template.totalsByUnit) as [string, number][]).filter(
                    ([, v]) => v !== 0,
                  );

                  return (
                    <div key={template.templateType} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{template.templateName}</h3>
                          <p className="text-xs text-slate-500">{template.sheetCount} hojas</p>
                        </div>
                      </div>
                      {tVisible.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {tVisible.map(([unit, total]) => (
                            <span
                              key={unit}
                              className="inline-flex items-baseline gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
                            >
                              <span className="font-semibold tabular-nums text-slate-900">
                                {formatNumber(total, 3)}
                              </span>
                              <span className="text-slate-500">{unit}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">Sin cantidades</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sheet list */}
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">Hojas de metrado</h2>
            </div>
          </CardHeader>
          <CardContent>
            <ProjectSummaryClient sheets={summary.sheets} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
