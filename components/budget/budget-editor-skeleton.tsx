import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AppSkeletonBlock } from "@/components/ui/app-skeleton";

export function BudgetEditorSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* Main card */}
      <Card className="overflow-hidden border-[var(--app-border)] bg-[var(--app-surface)]">
        {/* Header */}
        <CardHeader className="flex flex-col gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface-elevated)]">
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 space-y-2">
                <AppSkeletonBlock className="h-3 w-24" />
                <AppSkeletonBlock className="h-6 w-64" />
                <AppSkeletonBlock className="h-3 w-72" />
              </div>
              <div className="flex flex-col gap-2 xl:items-end">
                <div className="flex gap-2">
                  <AppSkeletonBlock className="h-8 w-24 rounded-full" />
                  <AppSkeletonBlock className="h-8 w-32 rounded-full" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <AppSkeletonBlock className="h-8 w-20 rounded-full" />
                  <AppSkeletonBlock className="h-8 w-24 rounded-full" />
                  <AppSkeletonBlock className="h-8 w-40 rounded-full" />
                  <AppSkeletonBlock className="h-8 w-24 rounded-full" />
                </div>
              </div>
            </div>
        </CardHeader>

        {/* Table skeleton */}
        <CardContent className="p-0">
          <div className="space-y-0">
            {/* Column headers */}
            <div className="flex min-h-12 items-center gap-3 border-b border-[var(--app-border-soft)] bg-[var(--app-surface-muted)] px-4 py-3">
              <AppSkeletonBlock className="h-4 w-12" />
              <AppSkeletonBlock className="h-4 flex-1" />
              <AppSkeletonBlock className="h-4 w-16" />
              <AppSkeletonBlock className="h-4 w-20" />
              <AppSkeletonBlock className="h-4 w-20" />
              <AppSkeletonBlock className="h-4 w-24" />
              <AppSkeletonBlock className="h-4 w-10" />
            </div>
            {/* Rows */}
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className={`flex min-h-12 items-center gap-3 border-b border-[var(--app-border-soft)] px-4 ${
                  index % 3 === 0 ? "py-3" : "py-3.5"
                }`}
              >
                <AppSkeletonBlock
                  className={`h-4 ${index % 3 === 0 ? "w-16" : "w-20"}`}
                />
                <AppSkeletonBlock
                  className={`h-4 flex-1 ${index % 3 === 0 ? "max-w-[85%]" : "max-w-[60%]"}`}
                />
                <AppSkeletonBlock className="h-4 w-12" />
                <AppSkeletonBlock className="h-4 w-16" />
                <AppSkeletonBlock className="h-4 w-20" />
                <AppSkeletonBlock className="h-4 w-24" />
                <AppSkeletonBlock className="h-4 w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary panel skeleton */}
      <Card className="h-fit min-h-[360px] border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardHeader className="border-b border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)]">
          <AppSkeletonBlock className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-2">
            <AppSkeletonBlock className="h-3 w-16" />
            <AppSkeletonBlock className="h-6 w-28" />
          </div>
          <div className="space-y-2">
            <AppSkeletonBlock className="h-3 w-20" />
            <AppSkeletonBlock className="h-5 w-24" />
          </div>
          <div className="space-y-2">
            <AppSkeletonBlock className="h-3 w-24" />
            <AppSkeletonBlock className="h-5 w-24" />
          </div>
          <div className="space-y-2">
            <AppSkeletonBlock className="h-3 w-20" />
            <AppSkeletonBlock className="h-5 w-28" />
          </div>
          <div className="border-t border-[var(--app-border-soft)] pt-4">
            <AppSkeletonBlock className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
