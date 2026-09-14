"use client";

import { memo, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Decimal from "decimal.js";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useOptionalAppViewMode } from "@/components/view-mode/app-view-mode-provider";
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
  const viewMode = useOptionalAppViewMode();
  const isExcelMode = viewMode?.isExcelMode ?? false;
  const [groupingDetailsOpen, setGroupingDetailsOpen] = useState(false);
  const [affinityDetailsOpen, setAffinityDetailsOpen] = useState(false);
  const groupingRows = useMemo(() => (preview ? buildProposedGroupingRows(preview) : []), [preview]);
  const displayedFinalMonomials = useMemo(
    () => groupingRows.map((row) => row.finalMonomial),
    [groupingRows],
  );
  const finalMonomialComplianceRows = useMemo(
    () => buildFinalMonomialComplianceRows(displayedFinalMonomials),
    [displayedFinalMonomials],
  );
  const initialGroupingRows = useMemo(
    () =>
      preview
        ? [...preview.initialGrouping].sort((left, right) => {
            const incidenceComparison = new Decimal(groupedIncidence(right.groupedMonomials)).comparedTo(
              new Decimal(groupedIncidence(left.groupedMonomials)),
            );
            return incidenceComparison !== 0
              ? incidenceComparison
              : left.principal.sortOrder - right.principal.sortOrder;
          })
        : [],
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
    setAffinityDetailsOpen(false);
    onClose();
  };
  const handleApply = () => {
    setGroupingDetailsOpen(false);
    setAffinityDetailsOpen(false);
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
                    className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 pr-4 flex flex-col"
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <section className="theme-muted-panel rounded-2xl border p-4">
                        <p className="theme-muted-text text-xs uppercase tracking-[0.18em]">Antes</p>
                        <p className="theme-strong-text mt-2 text-lg font-semibold">{preview.originalMonomials.length} actuales</p>
                      </section>
                      <section className="theme-status-info rounded-2xl border p-4">
                        <p className="theme-status-info-strong text-xs uppercase tracking-[0.18em]">Despues</p>
                        <p className="theme-strong-text mt-2 text-lg font-semibold">{displayedFinalMonomials.length} propuestos</p>
                      </section>
                    </div>

                    <section className="order-1 space-y-3">
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
                            {displayedFinalMonomials.map((monomial, index) => {
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

                    <section className={`order-4 border ${isExcelMode ? "rounded-md border-[var(--app-border)] bg-[var(--app-surface)] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.14)]" : "rounded-2xl border-[var(--app-border-soft)] bg-[var(--app-surface)] shadow-[0_10px_30px_-24px_rgba(15,23,42,0.28)]"}`}>
                      <div className={`border-b border-[var(--app-border)] ${isExcelMode ? "px-4 py-3" : "px-5 py-4"}`}>
                        <button type="button" className="theme-strong-text flex w-full items-center justify-between gap-3 text-left text-sm font-semibold" aria-expanded={affinityDetailsOpen} onClick={() => setAffinityDetailsOpen((current) => !current)}>
                          <span>Fusión por Afinidad de Mercado</span>
                          <ChevronDown className={`theme-muted-text h-4 w-4 shrink-0 transition-transform ${affinityDetailsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                        </button>
                        <p className="theme-muted-text mt-1 text-sm">
                          Orden de incidencia, selección de 8 principales y agrupación estándar con un máximo de 3 IU por monomio.
                          IU47 (mano de obra) e IU39 (índice general) se mantienen solos.
                        </p>
                      </div>
                      {affinityDetailsOpen ? <div className={`space-y-5 ${isExcelMode ? "px-4 py-4" : "px-6 pb-6 pt-5"}`}>
                      <h3 className="theme-strong-text text-sm font-semibold">Agrupamiento inicial</h3>
                      <p className="theme-muted-text mt-1 text-sm">Orden de incidencia, selección de 8 principales y agrupación estándar con un máximo de 3 IU por monomio. IU47 (mano de obra) e IU39 (índice general) se mantienen solos.</p>
                      <div className="overflow-hidden">
                        <Table className="w-full table-fixed text-xs [&_th]:px-3 [&_th]:py-3 [&_td]:break-words [&_td]:px-3 [&_td]:py-3 [&_th:first-child]:w-12 [&_td:first-child]:w-12 [&_th:nth-child(2)]:w-[30%] [&_td:nth-child(2)]:w-[30%] [&_th:nth-child(4)]:w-[14%] [&_td:nth-child(4)]:w-[14%] [&_th:nth-child(5)]:w-[8%] [&_td:nth-child(5)]:w-[8%] [&_th:nth-child(6)]:w-[20%] [&_td:nth-child(6)]:w-[20%]">
                          <THead><TR className="theme-muted-panel hover:theme-muted-panel">
                            <TH className="text-right">N.º</TH><TH>Monomio principal</TH><TH>IU agrupadas</TH><TH className="text-right">Incidencia agrupada</TH><TH className="text-right">Cantidad</TH><TH>Reglas FP</TH>
                          </TR></THead>
                          <TBody>
                            {initialGroupingRows.map((group, index) => (
                              <TR key={group.principalMonomialId} className="align-top">
                                <TD className="text-right tabular-nums">{index + 1}</TD>
                                <TD className="font-medium">{formatIu(group.principal)} - {group.principal.name}</TD>
                                <TD>{group.groupedMonomials.map((monomial) => formatIu(monomial)).join(", ")}</TD>
                                <TD className="text-right tabular-nums">{groupedIncidence(group.groupedMonomials)}</TD>
                                <TD className="text-right tabular-nums">{group.groupedMonomials.length}</TD>
                                <TD><InitialGroupingRules group={group} /></TD>
                              </TR>
                            ))}
                          </TBody>
                        </Table>
                      </div>
                      <div className="theme-muted-panel rounded-xl border px-4 py-3 text-sm">
                        <span className="theme-strong-text font-semibold">IU huérfanas ({preview.orphanMonomials.length}): </span>
                        {preview.orphanMonomials.length > 0
                          ? preview.orphanMonomials.map((monomial) => `${formatIu(monomial)} - ${monomial.name}`).join(", ")
                          : "Ninguna"}
                      </div>
                      </div> : null}
                      {affinityDetailsOpen && preview.affinityIterations.length > 0 ? (
                        <div className="space-y-2 px-4 py-4">
                          <h3 className="theme-strong-text text-sm font-semibold">Iteraciones de Fusión por Afinidad</h3>
                          <div className="overflow-hidden">
                            <Table className="w-full table-fixed text-xs [&_th]:px-3 [&_th]:py-3 [&_td]:break-words [&_td]:px-3 [&_td]:py-3 [&_th:first-child]:w-[7%] [&_td:first-child]:w-[7%] [&_th:nth-child(2)]:w-[25%] [&_td:nth-child(2)]:w-[25%] [&_th:nth-child(3)]:w-[25%] [&_td:nth-child(3)]:w-[25%] [&_th:nth-child(4)]:w-[10%] [&_td:nth-child(4)]:w-[10%] [&_th:nth-child(5)]:w-[10%] [&_td:nth-child(5)]:w-[10%] [&_th:nth-child(6)]:w-[9%] [&_td:nth-child(6)]:w-[9%] [&_th:nth-child(7)]:w-[14%] [&_td:nth-child(7)]:w-[14%]">
                              <THead><TR className="theme-muted-panel hover:theme-muted-panel">
                                <TH className="text-right">N.º</TH><TH>IU fusionada</TH><TH>IU receptora</TH><TH className="text-right">Incidencia IU</TH><TH>Razón</TH><TH className="text-right">Grupos conformes</TH><TH>Estado</TH>
                              </TR></THead>
                              <TBody>
                                {preview.affinityIterations.map((step) => (
                                  <TR key={step.iteration}>
                                    <TD className="text-right tabular-nums">{step.iteration}</TD>
                                    <TD className="font-medium">{formatIu(step.source)} - {step.source.name}</TD>
                                    <TD className="font-medium">{formatIu(step.target)} - {step.target.name}</TD>
                                    <TD className="text-right tabular-nums">{step.sourceIncidence}</TD>
                                    <TD>{formatMergeReason(step.reason)}</TD>
                                    <TD className="text-right tabular-nums">{step.groupsPassingRules}/{step.groupsChecked}</TD>
                                    <TD>{step.completed ? "Concluido" : "Continua"}</TD>
                                  </TR>
                                ))}
                              </TBody>
                            </Table>
                          </div>
                          <div className="space-y-3 pt-2">
                            {preview.affinityIterations.map((step) => (
                              <section key={`iteration-grouping-${step.iteration}`} className="space-y-2">
                                <h3 className="theme-strong-text text-sm font-semibold">Cuadro de la iteración {step.iteration} — IU fusionada: {formatIu(step.source)} · IU receptora: {formatIu(step.target)}</h3>
                                <AffinityGroupingTable groupingBefore={step.groupingBefore} grouping={step.grouping} />
                              </section>
                            ))}
                          </div>
                          <h3 className="theme-strong-text pt-2 text-sm font-semibold">Cuadro de la última iteración</h3>
                          <div className="overflow-hidden">
                            <Table className="w-full table-fixed text-xs [&_th]:px-3 [&_th]:py-3 [&_td]:break-words [&_td]:px-3 [&_td]:py-3 [&_th:first-child]:w-12 [&_td:first-child]:w-12 [&_th:nth-child(2)]:w-[30%] [&_td:nth-child(2)]:w-[30%] [&_th:nth-child(4)]:w-[14%] [&_td:nth-child(4)]:w-[14%] [&_th:nth-child(5)]:w-[8%] [&_td:nth-child(5)]:w-[8%] [&_th:nth-child(6)]:w-[20%] [&_td:nth-child(6)]:w-[20%]">
                              <THead><TR className="theme-muted-panel hover:theme-muted-panel">
                                <TH className="text-right">N.º</TH><TH>Monomio principal</TH><TH>IU agrupadas</TH><TH className="text-right">Incidencia agrupada</TH><TH className="text-right">Cantidad</TH><TH>Reglas FP</TH>
                              </TR></THead>
                              <TBody>
                                {[...preview.affinityFinalGrouping]
                                  .sort((left, right) => new Decimal(groupedIncidence(right.groupedMonomials)).comparedTo(new Decimal(groupedIncidence(left.groupedMonomials))))
                                  .map((group, index) => (
                                    <TR key={group.principalMonomialId} className="align-top">
                                      <TD className="text-right tabular-nums">{index + 1}</TD>
                                      <TD className="font-medium">{formatIu(group.principal)} - {group.principal.name}</TD>
                                      <TD>{group.groupedMonomials.map((monomial) => formatIu(monomial)).join(", ")}</TD>
                                      <TD className="text-right tabular-nums">{groupedIncidence(group.groupedMonomials)}</TD>
                                      <TD className="text-right tabular-nums">{group.groupedMonomials.length}</TD>
                                      <TD><InitialGroupingRules group={group} /></TD>
                                    </TR>
                                  ))}
                              </TBody>
                            </Table>
                          </div>
                          <div className="theme-muted-panel rounded-xl border px-4 py-3 text-sm">
                            <span className="theme-strong-text font-semibold">IU huérfanas restantes ({preview.affinityFinalOrphans.length}): </span>
                            {preview.affinityFinalOrphans.length > 0
                              ? preview.affinityFinalOrphans.map((monomial) => `${formatIu(monomial)} - ${monomial.name}`).join(", ")
                              : "Ninguna"}
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section className="order-2 space-y-3">
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

                    <section className="hidden space-y-3" aria-hidden="true">
                      <div>
                        <h2 className="theme-strong-text text-sm font-semibold">Fusión por Afinidad de Mercado</h2>
                        <p className="theme-muted-text mt-1 text-sm">
                          Resultado de absorber los monomios menores en el IU principal más afín, antes de conformar la fórmula final.
                        </p>
                      </div>
                      {preview.mergePlan.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
                          <Table className={`min-w-[680px] table-fixed text-xs ${isExcelMode ? "[&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_tr]:h-7" : ""}`}>
                            <THead><TR className="theme-muted-panel hover:theme-muted-panel">
                              <TH>IU absorbido</TH><TH>IU principal</TH><TH className="text-right">Incidencia absorbida</TH><TH className="text-right">Incidencia resultante</TH><TH>Criterio</TH>
                            </TR></THead>
                            <TBody>
                              {buildAffinityRows(preview).map((row, index) => (
                                <TR key={`${row.targetMonomialId}-${row.sourceMonomialId}-${index}`}><TD className="font-medium">{row.sourceIu}</TD><TD className="font-medium">{row.targetIu}</TD><TD className="text-right tabular-nums">{row.absorbedCoefficient}</TD><TD className="text-right tabular-nums">{row.resultingCoefficient}</TD><TD>{row.reason}</TD></TR>
                              ))}
                            </TBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="theme-muted-panel theme-muted-text rounded-2xl border px-4 py-3 text-sm">
                          No se realizaron fusiones por afinidad de mercado.
                        </p>
                      )}
                      {preview.mergePlan.length > 0 ? (
                        <div className="space-y-2">
                          <h3 className="theme-strong-text text-xs font-semibold">Resultado de las fusiones</h3>
                          <div className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
                            <Table className={`min-w-[420px] table-fixed text-xs ${isExcelMode ? "[&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_tr]:h-7" : ""}`}>
                              <THead><TR className="theme-muted-panel hover:theme-muted-panel"><TH>IU principal resultante</TH><TH className="text-right">Incidencia resultante</TH></TR></THead>
                              <TBody>
                                {buildAffinityResultRows(preview).map((row) => (
                                  <TR key={row.targetMonomialId}><TD className="font-medium">{row.targetIu}</TD><TD className="text-right tabular-nums">{row.resultingCoefficient}</TD></TR>
                                ))}
                              </TBody>
                            </Table>
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section className="order-5 space-y-3">
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

type AffinityRow = {
  targetMonomialId: string;
  sourceMonomialId: string;
  sourceIu: string;
  targetIu: string;
  absorbedCoefficient: string;
  resultingCoefficient: string;
  reason: string;
};

function buildAffinityRows(preview: FinalAdjustmentResult): AffinityRow[] {
  const originalById = new Map(preview.originalMonomials.map((monomial) => [monomial.id, monomial]));
  const totalAmount = preview.originalMonomials.reduce((sum, monomial) => sum.plus(monomial.amount), new Decimal(0));

  return preview.mergePlan.filter((entry) => entry.phase === "AFFINITY").flatMap((entry) => {
    const target = originalById.get(entry.targetMonomialId);
    return entry.sourceMonomialIds.map((sourceId) => {
      const source = originalById.get(sourceId);
      const directAmount = new Decimal(target?.amount ?? 0).plus(source?.amount ?? 0);
      return {
        targetMonomialId: entry.targetMonomialId,
        sourceMonomialId: sourceId,
        sourceIu: formatIu(source),
        targetIu: formatIu(target),
        absorbedCoefficient: new Decimal(source?.coefficient ?? 0).toDecimalPlaces(3).toFixed(3),
        resultingCoefficient: totalAmount.isZero()
          ? "0.000"
          : directAmount.dividedBy(totalAmount).toDecimalPlaces(3).toFixed(3),
        reason: formatMergeReason(entry.reason),
      };
    });
  });
}

function formatIu(monomial: PolynomialMonomialRecord | undefined): string {
  const code = monomial?.baseIndexCode || monomial?.composition[0]?.unifiedIndexCode;
  return code ? `IU ${code}` : "IU no identificado";
}

function groupedIncidence(monomials: readonly PolynomialMonomialRecord[]): string {
  return monomials
    .reduce((sum, monomial) => sum.plus(monomial.coefficient), new Decimal(0))
    .toDecimalPlaces(3)
    .toFixed(3);
}

function InitialGroupingRules({ group }: { group: { groupedMonomials: readonly PolynomialMonomialRecord[] } }) {
  const incidence = new Decimal(groupedIncidence(group.groupedMonomials));
  const maxIuCompliant = group.groupedMonomials.length <= 3;
  const incidenceCompliant = incidence.greaterThanOrEqualTo("0.050");
  const isCompliant = maxIuCompliant && incidenceCompliant;
  const reason = !maxIuCompliant ? "Más de 3 IU" : !incidenceCompliant ? "Incidencia < 0.050" : "";

  return (
    <span
      title={reason || "Máximo 3 IU e incidencia agrupada no menor de 0.050"}
      className={
        isCompliant
          ? "inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
          : "inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
      }
    >
      {isCompliant ? "Cumple" : `Revisar${reason ? `: ${reason}` : ""}`}
    </span>
  );
}

function AffinityGroupingTable({ groupingBefore, grouping }: { groupingBefore: readonly { principalMonomialId: string; principal: PolynomialMonomialRecord; groupedMonomials: readonly PolynomialMonomialRecord[] }[]; grouping: readonly { principalMonomialId: string; principal: PolynomialMonomialRecord; groupedMonomials: readonly PolynomialMonomialRecord[] }[] }) {
  const beforeById = new Map(groupingBefore.map((group) => [group.principalMonomialId, group]));
  const rows = [...grouping].sort((left, right) => new Decimal(groupedIncidence(right.groupedMonomials)).comparedTo(new Decimal(groupedIncidence(left.groupedMonomials))));
  return (
    <div className="overflow-hidden">
      <Table className="w-full table-fixed text-xs [&_th]:px-3 [&_th]:py-3 [&_td]:break-words [&_td]:px-3 [&_td]:py-3 [&_th:first-child]:w-[7%] [&_td:first-child]:w-[7%] [&_th:nth-child(2)]:w-[22%] [&_td:nth-child(2)]:w-[22%] [&_th:nth-child(3)]:w-[18%] [&_td:nth-child(3)]:w-[18%] [&_th:nth-child(4)]:w-[8%] [&_td:nth-child(4)]:w-[8%] [&_th:nth-child(5)]:w-[8%] [&_td:nth-child(5)]:w-[8%] [&_th:nth-child(6)]:w-[10%] [&_td:nth-child(6)]:w-[10%] [&_th:nth-child(7)]:w-[7%] [&_td:nth-child(7)]:w-[7%] [&_th:nth-child(8)]:w-[20%] [&_td:nth-child(8)]:w-[20%]">
        <THead><TR className="theme-muted-panel hover:theme-muted-panel"><TH className="text-right">N.º</TH><TH>Monomio principal</TH><TH>IU agrupadas</TH><TH className="text-right">Incidencia agrupada inicial</TH><TH className="text-right">Incidencia agrupada</TH><TH className="text-right">Diferencia</TH><TH className="text-right">Cantidad</TH><TH>Reglas FP</TH></TR></THead>
        <TBody>{rows.map((group, index) => { const before = beforeById.get(group.principalMonomialId); const initial = new Decimal(before ? groupedIncidence(before.groupedMonomials) : "0"); const final = new Decimal(groupedIncidence(group.groupedMonomials)); return <TR key={group.principalMonomialId} className="align-top"><TD className="text-right tabular-nums">{index + 1}</TD><TD className="font-medium">{formatIu(group.principal)} - {group.principal.name}</TD><TD>{group.groupedMonomials.map((monomial) => formatIu(monomial)).join(", ")}</TD><TD className="text-right tabular-nums">{initial.toFixed(3)}</TD><TD className="text-right tabular-nums">{final.toFixed(3)}</TD><TD className="text-right tabular-nums">{final.minus(initial).toFixed(3)}</TD><TD className="text-right tabular-nums">{group.groupedMonomials.length}</TD><TD><InitialGroupingRules group={group} /></TD></TR>; })}</TBody>
      </Table>
    </div>
  );
}

function buildAffinityResultRows(preview: FinalAdjustmentResult): Array<{
  targetMonomialId: string;
  targetIu: string;
  resultingCoefficient: string;
}> {
  const originalById = new Map(preview.originalMonomials.map((monomial) => [monomial.id, monomial]));
  const finalById = new Map(preview.finalMonomials.map((monomial) => [monomial.id, monomial]));
  const affinityEntries = preview.mergePlan.filter((entry) => entry.phase === "AFFINITY");
  const absorbedIds = new Set(affinityEntries.flatMap((entry) => entry.sourceMonomialIds));
  const targetIds = [...new Set(affinityEntries.map((entry) => entry.targetMonomialId))]
    .filter((targetMonomialId) => !absorbedIds.has(targetMonomialId));
  const totalAmount = preview.originalMonomials.reduce((sum, monomial) => sum.plus(monomial.amount), new Decimal(0));

  return targetIds.map((targetMonomialId) => {
    const target = originalById.get(targetMonomialId);
    const absorbedAmount = affinityEntries
      .filter((entry) => entry.targetMonomialId === targetMonomialId)
      .flatMap((entry) => entry.sourceMonomialIds)
      .reduce((sum, sourceId) => sum.plus(originalById.get(sourceId)?.amount ?? 0), new Decimal(target?.amount ?? 0));
    return {
      targetMonomialId,
      targetIu: formatIu(target),
      resultingCoefficient: totalAmount.isZero() ? "0.000" : absorbedAmount.dividedBy(totalAmount)
        .toDecimalPlaces(3)
        .toFixed(3),
    };
  });
}

function buildProposedGroupingRows(preview: FinalAdjustmentResult): GroupingRow[] {
  const grouping = preview.affinityIterations.at(-1)?.grouping ?? preview.initialGrouping;
  return grouping.map((group) => {
    const groupedCoefficient = groupedIncidence(group.groupedMonomials);
    return {
    finalMonomial: { ...group.principal, coefficient: groupedCoefficient },
    groupedMonomials: [...group.groupedMonomials],
    originalSum: groupedCoefficient,
    reason: preview.affinityIterations.length > 0 ? "Agrupamiento posterior a la última iteración" : "Agrupamiento inicial",
    };
  });
}

function buildGroupingRows(preview: FinalAdjustmentResult): GroupingRow[] {
  const originalById = new Map(preview.originalMonomials.map((monomial) => [monomial.id, monomial]));

  return preview.finalMonomials.map((finalMonomial) => {
    const sourceIds = preview.mergePlan
      .filter((entry) => entry.targetMonomialId === finalMonomial.id && entry.phase !== "AFFINITY")
      .flatMap((entry) => entry.sourceMonomialIds);
    const finalIuCodes = new Set(
      finalMonomial.composition
        .map((row) => row.unifiedIndexCode)
        .filter((code): code is string => Boolean(code)),
    );
    const visibleSourceIds = sourceIds.filter((sourceId) => {
      const source = originalById.get(sourceId);
      const sourceCode = source?.composition.find((row) => row.unifiedIndexCode)?.unifiedIndexCode ?? source?.baseIndexCode;
      // Algunos registros históricos no tienen composición materializada;
      // en ese caso mantenemos la explicación del agrupamiento.
      return finalIuCodes.size === 0 || (sourceCode ? finalIuCodes.has(sourceCode) : false);
    });
    const groupedIds = [finalMonomial.id, ...visibleSourceIds];
    const groupedMonomials = groupedIds
      .map((monomialId) => originalById.get(monomialId))
      .filter((monomial): monomial is PolynomialMonomialRecord => Boolean(monomial));
    const originalSum = groupedMonomials
      .reduce((sum, monomial) => sum.plus(monomial.coefficient), new Decimal(0))
      .toDecimalPlaces(3)
      .toFixed(3);
    const reasons = preview.mergePlan
      .filter((entry) => entry.targetMonomialId === finalMonomial.id)
      .filter((entry) => entry.sourceMonomialIds.some((sourceId) => visibleSourceIds.includes(sourceId)))
      .map((entry) => entry.reason);

    return {
      finalMonomial,
      groupedMonomials,
      originalSum,
      reason: reasons.length > 0 ? [...new Set(reasons)].map(formatMergeReason).join(", ") : "Se mantiene",
    };
  });
}

function formatMergeReason(reason: string): string {
  const labels: Record<string, string> = {
    SAME_IU_CODE: "Mismo IU",
    SAME_IU_FAMILY: "Misma familia IU",
    COMPATIBLE_FAMILY: "Familias compatibles",
    SAME_BROAD_GROUP: "Mismo grupo de costo",
    HIGHEST_INCIDENCE_FALLBACK: "Mayor incidencia disponible",
    EXPERIENCE_HINT: "Afinidad basada en experiencia",
  };
  return labels[reason] ?? "Afinidad de mercado";
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
