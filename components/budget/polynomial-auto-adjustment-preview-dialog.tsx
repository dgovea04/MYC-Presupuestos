"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "@/components/ui/button";
import type { FinalAdjustmentResult } from "@/lib/polynomial-formula/final-adjustment-types";

type PolynomialAutoAdjustmentPreviewDialogProps = {
  open: boolean;
  preview: FinalAdjustmentResult | null;
  onApply: () => void;
  onClose: () => void;
};

export function PolynomialAutoAdjustmentPreviewDialog({
  open,
  preview,
  onApply,
  onClose,
}: PolynomialAutoAdjustmentPreviewDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-slate-950/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[130] flex max-h-[min(86vh,820px)] w-[min(92vw,860px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)] outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-950">Ajuste automatico de formula</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                Revisa la propuesta final antes de reemplazar los monomios editables.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="sm">
                Cerrar
              </Button>
            </Dialog.Close>
          </div>

          {preview ? (
            <>
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Antes</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{preview.originalMonomials.length} actuales</p>
                  </section>
                  <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-sky-700">Despues</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{preview.finalMonomials.length} propuestos</p>
                  </section>
                </div>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-950">Monomios finales</h2>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Codigo</th>
                          <th className="px-4 py-3 text-left font-medium">Nombre</th>
                          <th className="px-4 py-3 text-right font-medium">Coeficiente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.finalMonomials.map((monomial) => (
                          <tr key={monomial.id} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-medium text-slate-900">{monomial.code}</td>
                            <td className="px-4 py-3 text-slate-600">{monomial.name}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-900">{monomial.coefficient}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-950">Fusiones propuestas</h2>
                  {preview.mergePlan.length > 0 ? (
                    <ul className="space-y-2">
                      {preview.mergePlan.map((entry, index) => (
                        <li
                          key={`${entry.targetMonomialId}-${index}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                        >
                          {entry.explanation}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      La propuesta no requiere fusiones adicionales.
                    </p>
                  )}
                </section>

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-950">Diagnosticos</h2>
                  {preview.diagnostics.length > 0 ? (
                    <ul className="space-y-2">
                      {preview.diagnostics.map((diagnostic, index) => (
                        <li
                          key={`${diagnostic.code}-${index}`}
                          className={
                            diagnostic.severity === "ERROR"
                              ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                              : "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                          }
                        >
                          {diagnostic.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      Sin observaciones para esta propuesta.
                    </p>
                  )}
                </section>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="button" onClick={onApply} disabled={!preview.canApply}>
                  Aplicar propuesta
                </Button>
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
