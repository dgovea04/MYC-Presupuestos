"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import {
  getFormActionBarClassName,
  getFormSectionPanelClassName,
  getOperationalFilterSummaryClassName,
  getOperationalMetricBadgeClassName,
  getOperationalPanelClassName,
} from "@/components/view-mode/view-mode-styles";
import { cn } from "@/lib/utils";

export function OperationalPanel({
  title,
  description,
  metrics,
  controls,
  className,
}: {
  title: string;
  description: string;
  metrics?: ReactNode;
  controls?: ReactNode;
  className?: string;
}) {
  const { isExcelMode } = useAppViewMode();

  return (
    <div className={getOperationalPanelClassName(isExcelMode, className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
          <p className="max-w-3xl text-sm leading-6 text-[var(--app-text-muted)]">{description}</p>
        </div>
        {metrics ? <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--app-text-muted)]">{metrics}</div> : null}
      </div>
      {controls ? <div className="mt-4">{controls}</div> : null}
    </div>
  );
}

export function OperationalSectionHeader({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
      <p className="max-w-3xl text-sm leading-6 text-[var(--app-text-muted)]">{description}</p>
    </div>
  );
}

export function OperationalMetricBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent";
}) {
  const { isExcelMode } = useAppViewMode();

  return (
    <span className={getOperationalMetricBadgeClassName(isExcelMode, tone)}>
      {children}
    </span>
  );
}

export function OperationalFilterSummary({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const { isExcelMode } = useAppViewMode();

  return (
    <div {...props} className={getOperationalFilterSummaryClassName(isExcelMode, className)}>
      {children}
    </div>
  );
}

export function FormSectionPanel({
  title,
  description,
  children,
  icon,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const { isExcelMode } = useAppViewMode();

  return (
    <section className={getFormSectionPanelClassName(isExcelMode, className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-[var(--app-text-muted)]">{icon}</span> : null}
          <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-[var(--app-text-muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function FormActionBar({ children, className }: { children: ReactNode; className?: string }) {
  const { isExcelMode } = useAppViewMode();

  return (
    <div className={getFormActionBarClassName(isExcelMode, className)}>
      {children}
    </div>
  );
}
