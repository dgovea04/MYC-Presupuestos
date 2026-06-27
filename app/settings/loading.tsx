import { AppShell } from "@/components/layout/app-shell";
import { AppSkeletonBlock } from "@/components/ui/app-skeleton";

export default async function SettingsLoading() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <AppSkeletonBlock className="h-14 w-14 rounded-2xl" />
          <div className="space-y-2">
            <AppSkeletonBlock className="h-6 w-48" />
            <AppSkeletonBlock className="h-4 w-72" />
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-6"
            >
              <div className="space-y-4">
                <AppSkeletonBlock className="h-5 w-40" />
                <div className="space-y-3">
                  <AppSkeletonBlock className="h-10 w-full rounded-xl" />
                  <AppSkeletonBlock className="h-10 w-full rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
