import { SkeletonBlock } from "@/components/ui/loading";

export function AppSkeletonBlock({ className }: { className?: string }) {
  return <SkeletonBlock className={className} />;
}
