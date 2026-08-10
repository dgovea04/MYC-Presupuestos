import { SkeletonBlock } from "@/components/ui/loading/skeleton-block";
import { SkeletonCard } from "@/components/ui/loading/skeleton-card";
import { SkeletonText } from "@/components/ui/loading/skeleton-text";
import { cn } from "@/lib/utils";

export function SkeletonChart({
  "aria-label": ariaLabel = "Cargando grafico",
  bars = 8,
  chartClassName,
  className,
}: {
  "aria-label"?: string;
  bars?: number;
  chartClassName?: string;
  className?: string;
}) {
  return (
    <SkeletonCard className={cn("min-h-[320px]", className)}>
      <div aria-busy="true" aria-label={ariaLabel} className="space-y-5" role="img">
        <SkeletonText lines={2} widths={["w-48", "w-64"]} />
        <div className={cn("flex h-60 items-end gap-2 rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface-muted)] p-4", chartClassName)}>
          {Array.from({ length: bars }).map((_, index) => (
            <SkeletonBlock
              key={index}
              className={cn("flex-1", index % 4 === 0 ? "h-16" : index % 3 === 0 ? "h-28" : index % 2 === 0 ? "h-36" : "h-24")}
              radius="sm"
            />
          ))}
        </div>
        <div className="flex justify-between">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-3 w-16" radius="md" />
          ))}
        </div>
      </div>
    </SkeletonCard>
  );
}
