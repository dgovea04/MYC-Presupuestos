import { SkeletonChart, SkeletonTable } from "@/components/ui/loading";

export function WorkScheduleValuationSkeleton() {
  return (
    <SkeletonTable
      aria-label="Cargando calendario valorizado"
      columns={[
        { id: "code", width: "w-24", sticky: true },
        { id: "description", width: "w-full" },
        { id: "partial", width: "w-24", align: "right" },
        { id: "period1", width: "w-24", align: "right" },
        { id: "period2", width: "w-24", align: "right" },
        { id: "total", width: "w-24", align: "right" },
      ]}
      rowCount={7}
    />
  );
}

export function WorkScheduleResourceCalendarSkeleton() {
  return (
    <SkeletonTable
      aria-label="Cargando calendario de insumos"
      columns={[
        { id: "code", width: "w-24", sticky: true },
        { id: "description", width: "w-full" },
        { id: "unit", width: "w-16" },
        { id: "quantity", width: "w-24", align: "right" },
        { id: "price", width: "w-24", align: "right" },
        { id: "period", width: "w-24", align: "right" },
      ]}
      rowCount={7}
    />
  );
}

export function WorkScheduleCurveSkeleton() {
  return <SkeletonChart aria-label="Cargando curva S" bars={10} className="min-h-[360px]" chartClassName="h-64" />;
}
