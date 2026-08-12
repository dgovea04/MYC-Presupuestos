import {
  SkeletonBlock,
  SkeletonButton,
  SkeletonCard,
  SkeletonIcon,
  SkeletonTable,
  SkeletonToolbar,
  type SkeletonTableColumn,
} from "@/components/ui/loading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const labels = {
  projects: "Cargando proyectos",
  budgets: "Cargando presupuestos",
  resources: "Cargando catalogo de insumos",
  partidas: "Cargando catalogo de partidas",
  templates: "Cargando plantillas",
  metrados: "Cargando metrados",
};

type CatalogSkeletonKind = keyof typeof labels;

const columnsByKind: Record<CatalogSkeletonKind, SkeletonTableColumn[]> = {
  projects: [
    { id: "name", width: "w-full" },
    { id: "status", width: "w-24" },
    { id: "date", width: "w-24", align: "right" },
    { id: "actions", width: "w-16", align: "right" },
  ],
  budgets: [
    { id: "name", width: "w-full" },
    { id: "currency", width: "w-20" },
    { id: "amount", width: "w-28", align: "right" },
    { id: "actions", width: "w-20", align: "right" },
  ],
  resources: [
    { id: "code", width: "w-24", sticky: true },
    { id: "description", width: "w-full" },
    { id: "unit", width: "w-16" },
    { id: "price", width: "w-24", align: "right" },
    { id: "actions", width: "w-16", align: "right" },
  ],
  partidas: [
    { id: "code", width: "w-24", sticky: true },
    { id: "description", width: "w-full" },
    { id: "unit", width: "w-16" },
    { id: "apu", width: "w-24", align: "right" },
    { id: "actions", width: "w-16", align: "right" },
  ],
  templates: [],
  metrados: [],
};

export function CatalogPageSkeleton({ kind }: { kind: CatalogSkeletonKind }) {
  return (
    <section aria-busy="true" aria-label={labels[kind]} className="space-y-4" role="status">
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[var(--app-surface-elevated)] md:flex-row md:items-start md:justify-between">
          <CatalogHeaderSkeleton />
          <div className="flex flex-wrap gap-2 md:justify-end">
            <SkeletonButton size="sm" />
            {kind !== "resources" ? <SkeletonButton size="sm" /> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {kind === "templates" ? <TemplateLibrarySkeletonContent /> : null}
          {kind === "metrados" ? <MetradosSkeletonContent /> : null}
          {kind !== "templates" && kind !== "metrados" ? (
            <>
              <div data-skeleton-section="catalog-toolbar">
                <SkeletonToolbar search filters={2} actions={1} />
              </div>
              <div data-skeleton-section="catalog-table">
                <SkeletonTable aria-label={labels[kind]} columns={columnsByKind[kind]} rowCount={8} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function CatalogHeaderSkeleton() {
  return (
    <div className="flex min-w-0 items-start gap-3" data-skeleton-section="catalog-header">
      <SkeletonIcon className="h-11 w-11 rounded-2xl" rounded={false} />
      <div className="min-w-0 space-y-2">
        <SkeletonBlock className="h-7 w-56" radius="md" />
        <SkeletonBlock className="h-4 w-[min(34rem,70vw)]" radius="md" />
      </div>
    </div>
  );
}

function TemplateLibrarySkeletonContent() {
  return (
    <div className="space-y-6" data-skeleton-section="template-library">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-2 rounded-2xl border border-[var(--app-border-soft)] px-4 py-3">
            <SkeletonBlock className="h-4 w-24" radius="md" />
            <SkeletonBlock className="h-6 w-16" radius="md" />
          </div>
        ))}
      </div>
      <SkeletonCard contentClassName="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-48" radius="md" />
            <SkeletonBlock className="h-4 w-80" radius="md" />
          </div>
          <SkeletonBlock className="h-6 w-24" radius="full" />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-14 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-12 rounded-2xl" />
          ))}
        </div>
      </SkeletonCard>
      <SkeletonCard contentClassName="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <SkeletonBlock className="h-5 w-48" radius="md" />
          <SkeletonButton size="sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-8 w-24" radius="full" />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_200px_190px_auto]">
          <SkeletonBlock className="h-10 w-full" radius="xl" />
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-10 w-full" radius="xl" />
          ))}
          <SkeletonButton />
        </div>
      </SkeletonCard>
      <div className="grid gap-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index} contentClassName="space-y-4">
            <div className="flex items-start gap-3">
              <SkeletonIcon size="sm" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-5 w-32" radius="md" />
                <SkeletonBlock className="h-4 w-full" radius="md" />
              </div>
            </div>
            <SkeletonBlock className="h-8 w-28" radius="full" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

function MetradosSkeletonContent() {
  return (
    <div className="space-y-6" data-skeleton-section="metrados-editor">
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-32" radius="md" />
          <SkeletonBlock className="h-7 w-64" radius="md" />
          <SkeletonBlock className="h-4 w-80" radius="md" />
        </div>
        <div className="flex flex-wrap gap-2">
          <SkeletonButton size="sm" />
          <SkeletonButton size="sm" />
        </div>
      </div>
      <SkeletonCard contentClassName="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <SkeletonBlock className="h-5 w-36" radius="md" />
          <SkeletonButton size="sm" />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <SkeletonBlock className="h-3 w-24" radius="md" />
              <SkeletonBlock className="h-10 w-full" radius="xl" />
            </div>
          ))}
        </div>
      </SkeletonCard>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SkeletonTable
          aria-label="Cargando tabla de metrados"
          columns={[
            { id: "group", width: "w-24" },
            { id: "description", width: "w-full" },
            { id: "formula", width: "w-28" },
            { id: "partial", width: "w-24", align: "right" },
          ]}
          rowCount={8}
        />
        <div className="space-y-4">
          <SkeletonCard contentClassName="space-y-4">
            <SkeletonBlock className="h-5 w-28" radius="md" />
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <SkeletonBlock className="h-3 w-28" radius="md" />
                <SkeletonBlock className="h-5 w-32" radius="md" />
              </div>
            ))}
          </SkeletonCard>
          <SkeletonCard className="min-h-40" contentClassName="space-y-3">
            <SkeletonBlock className="h-5 w-32" radius="md" />
            <SkeletonBlock className="h-4 w-full" radius="md" />
            <SkeletonBlock className="h-4 w-4/5" radius="md" />
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}
