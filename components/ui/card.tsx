import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "ui-card rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "ui-card-header rounded-t-2xl border-b border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("ui-card-title text-lg font-semibold text-[var(--app-text-strong)]", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("ui-card-description text-sm text-[var(--app-text-muted)]", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-card-content px-6 py-5", className)} {...props} />;
}
