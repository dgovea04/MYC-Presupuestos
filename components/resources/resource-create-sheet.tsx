"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useRef } from "react";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Button } from "@/components/ui/button";
import { ResourceForm } from "@/components/resources/resource-form";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getExcelViewCssVariables } from "@/lib/budget/excel-view-css";
import { cn } from "@/lib/utils";
import type { ResourceRecord } from "@/types/resource";

export function ResourceCreateSheet({
  open,
  companyId,
  onClose,
  onCreated,
}: {
  open: boolean;
  companyId?: string;
  onClose: () => void;
  onCreated: (resource: ResourceRecord) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { isExcelMode } = useAppViewMode();
  const { excelRowHeight, excelShowFieldBorders } = useFormattingSettings();
  const excelCssVariables = useMemo(
    () => getExcelViewCssVariables(excelShowFieldBorders, excelRowHeight),
    [excelRowHeight, excelShowFieldBorders],
  );

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn("fixed inset-0 z-50 bg-slate-950/30", isExcelMode ? "backdrop-blur-0" : "backdrop-blur-sm")} />
        <Dialog.Content
          asChild
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }}
        >
          <div
            className={cn(
              "fixed inset-y-0 right-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l p-5 outline-none",
              isExcelMode ? "border-slate-300 bg-white shadow-[0_10px_24px_-20px_rgba(15,23,42,0.16)]" : "border-slate-200 bg-slate-50 shadow-2xl",
            )}
            data-view-mode={isExcelMode ? "excel" : "modern"}
            style={excelCssVariables}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Catálogo de insumos</p>
                <Dialog.Title asChild>
                  <h3 className="text-2xl font-semibold text-slate-900">Nuevo insumo</h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <p className="mt-1 text-sm text-slate-500">
                    Registra un insumo base sin salir de la tabla y vuelve al catálogo cuando termines.
                  </p>
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button ref={closeButtonRef} variant="outline">
                  Cerrar
                </Button>
              </Dialog.Close>
            </div>

            <ResourceForm companyId={companyId} onCancel={onClose} onCreated={onCreated} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
