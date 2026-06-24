"use client";

import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { RiskBudgetItem, RiskVariableRecord } from "@/types/risk";

type RiskVariableRow = RiskBudgetItem & {
  variable: RiskVariableRecord | null;
};

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
  onEditVariable: (itemId: string) => void;
  variables: RiskVariableRecord[];
}) {
  const rows = items.map((item) => ({
    ...item,
    variable: variables.find((variable) => variable.budgetItemId === item.itemId) ?? null,
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
  onEditVariable: (itemId: string) => void;
  rows: RiskVariableRow[];
}) {
  "use no memo";

  // React Compiler cannot memoize TanStack Table's function-returning API safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: [
      columnHelper.accessor("code", {
        header: "Codigo",
        cell: (info) => info.getValue() || "-",
      }),
      columnHelper.accessor("description", {
        header: "Partida",
        cell: (info) => <span className="theme-strong-text font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor("sourceBudgetName", {
        header: "Presupuesto origen",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("baseQuantity", {
        header: "Cant. base",
        cell: (info) => formatNumber(info.getValue(), 4),
      }),
      columnHelper.display({
        id: "minimum",
        header: "Min",
        cell: ({ row }) => formatOptionalNumber(row.original.variable?.minimum),
      }),
      columnHelper.display({
        id: "mostLikely",
        header: "Mas probable",
        cell: ({ row }) => formatOptionalNumber(row.original.variable?.mostLikely),
      }),
      columnHelper.display({
        id: "maximum",
        header: "Max",
        cell: ({ row }) => formatOptionalNumber(row.original.variable?.maximum),
      }),
      columnHelper.display({
        id: "baseTotal",
        header: "Parcial base",
        cell: ({ row }) => formatCurrency(row.original.baseTotal, currency, currencyDecimals),
      }),
      columnHelper.display({
        id: "enabled",
        header: "Estado",
        cell: ({ row }) => <VariableState variable={row.original.variable} />,
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button disabled={disabled} size="sm" variant="outline" onClick={() => onEditVariable(row.original.itemId)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Editar
          </Button>
        ),
      }),
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="max-h-[560px] overflow-auto">
      <Table className="min-w-[1120px] text-xs">
        <THead className="theme-muted-panel sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <TR key={headerGroup.id} className="theme-muted-panel hover:theme-muted-panel">
              {headerGroup.headers.map((header) => (
                <TH key={header.id} className="border-r border-[var(--app-border)] px-3 py-2 text-[11px] uppercase tracking-wide">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TH>
              ))}
            </TR>
          ))}
        </THead>
        <TBody>
          {table.getRowModel().rows.map((row) => (
            <TR key={row.id} className="h-10">
              {row.getVisibleCells().map((cell) => (
                <TD key={cell.id} className="border-r border-[var(--app-border-soft)] px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function VariableState({ variable }: { variable: RiskVariableRecord | null }) {
  if (!variable) {
    return <span className="theme-subtle-text">Sin variable</span>;
  }

  return (
    <span className={variable.enabled ? "font-medium text-emerald-700 dark:text-emerald-300" : "theme-muted-text font-medium"}>
      {variable.enabled ? "Activa" : "Inactiva"}
    </span>
  );
}

function formatOptionalNumber(value: number | undefined) {
  return typeof value === "number" ? formatNumber(value, 4) : "-";
}
