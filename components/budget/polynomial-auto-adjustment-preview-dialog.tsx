"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Decimal from "decimal.js";

import { Button } from "@/components/ui/button";
import type { FinalAdjustmentResult } from "@/lib/polynomial-formula/final-adjustment-types";
import type { PolynomialMonomialRecord } from "@/types/polynomial-formula";

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
  const groupingRows = preview ? buildGroupingRows(preview) : [];

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-slate-950/35 backdrop-blur-[2px]" />
        <Dialog.Content className="theme-surface-card fixed left-1/2 top-1/2 z-[130] flex max-h-[min(86vh,820px)] w-[min(92vw,860px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)] outline-none">
          <div className="theme-border-top flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <Dialog.Title className="theme-strong-text text-base font-semibold">Ajuste automatico de formula</Dialog.Title>
              <Dialog.Description className="theme-muted-text mt-1 text-sm">
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
                  <section className="theme-muted-panel rounded-2xl border p-4">
                    <p className="theme-muted-text text-xs uppercase tracking-[0.18em]">Antes</p>
                    <p className="theme-strong-text mt-2 text-lg font-semibold">{preview.originalMonomials.length} actuales</p>
                  </section>
                  <section className="theme-status-info rounded-2xl border p-4">
                    <p className="theme-status-info-strong text-xs uppercase tracking-[0.18em]">Despues</p>
                    <p className="theme-strong-text mt-2 text-lg font-semibold">{preview.finalMonomials.length} propuestos</p>
                  </section>
                </div>

                <section className="space-y-3">
                  <h2 className="theme-strong-text text-sm font-semibold">Monomios finales</h2>
                  <div className="overflow-hidden rounded-2xl border border-[var(--table-border-strong)]">
                    <table className="w-full border-collapse text-sm">
                      <thead className="theme-muted-panel theme-muted-text">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Codigo</th>
                          <th className="px-4 py-3 text-left font-medium">Nombre</th>
                          <th className="px-4 py-3 text-right font-medium">Coeficiente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.finalMonomials.map((monomial) => (
                          <tr key={monomial.id} className="border-t border-[var(--table-border-soft)]">
                            <td className="theme-strong-text px-4 py-3 font-medium">{monomial.code}</td>
                            <td className="theme-muted-text px-4 py-3">{monomial.name}</td>
                            <td className="theme-strong-text px-4 py-3 text-right tabular-nums">{monomial.coefficient}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="theme-strong-text text-sm font-semibold">Agrupamiento propuesto</h2>
                  <div className="overflow-hidden rounded-2xl border border-[var(--table-border-strong)]">
                    <table className="w-full border-collapse text-sm">
                      <thead className="theme-muted-panel theme-muted-text">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Monomio final</th>
                          <th className="px-4 py-3 text-right font-medium">Coef. final</th>
                          <th className="px-4 py-3 text-left font-medium">Monomios agrupados</th>
                          <th className="px-4 py-3 text-right font-medium">Suma origen</th>
                          <th className="px-4 py-3 text-left font-medium">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupingRows.map((row) => (
                          <tr key={row.finalMonomial.id} className="border-t border-[var(--table-border-soft)] align-top">
                            <td className="theme-strong-text px-4 py-3 font-medium">
                              {row.finalMonomial.code} - {row.finalMonomial.name}
                            </td>
                            <td className="theme-strong-text px-4 py-3 text-right tabular-nums">
                              {row.finalMonomial.coefficient}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1.5">
                                {row.groupedMonomials.map((monomial) => (
                                  <span
                                    key={monomial.id}
                                    className="theme-surface-panel rounded-lg border px-2.5 py-1 text-xs text-[var(--app-text)]"
                                  >
                                    {monomial.code} - {monomial.name} - Coef. {monomial.coefficient}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="theme-strong-text px-4 py-3 text-right tabular-nums">{row.originalSum}</td>
                            <td className="theme-muted-text px-4 py-3">{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="theme-strong-text text-sm font-semibold">Fusiones propuestas</h2>
                  {preview.mergePlan.length > 0 ? (
                    <ul className="space-y-2">
                      {preview.mergePlan.map((entry, index) => (
                        <li
                          key={`${entry.targetMonomialId}-${index}`}
                          className="theme-muted-panel rounded-2xl border px-4 py-3 text-sm text-[var(--app-text)]"
                        >
                          {entry.explanation}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="theme-muted-panel theme-muted-text rounded-2xl border px-4 py-3 text-sm">
                      La propuesta no requiere fusiones adicionales.
                    </p>
                  )}
                </section>

                <section className="space-y-3">
                  <h2 className="theme-strong-text text-sm font-semibold">Diagnosticos</h2>
                  {preview.diagnostics.length > 0 ? (
                    <ul className="space-y-2">
                      {preview.diagnostics.map((diagnostic, index) => (
                        <li
                          key={`${diagnostic.code}-${index}`}
                          className={
                            diagnostic.severity === "ERROR"
                              ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                              : "theme-muted-panel theme-muted-text rounded-2xl border px-4 py-3 text-sm"
                          }
                        >
                          {diagnostic.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="theme-status-success theme-status-success-strong rounded-2xl border px-4 py-3 text-sm">
                      Sin observaciones para esta propuesta.
                    </p>
                  )}
                </section>
              </div>

              <div className="theme-border-top flex justify-end gap-2 border-t px-5 py-4">
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

type GroupingRow = {
  finalMonomial: PolynomialMonomialRecord;
  groupedMonomials: PolynomialMonomialRecord[];
  originalSum: string;
  reason: string;
};

function buildGroupingRows(preview: FinalAdjustmentResult): GroupingRow[] {
  const originalById = new Map(preview.originalMonomials.map((monomial) => [monomial.id, monomial]));

  return preview.finalMonomials.map((finalMonomial) => {
    const sourceIds = preview.mergePlan
      .filter((entry) => entry.targetMonomialId === finalMonomial.id)
      .flatMap((entry) => entry.sourceMonomialIds);
    const groupedIds = [finalMonomial.id, ...sourceIds];
    const groupedMonomials = groupedIds
      .map((monomialId) => originalById.get(monomialId))
      .filter((monomial): monomial is PolynomialMonomialRecord => Boolean(monomial));
    const originalSum = groupedMonomials
      .reduce((sum, monomial) => sum.plus(monomial.coefficient), new Decimal(0))
      .toDecimalPlaces(3)
      .toFixed(3);
    const reasons = preview.mergePlan
      .filter((entry) => entry.targetMonomialId === finalMonomial.id)
      .map((entry) => entry.reason);

    return {
      finalMonomial,
      groupedMonomials,
      originalSum,
      reason: reasons.length > 0 ? [...new Set(reasons)].join(", ") : "Se mantiene",
    };
  });
}
