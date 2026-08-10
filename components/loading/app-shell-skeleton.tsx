import type { ReactNode } from "react";
import { SkeletonBlock, SkeletonButton, SkeletonIcon, SkeletonText } from "@/components/ui/loading";

export function AppShellSkeleton({ children }: { children?: ReactNode }) {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando aplicacion"
      className="grid min-h-screen grid-cols-1 gap-5 px-3 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:px-4 xl:px-5"
      role="status"
    >
      <aside className="hidden rounded-3xl border border-white/70 bg-slate-900 p-4 shadow-xl shadow-slate-900/10 lg:flex lg:h-[calc(100vh-2rem)] lg:flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <SkeletonIcon className="bg-white/20" size="sm" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-32 bg-white/20" radius="md" />
            <SkeletonBlock className="h-3 w-20 bg-white/10" radius="md" />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-10 w-full bg-white/10" radius="xl" />
          ))}
        </div>
        <div className="mt-auto">
          <SkeletonBlock className="h-16 w-full bg-white/10" radius="2xl" />
        </div>
      </aside>
      <main className="flex min-h-full min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-3xl border border-[var(--app-border-soft)] bg-[var(--app-surface)]/90 px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <SkeletonText lines={3} widths={["w-24", "w-72", "w-56"]} />
          <div className="flex flex-wrap gap-3 md:justify-end">
            <SkeletonButton className="w-28" />
            <SkeletonButton className="w-32" />
            <SkeletonButton className="w-36" />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
