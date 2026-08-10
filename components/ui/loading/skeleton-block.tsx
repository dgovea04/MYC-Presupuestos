import { cn } from "@/lib/utils";

export type SkeletonTone = "surface" | "muted" | "strong";
export type SkeletonRadius = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const toneClassName: Record<SkeletonTone, string> = {
  surface: "border border-[var(--app-border-soft)] bg-[var(--app-surface-hover)]/90",
  muted: "border border-[var(--app-border-soft)] bg-[var(--app-surface-muted)]",
  strong: "border border-[var(--app-border)] bg-slate-200/80",
};

const radiusClassName: Record<SkeletonRadius, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

export function SkeletonBlock({
  className,
  radius = "lg",
  tone = "surface",
}: {
  className?: string;
  radius?: SkeletonRadius;
  tone?: SkeletonTone;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse", toneClassName[tone], radiusClassName[radius], className)}
    />
  );
}
