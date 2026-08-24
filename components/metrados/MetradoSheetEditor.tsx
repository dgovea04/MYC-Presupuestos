"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MetradoSheetRecord } from "@/types/metrado";

export type MetradoSheetEditorProps = {
  sheet: MetradoSheetRecord;
  formulaBar: ReactNode;
  table: ReactNode;
  summary: ReactNode;
  collapsed?: boolean;
  onRequestClose?: () => void;
};

export function MetradoSheetEditor({
  sheet,
  formulaBar,
  table,
  summary,
  collapsed = false,
}: MetradoSheetEditorProps) {
  return (
    <section className="space-y-4" data-testid="metrado-sheet-editor" data-sheet-id={sheet.id}>
      {formulaBar}
      <div className={cn("grid gap-6", collapsed ? "xl:grid-cols-[minmax(0,1fr)_64px]" : "xl:grid-cols-[minmax(0,1fr)_360px]")}>
        {table}
        <aside className="space-y-4">{summary}</aside>
      </div>
    </section>
  );
}
