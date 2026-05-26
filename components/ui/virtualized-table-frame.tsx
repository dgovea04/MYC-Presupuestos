import type { HTMLAttributes, ReactNode, RefObject, UIEventHandler } from "react";

import { TD, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName, getTableViewportClassName } from "@/components/view-mode/view-mode-styles";
import { cn } from "@/lib/utils";

type StaticTableFrameProps = {
  children: ReactNode;
  "data-testid"?: string;
} & HTMLAttributes<HTMLDivElement>;

export function StaticTableFrame({
  children,
  className,
  "data-testid": dataTestId = "static-table-frame",
  ...props
}: StaticTableFrameProps) {
  const { isExcelMode } = useAppViewMode();

  return (
    <div
      data-testid={dataTestId}
      {...props}
      className={getTableFrameClassName(isExcelMode, className)}
    >
      {children}
    </div>
  );
}

export function VirtualizedTableFrame({
  children,
  className,
  scrollContainerRef,
  onScroll,
}: {
  children: ReactNode;
  className?: string;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onScroll: UIEventHandler<HTMLDivElement>;
}) {
  const { isExcelMode } = useAppViewMode();

  return (
    <StaticTableFrame data-testid="virtualized-table-frame">
      <div
        ref={scrollContainerRef}
        className={getTableViewportClassName(isExcelMode, cn("max-h-[68vh]", className))}
        onScroll={onScroll}
      >
        {children}
      </div>
    </StaticTableFrame>
  );
}

export function VirtualizedTableSpacerRow({
  colSpan,
  height,
}: {
  colSpan: number;
  height: number;
}) {
  if (height <= 0) {
    return null;
  }

  return (
    <TR aria-hidden="true" className="hover:bg-transparent focus-within:bg-transparent">
      <TD colSpan={colSpan} className="p-0" style={{ height }} />
    </TR>
  );
}
