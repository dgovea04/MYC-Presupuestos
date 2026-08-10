import { SkeletonBlock } from "@/components/ui/loading/skeleton-block";
import { cn } from "@/lib/utils";

const sizeClassName = {
  sm: "h-8 w-24",
  md: "h-10 w-32",
  lg: "h-11 w-40",
};

export function SkeletonButton({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return <SkeletonBlock className={cn(sizeClassName[size], className)} radius="xl" />;
}
