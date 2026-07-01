"use client";

import Decimal from "decimal.js";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import {
  formatPolynomialIuCodeForDisplay,
  formatPolynomialIuNameForDisplay,
} from "@/lib/polynomial-formula/monomial-metadata";
import { cn, formatNumber } from "@/lib/utils";
import type {
  PolynomialMonomialCompositionRecord,
  PolynomialMonomialRecord,
} from "@/types/polynomial-formula";

export type PolynomialCompositionDetailProps = {
  monomials: PolynomialMonomialRecord[];
};

type CompositionDetailRow = {
  id: string;
  unifiedIndexCode?: string;
  unifiedIndexName?: string;
  resourceName?: string;
  iuFamily?: string;
  initialGroup: InitialMonomialGroupKey;
  amount?: string;
  participationPercentage?: string;
  coefficientContribution?: string;
  sourceIds: string[];
  hasComposition: boolean;
};

type CompositionDetailGroup = {
  monomialId: string;
  monomialCode: string;
  monomialName: string;
  monomialCoefficient: string;
  rows: CompositionDetailRow[];
  totalAmount: Decimal;
  totalParticipation: Decimal;
  totalCoefficientContribution: Decimal;
};

type InitialMonomialGroupKey =
  | "LABOR"
  | "MATERIALS"
  | "EQUIPMENT"
  | "OTHERS"
  | "GENERAL_EXPENSES_PROFIT";

type InitialMonomialSummaryRow = {
  key: InitialMonomialGroupKey;
  code: string;
  name: string;
  group: string;
  amount: Decimal;
  coefficient: Decimal;
};

const ZERO = new Decimal(0);
const DEFAULT_VISIBLE_COMPONENT_ROWS = 8;
const initialMonomialGroups: Array<{
  key: InitialMonomialGroupKey;
  code: string;
  name: string;
}> = [
  { key: "LABOR", code: "MO", name: "Mano de obra" },
  { key: "MATERIALS", code: "MAT", name: "Materiales" },
  { key: "EQUIPMENT", code: "EQ", name: "Equipos" },
  { key: "OTHERS", code: "V", name: "Otros" },
  { key: "GENERAL_EXPENSES_PROFIT", code: "GU", name: "Gastos generales y utilidad" },
];

function formatDecimalString(value: string | undefined, decimalPlaces: number) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "-";
  }

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? formatNumber(numericValue, decimalPlaces) : trimmed;
}

function formatPercentage(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "-";
  }

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? `${formatNumber(numericValue * 100, 2)}%` : trimmed;
}

function formatUnifiedIndexLabel(row: CompositionDetailRow) {
  if (!row.unifiedIndexCode && !row.unifiedIndexName) {
    return "Sin indice";
  }

  const displayCode = formatPolynomialIuCodeForDisplay(row.unifiedIndexCode) || row.unifiedIndexCode;
  const displayName = formatPolynomialIuNameForDisplay(row.unifiedIndexName);

  if (row.unifiedIndexCode && displayName) {
    return `${displayCode} : ${displayName}`;
  }

  return displayCode ?? displayName ?? "Sin indice";
}

function formatMonomialGroupName(monomial: PolynomialMonomialRecord) {
  const embeddedIuLabel = monomial.name.match(/^IU\s+(\d+)\s*:\s*(.+)$/i);
  const displayCode = formatPolynomialIuCodeForDisplay(monomial.baseIndexCode || embeddedIuLabel?.[1]);
  const displayName = formatPolynomialIuNameForDisplay(embeddedIuLabel?.[2] ?? monomial.baseIndexName);

  if (displayCode && displayName) {
    return `IU ${displayCode} : ${displayName}`;
  }

  return monomial.name;
}

function formatDecimal(value: Decimal, decimalPlaces: number) {
  return formatNumber(value.toNumber(), decimalPlaces);
}

function getCompositionSourceIds(component: PolynomialMonomialCompositionRecord) {
  return [component.budgetItemId, component.apuResourceId].filter((value): value is string => Boolean(value));
}

function deriveInitialGroupFromResourceType(resourceType: string | undefined): InitialMonomialGroupKey {
  const token = (resourceType ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (["LABOR", "MO", "MANO DE OBRA"].includes(token)) return "LABOR";
  if (["MATERIAL", "MATERIALS", "MAT", "MATERIALES"].includes(token)) return "MATERIALS";
  if (["EQUIPMENT", "EQUIPO", "EQ", "TOOLS", "TOOL", "HERRAMIENTAS"].includes(token)) return "EQUIPMENT";
  return "OTHERS";
}

function deriveInitialGroupFromCostGroup(costGroupKey: PolynomialMonomialRecord["costGroupKey"]): InitialMonomialGroupKey {
  if (costGroupKey === "GENERAL_EXPENSES_PROFIT") return "GENERAL_EXPENSES_PROFIT";
  if (costGroupKey === "LABOR") return "LABOR";
  if (costGroupKey === "EQUIPMENT") return "EQUIPMENT";
  if (costGroupKey === "OTHERS") return "OTHERS";
  return "MATERIALS";
}

function formatSourceCount(count: number) {
  return `${count} fuente${count === 1 ? "" : "s"}`;
}

function truncateSourceId(sourceId: string) {
  return sourceId.length <= 18 ? sourceId : `${sourceId.slice(0, 8)}...${sourceId.slice(-6)}`;
}

function formatSourceLabel(sourceIds: string[]) {
  if (sourceIds.length === 0) {
    return "0 fuentes";
  }

  return `${formatSourceCount(sourceIds.length)} : ${sourceIds.map(truncateSourceId).join(", ")}`;
}

function toOptionalDecimal(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return ZERO;

  try {
    return new Decimal(trimmed);
  } catch {
    return ZERO;
  }
}

function buildCompositionGroups(monomials: PolynomialMonomialRecord[]): CompositionDetailGroup[] {
  const groups: CompositionDetailGroup[] = [];

  for (const monomial of monomials) {
    const rows: CompositionDetailRow[] = [];

    if (monomial.composition.length === 0) {
      const initialGroup = deriveInitialGroupFromCostGroup(monomial.costGroupKey);
      rows.push({
        id: `${monomial.id}:empty`,
        unifiedIndexCode: monomial.baseIndexCode,
        unifiedIndexName: monomial.baseIndexName,
        resourceName: monomial.name,
        iuFamily: initialGroup === "GENERAL_EXPENSES_PROFIT" ? "GENERAL_EXPENSES" : undefined,
        initialGroup,
        amount: monomial.amount,
        participationPercentage: "1",
        coefficientContribution: monomial.coefficient,
        sourceIds: [],
        hasComposition: true,
      });
    } else {
      for (const component of monomial.composition) {
        rows.push({
          id: component.id,
          unifiedIndexCode: component.unifiedIndexCode,
          unifiedIndexName: component.unifiedIndexName,
          resourceName: component.resourceName,
          iuFamily: component.iuFamily,
          initialGroup: deriveInitialGroupFromResourceType(component.resourceType),
          amount: component.amount,
          participationPercentage: component.participationPercentage,
          coefficientContribution: component.coefficientContribution,
          sourceIds: getCompositionSourceIds(component),
          hasComposition: true,
        });
      }
    }

    groups.push({
      monomialId: monomial.id,
      monomialCode: monomial.code,
      monomialName: formatMonomialGroupName(monomial),
      monomialCoefficient: monomial.coefficient,
      rows,
      totalAmount: rows.reduce((total, row) => total.plus(toOptionalDecimal(row.amount)), ZERO),
      totalParticipation: rows.reduce((total, row) => total.plus(toOptionalDecimal(row.participationPercentage)), ZERO),
      totalCoefficientContribution: rows.reduce((total, row) => total.plus(toOptionalDecimal(row.coefficientContribution)), ZERO),
    });
  }

  return groups;
}

function buildInitialMonomialSummaryRows(monomials: PolynomialMonomialRecord[]): InitialMonomialSummaryRow[] {
  const amounts = new Map<InitialMonomialGroupKey, Decimal>(
    initialMonomialGroups.map((group) => [group.key, ZERO]),
  );

  for (const monomial of monomials) {
    if (monomial.composition.length === 0) {
      const groupKey = deriveInitialGroupFromCostGroup(monomial.costGroupKey);
      amounts.set(groupKey, (amounts.get(groupKey) ?? ZERO).plus(monomial.amount));
      continue;
    }

    for (const component of monomial.composition) {
      const groupKey = deriveInitialGroupFromResourceType(component.resourceType);
      amounts.set(groupKey, (amounts.get(groupKey) ?? ZERO).plus(component.amount));
    }
  }

  const totalAmount = [...amounts.values()].reduce((total, amount) => total.plus(amount), ZERO);

  return initialMonomialGroups.map((group) => {
    const amount = amounts.get(group.key) ?? ZERO;

    return {
      ...group,
      group: group.key,
      amount,
      coefficient: totalAmount.equals(ZERO) ? ZERO : amount.dividedBy(totalAmount).toDecimalPlaces(3),
    };
  });
}

export function PolynomialCompositionDetail({
  monomials,
}: PolynomialCompositionDetailProps) {
  const { isExcelMode } = useAppViewMode();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const compositionGroups = buildCompositionGroups(monomials);
  const initialRows = buildInitialMonomialSummaryRows(monomials);
  const initialTotalAmount = initialRows.reduce((total, row) => total.plus(row.amount), ZERO);
  const initialTotalCoefficient = initialTotalAmount.equals(ZERO) ? ZERO : new Decimal(1);
  const componentCount = monomials.reduce((total, monomial) => total + monomial.composition.length, 0);

  function toggleGroupRows(monomialId: string) {
    setExpandedGroups((current) => ({
      ...current,
      [monomialId]: !current[monomialId],
    }));
  }

  return (
    <details className={cn("theme-surface-card theme-soft-shadow group overflow-hidden border", isExcelMode ? "rounded-md border-[var(--app-border-strong)] shadow-none" : "rounded-2xl")}>
      <summary className={cn("flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 marker:hidden", isExcelMode ? "rounded-md" : "rounded-2xl")}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="theme-strong-text text-sm font-semibold">Detalle de composicion</span>
            <span className={cn("theme-status-info px-2 py-1 text-xs font-medium", isExcelMode ? "rounded-sm" : "rounded-full")}>
              DEV
            </span>
          </div>
          <p className="theme-muted-text mt-1 truncate text-sm">
            Trazabilidad DEV de los insumos agrupados para formar cada monomio.
          </p>
        </div>
        <div className="theme-muted-text flex shrink-0 items-center gap-2 text-sm">
          <span>{componentCount} componentes</span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition group-hover:bg-[var(--app-surface-hover-strong)] group-open:rotate-90 group-open:bg-[var(--app-surface-hover-strong)]">
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </summary>

      <div className="theme-border-top space-y-4 border-t p-6">
        {compositionGroups.length === 0 ? (
          <div className={cn("theme-muted-panel border px-4 py-3 text-sm theme-muted-text", isExcelMode ? "rounded-md border-[var(--app-border-strong)]" : "rounded-2xl")}>
            Sin monomios disponibles para inspeccionar.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="theme-strong-text text-sm font-semibold">Monomios iniciales</p>
              <div className={getTableFrameClassName(isExcelMode, "overflow-x-auto")}>
                <Table className="min-w-[820px] table-fixed text-xs">
                  <THead>
                    <TR className="theme-muted-panel hover:theme-muted-panel">
                      <TH className="w-[90px]">Codigo</TH>
                      <TH className="w-[260px]">Nombre</TH>
                      <TH className="w-[190px]">Grupo</TH>
                      <TH className="w-[140px] text-right">Monto base (S/)</TH>
                      <TH className="w-[140px] text-right">Coeficiente</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {initialRows.map((row) => (
                      <TR key={row.key}>
                        <TD className="theme-strong-text font-semibold">{row.code}</TD>
                        <TD className="truncate" title={row.name}>{row.name}</TD>
                        <TD className="theme-muted-text truncate text-xs" title={row.group}>{row.group}</TD>
                        <TD className="text-right tabular-nums">{formatDecimal(row.amount, 2)}</TD>
                        <TD className="theme-strong-text text-right font-medium tabular-nums">
                          {formatDecimal(row.coefficient, 3)}
                        </TD>
                      </TR>
                    ))}
                    <TR className="theme-muted-panel theme-strong-text font-semibold hover:theme-muted-panel">
                      <TD colSpan={3}>Total</TD>
                      <TD className="text-right tabular-nums">{formatDecimal(initialTotalAmount, 2)}</TD>
                      <TD className="text-right tabular-nums">{formatDecimal(initialTotalCoefficient, 3)}</TD>
                    </TR>
                  </TBody>
                </Table>
              </div>
            </div>

            <div className="space-y-4">
              {compositionGroups.map((group) => (
                <CompositionGroupPanel
                  key={group.monomialId}
                  group={group}
                  isExcelMode={isExcelMode}
                  showAllRows={expandedGroups[group.monomialId] ?? false}
                  onToggleRows={() => toggleGroupRows(group.monomialId)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </details>
  );
}

function CompositionGroupPanel({
  group,
  isExcelMode,
  showAllRows,
  onToggleRows,
}: {
  group: CompositionDetailGroup;
  isExcelMode: boolean;
  showAllRows: boolean;
  onToggleRows: () => void;
}) {
  const visibleRows = showAllRows ? group.rows : group.rows.slice(0, DEFAULT_VISIBLE_COMPONENT_ROWS);
  const hiddenRowCount = Math.max(group.rows.length - visibleRows.length, 0);

  return (
    <details
      open
      className={cn(
        "theme-surface-panel group overflow-hidden border",
        isExcelMode ? "rounded-md border-[var(--app-border-strong)]" : "rounded-2xl",
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 marker:hidden",
          isExcelMode ? "rounded-md" : "rounded-2xl",
        )}
      >
        <div className="min-w-0">
          <p className="theme-strong-text truncate text-sm font-semibold" title={group.monomialName}>
            {group.monomialName}
          </p>
          <p className="theme-muted-text text-xs">
            Codigo {group.monomialCode} - Coef. {formatDecimalString(group.monomialCoefficient, 3)}
          </p>
        </div>
        <div className="theme-muted-text flex shrink-0 items-center gap-2 text-xs">
          <span>{group.rows.length} componentes</span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition group-hover:bg-[var(--app-surface-hover-strong)] group-open:rotate-90 group-open:bg-[var(--app-surface-hover-strong)]">
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </summary>

      <div className="theme-border-top border-t p-4 pt-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="theme-muted-text text-xs">
            {visibleRows.length} de {group.rows.length} componentes visibles
          </p>
          {group.rows.length > DEFAULT_VISIBLE_COMPONENT_ROWS ? (
            <Button type="button" variant="outline" size="sm" onClick={onToggleRows}>
              {showAllRows ? "Mostrar menos" : `Mostrar todos (${hiddenRowCount} restantes)`}
            </Button>
          ) : null}
        </div>

        <div className={getTableFrameClassName(isExcelMode, "overflow-x-auto")}>
          <Table className="min-w-[1180px] table-fixed text-xs">
            <THead>
              <TR className="theme-muted-panel hover:theme-muted-panel">
                <TH className="w-[260px]">Indice unificado</TH>
                <TH className="w-[240px]">Insumo</TH>
                <TH className="w-[130px]">Grupo inicial</TH>
                <TH className="w-[120px]">Familia IU</TH>
                <TH className="w-[110px] text-right">Monto (S/)</TH>
                <TH className="w-[120px] text-right">Participacion</TH>
                <TH className="w-[120px] text-right">Aporte coef.</TH>
                <TH className="w-[180px]">Fuente</TH>
              </TR>
            </THead>
            <TBody>
              {visibleRows.map((row) => (
                <TR key={row.id} className={row.hasComposition ? undefined : "bg-[var(--app-surface-hover)]"}>
                  <TD className="align-middle">
                    {row.unifiedIndexCode || row.unifiedIndexName ? (
                      <p className="truncate text-xs text-[var(--app-text)]" title={formatUnifiedIndexLabel(row)}>
                        {formatUnifiedIndexLabel(row)}
                      </p>
                    ) : (
                      <span className="theme-subtle-text text-xs">Sin indice</span>
                    )}
                  </TD>
                  <TD className="align-middle">
                    <p className="truncate text-xs text-[var(--app-text)]" title={row.resourceName ?? "Sin insumo"}>
                      {row.resourceName ?? "Sin insumo"}
                    </p>
                  </TD>
                  <TD className="align-middle text-xs text-[var(--app-text)]">
                    <span className="block truncate" title={row.initialGroup}>{row.initialGroup}</span>
                  </TD>
                  <TD className="align-middle text-xs text-[var(--app-text)]">
                    <span className="block truncate" title={row.iuFamily ?? "Sin familia"}>{row.iuFamily ?? "Sin familia"}</span>
                  </TD>
                  <TD className="text-right align-middle tabular-nums">{formatDecimalString(row.amount, 2)}</TD>
                  <TD className="text-right align-middle tabular-nums">{formatPercentage(row.participationPercentage)}</TD>
                  <TD className="theme-strong-text text-right align-middle font-medium tabular-nums">
                    {formatDecimalString(row.coefficientContribution, 3)}
                  </TD>
                  <TD className="align-middle">
                    <p className="theme-muted-text truncate text-xs" title={formatSourceLabel(row.sourceIds)}>
                      {formatSourceLabel(row.sourceIds)}
                    </p>
                  </TD>
                </TR>
              ))}
              <TR className="theme-muted-panel theme-strong-text font-semibold hover:theme-muted-panel">
                <TD colSpan={4}>Total</TD>
                <TD className="text-right tabular-nums">{formatDecimal(group.totalAmount, 2)}</TD>
                <TD className="text-right tabular-nums">{formatPercentage(group.totalParticipation.toString())}</TD>
                <TD className="text-right tabular-nums">{formatDecimal(group.totalCoefficientContribution, 3)}</TD>
                <TD />
              </TR>
            </TBody>
          </Table>
        </div>

        {!showAllRows && hiddenRowCount > 0 ? (
          <div
            className={cn(
              "theme-muted-panel mt-3 flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-sm",
              isExcelMode ? "rounded-md border-[var(--app-border-strong)]" : "rounded-2xl",
            )}
          >
            <p className="theme-muted-text">
              Se muestran los primeros {visibleRows.length} componentes para mantener la navegacion fluida.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onToggleRows}>
              Ver {hiddenRowCount} componentes mas
            </Button>
          </div>
        ) : null}
      </div>
    </details>
  );
}
