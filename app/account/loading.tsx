import { AppShell } from "@/components/layout/app-shell";
import { AppSkeletonBlock } from "@/components/ui/app-skeleton";

export default async function AccountLoading() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <AppSkeletonBlock className="h-24 w-24 rounded-2xl" />
          <div className="space-y-2">
            <AppSkeletonBlock className="h-7 w-40" />
            <AppSkeletonBlock className="h-5 w-56" />
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-6"
            >
              <div className="space-y-4">
                <AppSkeletonBlock className="h-5 w-32" />
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
