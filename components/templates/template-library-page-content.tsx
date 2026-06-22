"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  Layers3,
  ReceiptText,
  Ruler,
  Search,
  SlidersHorizontal,
  Wrench,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { InfoCard } from "@/components/ui/info-cards";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { buildTemplateActionHref, filterTemplateLibraryItemsByCriteria } from "@/lib/templates/template-library";
import { cn } from "@/lib/utils";
import type { TemplateLibraryActivityEvent } from "@/lib/data/activity-events";
import type { TemplateLibraryItem, TemplateLibraryModule, TemplateLibrarySource } from "@/lib/templates/template-library";

const moduleLabels: Record<TemplateLibraryModule, string> = {
  BUDGET: "Presupuestos",
  APU: "APU",
  GENERAL_EXPENSES: "Gastos generales",
  METRADOS: "Metrados",
  FOOTER: "Pie de presupuesto",
};

const moduleDescriptions: Record<TemplateLibraryModule, string> = {
  BUDGET: "Estructuras iniciales para obras y presupuestos.",
  APU: "Bases tecnicas para analisis de precios unitarios.",
  GENERAL_EXPENSES: "Plantillas de gastos fijos y variables.",
  METRADOS: "Hojas con formulas de metrado reutilizables.",
  FOOTER: "Variables documentarias para cierre y exportacion.",
};

const moduleIcons = {
  BUDGET: FileSpreadsheet,
  APU: Wrench,
  GENERAL_EXPENSES: Layers3,
  METRADOS: Ruler,
  FOOTER: ReceiptText,
} satisfies Record<TemplateLibraryModule, typeof FileSpreadsheet>;

const moduleHrefs: Record<TemplateLibraryModule, string> = {
  BUDGET: "/projects/new",
  APU: "/partidas",
  GENERAL_EXPENSES: "/budgets",
  METRADOS: "/metrados-avanzados",
  FOOTER: "/budgets",
};

const sourceLabels: Record<TemplateLibrarySource, string> = {
  SYSTEM: "Sistema",
  WORKBOOK: "Workbook",
  USER: "Usuario",
};

const sourceFilterLabels: Record<SourceFilter, string> = {
  ALL: "Todos",
  SYSTEM: "Sistema",
  WORKBOOK: "Workbook",
  USER: "Usuario",
};

type ModuleFilter = TemplateLibraryModule | "ALL";
type SourceFilter = TemplateLibrarySource | "ALL";
type SortOption = "DEFAULT" | "NAME_ASC" | "UPDATED_DESC";
type TemplateFilterState = {
  query: string;
  moduleFilter: ModuleFilter;
  sourceFilter: SourceFilter;
  sortOption: SortOption;
};
type TagSuggestion = {
  tag: string;
  count: number;
};

const sortOptionLabels: Record<SortOption, string> = {
  DEFAULT: "Orden base",
  NAME_ASC: "Nombre A-Z",
  UPDATED_DESC: "Actualizadas",
};

export function TemplateLibraryPageContent({
  items,
  summary,
  activityEvents = [],
  initialFilters,
}: {
  items: TemplateLibraryItem[];
  summary: {
    total: number;
    modules: number;
    workbookTemplates: number;
    systemTemplates: number;
    userTemplates?: number;
  };
  activityEvents?: TemplateLibraryActivityEvent[];
  initialFilters?: {
    module?: ModuleFilter;
    source?: SourceFilter;
    query?: string;
    sort?: SortOption;
  };
}) {
  const [query, setQuery] = useState(initialFilters?.query ?? "");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>(initialFilters?.module ?? "ALL");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(initialFilters?.source ?? "ALL");
  const [sortOption, setSortOption] = useState<SortOption>(initialFilters?.sort ?? "DEFAULT");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deferredQuery = useDeferredValue(query);
  const currentFilterState = {
    query,
    moduleFilter,
    sourceFilter,
    sortOption,
  };
  const filteredItems = useMemo(
    () =>
      filterTemplateLibraryItemsByCriteria(items, {
        module: moduleFilter,
        source: sourceFilter,
        query: deferredQuery,
      }),
    [deferredQuery, items, moduleFilter, sourceFilter],
  );
  const sourceShortcutItems = useMemo(
    () =>
      filterTemplateLibraryItemsByCriteria(items, {
        module: moduleFilter,
        query: deferredQuery,
      }),
    [deferredQuery, items, moduleFilter],
  );
  const tagSuggestionItems = useMemo(
    () =>
      filterTemplateLibraryItemsByCriteria(items, {
        module: moduleFilter,
        source: sourceFilter,
      }),
    [items, moduleFilter, sourceFilter],
  );
  const tagSuggestions = useMemo(() => getSuggestedTemplateTags(tagSuggestionItems), [tagSuggestionItems]);
  const visibleItems = useMemo(() => sortTemplateLibraryItems(filteredItems, sortOption), [filteredItems, sortOption]);
  const groupedItems = groupTemplatesByModule(visibleItems);
  const hasActiveFilters = query.trim() !== "" || moduleFilter !== "ALL" || sourceFilter !== "ALL" || sortOption !== "DEFAULT";
  const activeFilterCount = countActiveTemplateFilters(currentFilterState);
  const shareHref = buildTemplateLibraryHref(pathname, searchParams.toString(), currentFilterState);
  const [copiedShareHref, setCopiedShareHref] = useState(false);

  function applyFilters(nextFilters: Partial<TemplateFilterState>) {
    const nextState = { ...currentFilterState, ...nextFilters };

    if (nextFilters.query !== undefined) setQuery(nextFilters.query);
    if (nextFilters.moduleFilter !== undefined) setModuleFilter(nextFilters.moduleFilter);
    if (nextFilters.sourceFilter !== undefined) setSourceFilter(nextFilters.sourceFilter);
    if (nextFilters.sortOption !== undefined) setSortOption(nextFilters.sortOption);

    router.replace(buildTemplateLibraryHref(pathname, searchParams.toString(), nextState), { scroll: false });
  }

  async function copyShareHref() {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    const absoluteHref =
      typeof window === "undefined" ? shareHref : new URL(shareHref, window.location.origin).toString();

    await navigator.clipboard.writeText(absoluteHref);
    setCopiedShareHref(true);
    window.setTimeout(() => setCopiedShareHref(false), 1600);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <InfoCard label="Plantillas" value={String(summary.total)} tone="sky" />
        <InfoCard label="Modulos cubiertos" value={String(summary.modules)} tone="slate" />
        <InfoCard label="Sistema" value={String(summary.systemTemplates)} tone="slate" />
        <InfoCard label="Workbook" value={String(summary.workbookTemplates)} tone="amber" />
        <InfoCard label="Usuario" value={String(summary.userTemplates ?? 0)} tone="emerald" />
      </div>

      <TemplateActivityPanel events={activityEvents} />

      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--app-text)]">
              <SlidersHorizontal className="h-4 w-4 text-sky-700" />
              Filtros de biblioteca
              {activeFilterCount > 0 ? (
                <Badge className="bg-[var(--app-primary-muted)] text-sky-700">{formatActiveFilterCount(activeFilterCount)}</Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>
                {visibleItems.length} de {items.length} visibles
              </Badge>
              <Button className="h-8 gap-2 rounded-lg px-3 text-xs" variant="outline" onClick={() => void copyShareHref()}>
                {copiedShareHref ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedShareHref ? "Copiado" : "Copiar enlace"}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Atajos por origen">
            {(["ALL", "SYSTEM", "WORKBOOK", "USER"] as SourceFilter[]).map((source) => {
              const isSelectedSource = sourceFilter === source;
              return (
                <Button
                  key={source}
                  aria-pressed={isSelectedSource}
                  className="h-8 rounded-lg px-3 text-xs"
                  variant={isSelectedSource ? "default" : "outline"}
                  onClick={() => {
                    applyFilters({ query: "", sourceFilter: isSelectedSource && source !== "ALL" ? "ALL" : source });
                  }}
                >
                  {sourceFilterLabels[source]} ({countTemplatesBySource(sourceShortcutItems, source)})
                </Button>
              );
            })}
          </div>
          {tagSuggestions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2" aria-label="Etiquetas sugeridas">
              <span className="text-xs font-medium text-[var(--app-text-muted)]">Etiquetas</span>
              {tagSuggestions.map((suggestion) => {
                const isSelectedTag = query.trim().toLocaleLowerCase("es-PE") === suggestion.tag.toLocaleLowerCase("es-PE");

                return (
                  <Button
                    key={suggestion.tag}
                    aria-pressed={isSelectedTag}
                    className="h-8 rounded-lg px-3 text-xs"
                    variant={isSelectedTag ? "default" : "outline"}
                    onClick={() => {
                      applyFilters({ query: isSelectedTag ? "" : suggestion.tag });
                    }}
                  >
                    {suggestion.tag} ({suggestion.count})
                  </Button>
                );
              })}
            </div>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_200px_190px_auto]">
            <label className="relative block">
              <span className="sr-only">Buscar plantillas</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-subtle)]" />
              <Input
                aria-label="Buscar plantillas"
                className="pl-9 pr-10"
                placeholder="Buscar por nombre, etiqueta, modulo u origen"
                value={query}
                onChange={(event) => applyFilters({ query: event.target.value })}
              />
              {query.trim() ? (
                <button
                  type="button"
                  aria-label="Limpiar busqueda de plantillas"
                  className="absolute right-2 top-1/2 rounded-full p-1 text-[var(--app-text-subtle)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
                  onClick={() => applyFilters({ query: "" })}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </label>
            <Select
              aria-label="Filtrar por modulo"
              value={moduleFilter}
              onChange={(event) => applyFilters({ moduleFilter: readModuleFilter(event.currentTarget.value) })}
            >
              <option value="ALL">Todos los modulos</option>
              {(Object.keys(moduleLabels) as TemplateLibraryModule[]).map((module) => (
                <option key={module} value={module}>
                  {moduleLabels[module]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrar por origen"
              value={sourceFilter}
              onChange={(event) => applyFilters({ sourceFilter: readSourceFilter(event.currentTarget.value) })}
            >
              <option value="ALL">Todos los origenes</option>
              {(Object.keys(sourceLabels) as TemplateLibrarySource[]).map((source) => (
                <option key={source} value={source}>
                  {sourceLabels[source]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Ordenar plantillas"
              value={sortOption}
              onChange={(event) => applyFilters({ sortOption: readSortOption(event.currentTarget.value) })}
            >
              <option value="DEFAULT">{sortOptionLabels.DEFAULT}</option>
              <option value="NAME_ASC">{sortOptionLabels.NAME_ASC}</option>
              <option value="UPDATED_DESC">{sortOptionLabels.UPDATED_DESC}</option>
            </Select>
            <Button
              className="gap-2"
              disabled={!hasActiveFilters}
              variant="outline"
              onClick={() => {
                applyFilters({
                  query: "",
                  moduleFilter: "ALL",
                  sourceFilter: "ALL",
                  sortOption: "DEFAULT",
                });
              }}
            >
              <X className="h-4 w-4" />
              Limpiar
            </Button>
          </div>
          {hasActiveFilters ? (
            <ActiveFilterChips
              moduleFilter={moduleFilter}
              query={query}
              sortOption={sortOption}
              sourceFilter={sourceFilter}
              onClearModule={() => applyFilters({ moduleFilter: "ALL" })}
              onClearQuery={() => applyFilters({ query: "" })}
              onClearSort={() => applyFilters({ sortOption: "DEFAULT" })}
              onClearSource={() => applyFilters({ sourceFilter: "ALL" })}
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-5">
        {(Object.keys(moduleLabels) as TemplateLibraryModule[]).map((module) => {
          const Icon = moduleIcons[module];
          const moduleItems = groupedItems.get(module) ?? [];
          const allModuleItems = items.filter((item) => item.module === module);
          const sourceBreakdown = countTemplateSources(allModuleItems);
          const isSelectedModule = moduleFilter === module;

          return (
            <Card
              key={module}
              className={cn("border-[var(--app-border)] bg-[var(--app-surface)] transition", isSelectedModule ? "border-sky-300 ring-2 ring-sky-100" : null)}
            >
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2 text-[var(--app-text)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--app-text-strong)]">{moduleLabels[module]}</p>
                    <p className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">{moduleDescriptions[module]}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge className="bg-[var(--app-primary-muted)] text-sky-700">{formatTemplateCount(moduleItems.length)}</Badge>
                  <Button
                    aria-pressed={isSelectedModule}
                    className="h-8 rounded-lg px-3 text-xs"
                    variant={isSelectedModule ? "default" : "outline"}
                    onClick={() => {
                      applyFilters({
                        query: "",
                        sourceFilter: "ALL",
                        moduleFilter: isSelectedModule ? "ALL" : module,
                      });
                    }}
                  >
                    {isSelectedModule ? "Quitar filtro" : `Ver ${formatTemplateCount(allModuleItems.length)}`}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5" aria-label={`Origenes de ${moduleLabels[module]}`}>
                  {(Object.keys(sourceLabels) as TemplateLibrarySource[]).map((source) =>
                    sourceBreakdown[source] > 0 ? (
                      <button
                        key={source}
                        type="button"
                        aria-label={`Ver ${sourceLabels[source]} en ${moduleLabels[module]}`}
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                          getSourceBadgeClass(source),
                        )}
                        onClick={() => {
                          applyFilters({ query: "", moduleFilter: module, sourceFilter: source });
                        }}
                      >
                        {sourceLabels[source]} {sourceBreakdown[source]}
                      </button>
                    ) : null,
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-4" aria-live="polite">
        {!visibleItems.length ? (
          <EmptyStatePanel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>No hay plantillas que coincidan con los filtros actuales.</span>
              <Button
                className="h-8 gap-2 rounded-lg px-3 text-xs"
                variant="outline"
                onClick={() => {
                  applyFilters({
                    query: "",
                    moduleFilter: "ALL",
                    sourceFilter: "ALL",
                    sortOption: "DEFAULT",
                  });
                }}
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </Button>
            </div>
          </EmptyStatePanel>
        ) : null}
        {(Object.keys(moduleLabels) as TemplateLibraryModule[]).map((module) => {
          const moduleItems = groupedItems.get(module) ?? [];
          if (!moduleItems.length) return null;

          return (
            <section key={module} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-[var(--app-text-strong)]">{moduleLabels[module]}</p>
                    <Badge>{formatVisibleTemplateCount(moduleItems.length)}</Badge>
                  </div>
                  <p className="text-sm text-[var(--app-text-muted)]">{moduleDescriptions[module]}</p>
                </div>
                <Link
                  href={moduleHrefs[module]}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-text)] transition hover:border-sky-300 hover:bg-[var(--app-primary-muted)]"
                >
                  Abrir modulo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {moduleItems.map((item) => (
                  <TemplateCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ActiveFilterChips({
  moduleFilter,
  query,
  sortOption,
  sourceFilter,
  onClearModule,
  onClearQuery,
  onClearSort,
  onClearSource,
}: {
  moduleFilter: ModuleFilter;
  query: string;
  sortOption: SortOption;
  sourceFilter: SourceFilter;
  onClearModule: () => void;
  onClearQuery: () => void;
  onClearSort: () => void;
  onClearSource: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Filtros activos">
      {query.trim() ? (
        <ActiveFilterChip label={`Busqueda: ${query.trim()}`} onClear={onClearQuery} clearLabel="Quitar busqueda" />
      ) : null}
      {moduleFilter !== "ALL" ? (
        <ActiveFilterChip
          label={`Modulo: ${moduleLabels[moduleFilter]}`}
          onClear={onClearModule}
          clearLabel="Quitar filtro de modulo"
        />
      ) : null}
      {sourceFilter !== "ALL" ? (
        <ActiveFilterChip
          label={`Origen: ${sourceLabels[sourceFilter]}`}
          onClear={onClearSource}
          clearLabel="Quitar filtro de origen"
        />
      ) : null}
      {sortOption !== "DEFAULT" ? (
        <ActiveFilterChip
          label={`Orden: ${sortOptionLabels[sortOption]}`}
          onClear={onClearSort}
          clearLabel="Quitar orden"
        />
      ) : null}
    </div>
  );
}

function countActiveTemplateFilters(filters: TemplateFilterState) {
  return [
    filters.query.trim() !== "",
    filters.moduleFilter !== "ALL",
    filters.sourceFilter !== "ALL",
    filters.sortOption !== "DEFAULT",
  ].filter(Boolean).length;
}

function formatActiveFilterCount(count: number) {
  return `${count} ${count === 1 ? "activo" : "activos"}`;
}

function ActiveFilterChip({ label, clearLabel, onClear }: { label: string; clearLabel: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--app-text-muted)]">
      {label}
      <button
        type="button"
        aria-label={clearLabel}
        className="rounded-full p-0.5 text-[var(--app-text-subtle)] transition hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
        onClick={onClear}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function buildTemplateLibraryHref(pathname: string, currentQueryString: string, filters: TemplateFilterState) {
  const params = new URLSearchParams(currentQueryString);
  setTemplateLibraryQueryParam(params, "q", filters.query.trim());
  setTemplateLibraryQueryParam(params, "module", filters.moduleFilter === "ALL" ? "" : filters.moduleFilter);
  setTemplateLibraryQueryParam(params, "source", filters.sourceFilter === "ALL" ? "" : filters.sourceFilter);
  setTemplateLibraryQueryParam(params, "sort", filters.sortOption === "DEFAULT" ? "" : filters.sortOption);

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function setTemplateLibraryQueryParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
    return;
  }

  params.delete(key);
}

function TemplateActivityPanel({ events }: { events: TemplateLibraryActivityEvent[] }) {
  const summary = getTemplateActivitySummary(events);

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-[var(--app-text-strong)]">Actividad de plantillas</p>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">
              Ultimos cambios y aplicaciones registrados en la biblioteca reutilizable.
            </p>
          </div>
          <Badge>{events.length} recientes</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <TemplateActivityMetric
            label="Aplicaciones"
            value={formatActivityCount(summary.applications, "aplicacion", "aplicaciones")}
          />
          <TemplateActivityMetric
            label="Mantenimiento"
            value={formatActivityCount(summary.maintenance, "mantenimiento", "mantenimientos")}
          />
          <TemplateActivityMetric label="Ultima actividad" value={summary.latestDateLabel ?? "Sin actividad"} />
        </div>
        {events.length > 0 ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={event.href}
                className="group flex items-start justify-between gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm transition hover:border-sky-200 hover:bg-[var(--app-primary-muted)]"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-[var(--app-text-strong)]">{event.title}</span>
                  <span className="mt-1 block truncate text-[var(--app-text-muted)]">{event.detail}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--app-surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--app-text-muted)] group-hover:bg-[var(--app-surface)]">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatActivityDate(event.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-5 text-sm text-[var(--app-text-muted)]">
            Todavia no hay actividad registrada para plantillas guardadas o aplicadas.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TemplateActivityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
      <p className="text-xs font-medium uppercase text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{value}</p>
    </div>
  );
}

function TemplateCard({ item }: { item: TemplateLibraryItem }) {
  const updatedDateLabel = formatTemplateUpdatedDate(item.updatedAt);
  const hiddenTagCount = Math.max(item.tags.length - 4, 0);
  const hiddenTagLabel = formatHiddenTagLabel(hiddenTagCount);

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm shadow-slate-100/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--app-text-strong)]">{item.name}</p>
          <p className="mt-2 text-sm leading-5 text-[var(--app-text-muted)]">{item.description}</p>
          {updatedDateLabel ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--app-text-muted)]">
              <Clock3 className="h-3.5 w-3.5 text-[var(--app-text-subtle)]" />
              Actualizada {updatedDateLabel}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
            getSourceBadgeClass(item.source),
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {getSourceLabel(item.source)}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.tags.slice(0, 4).map((tag) => (
          <Badge key={tag}>
            {tag}
          </Badge>
        ))}
        {hiddenTagCount > 0 ? (
          <Badge aria-label={hiddenTagLabel} title={hiddenTagLabel}>
            {formatHiddenTagCount(hiddenTagCount)}
          </Badge>
        ) : null}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--app-border-soft)] pt-3 text-sm">
        <span className="text-[var(--app-text-muted)]">{item.status === "AVAILABLE" ? "Disponible" : "Base operativa"}</span>
        <Link
          href={buildTemplateActionHref(item)}
          aria-label={`${item.actionLabel}: ${item.name}`}
          className="inline-flex items-center gap-2 font-medium text-sky-700"
        >
          <BookOpen className="h-4 w-4" />
          {item.actionLabel}
        </Link>
      </div>
    </div>
  );
}

function formatActivityDate(value: Date) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
  }).format(value);
}

function formatActivityMetricDate(value: Date) {
  return formatActivityDate(value).replace(/[.-]/g, " ").replace(/\s+/g, " ").trim();
}

function getTemplateActivitySummary(events: TemplateLibraryActivityEvent[]) {
  const applications = events.filter(isTemplateApplicationEvent).length;
  const latestEvent = events[0];

  return {
    applications,
    maintenance: events.length - applications,
    latestDateLabel: latestEvent ? formatActivityMetricDate(latestEvent.createdAt) : null,
  };
}

function isTemplateApplicationEvent(event: TemplateLibraryActivityEvent) {
  return event.type === "BUDGET_CREATED" && event.title === "Presupuesto creado desde plantilla";
}

function formatActivityCount(count: number, singularLabel: string, pluralLabel: string) {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

function formatTemplateUpdatedDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTemplateCount(count: number) {
  return `${count} ${count === 1 ? "plantilla" : "plantillas"}`;
}

function formatVisibleTemplateCount(count: number) {
  return `${count} ${count === 1 ? "visible" : "visibles"}`;
}

function formatHiddenTagCount(count: number) {
  return `+${count} ${count === 1 ? "etiqueta" : "etiquetas"}`;
}

function formatHiddenTagLabel(count: number) {
  return `${count} ${count === 1 ? "etiqueta adicional" : "etiquetas adicionales"}`;
}

function getSourceLabel(source: TemplateLibraryItem["source"]) {
  if (source === "WORKBOOK") return "Workbook";
  if (source === "USER") return "Usuario";
  return "Sistema";
}

function getSourceBadgeClass(source: TemplateLibraryItem["source"]) {
  if (source === "WORKBOOK") return "bg-[color:rgba(245,158,11,0.16)] text-amber-700";
  if (source === "USER") return "bg-[color:rgba(16,185,129,0.16)] text-emerald-700";
  return "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]";
}

function groupTemplatesByModule(items: TemplateLibraryItem[]) {
  return items.reduce((grouped, item) => {
    const current = grouped.get(item.module) ?? [];
    grouped.set(item.module, [...current, item]);
    return grouped;
  }, new Map<TemplateLibraryModule, TemplateLibraryItem[]>());
}

function countTemplatesBySource(items: TemplateLibraryItem[], source: SourceFilter) {
  if (source === "ALL") {
    return items.length;
  }

  return items.filter((item) => item.source === source).length;
}

function countTemplateSources(items: TemplateLibraryItem[]) {
  return items.reduce(
    (counts, item) => ({
      ...counts,
      [item.source]: counts[item.source] + 1,
    }),
    {
      SYSTEM: 0,
      WORKBOOK: 0,
      USER: 0,
    } satisfies Record<TemplateLibrarySource, number>,
  );
}

function getSuggestedTemplateTags(items: TemplateLibraryItem[]): TagSuggestion[] {
  const tagCounts = items.reduce((counts, item) => {
    item.tags.forEach((tag) => {
      const trimmedTag = tag.trim();
      if (!trimmedTag) return;

      counts.set(trimmedTag, (counts.get(trimmedTag) ?? 0) + 1);
    });

    return counts;
  }, new Map<string, number>());

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => {
      const countComparison = right.count - left.count;
      if (countComparison !== 0) {
        return countComparison;
      }

      return left.tag.localeCompare(right.tag, "es-PE");
    })
    .slice(0, 6);
}

function sortTemplateLibraryItems(items: TemplateLibraryItem[], sortOption: SortOption) {
  if (sortOption === "DEFAULT") {
    return items;
  }

  return [...items].sort((left, right) => {
    if (sortOption === "NAME_ASC") {
      return left.name.localeCompare(right.name);
    }

    const dateComparison = getTemplateTimestamp(right.updatedAt) - getTemplateTimestamp(left.updatedAt);
    if (dateComparison !== 0) {
      return dateComparison;
    }

    return left.name.localeCompare(right.name);
  });
}

function getTemplateTimestamp(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function readModuleFilter(value: string): ModuleFilter {
  return value === "ALL" || isTemplateLibraryModule(value) ? value : "ALL";
}

function readSourceFilter(value: string): SourceFilter {
  return value === "ALL" || isTemplateLibrarySource(value) ? value : "ALL";
}

function readSortOption(value: string): SortOption {
  return value === "NAME_ASC" || value === "UPDATED_DESC" ? value : "DEFAULT";
}

function isTemplateLibraryModule(value: string): value is TemplateLibraryModule {
  return Object.hasOwn(moduleLabels, value);
}

function isTemplateLibrarySource(value: string): value is TemplateLibrarySource {
  return Object.hasOwn(sourceLabels, value);
}
