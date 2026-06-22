import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("ui-table w-full caption-bottom text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("ui-table-head [&_tr]:border-b [&_tr]:border-[var(--app-border)]", className)} {...props} />;
}

export const TBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  function TBody({ className, ...props }, ref) {
    return <tbody ref={ref} className={cn("ui-table-body [&_tr:last-child]:border-0", className)} {...props} />;
  },
);

export const TR = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(function TR(
  { className, ...props },
  ref,
) {
  return (
    <tr
      ref={ref}
      className={cn(
        "ui-table-row border-b border-[var(--app-border-soft)] transition-[background-color,box-shadow] duration-150 hover:bg-[var(--app-surface-muted)]/90 focus-within:bg-[var(--app-primary-muted)]",
        className,
      )}
      {...props}
    />
  );
});

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("ui-table-head-cell px-3 py-3 text-left align-middle font-medium text-[var(--app-text-muted)]", className)}
      {...props}
    />
  );
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("ui-table-cell p-3 align-middle text-[var(--app-text-strong)] transition-colors", className)} {...props} />;
}
