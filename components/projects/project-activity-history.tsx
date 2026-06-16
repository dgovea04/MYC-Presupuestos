"use client";

import Link from "next/link";
import { Clock3, History, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionPagination } from "@/components/ui/section-pagination";
import { useDebounce } from "@/hooks/use-debounce";
import { cn, formatDate } from "@/lib/utils";
import type { ProjectActivityEvent } from "@/lib/data/activity-events";
import type { DateFormatOption } from "@/types/settings";

const PAGE_SIZE = 5;

const activityTypeLabels: Record<ProjectActivityEvent["type"], string> = {
  PROJECT_CREATED: "Proyecto",
  PROJECT_UPDATED: "Proyecto",
  BUDGET_CREATED: "Presupuesto",
  BUDGET_UPDATED: "Presupuesto",
  POLYNOMIAL_FORMULA_GENERATED: "Formula",
  POLYNOMIAL_FORMULA_UPDATED: "Formula",
  ADJUSTMENT_REGISTERED: "Reajuste",
};

const FILTER_LABELS = ["Todos", "Proyecto", "Presupuesto", "Formula", "Reajuste"] as const;
type FilterLabel = (typeof FILTER_LABELS)[number];

const labelToEventTypes: Record<FilterLabel, ProjectActivityEvent["type"][]> = {
  Todos: ["PROJECT_CREATED", "PROJECT_UPDATED", "BUDGET_CREATED", "BUDGET_UPDATED", "POLYNOMIAL_FORMULA_GENERATED", "POLYNOMIAL_FORMULA_UPDATED", "ADJUSTMENT_REGISTERED"],
  Proyecto: ["PROJECT_CREATED", "PROJECT_UPDATED"],
  Presupuesto: ["BUDGET_CREATED", "BUDGET_UPDATED"],
  Formula: ["POLYNOMIAL_FORMULA_GENERATED", "POLYNOMIAL_FORMULA_UPDATED"],
  Reajuste: ["ADJUSTMENT_REGISTERED"],
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function ProjectActivityHistory({
  events,
  dateFormat,
}: {
  events: ProjectActivityEvent[];
  dateFormat: DateFormatOption;
}) {
  const [filter, setFilter] = useState<FilterLabel>("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [page, setPage] = useState(1);

  const filteredEvents = useMemo(() => {
    const typeFiltered = filter === "Todos"
      ? events
      : events.filter((event) => labelToEventTypes[filter].includes(event.type));

    const normalizedQuery = normalizeSearchText(debouncedSearch);
    if (!normalizedQuery) {
      return typeFiltered;
    }

    return typeFiltered.filter((event) => {
      const searchText = normalizeSearchText(`${event.title} ${event.detail}`);
      return searchText.includes(normalizedQuery);
    });
  }, [events, filter, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const visibleEvents = filteredEvents.slice(startIndex, startIndex + PAGE_SIZE);

  // Clamp page when filtered events change (filter toggle, search, or events refresh)
  useEffect(() => {
    setPage((prev) => Math.min(prev, Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE))));
  }, [filteredEvents.length]);

  const filterCounts = useMemo(() => {
    const counts: Record<FilterLabel, number> = {
      Todos: events.length,
      Proyecto: 0,
      Presupuesto: 0,
      Formula: 0,
      Reajuste: 0,
    };
    for (const event of events) {
      const label = activityTypeLabels[event.type] as FilterLabel;
      if (label !== undefined) {
        counts[label]++;
      }
    }
    return counts;
  }, [events]);

  return (
    <section id="historial">
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-700">
              <History className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Historial del proyecto</CardTitle>
              <CardDescription>
                Trazabilidad reciente de cambios registrados para la obra y sus presupuestos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {events.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {FILTER_LABELS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFilter(label)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition",
                    filter === label
                      ? "bg-slate-900 !text-white hover:bg-slate-800"
                      : "border border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700",
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      filter === label
                        ? "bg-white/15 !text-white"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {filterCounts[label]}
                  </span>
                </button>
              ))}
            </div>
          )}
          {events.length > 0 && (
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en el historial..."
              />
            </div>
          )}
          {filteredEvents.length ? (
            <div className="space-y-3">
              {visibleEvents.map((event) => (
                <Link
                  key={event.id}
                  href={event.href}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:bg-sky-50/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {activityTypeLabels[event.type]}
                      </span>
                      <p className="font-medium text-slate-900">{event.title}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{event.detail}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                    <Clock3 className="h-4 w-4" />
                    {formatDate(event.createdAt, dateFormat)}
                  </span>
                </Link>
              ))}
              <SectionPagination
                currentPage={page}
                totalPages={totalPages}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <p className="font-medium text-slate-900">
                {events.length === 0
                  ? "Sin actividad registrada"
                  : `Sin eventos de tipo "${filter}"`}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {events.length === 0
                  ? "Los cambios importantes del proyecto apareceran aqui cuando se creen o actualicen presupuestos, formulas y reajustes."
                  : searchQuery
                    ? "Prueba con otro termino de busqueda para encontrar eventos en el historial."
                    : "Prueba con otro filtro para ver el resto del historial del proyecto."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
