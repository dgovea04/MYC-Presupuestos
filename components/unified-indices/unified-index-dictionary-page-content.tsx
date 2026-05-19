"use client";

import { useDeferredValue, useMemo, useState } from "react";

import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { useVirtualTableWindow } from "@/hooks/use-virtual-table-window";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { Input } from "@/components/ui/input";
import { OperationalFilterSummary, OperationalMetricBadge, OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VirtualizedTableFrame, VirtualizedTableSpacerRow } from "@/components/ui/virtualized-table-frame";
import type { UnifiedIndexDictionaryRow } from "@/types/unified-index";

const DICTIONARY_ROW_HEIGHT = 53;
const DICTIONARY_ROW_OVERSCAN = 8;
const DICTIONARY_TABLE_COLUMN_COUNT = 3;

export function UnifiedIndexDictionaryPageContent({ rows }: { rows: UnifiedIndexDictionaryRow[] }) {
  const { isExcelMode } = useAppViewMode();
  const { excelRowHeight } = useFormattingSettings();
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter);

  const filteredRows = useMemo(() => {
    const normalizedFilter = deferredFilter.trim().toLowerCase();
    if (!normalizedFilter) {
      return rows;
    }

    return rows.filter((row) => `${row.element} ${row.note ?? ""} ${row.code}`.toLowerCase().includes(normalizedFilter));
  }, [deferredFilter, rows]);
  const { scrollContainerRef, scrollProps, virtualRange } = useVirtualTableWindow({
    items: filteredRows,
    rowHeight: isExcelMode ? excelRowHeight : DICTIONARY_ROW_HEIGHT,
    overscan: DICTIONARY_ROW_OVERSCAN,
    fallbackVisibleRows: 12,
    resetKey: deferredFilter,
  });

  return (
    <div className="space-y-4">
      <OperationalPanel
        title="Tabla alfabetica"
        description="Diccionario oficial alfabetico de elementos con su codigo IU para consulta rapida y referencia dentro del ecosistema de costos."
        metrics={
          <div className="flex flex-wrap items-center gap-2">
            <OperationalMetricBadge tone="accent">
              {formatCount(filteredRows.length, "elemento visible", "elementos visibles")}
            </OperationalMetricBadge>
            <OperationalMetricBadge>
              Fuente oficial serializada
            </OperationalMetricBadge>
          </div>
        }
        controls={
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
            <Input
              aria-label="Buscar en diccionario alfabetico por elemento, nota o codigo"
              placeholder="Buscar por elemento, nota o codigo"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <OperationalFilterSummary className="flex items-center" data-testid="unified-index-dictionary-filter-summary">
              {filter.trim() ? `Filtrando "${filter}"` : "Lectura oficial no editable"}
            </OperationalFilterSummary>
          </div>
        }
      />

      <VirtualizedTableFrame scrollContainerRef={scrollContainerRef} onScroll={scrollProps.onScroll}>
        <Table>
          <THead className="sticky top-0 z-20 [&_tr]:border-b-slate-200">
            <TR className="bg-slate-50 hover:bg-slate-50">
              <TH>ELEMENTO</TH>
              <TH>NOTA</TH>
              <TH>CODIGO IU</TH>
            </TR>
          </THead>
          <TBody>
            <VirtualizedTableSpacerRow colSpan={DICTIONARY_TABLE_COLUMN_COUNT} height={virtualRange.topSpacerHeight} />
            {virtualRange.visibleRows.map((row) => (
              <TR key={`${row.element}-${row.code}-${row.note ?? "sin-nota"}`}>
                <TD className="font-medium text-slate-900">{row.element}</TD>
                <TD>{row.note ?? "Sin nota"}</TD>
                <TD className="tabular-nums">{row.code}</TD>
              </TR>
            ))}
            <VirtualizedTableSpacerRow colSpan={DICTIONARY_TABLE_COLUMN_COUNT} height={virtualRange.bottomSpacerHeight} />
          </TBody>
        </Table>
      </VirtualizedTableFrame>
    </div>
  );
}

function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}
