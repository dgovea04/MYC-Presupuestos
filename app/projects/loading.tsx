import { AppShell } from "@/components/layout/app-shell";
import { AppSkeletonBlock } from "@/components/ui/app-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function ProjectsLoading() {
  return (
    <AppShell>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[var(--app-surface-elevated)] md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <AppSkeletonBlock className="h-6 w-48" />
            <AppSkeletonBlock className="h-4 w-80 max-w-full" />
          </div>
          <AppSkeletonBlock className="h-10 w-40 rounded-xl" />
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-4 py-3"
            >
              <div className="flex-1 space-y-2">
                <AppSkeletonBlock className="h-5 w-48" />
                <div className="flex gap-3">
                  <AppSkeletonBlock className="h-4 w-20 rounded-full" />
                  <AppSkeletonBlock className="h-4 w-16 rounded-full" />
                </div>
              </div>
              <AppSkeletonBlock className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
