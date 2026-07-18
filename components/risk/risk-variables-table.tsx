"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { BadgeDollarSign, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type {
  RiskBudgetItem,
  RiskDistributionType,
  RiskVariableDraftKey,
  RiskVariableRecord,
  RiskVariableType,
} from "@/types/risk";

type RiskVariableEntry = {
  draftKey: RiskVariableDraftKey;
  variableType: RiskVariableType;
  variable: RiskVariableRecord | null;
};

type RiskVariableRow = RiskBudgetItem & {
  entries: Record<RiskVariableType, RiskVariableEntry>;
};

type VariableStateFilter = "ALL" | "ACTIVE" | "INACTIVE" | "MISSING";
type VariableTypeFilter = "ALL" | RiskVariableType;
type DistributionFilter = "ALL" | RiskDistributionType | "MISSING";

const columnHelper = createColumnHelper<RiskVariableRow>();

export function RiskVariablesTable({
  currency,
  currencyDecimals,
  disabled = false,
  items,
  onEditVariable,
  variables,
}: {
  currency: string;
  currencyDecimals: number;
  disabled?: boolean;
  items: RiskBudgetItem[];
  onEditVariable: (draftKey: RiskVariableDraftKey) => void;
  variables: RiskVariableRecord[];
}) {
  const rows = items.map((item) => ({
    ...item,
    entries: {
      QUANTITY: {
        draftKey: `${item.itemId}:QUANTITY` as RiskVariableDraftKey,
        variableType: "QUANTITY",
        variable:
          variables.find((variable) => variable.budgetItemId === item.itemId && variable.variableType === "QUANTITY") ??
          null,
      },
      UNIT_PRICE: {
        draftKey: `${item.itemId}:UNIT_PRICE` as RiskVariableDraftKey,
        variableType: "UNIT_PRICE",
        variable:
          variables.find((variable) => variable.budgetItemId === item.itemId && variable.variableType === "UNIT_PRICE") ??
          null,
      },
    },
  }));

  return <RiskVariablesTableGrid currency={currency} currencyDecimals={currencyDecimals} disabled={disabled} onEditVariable={onEditVariable} rows={rows} />;
}

function RiskVariablesTableGrid({
  currency,
  currencyDecimals,
  disabled,
  onEditVariable,
  rows,
}: {
  currency: string;
  currencyDecimals: number;
  disabled: boolean;
  onEditVariable: (draftKey: RiskVariableDraftKey) => void;
  rows: RiskVariableRow[];
}) {
  "use no memo";
  const [stateFilter, setStateFilter] = useState<VariableStateFilter>("ALL");
  const [variableTypeFilter, setVariableTypeFilter] = useState<VariableTypeFilter>("ALL");
  const [distributionFilter, setDistributionFilter] = useState<DistributionFilter>("ALL");

  const visibleEntriesByRowId = useMemo(
    () =>
      new Map(
        rows.map((row) => [
          row.itemId,
          getVisibleEntries({
            distributionFilter,
            row,
            stateFilter,
            variableTypeFilter,
          }),
        ]),
      ),
    [distributionFilter, rows, stateFilter, variableTypeFilter],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const visibleEntries = visibleEntriesByRowId.get(row.itemId);
        return visibleEntries !== undefined && visibleEntries.length > 0;
      }),
    [rows, visibleEntriesByRowId],
  );

  // React Compiler cannot memoize TanStack Table's function-returning API safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredRows,
    columns: [
      columnHelper.accessor("code", {
        header: "Codigo",
        cell: (info) => <span className="block min-w-16">{info.getValue() || "-"}</span>,
      }),
      columnHelper.accessor("description", {
        header: "Partida",
        cell: (info) => (
          <span className="theme-strong-text block w-52 max-w-52 truncate font-medium" title={info.getValue()}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("sourceBudgetName", {
        header: "Origen",
        cell: (info) => <span className="block min-w-28">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: "variableType",
        header: "Variable",
        cell: ({ row }) => (
          <VariableEntryStack entries={visibleEntriesByRowId.get(row.original.itemId) ?? []}>
            {(entry) => formatVariableType(entry.variableType)}
          </VariableEntryStack>
        ),
      }),
      columnHelper.display({
        id: "distributionType",
        header: "Distribucion",
        cell: ({ row }) => (
          <VariableEntryStack entries={visibleEntriesByRowId.get(row.original.itemId) ?? []}>
            {(entry) => formatDistributionType(entry.variable?.distributionType)}
          </VariableEntryStack>
        ),
      }),
      columnHelper.display({
        id: "summary",
        header: "Resumen",
        cell: ({ row }) => {
          const entries = visibleEntriesByRowId.get(row.original.itemId) ?? [];

          if (entries.length > 0 && entries.every((entry) => entry.variable === null)) {
            return <MissingVariableSummary />;
          }

          return (
            <VariableEntryStack entries={entries}>
              {(entry) => <VariableSummary variable={entry.variable} />}
            </VariableEntryStack>
          );
        },
      }),
      columnHelper.accessor("baseQuantity", {
        header: "Cant. base",
        cell: (info) => <span className="block min-w-20 text-right">{formatNumber(info.getValue(), 4)}</span>,
      }),
      columnHelper.accessor("unitPrice", {
        header: "PU base",
        cell: (info) => (
          <span className="block min-w-24 text-right">{formatCurrency(info.getValue(), currency, currencyDecimals)}</span>
        ),
      }),
      columnHelper.display({
        id: "baseTotal",
        header: "Parcial base",
        cell: ({ row }) => (
          <span className="block min-w-24 text-right">
            {formatCurrency(row.original.baseTotal, currency, currencyDecimals)}
          </span>
        ),
      }),
      columnHelper.display({
        id: "enabled",
        header: "Estado",
        cell: ({ row }) => (
          <VariableEntryStack entries={visibleEntriesByRowId.get(row.original.itemId) ?? []}>
            {(entry) => <VariableState variable={entry.variable} />}
          </VariableEntryStack>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex min-w-[4.5rem] items-center gap-1">
            {(["QUANTITY", "UNIT_PRICE"] as const).map((variableType) => {
              const entry = row.original.entries[variableType];
              const label = `Editar ${formatVariableType(variableType).toLowerCase()}`;
              const Icon = variableType === "UNIT_PRICE" ? BadgeDollarSign : Ruler;

              return (
                <Button
                  key={entry.draftKey}
                  aria-label={label}
                  disabled={disabled}
                  size="sm"
                  title={label}
                  className="h-7 w-7 shrink-0 px-0"
                  variant="outline"
                  onClick={() => onEditVariable(entry.draftKey)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="sr-only">{label}</span>
                </Button>
              );
            })}
          </div>
        ),
      }),
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--app-border)] px-2 py-2">
        <FilterField label="Estado">
          <Select
            aria-label="Filtrar por estado"
            onChange={(event) => setStateFilter(event.target.value as VariableStateFilter)}
            value={stateFilter}
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Activas</option>
            <option value="INACTIVE">Inactivas</option>
            <option value="MISSING">Sin variable</option>
          </Select>
        </FilterField>
        <FilterField label="Tipo">
          <Select
            aria-label="Filtrar por tipo"
            onChange={(event) => setVariableTypeFilter(event.target.value as VariableTypeFilter)}
            value={variableTypeFilter}
          >
            <option value="ALL">Todos</option>
            <option value="QUANTITY">Cantidad</option>
            <option value="UNIT_PRICE">Precio unitario</option>
          </Select>
        </FilterField>
        <FilterField label="Distribucion">
          <Select
            aria-label="Filtrar por distribucion"
            onChange={(event) => setDistributionFilter(event.target.value as DistributionFilter)}
            value={distributionFilter}
          >
            <option value="ALL">Todas</option>
            <option value="TRIANGULAR">Triangular</option>
            <option value="PERT">PERT</option>
            <option value="NORMAL">Normal</option>
            <option value="UNIFORM">Uniforme</option>
            <option value="MISSING">Sin variable</option>
          </Select>
        </FilterField>
        <p className="theme-muted-text ml-auto text-[10px]">
          {filteredRows.length} de {rows.length} filas
        </p>
      </div>

      <div className="max-h-[520px] overflow-auto">
      <Table className="risk-variables-table min-w-[1200px] text-[10px] relative">
        <THead className="theme-muted-panel sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <TR key={headerGroup.id} className="theme-muted-panel hover:theme-muted-panel">
              {headerGroup.headers.map((header) => (
                <TH key={header.id} className="border-r border-[var(--app-border)] px-2 py-1.5 text-[10px] uppercase tracking-wide whitespace-nowrap">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TH>
              ))}
            </TR>
          ))}
        </THead>
        <TBody>
          {table.getRowModel().rows.map((row) => (
            <TR key={row.id} className="h-9">
              {row.getVisibleCells().map((cell) => (
                <TD key={cell.id} className="border-r border-[var(--app-border-soft)] px-2 py-1.5 align-middle whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
      </div>
    </div>
  );
}

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="space-y-1">
      <span className="theme-muted-text block text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      <div className="min-w-32">{children}</div>
    </label>
  );
}

function VariableEntryStack({
  children,
  entries,
}: {
  children: (entry: RiskVariableEntry) => ReactNode;
  entries: RiskVariableEntry[];
}) {
  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div key={entry.draftKey} className="min-h-0 whitespace-nowrap">
          {children(entry)}
        </div>
      ))}
    </div>
  );
}

function VariableState({ variable }: { variable: RiskVariableRecord | null }) {
  if (!variable) {
    return <StatusBadge tone="muted">Sin variable</StatusBadge>;
  }

  return (
    <StatusBadge tone={variable.enabled ? "active" : "inactive"}>{variable.enabled ? "Activa" : "Inactiva"}</StatusBadge>
  );
}

function VariableSummary({ variable }: { variable: RiskVariableRecord | null }) {
  if (!variable) {
    return (
      <span
        className="theme-subtle-text block max-w-32 truncate text-[10px]"
        title="Configura una variable para definir el rango."
      >
        Configura una variable para definir el rango.
      </span>
    );
  }

  return (
    <div className="flex max-w-40 items-center gap-2 whitespace-nowrap text-[10px]">
      <VariableState variable={variable} />
      <p
        className="theme-muted-text truncate text-[10px] leading-none"
        title={`${formatNumber(variable.minimum, 4)} / ${formatNumber(variable.mostLikely, 4)} / ${formatNumber(variable.maximum, 4)}`}
      >
        {formatNumber(variable.minimum, 4)} / {formatNumber(variable.mostLikely, 4)} / {formatNumber(variable.maximum, 4)}
      </p>
    </div>
  );
}

function MissingVariableSummary() {
  return (
    <span
      className="theme-subtle-text block max-w-32 truncate text-[10px]"
      title="Configura una variable para definir el rango."
    >
      Configura una variable para definir el rango.
    </span>
  );
}

function StatusBadge({
  children,
  tone,
}: {
  children: string;
  tone: "active" | "inactive" | "muted";
}) {
  const className =
    tone === "active"
      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
      : tone === "inactive"
        ? "rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600"
        : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500";

  return <span className={className}>{children}</span>;
}

function formatVariableType(value: RiskVariableType) {
  return value === "UNIT_PRICE" ? "Precio unitario" : "Cantidad";
}

function formatDistributionType(value: RiskDistributionType | undefined) {
  if (value === "PERT") {
    return "PERT";
  }

  if (value === "NORMAL") {
    return "Normal";
  }

  if (value === "UNIFORM") {
    return "Uniforme";
  }

  if (value === "TRIANGULAR") {
    return "Triangular";
  }

  return "-";
}

function getVisibleEntries({
  distributionFilter,
  row,
  stateFilter,
  variableTypeFilter,
}: {
  distributionFilter: DistributionFilter;
  row: RiskVariableRow;
  stateFilter: VariableStateFilter;
  variableTypeFilter: VariableTypeFilter;
}) {
  return (["QUANTITY", "UNIT_PRICE"] as const)
    .map((variableType) => row.entries[variableType])
    .filter((entry) => {
      if (variableTypeFilter !== "ALL" && entry.variableType !== variableTypeFilter) {
        return false;
      }

      if (stateFilter === "ACTIVE" && !entry.variable?.enabled) {
        return false;
      }

      if (stateFilter === "INACTIVE" && (!entry.variable || entry.variable.enabled)) {
        return false;
      }

      if (stateFilter === "MISSING" && entry.variable) {
        return false;
      }

      if (distributionFilter === "MISSING" && entry.variable) {
        return false;
      }

      if (
        distributionFilter !== "ALL" &&
        distributionFilter !== "MISSING" &&
        entry.variable?.distributionType !== distributionFilter
      ) {
        return false;
      }

      return true;
    });
}
