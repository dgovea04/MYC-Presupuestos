"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getExcelViewCssVariables } from "@/lib/budget/excel-view-css";
import type { MetradoSheetRecord } from "@/types/metrado";
import { cn } from "@/lib/utils";

export function MetradoSheetDrawer({
  sheet,
  open,
  onClose,
  children,
  title = "Hoja de metrados",
  description,
  className,
  headerActionLabel,
  onHeaderAction,
  headerActionDisabled = false,
}: {
  sheet: MetradoSheetRecord | null;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  headerActionLabel?: string;
  onHeaderAction?: () => void;
  headerActionDisabled?: boolean;
}) {
  const { isExcelMode } = useAppViewMode();
  const { excelRowHeight, excelShowFieldBorders } = useFormattingSettings();
  const excelCssVariables = useMemo(
    () => getExcelViewCssVariables(excelShowFieldBorders, excelRowHeight),
    [excelRowHeight, excelShowFieldBorders],
  );

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content asChild>
          <div
            className={cn("fixed inset-y-0 right-0 z-50 h-full w-full max-w-6xl overflow-y-auto border-l border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-2xl outline-none", className)}
            data-metrado-sheet-drawer="true"
            data-view-mode={isExcelMode ? "excel" : "modern"}
            style={excelCssVariables}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><Dialog.Title className="text-lg font-semibold text-[var(--app-text-strong)]">{title}</Dialog.Title><Dialog.Description className="text-sm text-[var(--app-text-muted)]">{description ?? sheet?.partidaLink?.budgetItemDescription ?? sheet?.name ?? ""}</Dialog.Description>
              </div>
              {headerActionLabel && onHeaderAction ? (
                <Button type="button" onClick={() => onHeaderAction()} disabled={headerActionDisabled}>
                  {headerActionLabel}
                </Button>
              ) : (
                <Dialog.Close asChild><Button type="button" variant="outline">Cerrar</Button></Dialog.Close>
              )}
            </div>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
