import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SkeletonCard({
  busyLabel,
  children,
  className,
  contentClassName,
}: {
  busyLabel?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card
      role={busyLabel ? "status" : undefined}
      aria-busy={busyLabel ? "true" : undefined}
      aria-label={busyLabel}
      className={cn("border-[var(--app-border-soft)] bg-[var(--app-surface)]", className)}
    >
      <CardContent className={cn("p-6", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
