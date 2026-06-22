"use client";

import { useDeferredValue, useMemo, useState } from "react";

import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { useVirtualTableWindow } from "@/hooks/use-virtual-table-window";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { OperationalFilterSummary, OperationalMetricBadge, OperationalPanel } from "@/components/ui/operational-surfaces";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VirtualizedTableFrame, VirtualizedTableSpacerRow } from "@/components/ui/virtualized-table-frame";
import type { UnifiedIndexRelationRow } from "@/types/unified-index";

const RELATION_ROW_HEIGHT = 53;
const RELATION_ROW_OVERSCAN = 8;
const RELATION_TABLE_COLUMN_COUNT = 3;

export function UnifiedIndexRelationsPageContent({ rows }: { rows: UnifiedIndexRelationRow[] }) {
  const { isExcelMode } = useAppViewMode();
  const { excelRowHeight } = useFormattingSettings();
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter);

  const filteredRows = useMemo(() => {
    const normalizedFilter = deferredFilter.trim().toLowerCase();
    if (!normalizedFilter) {
      return rows;
    }

    return rows.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(normalizedFilter));
  }, [deferredFilter, rows]);

  const totalResources = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.resourceCount, 0),
    [filteredRows],
  );
  const { scrollContainerRef, scrollProps, virtualRange } = useVirtualTableWindow({
    items: filteredRows,
    rowHeight: isExcelMode ? excelRowHeight : RELATION_ROW_HEIGHT,
    overscan: RELATION_ROW_OVERSCAN,
    fallbackVisibleRows: 12,
    resetKey: deferredFilter,
  });

  return (
    <div className="space-y-4">
      <OperationalPanel
        title="Tabla oficial"
        description="Relacion maestra de indices unificados disponible para consulta, cruce visual y referencia operativa dentro del flujo de costos."
        metrics={
          <div className="flex flex-wrap items-center gap-2">
            <OperationalMetricBadge tone="accent">
              {formatCount(filteredRows.length, "IU visible", "IU visibles")}
            </OperationalMetricBadge>
            <OperationalMetricBadge>
              {formatCount(totalResources, "insumo asociado", "insumos asociados")}
            </OperationalMetricBadge>
          </div>
        }
        controls={
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
            <Input
              aria-label="Buscar IU por codigo o nombre"
              placeholder="Buscar por codigo o nombre oficial"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <OperationalFilterSummary className="flex items-center">
              {filter.trim() ? `Filtrando "${filter}"` : "Consulta global no editable"}
            </OperationalFilterSummary>
          </div>
        }
      />

      <VirtualizedTableFrame scrollContainerRef={scrollContainerRef} onScroll={scrollProps.onScroll}>
        <Table className="table-fixed">
          <UnifiedIndexRelationsColGroup />
          <THead className="sticky top-0 z-20 [&_tr]:border-b-[var(--app-border)]">
            <TR className="bg-[var(--app-surface-muted)] hover:bg-[var(--app-surface-muted)]">
              <TH>CODIGO IU</TH>
              <TH>NOMBRE OFICIAL</TH>
              <TH className="text-right">INSUMOS ASOCIADOS</TH>
            </TR>
          </THead>
          <TBody>
            <VirtualizedTableSpacerRow colSpan={RELATION_TABLE_COLUMN_COUNT} height={virtualRange.topSpacerHeight} />
            {virtualRange.visibleRows.map((row) => (
              <TR key={`${row.code}-${row.name}`}>
                <TD className="font-medium text-[var(--app-text-strong)]">{row.code}</TD>
                <TD>{row.name}</TD>
                <TD className="text-right tabular-nums">{row.resourceCount}</TD>
              </TR>
            ))}
            <VirtualizedTableSpacerRow colSpan={RELATION_TABLE_COLUMN_COUNT} height={virtualRange.bottomSpacerHeight} />
          </TBody>
        </Table>
      </VirtualizedTableFrame>
    </div>
  );
}

function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function UnifiedIndexRelationsColGroup() {
  return (
    <colgroup>
      <col style={{ width: "140px" }} />
      <col />
      <col style={{ width: "180px" }} />
    </colgroup>
  );
}
