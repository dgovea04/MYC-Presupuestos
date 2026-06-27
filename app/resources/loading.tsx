import { AppShell } from "@/components/layout/app-shell";
import { AppSkeletonBlock } from "@/components/ui/app-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function ResourcesLoading() {
  return (
    <AppShell>
      <Card className="theme-surface-card rounded-2xl">
        <CardHeader className="theme-surface-card-gradient flex flex-col gap-4 rounded-2xl">
          <div className="space-y-2">
            <AppSkeletonBlock className="h-6 w-56" />
            <AppSkeletonBlock className="h-4 w-96 max-w-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-4 py-3"
            >
              <AppSkeletonBlock className="h-9 w-9 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-3">
                  <AppSkeletonBlock className="h-5 w-20" />
                  <AppSkeletonBlock className="h-5 w-40" />
                </div>
                <div className="flex gap-3">
                  <AppSkeletonBlock className="h-4 w-16 rounded-full" />
                  <AppSkeletonBlock className="h-4 w-24 rounded-full" />
                </div>
              </div>
              <AppSkeletonBlock className="h-8 w-20 rounded-xl" />
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
