import { SkeletonBlock, SkeletonCard, SkeletonTable, SkeletonText, SkeletonToolbar } from "@/components/ui/loading";

export function BudgetEditorPageSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Cargando presupuesto"
      className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"
      role="status"
    >
      <div className="space-y-4">
        <SkeletonCard>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <SkeletonText lines={3} widths={["w-24", "w-64", "w-72"]} />
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <SkeletonBlock className="h-8 w-24" radius="full" />
                <SkeletonBlock className="h-8 w-32" radius="full" />
                <SkeletonBlock className="h-8 w-20" radius="full" />
              </div>
            </div>
            <SkeletonToolbar search={false} filters={4} actions={2} />
          </div>
        </SkeletonCard>
        <SkeletonTable
          aria-label="Cargando editor de presupuesto"
          columns={[
            { id: "code", width: "w-20", sticky: true },
            { id: "description", width: "w-full" },
            { id: "unit", width: "w-16" },
            { id: "quantity", width: "w-20", align: "right" },
            { id: "unitPrice", width: "w-24", align: "right" },
            { id: "partial", width: "w-24", align: "right" },
            { id: "actions", width: "w-12", align: "right" },
          ]}
          rowCount={12}
        />
      </div>
      <SkeletonCard busyLabel="Cargando resumen del presupuesto">
        <div className="space-y-5">
          <SkeletonText lines={1} widths={["w-28"]} />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <SkeletonBlock className="h-3 w-24" radius="md" />
              <SkeletonBlock className="h-6 w-32" radius="md" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </section>
  );
}
