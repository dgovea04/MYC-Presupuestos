import { AppShell } from "@/components/layout/app-shell";
import { AppSkeletonBlock } from "@/components/ui/app-skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardLoading() {
  return (
    <AppShell>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="overflow-hidden border-[var(--app-border-soft)] bg-[var(--app-surface)]">
            <CardContent className="space-y-4 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <AppSkeletonBlock className="h-4 w-24" />
                  <AppSkeletonBlock className="h-8 w-16" />
                  <AppSkeletonBlock className="h-4 w-32" />
                </div>
                <AppSkeletonBlock className="h-11 w-11 rounded-2xl" />
              </div>
              <AppSkeletonBlock className="h-8 w-full rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="h-full border-[var(--app-border-soft)] bg-[var(--app-surface)]">
          <CardContent className="flex h-full flex-col gap-5 p-6">
            <div className="space-y-1">
              <AppSkeletonBlock className="h-5 w-48" />
              <AppSkeletonBlock className="h-4 w-64" />
            </div>
            <div className="flex flex-1 flex-col justify-between gap-5">
              <div className="space-y-2">
                <AppSkeletonBlock className="h-8 w-72 max-w-full" />
                <AppSkeletonBlock className="h-4 w-48" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <AppSkeletonBlock key={index} className="h-16 rounded-2xl" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full border-[var(--app-border-soft)] bg-[var(--app-surface)]">
          <CardContent className="flex h-full flex-col gap-4 p-6">
            <div className="space-y-1">
              <AppSkeletonBlock className="h-5 w-36" />
              <AppSkeletonBlock className="h-4 w-56" />
            </div>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3 rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-4 py-3">
                <AppSkeletonBlock className="h-10 w-10 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <AppSkeletonBlock className="h-4 w-40" />
                  <AppSkeletonBlock className="h-3 w-56 max-w-full" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="min-h-full border-[var(--app-border-soft)] bg-[var(--app-surface)]">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-1">
              <AppSkeletonBlock className="h-5 w-48" />
              <AppSkeletonBlock className="h-4 w-72 max-w-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <AppSkeletonBlock className="h-4 w-16 rounded-full" />
                      <div className="flex gap-2">
                        <AppSkeletonBlock className="h-5 w-20 rounded-full" />
                        <AppSkeletonBlock className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                    <AppSkeletonBlock className="h-8 w-8 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-full border-[var(--app-border-soft)] bg-[var(--app-surface)]">
          <CardContent className="space-y-3 p-6">
            <div className="space-y-1">
              <AppSkeletonBlock className="h-5 w-36" />
              <AppSkeletonBlock className="h-4 w-56" />
            </div>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3 rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-4 py-3">
                <AppSkeletonBlock className="h-9 w-9 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <AppSkeletonBlock className="h-4 w-32" />
                  <AppSkeletonBlock className="h-3 w-48" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
