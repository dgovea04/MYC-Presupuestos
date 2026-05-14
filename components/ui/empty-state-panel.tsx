import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyStatePanel({
  message,
  children,
  className,
}: {
  message?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600",
        className,
      )}
    >
      {children ?? message}
    </div>
  );
}
