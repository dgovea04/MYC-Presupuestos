"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const ExportPanel = dynamic(() => import("@/components/exports/export-panel").then((mod) => mod.ExportPanel));
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { InfoCard } from "@/components/ui/info-cards";
import { Input } from "@/components/ui/input";
import { OperationalMetricBadge, OperationalPanel } from "@/components/ui/operational-surfaces";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StaticTableFrame } from "@/components/ui/virtualized-table-frame";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getExportDefinition } from "@/lib/exports/definitions";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { GeneralBudgetResourceSummaryResult } from "@/types/budget-sections";

export function GeneralBudgetResourcesTable({
  budgetId,
  summary,
  currency,
}: {
  budgetId: string;
  summary: GeneralBudgetResourceSummaryResult;
  currency: string;
}) {
  const { isExcelMode } = useAppViewMode();
  const { currencyDecimals } = useFormattingSettings();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [budgetName, setBudgetName] = useState("ALL");

  const budgetOptions = useMemo(
    () => [...new Set(summary.resources.flatMap((resource) => resource.budgetNames))].sort(),
    [summary.resources],
  );

  const filteredResources = useMemo(
    () =>
      summary.resources.filter((resource) => {
        const matchesQuery =
          `${resource.code} ${resource.description} ${resource.unit}`.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = category === "ALL" || resource.category === category;
        const matchesBudget = budgetName === "ALL" || resource.budgetNames.includes(budgetName);
        return matchesQuery && matchesCategory && matchesBudget;
      }),
    [budgetName, category, query, summary.resources],
  );

  const totals = useMemo(
    () =>
      filteredResources.reduce(
        (accumulator, resource) => ({
          totalQuantity: accumulator.totalQuantity + resource.totalQuantity,
          totalCost: accumulator.totalCost + resource.totalCost,
        }),
        { totalQuantity: 0, totalCost: 0 },
      ),
    [filteredResources],
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <OperationalPanel
          title="Lista de insumos derivada"
          description="Consolidado automatico a partir de los APUs de los Sub Presupuestos del proyecto. Esta vista es operativa y de solo lectura."
          metrics={<OperationalMetricBadge tone="accent">{summary.resources.length} insumos en origen</OperationalMetricBadge>}
          controls={
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_240px_auto]">
              <Input
                placeholder="Buscar por codigo, descripcion o unidad"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="ALL">Todas las categorias</option>
                <option value="MATERIAL">Materiales</option>
                <option value="LABOR">Mano de obra</option>
                <option value="EQUIPMENT">Equipos</option>
                <option value="TOOLS">Herramientas</option>
                <option value="SUBCONTRACT">Sub contratos</option>
              </Select>
              <Select value={budgetName} onChange={(event) => setBudgetName(event.target.value)}>
                <option value="ALL">Todos los Sub Presupuestos</option>
                {budgetOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <ExportPanel
                buttonLabel="Exportar"
                defaultPreset="lista_insumos_derivada"
                definition={getExportDefinition("budget_resources")}
                targetId={budgetId}
              />
            </div>
          }
        />

        <div className={isExcelMode ? "grid gap-2 md:grid-cols-2 xl:grid-cols-4" : "grid gap-3 md:grid-cols-2 xl:grid-cols-4"}>
          <InfoCard label="Insumos" value={String(filteredResources.length)} tone="slate" />
          <InfoCard label="Sub Presupuestos" value={String(summary.budgetCount)} tone="sky" />
          <InfoCard label="Cantidad total" value={formatNumber(totals.totalQuantity, 4)} tone="amber" />
          <InfoCard label="Costo total" value={formatCurrency(totals.totalCost, currency, currencyDecimals)} tone="sky" />
        </div>

        {summary.unresolvedCount > 0 ? (
          <div className={cn("border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800", isExcelMode ? "rounded-md" : "rounded-2xl")}>
            {summary.unresolvedCount} insumos no resolubles quedaron fuera del consolidado derivado.
          </div>
        ) : null}

        <StaticTableFrame>
          <Table>
            <THead>
              <TR className="bg-slate-50 hover:bg-slate-50">
                <TH>Codigo</TH>
                <TH>Descripcion</TH>
                <TH>Categoria</TH>
                <TH className="text-center">Unidad</TH>
                <TH className="text-right">P. unitario</TH>
                <TH className="text-right">Cantidad total</TH>
                <TH className="text-right">Costo total</TH>
                <TH className="text-right">Usos</TH>
                <TH>Sub Presupuestos</TH>
              </TR>
            </THead>
            <TBody>
              {filteredResources.map((resource) => (
                <TR key={resource.resourceId}>
                  <TD className="font-medium text-slate-900">{resource.code}</TD>
                  <TD>{resource.description}</TD>
                  <TD>{getCategoryLabel(resource.category)}</TD>
                  <TD className="text-center">{resource.unit}</TD>
                  <TD className="text-right tabular-nums">{formatCurrency(resource.unitPrice, currency, currencyDecimals)}</TD>
                  <TD className="text-right tabular-nums">{formatNumber(resource.totalQuantity, 4)}</TD>
                  <TD className="text-right tabular-nums">{formatCurrency(resource.totalCost, currency, currencyDecimals)}</TD>
                  <TD className="text-right tabular-nums">{resource.usageCount}</TD>
                  <TD className="text-sm text-slate-600">{resource.budgetNames.join(", ")}</TD>
                </TR>
              ))}
              {filteredResources.length === 0 ? (
                <TR>
                  <TD colSpan={9} className="p-4">
                    <EmptyStatePanel message="No hay insumos que coincidan con los filtros actuales." className="py-5 text-center" />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </StaticTableFrame>
      </CardContent>
    </Card>
  );
}

function getCategoryLabel(category: string) {
  if (category === "LABOR") return "Mano de obra";
  if (category === "EQUIPMENT") return "Equipos";
  if (category === "TOOLS") return "Herramientas";
  if (category === "SUBCONTRACT") return "Sub contratos";
  return "Materiales";
}
