import { SkeletonBlock } from "@/components/ui/loading/skeleton-block";
import { cn } from "@/lib/utils";

export function SkeletonText({
  className,
  lines = 1,
  width,
  widths = ["w-full"],
}: {
  className?: string;
  lines?: number;
  width?: string;
  widths?: string[];
}) {
  const resolvedWidths = width ? [width] : widths;

  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBlock
          key={index}
          className={cn("h-4", resolvedWidths[index] ?? resolvedWidths[resolvedWidths.length - 1] ?? "w-full")}
          radius="md"
        />
      ))}
    </div>
  );
}
