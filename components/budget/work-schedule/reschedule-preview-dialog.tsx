"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { WorkScheduleRescheduleImpact } from "@/lib/work-schedule/rescheduling";

export type ReschedulePreviewDialogProps = {
  open: boolean;
  impacts: WorkScheduleRescheduleImpact[];
  onApply: () => void;
  onSaveOnlyThis: () => void;
  onCancel: () => void;
};

export function ReschedulePreviewDialog({
  open,
  impacts,
  onApply,
  onSaveOnlyThis,
  onCancel,
}: ReschedulePreviewDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl outline-none">
          <Dialog.Title className="text-lg font-semibold text-[var(--app-text-strong)]">
            Reprogramacion detectada
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[var(--app-text-muted)]">
            El cambio afecta a las siguientes partidas. Puedes aplicar la reprogramacion o guardar solo la partida editada.
          </Dialog.Description>

          <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border border-[var(--app-border)]">
            <Table className="table-fixed">
              <THead className="bg-[var(--app-surface-muted)]">
                <TR>
                  <TH className="text-left">Partida</TH>
                  <TH className="text-left">Inicio anterior</TH>
                  <TH className="text-left">Nuevo inicio</TH>
                  <TH className="text-left">Fin anterior</TH>
                  <TH className="text-left">Nuevo fin</TH>
                  <TH className="text-right">Variacion</TH>
                </TR>
              </THead>
              <TBody>
                {impacts.map((impact) => (
                  <TR key={impact.budgetItemId}>
                    <TD className="text-sm font-medium text-[var(--app-text-strong)]">
                      {impact.itemCode}
                      <span className="ml-2 text-xs text-[var(--app-text-muted)]">{impact.description}</span>
                      {impact.isCritical ? (
                        <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          Critica
                        </span>
                      ) : null}
                    </TD>
                    <TD className="text-sm text-[var(--app-text-muted)]">{impact.previousStartDate ?? "-"}</TD>
                    <TD className="text-sm text-[var(--app-text-strong)]">{impact.nextStartDate ?? "-"}</TD>
                    <TD className="text-sm text-[var(--app-text-muted)]">{impact.previousEndDate ?? "-"}</TD>
                    <TD className="text-sm text-[var(--app-text-strong)]">{impact.nextEndDate ?? "-"}</TD>
                    <TD className="text-right text-sm font-medium text-[var(--app-text-strong)]">
                      {impact.deltaDays > 0 ? `+${impact.deltaDays}d` : `${impact.deltaDays}d`}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={onSaveOnlyThis}>
              Guardar solo esta partida
            </Button>
            <Button onClick={onApply}>Aplicar reprogramacion</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
