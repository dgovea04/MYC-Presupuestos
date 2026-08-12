import {
  SkeletonBlock,
  SkeletonButton,
  SkeletonCard,
  SkeletonIcon,
  SkeletonText,
} from "@/components/ui/loading";
import { cn } from "@/lib/utils";

export function ProjectDetailPageSkeleton() {
  return (
    <section aria-busy="true" aria-label="Cargando proyecto" className="space-y-5" role="status">
      <SkeletonCard className="rounded-2xl" contentClassName="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <SkeletonBlock className="h-6 w-24" radius="full" />
              <SkeletonBlock className="h-6 w-36" radius="full" />
            </div>
            <div className="flex items-center gap-3">
              <SkeletonIcon className="h-11 w-11 rounded-2xl" rounded={false} />
              <div className="space-y-2">
                <SkeletonBlock className="h-7 w-64" radius="md" />
                <SkeletonBlock className="h-4 w-96" radius="md" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <SkeletonButton size="sm" />
            <SkeletonButton size="sm" />
            <SkeletonButton className="w-44" size="sm" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-2xl border border-[var(--app-border-soft)] px-4 py-3">
              <SkeletonBlock className="h-4 w-20" radius="md" />
              <SkeletonBlock className={index === 3 ? "h-5 w-full" : "h-5 w-24"} radius="md" />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBlock key={index} className={index === 2 ? "h-9 w-36" : "h-9 w-32"} radius="full" />
          ))}
        </div>
      </SkeletonCard>

      <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
        <ProjectSectionHeading titleWidth="w-48" descriptionWidth="w-[32rem]" />
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface-muted)] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-40" radius="md" />
            <div className="flex flex-wrap gap-4">
              <SkeletonBlock className="h-4 w-40" radius="md" />
              <SkeletonBlock className="h-4 w-32" radius="md" />
              <SkeletonBlock className="h-4 w-44" radius="md" />
            </div>
          </div>
          <SkeletonButton className="w-36" />
        </div>
      </SkeletonCard>

      <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <ProjectSectionHeading titleWidth="w-40" descriptionWidth="w-[34rem]" />
          <SkeletonBlock className="h-7 w-32" radius="full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-4 rounded-2xl border border-[var(--app-border-soft)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <SkeletonBlock className="h-5 w-40" radius="md" />
                  <SkeletonBlock className="h-4 w-48" radius="md" />
                </div>
                <SkeletonBlock className="h-6 w-28" radius="full" />
              </div>
              <SkeletonButton className="w-44" size="sm" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
        <ProjectSectionHeading titleWidth="w-64" descriptionWidth="w-[36rem]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-2xl border border-dashed border-[var(--app-border)] p-4">
              <SkeletonBlock className="h-5 w-36" radius="md" />
              <SkeletonBlock className="h-4 w-full" radius="md" />
              <SkeletonBlock className="h-4 w-2/3" radius="md" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
        <ProjectSectionHeading titleWidth="w-44" descriptionWidth="w-[34rem]" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3 w-20" radius="md" />
            <SkeletonBlock className="h-10 w-full" radius="xl" />
          </div>
          <SkeletonButton className="w-32" />
        </div>
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] p-6">
          <SkeletonIcon size="sm" />
          <SkeletonBlock className="h-4 w-72" radius="md" />
          <SkeletonBlock className="h-3 w-56" radius="md" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-lg border border-[var(--app-border-soft)] px-3 py-2">
              <SkeletonIcon size="sm" />
              <SkeletonBlock className="h-4 w-48" radius="md" />
              <SkeletonBlock className="ml-auto h-4 w-16" radius="md" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
        <ProjectSectionHeading titleWidth="w-48" descriptionWidth="w-[34rem]" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-8 w-24" radius="full" />
          ))}
        </div>
        <SkeletonBlock className="h-10 w-full" radius="xl" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <SkeletonBlock className="h-6 w-24" radius="full" />
                  <SkeletonBlock className="h-5 w-44" radius="md" />
                </div>
                <SkeletonBlock className="h-4 w-64" radius="md" />
              </div>
              <SkeletonBlock className="h-4 w-28" radius="md" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </section>
  );
}

function ProjectSectionHeading({
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
