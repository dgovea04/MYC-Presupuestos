import { SkeletonBlock } from "@/components/ui/loading/skeleton-block";
import { cn } from "@/lib/utils";

export type SkeletonTableColumn = {
  id: string;
  width: string;
  align?: "left" | "right";
  sticky?: boolean;
};

export function SkeletonTable({
  "aria-label": ariaLabel = "Cargando tabla",
  className,
  columns,
  compact = false,
  rowCount = 6,
}: {
  "aria-label"?: string;
  className?: string;
  columns: SkeletonTableColumn[];
  compact?: boolean;
  rowCount?: number;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)]", className)}>
      <table aria-busy="true" aria-label={ariaLabel} className="w-full table-fixed" role="table">
        <thead>
          <tr className={cn("border-b border-[var(--app-border-soft)] bg-[var(--app-surface-muted)]", compact ? "h-10" : "h-12")} role="row">
            {columns.map((column) => (
              <th
                key={column.id}
                className={cn("px-3", compact ? "py-2" : "py-3", column.align === "right" && "text-right")}
                role="columnheader"
              >
                <SkeletonBlock className={cn("h-3", column.width, column.align === "right" && "ml-auto")} radius="md" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <tr key={rowIndex} className={cn("border-b border-[var(--app-border-soft)] last:border-0", compact ? "h-10" : "h-12")} role="row">
              {columns.map((column, columnIndex) => (
                <td
                  key={column.id}
                  className={cn("px-3", compact ? "py-2" : "py-3", column.sticky && "bg-[var(--app-surface)]")}
                  role="cell"
                >
                  <SkeletonBlock
                    className={cn(
                      "h-4",
                      column.width,
                      column.align === "right" && "ml-auto",
                      columnIndex === 1 && rowIndex % 3 === 0 && "max-w-[70%]",
                    )}
                    radius="md"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
