import { PageSkeletonFrame } from "@/components/loading/page-skeleton-frame";
import { SkeletonTable, SkeletonToolbar, type SkeletonTableColumn } from "@/components/ui/loading";

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
  templates: [
    { id: "name", width: "w-full" },
    { id: "type", width: "w-24" },
    { id: "items", width: "w-20", align: "right" },
    { id: "actions", width: "w-16", align: "right" },
  ],
  metrados: [
    { id: "name", width: "w-full" },
    { id: "template", width: "w-28" },
    { id: "rows", width: "w-20", align: "right" },
    { id: "actions", width: "w-16", align: "right" },
  ],
};

export function CatalogPageSkeleton({ kind }: { kind: CatalogSkeletonKind }) {
  return (
    <PageSkeletonFrame aria-label={labels[kind]} actions={1}>
      <SkeletonToolbar search filters={2} actions={1} />
      <SkeletonTable aria-label={labels[kind]} columns={columnsByKind[kind]} rowCount={8} />
    </PageSkeletonFrame>
  );
}
