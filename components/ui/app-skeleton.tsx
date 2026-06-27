import { cn } from "@/lib/utils";

export function AppSkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-lg border border-[var(--app-border-soft)] bg-[var(--app-surface-hover)]/90",
        className,
      )}
    />
  );
}
