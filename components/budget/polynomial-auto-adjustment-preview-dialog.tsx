"use client";

import { memo, useMemo, useState } from "react";
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

function PolynomialAutoAdjustmentPreviewDialogComponent({
  open,
  preview,
  onApply,
  onClose,
}: PolynomialAutoAdjustmentPreviewDialogProps) {
  const [groupingDetailsOpen, setGroupingDetailsOpen] = useState(false);
  const groupingRows = useMemo(() => (preview ? buildGroupingRows(preview) : []), [preview]);
  const finalMonomialComplianceRows = useMemo(
    () => (preview ? buildFinalMonomialComplianceRows(preview.finalMonomials) : []),
    [preview],
  );
  const groupedSourceCount = useMemo(
    () =>
      groupingRows.reduce((total, row) => {
        return total + Math.max(row.groupedMonomials.length - 1, 0);
      }, 0),
    [groupingRows],
  );
  const handleClose = () => {
    setGroupingDetailsOpen(false);
    onClose();
  };
  const handleApply = () => {
    setGroupingDetailsOpen(false);
    onApply();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-slate-950/35" />
        <Dialog.Content asChild>
          <div
            data-testid="polynomial-auto-adjustment-dialog-viewport"
            className="pointer-events-none fixed inset-0 z-[130] overflow-hidden px-4 py-6 outline-none"
          >
            <div className="theme-surface-card pointer-events-auto mx-auto flex max-h-[calc(100dvh-3rem)] w-[min(92vw,860px)] flex-col overflow-hidden rounded-2xl border shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)]">
              <div className="theme-border-top flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
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
                  <div
                    data-testid="polynomial-auto-adjustment-scroll-area"
                    className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 pr-4"
                  >
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
                              <th className="px-4 py-3 text-left font-medium">Reglas FP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.finalMonomials.map((monomial, index) => {
                              const compliance = finalMonomialComplianceRows[index];

                              return (
                                <tr key={monomial.id} className="border-t border-[var(--table-border-soft)]">
                                  <td className="theme-strong-text px-4 py-3 font-medium">{monomial.code}</td>
                                  <td className="theme-muted-text px-4 py-3">{monomial.name}</td>
                                  <td className="theme-strong-text px-4 py-3 text-right tabular-nums">{monomial.coefficient}</td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={
                                        compliance?.isCompliant
                                          ? "inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                                          : "inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                                      }
                                    >
                                      {compliance?.isCompliant ? "Cumple" : "Revisar"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="theme-strong-text text-sm font-semibold">Agrupamiento propuesto</h2>
                          <p className="theme-muted-text mt-1 text-xs">
                            Vista compacta para mantener el popup liviano. El detalle completo se abre solo bajo demanda.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setGroupingDetailsOpen((current) => !current)}
                        >
                          {groupingDetailsOpen ? "Ocultar detalle" : "Ver detalle"}
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <section className="theme-muted-panel rounded-2xl border p-4">
                          <p className="theme-muted-text text-xs uppercase tracking-[0.18em]">Monomios finales</p>
                          <p className="theme-strong-text mt-2 text-lg font-semibold">{groupingRows.length}</p>
                        </section>
                        <section className="theme-muted-panel rounded-2xl border p-4">
                          <p className="theme-muted-text text-xs uppercase tracking-[0.18em]">Origen agrupado</p>
                          <p className="theme-strong-text mt-2 text-lg font-semibold">{groupedSourceCount}</p>
                        </section>
                        <section className="theme-muted-panel rounded-2xl border p-4">
                          <p className="theme-muted-text text-xs uppercase tracking-[0.18em]">Modo de vista</p>
                          <p className="theme-strong-text mt-2 text-lg font-semibold">
                            {groupingDetailsOpen ? "Completo" : "Compacto"}
                          </p>
                        </section>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-[var(--table-border-strong)]">
                        <table className="w-full border-collapse text-sm">
                          <thead className="theme-muted-panel theme-muted-text">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Monomio final</th>
                              <th className="px-4 py-3 text-right font-medium">Coef. final</th>
                              <th className="px-4 py-3 text-left font-medium">
                                {groupingDetailsOpen ? "Monomios agrupados" : "Resumen"}
                              </th>
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
                                  {groupingDetailsOpen ? (
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
                                  ) : (
                                    <span className="theme-muted-text text-xs">
                                      {row.groupedMonomials.length} monomio{row.groupedMonomials.length === 1 ? "" : "s"} en el grupo
                                    </span>
                                  )}
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

                  <div className="theme-border-top flex shrink-0 justify-end gap-2 border-t px-5 py-4">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Cancelar
                    </Button>
                    <Button type="button" onClick={handleApply} disabled={!preview.canApply}>
                      Aplicar propuesta
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const PolynomialAutoAdjustmentPreviewDialog = memo(PolynomialAutoAdjustmentPreviewDialogComponent);

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

type FinalMonomialComplianceRow = {
  isCompliant: boolean;
};

function buildFinalMonomialComplianceRows(
  monomials: readonly PolynomialMonomialRecord[],
): FinalMonomialComplianceRow[] {
  return monomials.map((monomial) => {
    return {
      isCompliant: new Decimal(monomial.coefficient).greaterThanOrEqualTo("0.050"),
    };
  });
}
