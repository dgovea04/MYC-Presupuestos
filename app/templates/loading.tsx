import { AppShell } from "@/components/layout/app-shell";
import { AppSkeletonBlock } from "@/components/ui/app-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function TemplatesLoading() {
  return (
    <AppShell>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[var(--app-surface-elevated)]">
          <div className="space-y-2">
            <AppSkeletonBlock className="h-6 w-40" />
            <AppSkeletonBlock className="h-4 w-96 max-w-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5"
              >
                <div className="space-y-3">
                  <AppSkeletonBlock className="h-10 w-10 rounded-xl" />
                  <div className="space-y-2">
                    <AppSkeletonBlock className="h-5 w-3/4" />
                    <AppSkeletonBlock className="h-4 w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
