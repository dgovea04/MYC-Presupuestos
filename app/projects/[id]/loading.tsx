import { AppShell } from "@/components/layout/app-shell";
import { AppSkeletonBlock } from "@/components/ui/app-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function ProjectDetailLoading() {
  return (
    <AppShell>
      <div className="space-y-5">
        <Card className="theme-surface-card rounded-2xl">
          <CardHeader className="theme-surface-card-gradient gap-4 rounded-2xl">
            <div className="space-y-2">
              <AppSkeletonBlock className="h-7 w-64 max-w-full" />
              <AppSkeletonBlock className="h-4 w-96 max-w-full" />
            </div>
            <div className="flex gap-2">
              <AppSkeletonBlock className="h-6 w-20 rounded-full" />
              <AppSkeletonBlock className="h-6 w-24 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <AppSkeletonBlock key={index} className="h-16 rounded-2xl" />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <AppSkeletonBlock className="h-10 w-full rounded-2xl" />

          <Card className="theme-surface-card rounded-2xl">
            <CardHeader>
              <div className="space-y-2">
                <AppSkeletonBlock className="h-5 w-48" />
                <AppSkeletonBlock className="h-4 w-72 max-w-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-4 py-3"
                >
                  <div className="flex-1 space-y-2">
                    <AppSkeletonBlock className="h-5 w-40" />
                    <AppSkeletonBlock className="h-4 w-24" />
                  </div>
                  <AppSkeletonBlock className="h-8 w-16 rounded-xl" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="theme-surface-card rounded-2xl">
            <CardHeader>
              <div className="space-y-2">
                <AppSkeletonBlock className="h-5 w-40" />
                <AppSkeletonBlock className="h-4 w-64 max-w-full" />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <AppSkeletonBlock key={index} className="h-24 rounded-2xl border-dashed p-4" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
