import { AppShell } from "@/components/layout/app-shell";
import { AppSkeletonBlock } from "@/components/ui/app-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function PartidasLoading() {
  return (
    <AppShell>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[var(--app-surface-elevated)]">
          <div className="space-y-2">
            <AppSkeletonBlock className="h-6 w-56" />
            <AppSkeletonBlock className="h-4 w-96 max-w-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <AppSkeletonBlock className="h-5 w-3/4" />
                  <div className="flex gap-2">
                    <AppSkeletonBlock className="h-4 w-16 rounded-full" />
                    <AppSkeletonBlock className="h-4 w-24 rounded-full" />
                  </div>
                </div>
                <AppSkeletonBlock className="h-10 w-10 rounded-xl" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
