import { SkeletonBlock } from "@/components/ui/loading/skeleton-block";
import { SkeletonButton } from "@/components/ui/loading/skeleton-button";
import { cn } from "@/lib/utils";

export function SkeletonToolbar({
  actions = 1,
  className,
  filters = 2,
  search = true,
}: {
  actions?: number;
  className?: string;
  filters?: number;
  search?: boolean;
}) {
  return (
    <div aria-hidden="true" className={cn("flex min-h-10 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex flex-1 flex-wrap gap-2">
        {search ? <SkeletonBlock className="h-10 min-w-56 flex-1" radius="xl" /> : null}
        {Array.from({ length: filters }).map((_, index) => (
          <SkeletonButton key={index} className="w-28" />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }).map((_, index) => (
          <SkeletonButton key={index} size={index === 0 ? "md" : "sm"} />
        ))}
      </div>
    </div>
  );
}
