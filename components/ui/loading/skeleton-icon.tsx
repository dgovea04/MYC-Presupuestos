import { SkeletonBlock } from "@/components/ui/loading/skeleton-block";
import { cn } from "@/lib/utils";

const sizeClassName = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

export function SkeletonIcon({
  className,
  rounded = true,
  size = "md",
}: {
  className?: string;
  rounded?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  return <SkeletonBlock className={cn(sizeClassName[size], className)} radius={rounded ? "full" : "xl"} />;
}
