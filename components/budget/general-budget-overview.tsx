"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { buildDisplayRows } from "@/lib/budget/structure";
import { calculateBudgetRecord } from "@/lib/calculations/budget";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedCurrencyValue } from "@/components/ui/animated-currency-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import {
  getAppDataChangeEventName,
  getAppDataChangeStorageKey,
  type AppDataChangePayload,
} from "@/lib/client/live-updates";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { orderSubBudgetsBySpecialty } from "@/lib/budgets/sub-budget-order";
import type { BudgetRecord } from "@/types/budget";

type SubBudgetOverview = {
  id: string;
  projectId: string;
  parentBudgetId?: string | null;
  name: string;
  currency: string;
  totalDirectCost: number;
  totalGeneralExpenses: number;
  totalUtility: number;
  totalTax: number;
  totalAmount: number;
  updatedAt: string;
  levelsCount: number;
  itemsCount: number;
};

const QUANTITY_DECIMALS = 2;
const GENERAL_TAB_ID = "__general_budget__";

export function GeneralBudgetOverview({
  projectId,
  generalBudgetId,
  subBudgets,
  subBudgetDetails,
}: {
  projectId: string;
  generalBudgetId: string;
  subBudgets: SubBudgetOverview[];
  subBudgetDetails: BudgetRecord[];
}) {
  const { currencyDecimals, dateFormat } = useFormattingSettings();
  const { isExcelMode } = useAppViewMode();
  const [optimisticTotals, setOptimisticTotals] = useState<Record<string, { totalAmount: number; updatedAt: string }>>({});

  useEffect(() => {
    function applyPayload(payload: AppDataChangePayload | null) {
      if (!payload?.budgets?.length) return;

      const matchingBudgets = payload.budgets.filter(
        (budget) => budget.projectId === projectId && budget.kind === "SUB_BUDGET",
      );
      if (!matchingBudgets.length) return;

      setOptimisticTotals((current) => {
        const next = { ...current };

        for (const budget of matchingBudgets) {
          next[budget.id] = {
            totalAmount: budget.totalAmount,
            updatedAt: budget.updatedAt,
          };
        }

        return next;
      });
    }

    function handleCustomEvent(event: Event) {
      applyPayload((event as CustomEvent<AppDataChangePayload>).detail);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== getAppDataChangeStorageKey() || !event.newValue) return;

      try {
        applyPayload(JSON.parse(event.newValue) as AppDataChangePayload);
      } catch {}
    }

    window.addEventListener(getAppDataChangeEventName(), handleCustomEvent as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(getAppDataChangeEventName(), handleCustomEvent as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [projectId]);

  const orderedSubBudgets = useMemo(
    () =>
      orderSubBudgetsBySpecialty(subBudgets).map((budget) => ({
        ...budget,
        totalAmount: optimisticTotals[budget.id]?.totalAmount ?? budget.totalAmount,
        updatedAt: optimisticTotals[budget.id]?.updatedAt ?? budget.updatedAt,
      })),
    [optimisticTotals, subBudgets],
  );
  const [activeBudgetId, setActiveBudgetId] = useState<string>(GENERAL_TAB_ID);

  const consolidatedTotals = useMemo(
    () =>
      orderedSubBudgets.reduce(
        (totals, budget) => ({
          totalDirectCost: totals.totalDirectCost + budget.totalDirectCost,
          totalGeneralExpenses: totals.totalGeneralExpenses + budget.totalGeneralExpenses,
          totalUtility: totals.totalUtility + budget.totalUtility,
          totalTax: totals.totalTax + budget.totalTax,
          totalAmount: totals.totalAmount + budget.totalAmount,
          levelsCount: totals.levelsCount + budget.levelsCount,
          itemsCount: totals.itemsCount + budget.itemsCount,
        }),
        {
          totalDirectCost: 0,
          totalGeneralExpenses: 0,
          totalUtility: 0,
          totalTax: 0,
          totalAmount: 0,
          levelsCount: 0,
          itemsCount: 0,
        },
      ),
    [orderedSubBudgets],
  );

  const currency = orderedSubBudgets[0]?.currency ?? "PEN";
  const calculatedSubBudgetDetails = useMemo(() => {
    const calculatedById = new Map(
      subBudgetDetails.map((budget) => {
        const calculatedBudget = calculateBudgetRecord(budget);

        return [
          budget.id,
          {
            ...calculatedBudget,
            displayRows: buildDisplayRows(calculatedBudget),
          },
        ] as const;
      }),
    );

    return orderedSubBudgets
      .map((budget) => calculatedById.get(budget.id))
      .filter((budget): budget is NonNullable<typeof budget> => budget !== undefined);
  }, [orderedSubBudgets, subBudgetDetails]);
  const budgetTabs = useMemo(
    () => [
      {
        id: GENERAL_TAB_ID,
        label: "Presupuesto general",
      },
      ...orderedSubBudgets.map((budget) => ({
        id: budget.id,
        label: budget.name,
      })),
    ],
    [orderedSubBudgets],
  );
  const resolvedActiveBudgetId = budgetTabs.some((tab) => tab.id === activeBudgetId) ? activeBudgetId : GENERAL_TAB_ID;
  const isGeneralTabActive = resolvedActiveBudgetId === GENERAL_TAB_ID;
  const activeBudget = useMemo(
    () => orderedSubBudgets.find((budget) => budget.id === resolvedActiveBudgetId) ?? orderedSubBudgets[0] ?? null,
    [orderedSubBudgets, resolvedActiveBudgetId],
  );
  const activeBudgetDetail = useMemo(
    () => calculatedSubBudgetDetails.find((budget) => budget.id === activeBudget?.id) ?? null,
    [activeBudget, calculatedSubBudgetDetails],
  );
  const activeBudgetRows = useMemo(
    () => (activeBudgetDetail ? buildDisplayRows(activeBudgetDetail) : []),
    [activeBudgetDetail],
  );
  const latestUpdatedAt =
    orderedSubBudgets
      .map((budget) => new Date(budget.updatedAt))
      .sort((left, right) => right.getTime() - left.getTime())[0]
      ?.toISOString() ?? null;

  return (
    <div className="space-y-5">
      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-6">
          <OperationalPanel
            title="Resumen por Sub Presupuesto"
            description="Lectura ejecutiva del consolidado. Cada tarjeta responde a cambios del editor y refleja el peso de cada Sub Presupuesto dentro del total general."
            metrics={<span>{orderedSubBudgets.length} Sub Presupuestos</span>}
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              label="Total consolidado"
              value={formatCurrency(consolidatedTotals.totalAmount, currency, currencyDecimals)}
              tone="sky"
            />
            <InfoCard label="Partidas" value={String(consolidatedTotals.itemsCount)} tone="slate" />
            <InfoCard label="Niveles" value={String(consolidatedTotals.levelsCount)} tone="amber" />
            <InfoCard
              label="Actualizado"
              value={latestUpdatedAt ? formatDate(latestUpdatedAt, dateFormat) : "Sin fecha"}
              tone="slate"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {orderedSubBudgets.map((budget) => {
              const participation =
                consolidatedTotals.totalAmount > 0
                  ? (budget.totalAmount / consolidatedTotals.totalAmount) * 100
                  : 0;

              return (
                <div
                  key={budget.id}
                  className={cn(
                    "border bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 transition hover:border-sky-300",
                    isExcelMode ? "rounded-md border-slate-300 shadow-none" : "rounded-3xl border-slate-200 shadow-sm",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{budget.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Actualizado {formatDate(budget.updatedAt, dateFormat)}
                      </p>
                    </div>
                    <Badge className="bg-sky-100 text-sky-700">{formatNumber(participation, 1)}%</Badge>
                  </div>

                  <div className="mt-4">
                    <AnimatedCurrencyValue
                      value={budget.totalAmount}
                      currency={budget.currency}
                      className="px-0 py-0 text-2xl font-semibold text-slate-900"
                    />
                    <p className="mt-2 text-sm text-slate-500">
                      {budget.itemsCount} partidas activas | {budget.levelsCount} niveles estructurados
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Link href={`/budgets/${budget.id}`}>
                      <ActionButton action="open" label="Abrir Sub Presupuesto" variant="outline" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-6">
          <OperationalPanel
            title="Tabla consolidada"
            description="Consolida cantidades, estructura y montos de cada sub presupuesto sin entrar todavía al detalle de partidas."
            metrics={
              <>
                <span>Sub Presupuestos: {orderedSubBudgets.length}</span>
                <span className="hidden h-1 w-1 rounded-full bg-slate-300 md:inline-flex" />
                <span>Partidas: {consolidatedTotals.itemsCount}</span>
                <span className="hidden h-1 w-1 rounded-full bg-slate-300 md:inline-flex" />
                <span>
                  Última actualización: {latestUpdatedAt ? formatDate(latestUpdatedAt, dateFormat) : "Sin fecha"}
                </span>
              </>
            }
          />

          <div className={getTableFrameClassName(isExcelMode)}>
            <Table>
              <THead>
                <TR className="bg-slate-50 hover:bg-slate-50">
                  <TH>Sub Presupuesto</TH>
                  <TH className="text-right">Niveles</TH>
                  <TH className="text-right">Partidas</TH>
                  <TH className="text-right">Costo directo</TH>
                  <TH className="text-right">G. generales</TH>
                  <TH className="text-right">Utilidad</TH>
                  <TH className="text-right">IGV</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Acciones</TH>
                </TR>
              </THead>
              <TBody>
                {orderedSubBudgets.map((budget) => (
                  <TR key={budget.id}>
                    <TD className="font-medium text-slate-900">{budget.name}</TD>
                    <TD className="text-right tabular-nums">{budget.levelsCount}</TD>
                    <TD className="text-right tabular-nums">{budget.itemsCount}</TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrencyCell(budget.totalDirectCost, budget.currency, currencyDecimals)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrencyCell(budget.totalGeneralExpenses, budget.currency, currencyDecimals)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrencyCell(budget.totalUtility, budget.currency, currencyDecimals)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrencyCell(budget.totalTax, budget.currency, currencyDecimals)}
                    </TD>
                    <TD className="text-right">
                      <AnimatedCurrencyValue
                        value={budget.totalAmount}
                        currency={budget.currency}
                        className="justify-end px-0 py-0 text-sm font-semibold text-slate-900"
                      />
                    </TD>
                    <TD>
                      <div className="flex justify-end">
                        <Link href={`/budgets/${budget.id}`}>
                          <ActionButton action="open" label="Abrir" size="sm" variant="ghost" />
                        </Link>
                      </div>
                    </TD>
                  </TR>
                ))}
                <TR className="bg-slate-50/70">
                  <TD className="font-semibold text-slate-900">Total consolidado</TD>
                  <TD className="text-right font-semibold tabular-nums">{consolidatedTotals.levelsCount}</TD>
                  <TD className="text-right font-semibold tabular-nums">{consolidatedTotals.itemsCount}</TD>
                  <TD className="text-right font-semibold tabular-nums">
                    {formatCurrencyCell(consolidatedTotals.totalDirectCost, currency, currencyDecimals)}
                  </TD>
                  <TD className="text-right font-semibold tabular-nums">
                    {formatCurrencyCell(consolidatedTotals.totalGeneralExpenses, currency, currencyDecimals)}
                  </TD>
                  <TD className="text-right font-semibold tabular-nums">
                    {formatCurrencyCell(consolidatedTotals.totalUtility, currency, currencyDecimals)}
                  </TD>
                  <TD className="text-right font-semibold tabular-nums">
                    {formatCurrencyCell(consolidatedTotals.totalTax, currency, currencyDecimals)}
                  </TD>
                  <TD className="text-right">
                    <AnimatedCurrencyValue
                      value={consolidatedTotals.totalAmount}
                      currency={currency}
                      className="justify-end px-0 py-0 text-sm font-semibold text-slate-900"
                    />
                  </TD>
                  <TD>
                    <div className="flex justify-end">
                      <Link href={`/budgets/${generalBudgetId}`}>
                        <ActionButton
                          action="open"
                          label="Vista general"
                          size="sm"
                          variant="ghost"
                          className="opacity-60"
                        />
                      </Link>
                    </div>
                  </TD>
                </TR>
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <OperationalPanel
            title="Sub presupuesto conectado al consolidado"
            description="Navega entre Sub Presupuestos desde una vista tipo tabs. Según el Sub Presupuesto activo, abajo se muestra su lectura detallada dentro del consolidado."
          />

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Sub Presupuestos</span>
              {budgetTabs.map((budgetTab) => (
                <button
                  key={budgetTab.id}
                  type="button"
                  onClick={() => setActiveBudgetId(budgetTab.id)}
                  className={
                    budgetTab.id === resolvedActiveBudgetId
                      ? cn("inline-flex border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm text-white transition", isExcelMode ? "rounded-sm" : "rounded-full")
                      : cn("inline-flex border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50", isExcelMode ? "rounded-sm border-slate-300" : "rounded-full")
                  }
                >
                  {budgetTab.label}
                </button>
              ))}
            </div>

            {isGeneralTabActive ? (
              <>
                <div className={cn("flex flex-col gap-3 border border-sky-100 bg-[linear-gradient(180deg,#f7fbff_0%,#eef7ff_100%)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between", isExcelMode ? "rounded-md shadow-none" : "rounded-2xl")}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">Presupuesto general</p>
                      <Badge className="bg-sky-100 text-sky-700">Consolidado activo</Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                      <Sparkles className="h-4 w-4 text-sky-600" />
                      Integra {orderedSubBudgets.length} subpresupuestos, {consolidatedTotals.itemsCount} partidas y {consolidatedTotals.levelsCount} niveles dentro del presupuesto general.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <AnimatedCurrencyValue
                      value={consolidatedTotals.totalAmount}
                      currency={currency}
                      className="px-0 py-0 text-xl font-semibold text-slate-900"
                    />
                    <Link href={`/budgets/${generalBudgetId}`}>
                      <ActionButton action="open" label="Abrir presupuesto general" variant="outline" />
                    </Link>
                  </div>
                </div>

                <div className={getTableFrameClassName(isExcelMode)} data-testid="general-budget-tab-table">
                  <Table>
                    <THead>
                      <TR className="bg-slate-50 hover:bg-slate-50">
                        <TH>Código</TH>
                        <TH>Descripción</TH>
                        <TH className="text-center">Unidad</TH>
                        <TH className="text-right">Metrado</TH>
                        <TH className="text-right">P. unitario</TH>
                        <TH className="text-right">Parcial</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {calculatedSubBudgetDetails.map((budgetDetail) => (
                        [
                          <TR key={`${budgetDetail.id}-group`} className="bg-slate-100/80 hover:bg-slate-100/80">
                            <TD colSpan={6} className="font-semibold text-slate-900">
                              {budgetDetail.name}
                            </TD>
                          </TR>,
                          ...budgetDetail.displayRows.map((row) =>
                          row.kind === "level" ? (
                            <TR key={row.level.id} className={getLevelRowClass(row.level.type)}>
                              <TD className="font-medium text-slate-800">{row.level.code}</TD>
                              <TD>
                                <div
                                  className="flex items-center gap-3"
                                  style={{ paddingLeft: `${row.depth * 18}px` }}
                                >
                                  <Badge className="bg-white/80 text-slate-700">
                                    {getLevelTypeLabel(row.level.type)}
                                  </Badge>
                                  <span className="font-medium text-slate-900">{row.level.name}</span>
                                </div>
                              </TD>
                              <TD colSpan={4} />
                            </TR>
                          ) : (
                            <TR key={row.item.id}>
                              <TD className="font-medium text-slate-800">{row.item.code}</TD>
                              <TD>
                                <div style={{ paddingLeft: `${row.depth * 18}px` }}>
                                  <span className="text-slate-900">{row.item.description}</span>
                                </div>
                              </TD>
                              <TD className="text-center">{row.item.unit}</TD>
                              <TD className="text-right tabular-nums">
                                {formatNumber(row.item.quantity, QUANTITY_DECIMALS)}
                              </TD>
                              <TD className="text-right tabular-nums">
                                {formatCurrencyCell(row.item.unitPrice, budgetDetail.currency, currencyDecimals)}
                              </TD>
                              <TD className="text-right">
                                <AnimatedCurrencyValue
                                  value={row.item.partial}
                                  currency={budgetDetail.currency}
                                  className="justify-end px-0 py-0 text-sm text-slate-900"
                                />
                              </TD>
                            </TR>
                          ),
                          ),
                        ]
                      ))}
                    </TBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="gap-2" disabled>
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-2"
                    disabled={orderedSubBudgets.length === 0}
                    onClick={() => orderedSubBudgets[0] && setActiveBudgetId(orderedSubBudgets[0].id)}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : activeBudget ? (
              <>
                <div className={cn("flex flex-col gap-3 border border-sky-100 bg-[linear-gradient(180deg,#f7fbff_0%,#eef7ff_100%)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between", isExcelMode ? "rounded-md shadow-none" : "rounded-2xl")}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{activeBudget.name}</p>
                      <Badge className="bg-sky-100 text-sky-700">Sub Presupuesto activo</Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                      <Sparkles className="h-4 w-4 text-sky-600" />
                      Integra {activeBudget.itemsCount} partidas y {activeBudget.levelsCount} niveles dentro del presupuesto general.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <AnimatedCurrencyValue
                      value={activeBudget.totalAmount}
                      currency={activeBudget.currency}
                      className="px-0 py-0 text-xl font-semibold text-slate-900"
                    />
                    <Link href={`/budgets/${activeBudget.id}`}>
                      <ActionButton action="open" label="Abrir Sub Presupuesto" variant="outline" />
                    </Link>
                  </div>
                </div>

                <div className={getTableFrameClassName(isExcelMode)} data-testid="active-sub-budget-table">
                  <Table>
                    <THead>
                      <TR className="bg-slate-50 hover:bg-slate-50">
                        <TH>Código</TH>
                        <TH>Descripción</TH>
                        <TH className="text-center">Unidad</TH>
                        <TH className="text-right">Metrado</TH>
                        <TH className="text-right">P. unitario</TH>
                        <TH className="text-right">Parcial</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {activeBudgetRows.map((row) =>
                        row.kind === "level" ? (
                          <TR key={row.level.id} className={getLevelRowClass(row.level.type)}>
                            <TD className="font-medium text-slate-800">{row.level.code}</TD>
                            <TD>
                              <div
                                className="flex items-center gap-3"
                                style={{ paddingLeft: `${row.depth * 18}px` }}
                              >
                                <Badge className="bg-white/80 text-slate-700">
                                  {getLevelTypeLabel(row.level.type)}
                                </Badge>
                                <span className="font-medium text-slate-900">{row.level.name}</span>
                              </div>
                            </TD>
                            <TD colSpan={4} />
                          </TR>
                        ) : (
                          <TR key={row.item.id}>
                            <TD className="font-medium text-slate-800">{row.item.code}</TD>
                            <TD>
                              <div style={{ paddingLeft: `${row.depth * 18}px` }}>
                                <span className="text-slate-900">{row.item.description}</span>
                              </div>
                            </TD>
                            <TD className="text-center">{row.item.unit}</TD>
                            <TD className="text-right tabular-nums">
                              {formatNumber(row.item.quantity, QUANTITY_DECIMALS)}
                            </TD>
                            <TD className="text-right tabular-nums">
                              {formatCurrencyCell(row.item.unitPrice, activeBudget.currency, currencyDecimals)}
                            </TD>
                            <TD className="text-right">
                              <AnimatedCurrencyValue
                                value={row.item.partial}
                                currency={activeBudget.currency}
                                className="justify-end px-0 py-0 text-sm text-slate-900"
                              />
                            </TD>
                          </TR>
                        ),
                      )}
                    </TBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-2">
                  {(() => {
                    const activeIndex = budgetTabs.findIndex((budget) => budget.id === activeBudget.id);
                    const previousBudget = activeIndex > 0 ? budgetTabs[activeIndex - 1] : null;
                    const nextBudget =
                      activeIndex >= 0 && activeIndex < budgetTabs.length - 1
                        ? budgetTabs[activeIndex + 1]
                        : null;

                    return (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2"
                          disabled={!previousBudget}
                          onClick={() => previousBudget && setActiveBudgetId(previousBudget.id)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Anterior
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2"
                          disabled={!nextBudget}
                          onClick={() => nextBudget && setActiveBudgetId(nextBudget.id)}
                        >
                          Siguiente
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatCurrencyCell(value: number, currency: string, currencyDecimals: number) {
  return formatCurrency(value, currency, currencyDecimals);
}

function getLevelTypeLabel(type: BudgetRecord["levels"][number]["type"]) {
  if (type === "TITLE") return "Título";
  if (type === "SUBTITLE") return "Subtítulo";
  if (type === "ITEM_GROUP") return "Subpartida";
  return "Subitem";
}

function getLevelRowClass(type: BudgetRecord["levels"][number]["type"]) {
  if (type === "TITLE") return "bg-slate-50";
  if (type === "SUBTITLE") return "bg-sky-50/60";
  return "bg-amber-50/60";
}
