import {
  SkeletonBlock,
  SkeletonButton,
  SkeletonCard,
  SkeletonIcon,
  SkeletonTable,
  SkeletonText,
} from "@/components/ui/loading";
import { cn } from "@/lib/utils";

export function BudgetDetailPageSkeleton() {
  return (
    <section aria-busy="true" aria-label="Cargando presupuesto" className="space-y-3" role="status">
      <div data-skeleton-section="collaboration" className="flex items-center justify-end">
        <div className="flex items-center gap-1 px-3 py-1.5">
          <SkeletonBlock className="h-7 w-28" radius="full" />
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-7 w-7" radius="md" />
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <div data-skeleton-section="overview">
        <SkeletonCard className="rounded-2xl" contentClassName="space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <SkeletonBlock className="h-6 w-36" radius="full" />
              <SkeletonBlock className="h-6 w-40" radius="full" />
            </div>
            <div className="flex items-center gap-3">
              <SkeletonIcon className="h-11 w-11 rounded-2xl" rounded={false} />
              <div className="space-y-2">
                <SkeletonBlock className="h-7 w-72" radius="md" />
                <SkeletonBlock className="h-4 w-96" radius="md" />
              </div>
            </div>
          </div>
          <SkeletonButton className="w-36" size="sm" />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-2xl border border-[var(--app-border-soft)] px-4 py-3">
              <SkeletonBlock className="h-4 w-24" radius="md" />
              <SkeletonBlock className={index === 0 ? "h-6 w-36" : "h-5 w-24"} radius="md" />
            </div>
          ))}
        </div>

          <div className="flex flex-wrap gap-2">
            <SkeletonBlock className="h-9 w-40" radius="full" />
            <SkeletonBlock className="h-9 w-36" radius="full" />
          </div>
        </SkeletonCard>
      </div>

      <section
        className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]"
        data-skeleton-section="subbudgets-and-actions"
      >
        <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <BudgetSectionHeading titleWidth="w-48" descriptionWidth="w-[32rem]" />
            <SkeletonButton className="w-40" size="sm" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-4 rounded-2xl border border-[var(--app-border)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <SkeletonBlock className="h-5 w-40" radius="md" />
                    <SkeletonBlock className="h-4 w-32" radius="md" />
                  </div>
                  <SkeletonBlock className="h-6 w-28" radius="full" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <SkeletonBlock className="h-7 w-36" radius="md" />
                  <SkeletonButton className="w-40" size="sm" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>

        <SkeletonCard className="h-full rounded-2xl" contentClassName="space-y-4">
          <BudgetSectionHeading titleWidth="w-56" descriptionWidth="w-full" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-xl border border-[var(--app-border-soft)] px-3 py-3">
                <SkeletonIcon size="sm" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-40" radius="md" />
                  <SkeletonBlock className="h-3 w-56" radius="md" />
                </div>
                <SkeletonBlock className="h-4 w-4" radius="md" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </section>

      <div data-skeleton-section="overview-summary">
        <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
          <BudgetSectionHeading titleWidth="w-64" descriptionWidth="w-[42rem]" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-2xl border border-[var(--app-border-soft)] px-4 py-3">
              <SkeletonBlock className="h-4 w-32" radius="md" />
              <SkeletonBlock className="h-6 w-36" radius="md" />
              <SkeletonBlock className="h-3 w-24" radius="md" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface-muted)] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-48" radius="md" />
              <SkeletonBlock className="h-3 w-80" radius="md" />
            </div>
            <div className="flex flex-wrap gap-2">
              <SkeletonBlock className="h-7 w-32" radius="full" />
              <SkeletonBlock className="h-7 w-36" radius="full" />
            </div>
          </div>
        </div>
          <div className="flex flex-wrap gap-3 rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-44" radius="md" />
              <SkeletonBlock className="h-3 w-80" radius="md" />
            </div>
            <SkeletonButton className="w-48" size="sm" />
          </div>
        </SkeletonCard>
      </div>

      <div data-skeleton-section="consolidated-table">
        <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
          <BudgetSectionHeading titleWidth="w-48" descriptionWidth="w-[42rem]" />
          <SkeletonTable
          aria-label="Cargando tabla consolidada"
          columns={[
            { id: "subBudget", width: "w-full" },
            { id: "levels", width: "w-16", align: "right" },
            { id: "items", width: "w-16", align: "right" },
            { id: "directCost", width: "w-28", align: "right" },
            { id: "generalExpenses", width: "w-28", align: "right" },
            { id: "utility", width: "w-24", align: "right" },
            { id: "tax", width: "w-24", align: "right" },
            { id: "total", width: "w-28", align: "right" },
            { id: "actions", width: "w-20", align: "right" },
          ]}
            rowCount={4}
          />
        </SkeletonCard>
      </div>

      <div data-skeleton-section="connected-detail">
        <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
          <BudgetSectionHeading titleWidth="w-72" descriptionWidth="w-[46rem]" />
          <div className="flex flex-wrap items-center gap-2">
            <SkeletonBlock className="h-4 w-32" radius="md" />
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className={index === 0 ? "h-9 w-44" : "h-9 w-36"} radius="full" />
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-5 w-44" radius="md" />
                <SkeletonBlock className="h-6 w-36" radius="full" />
              </div>
              <SkeletonBlock className="h-4 w-96" radius="md" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SkeletonBlock className="h-7 w-32" radius="md" />
              <SkeletonButton className="w-44" size="sm" />
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-[28rem]" radius="md" />
                <SkeletonBlock className="h-3 w-72" radius="md" />
              </div>
              <SkeletonButton className="w-48" size="sm" />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <SkeletonButton className="w-28" size="sm" />
            <SkeletonButton className="w-28" size="sm" />
          </div>
        </SkeletonCard>
      </div>
      </div>
    </section>
  );
}

export function BudgetSubBudgetPageSkeleton() {
  return (
    <section aria-busy="true" aria-label="Cargando sub presupuesto" className="space-y-5" role="status">
      <div data-skeleton-section="collaboration" className="flex items-center justify-end">
        <div className="flex items-center gap-1 px-3 py-1.5">
          <SkeletonBlock className="h-7 w-28" radius="full" />
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-7 w-7" radius="md" />
          ))}
        </div>
      </div>

      <div
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"
        data-skeleton-section="editor-flow"
      >
        <SkeletonCard className="overflow-hidden rounded-2xl" contentClassName="p-0">
          <div className="space-y-4 border-b border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 space-y-2">
                <SkeletonBlock className="h-3 w-24" radius="md" />
                <SkeletonBlock className="h-7 w-64" radius="md" />
                <SkeletonBlock className="h-4 w-80" radius="md" />
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonBlock key={index} className={index === 4 ? "h-8 w-24" : "h-8 w-28"} radius="full" />
                ))}
              </div>
            </div>
          </div>
          <div className="p-6">
            <SkeletonTable
              aria-label="Cargando partidas del sub presupuesto"
              columns={[
                { id: "code", width: "w-20", sticky: true },
                { id: "description", width: "w-full" },
                { id: "unit", width: "w-16" },
                { id: "quantity", width: "w-20", align: "right" },
                { id: "unitPrice", width: "w-24", align: "right" },
                { id: "partial", width: "w-24", align: "right" },
                { id: "actions", width: "w-16", align: "right" },
              ]}
              compact
              rowCount={9}
            />
          </div>
        </SkeletonCard>

        <SkeletonCard className="h-fit min-h-[360px] overflow-hidden rounded-2xl" contentClassName="p-0">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-6 py-4">
            <SkeletonBlock className="h-5 w-24" radius="md" />
            <SkeletonBlock className="h-8 w-8" radius="md" />
          </div>
          <div className="space-y-4 p-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <SkeletonBlock className="h-3 w-28" radius="md" />
                <SkeletonBlock className={index === 0 ? "h-6 w-36" : "h-5 w-28"} radius="md" />
              </div>
            ))}
            <div className="border-t border-[var(--app-border-soft)] pt-4">
              <SkeletonBlock className="h-4 w-36" radius="md" />
            </div>
          </div>
        </SkeletonCard>
      </div>
    </section>
  );
}

export function BudgetLoadingResolverSkeleton() {
  return (
    <section aria-busy="true" aria-label="Cargando presupuesto" className="space-y-5" role="status">
      <div data-skeleton-section="collaboration" className="flex items-center justify-end">
        <div className="flex items-center gap-1 px-3 py-1.5">
          <SkeletonBlock className="h-7 w-28" radius="full" />
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-7 w-7" radius="md" />
          ))}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" data-skeleton-section="resolving-content">
        <SkeletonCard className="overflow-hidden rounded-2xl" contentClassName="space-y-5">
          <div className="space-y-3">
            <SkeletonBlock className="h-3 w-24" radius="md" />
            <SkeletonBlock className="h-7 w-64" radius="md" />
            <SkeletonBlock className="h-4 w-80" radius="md" />
          </div>
          <SkeletonTable
            aria-label="Cargando contenido del presupuesto"
            compact
            columns={[
              { id: "description", width: "w-full" },
              { id: "quantity", width: "w-20", align: "right" },
              { id: "total", width: "w-28", align: "right" },
            ]}
            rowCount={5}
          />
        </SkeletonCard>
        <SkeletonCard className="h-fit rounded-2xl" contentClassName="space-y-4">
          <SkeletonBlock className="h-5 w-24" radius="md" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <SkeletonBlock className="h-3 w-24" radius="md" />
              <SkeletonBlock className="h-5 w-28" radius="md" />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </section>
  );
}

function BudgetSectionHeading({
  descriptionWidth,
  titleWidth,
}: {
  descriptionWidth: string;
  titleWidth: string;
}) {
  return (
    <div className="space-y-2">
      <SkeletonBlock className={cn("h-6", titleWidth)} radius="md" />
      <SkeletonText lines={1} width={descriptionWidth} />
    </div>
  );
}
