import { PageSkeletonFrame } from "@/components/loading/page-skeleton-frame";
import { SkeletonBlock, SkeletonCard, SkeletonIcon, SkeletonText } from "@/components/ui/loading";

export function DashboardPageSkeleton() {
  return (
    <PageSkeletonFrame aria-label="Cargando dashboard" actions={0} titleWidth="w-48" descriptionWidth="w-80">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} className="min-h-[164px]" contentClassName="flex h-full flex-col justify-between space-y-4 py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className={index === 3 ? "h-9 w-36" : "h-9 w-16"} />
                <SkeletonBlock className="h-4 w-40" />
              </div>
              <SkeletonIcon className="h-11 w-11 rounded-2xl" rounded={false} />
            </div>
            <SkeletonBlock className="h-9 w-full rounded-xl" />
          </SkeletonCard>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SkeletonCard className="min-h-[300px]" contentClassName="flex h-full flex-col gap-5">
          <DashboardSectionHeaderSkeleton />
          <div className="flex flex-1 flex-col justify-between gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <SkeletonBlock className="h-8 w-72" />
                <SkeletonBlock className="h-4 w-48" />
                <SkeletonBlock className="h-4 w-56" />
              </div>
              <SkeletonBlock className="h-20 w-56 rounded-2xl" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-20 rounded-2xl" />
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <SkeletonBlock className="h-10 w-36 rounded-xl" />
              <SkeletonBlock className="h-10 w-44 rounded-xl" />
            </div>
          </div>
        </SkeletonCard>

        <SkeletonCard className="min-h-[300px]" contentClassName="flex h-full flex-col gap-4">
          <DashboardSectionHeaderSkeleton />
          <SkeletonBlock className="h-20 rounded-2xl" />
          <div className="grid flex-1 content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-20 rounded-2xl" />
            ))}
          </div>
        </SkeletonCard>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SkeletonCard className="min-h-[460px]">
          <div className="space-y-4">
            <DashboardSectionHeaderSkeleton />
            <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1">
              <SkeletonBlock className="h-10 flex-1 rounded-xl sm:w-44 sm:flex-none" />
              <SkeletonBlock className="h-10 flex-1 rounded-xl sm:w-40 sm:flex-none" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-20 rounded-2xl" />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-9 w-20 rounded-xl" />
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <DashboardRecordSkeleton key={index} />
              ))}
            </div>
          </div>
        </SkeletonCard>

        <SkeletonCard className="min-h-[460px]">
          <div className="space-y-4">
            <DashboardSectionHeaderSkeleton />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-20 rounded-2xl" />
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <DashboardRecordSkeleton key={index} />
              ))}
            </div>
          </div>
        </SkeletonCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <SkeletonCard key={index} className="min-h-[280px]">
            <div className="space-y-4">
              <DashboardSectionHeaderSkeleton />
              {Array.from({ length: 3 }).map((_, recordIndex) => (
                <DashboardRecordSkeleton key={recordIndex} />
              ))}
            </div>
          </SkeletonCard>
        ))}
      </section>
    </PageSkeletonFrame>
  );
}

function DashboardSectionHeaderSkeleton() {
  return <SkeletonText lines={2} widths={["w-44", "w-80"]} />;
}

function DashboardRecordSkeleton() {
  return (
    <div className="flex min-h-[86px] flex-col gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-6 w-20 rounded-full" />
        </div>
        <SkeletonBlock className="h-4 w-56" />
      </div>
      <SkeletonBlock className="h-12 w-full rounded-xl lg:w-44" />
    </div>
  );
}
