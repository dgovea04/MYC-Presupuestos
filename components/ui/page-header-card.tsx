import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeaderCard({
  icon,
  title,
  description,
  actions,
  badges,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
      <div className="space-y-3">
        {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[var(--app-surface-strong)] p-2 text-[var(--app-text-strong)] shadow-[0_14px_34px_-22px_rgba(15,23,42,0.22)]">
            {icon}
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-text-strong)]">{title}</h2>
            {description ? <p className="max-w-3xl text-sm leading-6 text-[var(--app-text-muted)]">{description}</p> : null}
          </div>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
