"use client";

import { useMemo, useState } from "react";
import { Combine, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { formatPolynomialIuCodeForDisplay } from "@/lib/polynomial-formula/monomial-metadata";
import { cn, formatNumber } from "@/lib/utils";
import type { PolynomialMonomialRecord, UnifiedIndexRecord } from "@/types/polynomial-formula";

const DEFAULT_VISIBLE_MONOMIALS = 12;

type BaseIndexOption = {
  key: string;
  code: string;
  name: string;
  value: string;
  geographicArea?: string;
};

function toBaseIndexOptions(indices: UnifiedIndexRecord[]): BaseIndexOption[] {
  return indices.map((index) => ({
    key: `${index.code}:${index.geographicArea ?? "NA"}`,
    code: index.code,
    name: index.name,
    value: index.value,
    geographicArea: index.geographicArea,
  }));
}

function formatReadonlyDecimal(value: string, decimalPlaces: number) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? formatNumber(numericValue, decimalPlaces) : value;
}

function getCoefficientStatus(value: string) {
  const coefficient = Number(value);

  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    return {
      label: "Sin aporte",
      className: "theme-badge-slate",
    };
  }

  if (coefficient < 0.05) {
    return {
      label: "< 0.050",
      className: "theme-status-warning",
    };
  }

  return {
    label: "Cumple",
    className: "theme-status-success",
  };
}

function formatBaseIndexOptionLabel(option: BaseIndexOption) {
  const displayCode = formatPolynomialIuCodeForDisplay(option.code) || option.code;
  return `${displayCode} - ${option.name}${option.geographicArea ? ` (${option.geographicArea})` : ""}`;
}

export function PolynomialMonomialsTable({
  monomials,
  baseIndexOptions,
  baseIndicesLoading,
  currencyDecimals,
  onChangeMonomial,
  onMergeMonomials,
  onAutoAdjustMonomials,
}: {
  monomials: PolynomialMonomialRecord[];
  baseIndexOptions: UnifiedIndexRecord[];
  baseIndicesLoading: boolean;
  currencyDecimals: number;
  onChangeMonomial: (monomial: PolynomialMonomialRecord) => void;
  onMergeMonomials?: (targetMonomialId: string, sourceMonomialIds: string[]) => void;
  onAutoAdjustMonomials?: () => void;
}) {
  const { isExcelMode } = useAppViewMode();
  const [targetMonomialId, setTargetMonomialId] = useState("");
  const [sourceMonomialIds, setSourceMonomialIds] = useState<string[]>([]);
  const [showAllMonomials, setShowAllMonomials] = useState(false);
  const options = toBaseIndexOptions(baseIndexOptions);
  const selectedTarget = useMemo(
    () => monomials.find((monomial) => monomial.id === targetMonomialId) ?? null,
    [monomials, targetMonomialId],
  );
  const validMonomialIds = useMemo(
    () => new Set(monomials.map((monomial) => monomial.id)),
    [monomials],
  );
  const activeSourceMonomialIds = useMemo(
    () =>
      sourceMonomialIds.filter(
        (sourceId) => validMonomialIds.has(sourceId) && sourceId !== targetMonomialId,
      ),
    [sourceMonomialIds, targetMonomialId, validMonomialIds],
  );
  const visibleMonomials = useMemo(
    () => (showAllMonomials ? monomials : monomials.slice(0, DEFAULT_VISIBLE_MONOMIALS)),
    [monomials, showAllMonomials],
  );
  const hiddenMonomialCount = Math.max(monomials.length - visibleMonomials.length, 0);
  const selectedSourceCount = activeSourceMonomialIds.length;
  const canMerge = Boolean(onMergeMonomials && selectedTarget && selectedSourceCount > 0);

  function selectTarget(monomialId: string) {
    setTargetMonomialId(monomialId);
    setSourceMonomialIds((current) => current.filter((sourceId) => sourceId !== monomialId));
  }

  function toggleSource(monomialId: string, checked: boolean) {
    if (monomialId === targetMonomialId) {
      return;
    }

    setSourceMonomialIds((current) => {
      if (checked) {
        return current.includes(monomialId) ? current : [...current, monomialId];
      }

      return current.filter((sourceId) => sourceId !== monomialId);
    });
  }

  function mergeSelectedMonomials() {
    if (!onMergeMonomials || !canMerge) {
      return;
    }

    onMergeMonomials(targetMonomialId, activeSourceMonomialIds);
    setSourceMonomialIds([]);
  }

  return (
    <Card className="theme-surface-card">
      <CardContent className="space-y-4 p-6">
        <OperationalPanel
          title="Monomios"
          description="Edita codigos, nombres e indices base. Los coeficientes deben sumar 1.000 y cada monomio debe quedar asociado a un indice INEI."
          metrics={
            <span>
              {visibleMonomials.length} de {monomials.length} monomios
            </span>
          }
          controls={
            monomials.length > DEFAULT_VISIBLE_MONOMIALS ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAllMonomials((current) => !current)}
              >
                {showAllMonomials ? "Mostrar menos" : `Mostrar todos (${hiddenMonomialCount} restantes)`}
              </Button>
            ) : undefined
          }
        />

        {onMergeMonomials ? (
          <div className={cn("theme-muted-panel flex flex-wrap items-center justify-between gap-3 border px-4 py-3", isExcelMode ? "rounded-md border-[var(--app-border-strong)]" : "rounded-2xl")}>
            <div className="space-y-1">
              <p className="theme-strong-text text-sm font-medium">Juntar monomios</p>
              <p className="theme-muted-text text-xs">
                Destino: {selectedTarget?.code ?? "sin seleccionar"} - Origenes: {selectedSourceCount}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={mergeSelectedMonomials} disabled={!canMerge}>
                <Combine className="mr-2 h-4 w-4" />
                Juntar monomios
              </Button>
              {onAutoAdjustMonomials ? (
                <Button type="button" size="sm" variant="outline" onClick={onAutoAdjustMonomials}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Aplicar ajuste automatico
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {baseIndicesLoading ? (
          <div className={cn("theme-muted-panel border px-4 py-3 text-sm theme-muted-text", isExcelMode ? "rounded-md border-[var(--app-border-strong)]" : "rounded-2xl")}>
            Cargando indices INEI del mes base...
          </div>
        ) : null}

        <div data-testid="polynomial-monomials-table-frame" className={getTableFrameClassName(isExcelMode, "overflow-x-auto")}>
          <Table className="min-w-[1180px] table-fixed">
            <THead>
              <TR className="theme-muted-panel hover:theme-muted-panel">
                {onMergeMonomials ? (
                  <>
                    <TH className="w-[72px] text-center">Destino</TH>
                    <TH className="w-[72px] text-center">Origen</TH>
                  </>
                ) : null}
                <TH className="w-[86px]">Codigo</TH>
                <TH className="w-[330px]">Nombre</TH>
                <TH className="w-[138px]">Grupo</TH>
                <TH className="w-[118px] text-right">Monto base (S/)</TH>
                <TH className="w-[132px] text-right">Coef.</TH>
                <TH className="w-[220px]">Indice base</TH>
                <TH className="w-[92px] text-right">Valor</TH>
              </TR>
            </THead>
            <TBody>
              {visibleMonomials.map((monomial) => {
                const coefficientStatus = getCoefficientStatus(monomial.coefficient);

                return (
                <TR key={monomial.id}>
                  {onMergeMonomials ? (
                    <>
                      <TD className="text-center align-top">
                        <input
                          type="radio"
                          name="polynomial-merge-target"
                          checked={targetMonomialId === monomial.id}
                          onChange={() => selectTarget(monomial.id)}
                          aria-label={`Usar ${monomial.code} como destino`}
                          title="Monomio destino"
                          className="mt-2 h-4 w-4"
                        />
                      </TD>
                      <TD className="text-center align-top">
                        <input
                          type="checkbox"
                          checked={activeSourceMonomialIds.includes(monomial.id)}
                          disabled={targetMonomialId === monomial.id}
                          onChange={(event) => toggleSource(monomial.id, event.target.checked)}
                          aria-label={`Juntar ${monomial.code} en destino`}
                          title="Monomio origen"
                          className="mt-2 h-4 w-4 rounded border-[var(--app-border-strong)]"
                        />
                      </TD>
                    </>
                  ) : null}
                  <TD className="align-top">
                    <Input
                      value={monomial.code}
                      onChange={(event) =>
                        onChangeMonomial({
                          ...monomial,
                          code: event.target.value,
                        })
                      }
                      className="h-8 rounded-lg px-2 text-xs font-semibold uppercase tracking-wide"
                    />
                  </TD>
                  <TD className="align-top">
                    <input
                      value={monomial.name}
                      onChange={(event) =>
                        onChangeMonomial({
                          ...monomial,
                          name: event.target.value,
                        })
                      }
                      title={monomial.name}
                      className="theme-strong-text h-8 w-full border-0 bg-transparent px-0 text-xs outline-none ring-0 transition-colors placeholder:text-[var(--app-text-subtle)] focus:text-sky-700"
                    />
                  </TD>
                  <TD className="theme-muted-text align-top text-xs">
                    <span className="block truncate pt-2" title={monomial.costGroupKey}>
                      {monomial.costGroupKey}
                    </span>
                  </TD>
                  <TD className="align-top text-right">
                    <span className="theme-strong-text block pt-2 text-xs tabular-nums">
                      {formatReadonlyDecimal(monomial.amount, currencyDecimals)}
                    </span>
                  </TD>
                  <TD className="align-top text-right">
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <span className="theme-strong-text text-xs font-medium tabular-nums">
                        {formatReadonlyDecimal(monomial.coefficient, 3)}
                      </span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none", coefficientStatus.className)}>
                        {coefficientStatus.label}
                      </span>
                    </div>
                  </TD>
                  <TD className="align-top">
                    <Select
                      value={monomial.baseIndexCode}
                      onChange={(event) => {
                        const nextOption = options.find((option) => option.code === event.target.value);

                        onChangeMonomial({
                          ...monomial,
                          baseIndexCode: event.target.value,
                          baseIndexName: nextOption
                            ? `${nextOption.name}${nextOption.geographicArea ? ` (${nextOption.geographicArea})` : ""}`
                            : monomial.baseIndexName,
                          baseIndexValue: nextOption?.value ?? monomial.baseIndexValue,
                        });
                      }}
                      className="h-8 w-full rounded-lg px-2 text-xs"
                    >
                      <option value="">Selecciona un indice base</option>
                      {options.map((option) => (
                        <option key={option.key} value={option.code}>
                          {formatBaseIndexOptionLabel(option)}
                        </option>
                      ))}
                    </Select>
                  </TD>
                  <TD className="align-top">
                    <Input
                      type="number"
                      step="0.001"
                      value={monomial.baseIndexValue}
                      onChange={(event) =>
                        onChangeMonomial({
                          ...monomial,
                          baseIndexValue: event.target.value,
                        })
                      }
                      className="h-8 w-full rounded-lg px-2 text-right text-xs tabular-nums"
                    />
                  </TD>
                </TR>
                );
              })}
            </TBody>
          </Table>
        </div>

        {!showAllMonomials && hiddenMonomialCount > 0 ? (
          <div
            className={cn(
              "theme-muted-panel flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-sm",
              isExcelMode ? "rounded-md border-[var(--app-border-strong)]" : "rounded-2xl",
            )}
          >
            <p className="theme-muted-text">
              Se muestran los primeros {visibleMonomials.length} monomios para mantener la vista fluida.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAllMonomials(true)}>
              Ver {hiddenMonomialCount} monomios mas
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
