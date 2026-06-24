"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useRef } from "react";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { CompanyProfileForm } from "@/components/settings/company-profile-form";
import { Button } from "@/components/ui/button";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getExcelViewCssVariables } from "@/lib/budget/excel-view-css";
import { cn } from "@/lib/utils";

export function CompanyProfileSheet({
  open,
  company,
  onClose,
  onSaved,
}: {
  open: boolean;
  company?: {
    name?: string | null;
    ruc?: string | null;
    logoUrl?: string | null;
  };
  onClose: () => void;
  onSaved: (company: { name?: string | null; ruc?: string | null; logoUrl?: string | null }) => void;
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
              "theme-surface-card fixed inset-y-0 right-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l p-5 outline-none",
              isExcelMode ? "border-[var(--table-border-strong)] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.16)]" : "border-[var(--app-border)] shadow-2xl",
            )}
            data-view-mode={isExcelMode ? "excel" : "modern"}
            style={excelCssVariables}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--app-text-muted)]">Configuracion</p>
                <Dialog.Title asChild>
                  <h3 className="text-2xl font-semibold text-[var(--app-text-strong)]">
                    {company ? "Editar empresa / perfil profesional" : "Crear empresa / perfil profesional"}
                  </h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                    Actualiza la base comercial y documental sin salir de la vista de configuracion.
                  </p>
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button ref={closeButtonRef} variant="outline">
                  Cerrar
                </Button>
              </Dialog.Close>
            </div>

            <CompanyProfileForm
              key={`${company?.name ?? ""}:${company?.ruc ?? ""}:${company?.logoUrl ?? ""}`}
              initialCompany={company}
              onCancel={onClose}
              onSaved={onSaved}
              onSubmitSuccess={onClose}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

