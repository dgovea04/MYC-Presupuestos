import { SkeletonBlock, SkeletonText } from "@/components/ui/loading";

interface CollaborationSheetSkeletonProps {
  "aria-label": string;
  rows?: number;
}

export function CollaborationSheetSkeleton({
  "aria-label": ariaLabel,
  rows = 5,
}: CollaborationSheetSkeletonProps) {
  return (
    <div aria-busy="true" aria-label={ariaLabel} className="space-y-2" role="status">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="min-h-[82px] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-2"
        >
          <div className="flex items-start gap-3">
            <SkeletonBlock className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <SkeletonText lines={1} width="w-24" />
                <SkeletonBlock className="h-2.5 w-16" />
              </div>
              <SkeletonText lines={1} width={index % 2 === 0 ? "w-40" : "w-32"} />
              <SkeletonText lines={1} width={index % 3 === 0 ? "w-full" : "w-4/5"} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
