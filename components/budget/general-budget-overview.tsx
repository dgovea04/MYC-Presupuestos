"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { buildDisplayRows } from "@/lib/budget/structure";
import { calculateBudgetRecord } from "@/lib/calculations/budget";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedCurrencyValue } from "@/components/ui/animated-currency-value";
import { Badge } from "@/components/ui/badge";
import { BudgetComparisonPanel } from "@/components/budget/budget-comparison-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { isSubpartidaResourceType } from "@/lib/apu/subpartidas";
import { buildGeneralBudgetTraceability } from "@/lib/budget/general-budget-traceability";
import {
  getAppDataChangeEventName,
  getAppDataChangeStorageKey,
  type AppDataChangePayload,
} from "@/lib/client/live-updates";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { orderSubBudgetsBySpecialty } from "@/lib/budgets/sub-budget-order";
import type { BudgetRecord } from "@/types/budget";
import type { CatalogPartidaRecord } from "@/types/partida";

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

type SubBudgetSubpartidaRow = {
  key: string;
  apuResourceId: string;
  name: string;
  unit: string;
  unitPrice: number;
  currency: string;
  hasApu: boolean;
  hasCatalogPartida: boolean;
};

export function GeneralBudgetOverview({
  projectId,
  generalBudgetId,
  subBudgets,
  subBudgetDetails: initialSubBudgetDetails = [],
}: {
  projectId: string;
  generalBudgetId: string;
  subBudgets: SubBudgetOverview[];
  subBudgetDetails?: BudgetRecord[];
}) {
  const { currencyDecimals, dateFormat } = useFormattingSettings();
  const { isExcelMode } = useAppViewMode();
  const router = useRouter();
  const [optimisticTotals, setOptimisticTotals] = useState<Record<string, { totalAmount: number; updatedAt: string }>>({});
  const [activeSubBudgetDetailView, setActiveSubBudgetDetailView] = useState<"items" | "subpartidas">("items");
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [showGeneralDetail, setShowGeneralDetail] = useState(false);
  const [subBudgetDetails, setSubBudgetDetails] = useState<BudgetRecord[]>(initialSubBudgetDetails);
  const [isLoadingSubBudgetDetails, setIsLoadingSubBudgetDetails] = useState(false);
  const [subBudgetDetailsError, setSubBudgetDetailsError] = useState("");
  const [createdSubpartidasByResourceId, setCreatedSubpartidasByResourceId] = useState<Record<string, CatalogPartidaRecord>>({});
  const [creatingSubpartidaKey, setCreatingSubpartidaKey] = useState<string | null>(null);
  const [subpartidaCreationError, setSubpartidaCreationError] = useState("");

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
  const subBudgetDetailsById = useMemo(
    () => new Map(subBudgetDetails.map((budget) => [budget.id, budget] as const)),
    [subBudgetDetails],
  );
  const comparisonBudgets = useMemo(() => {
    if (!isComparisonOpen) return [];

    return orderedSubBudgets
      .map((budget) => subBudgetDetailsById.get(budget.id))
      .filter((budget): budget is BudgetRecord => budget !== undefined)
      .map((budget) => calculateBudgetRecord(budget));
  }, [isComparisonOpen, orderedSubBudgets, subBudgetDetailsById]);
  const generalDetailBudgets = useMemo(() => {
    if (!showGeneralDetail) return [];

    return orderedSubBudgets
      .map((budget) => subBudgetDetailsById.get(budget.id))
      .filter((budget): budget is BudgetRecord => budget !== undefined)
      .map((budget) => {
        const calculatedBudget = calculateBudgetRecord(budget);

        return {
          ...calculatedBudget,
          displayRows: buildDisplayRows(calculatedBudget),
        };
      });
  }, [orderedSubBudgets, showGeneralDetail, subBudgetDetailsById]);
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
    () => (isGeneralTabActive ? null : orderedSubBudgets.find((budget) => budget.id === resolvedActiveBudgetId) ?? null),
    [isGeneralTabActive, orderedSubBudgets, resolvedActiveBudgetId],
  );
  const activeBudgetDetail = useMemo(() => {
    if (!activeBudget) return null;

    const detail = subBudgetDetailsById.get(activeBudget.id);
    if (!detail) return null;

    const calculatedBudget = calculateBudgetRecord(detail);

    return {
      ...calculatedBudget,
      displayRows: buildDisplayRows(calculatedBudget),
    };
  }, [activeBudget, subBudgetDetailsById]);
  const activeBudgetRows = useMemo(
    () => (activeBudgetDetail ? buildDisplayRows(activeBudgetDetail) : []),
    [activeBudgetDetail],
  );
  const activeBudgetSubpartidas = useMemo(
    () => (activeBudgetDetail ? buildSubBudgetSubpartidaRows(activeBudgetDetail, createdSubpartidasByResourceId) : []),
    [activeBudgetDetail, createdSubpartidasByResourceId],
  );
  const latestUpdatedAt =
    orderedSubBudgets
      .map((budget) => new Date(budget.updatedAt))
      .sort((left, right) => right.getTime() - left.getTime())[0]
      ?.toISOString() ?? null;
  const traceability = useMemo(
    () =>
      buildGeneralBudgetTraceability({
        subBudgetCount: orderedSubBudgets.length,
        detailCount: subBudgetDetails.length,
        latestUpdatedAt,
      }),
    [latestUpdatedAt, orderedSubBudgets.length, subBudgetDetails.length],
  );

  async function loadSubBudgetDetails() {
    if (subBudgetDetails.length > 0 || isLoadingSubBudgetDetails) return;

    setIsLoadingSubBudgetDetails(true);
    setSubBudgetDetailsError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/sub-budget-details`);
      const payload = (await response.json()) as { budgets?: BudgetRecord[]; error?: string };

      if (!response.ok || !payload.budgets) {
        throw new Error(payload.error ?? "No se pudo cargar el detalle de sub presupuestos.");
      }

      setSubBudgetDetails(payload.budgets);
    } catch (error) {
      setSubBudgetDetailsError(error instanceof Error ? error.message : "No se pudo cargar el detalle de sub presupuestos.");
    } finally {
      setIsLoadingSubBudgetDetails(false);
    }
  }

  async function createCatalogPartidaForSubpartida(subpartida: SubBudgetSubpartidaRow) {
    if (!activeBudget) return;

    setCreatingSubpartidaKey(subpartida.key);
    setSubpartidaCreationError("");

    try {
      const response = await fetch(`/api/budgets/${activeBudget.id}/subpartidas/catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apuResourceId: subpartida.apuResourceId,
          description: subpartida.name,
          unit: subpartida.unit,
          unitPrice: subpartida.unitPrice,
        }),
      });

      const payload = (await response.json()) as { partida?: CatalogPartidaRecord; error?: string };
      if (!response.ok || !payload.partida) {
        throw new Error(payload.error ?? "No se pudo crear la partida/APU de la subpartida.");
      }

      setCreatedSubpartidasByResourceId((current) => ({
        ...current,
        [subpartida.apuResourceId]: payload.partida as CatalogPartidaRecord,
      }));
      router.refresh();
    } catch (error) {
      setSubpartidaCreationError(error instanceof Error ? error.message : "No se pudo crear la partida/APU de la subpartida.");
    } finally {
      setCreatingSubpartidaKey(null);
    }
  }
  return (
    <div className="space-y-5">
      <Card className="theme-surface-card rounded-2xl">
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

          <div className={cn("theme-muted-panel border px-4 py-3", isExcelMode ? "rounded-md border-[var(--app-border-strong)]" : "rounded-2xl")}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="theme-strong-text text-sm font-semibold">Trazabilidad del consolidado</p>
                <p className="theme-muted-text mt-1 text-xs leading-5">
                  Origen: {traceability.sourceLabel}. Motor: {traceability.calculationLabel}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="theme-surface-panel theme-muted-text rounded-full border px-2.5 py-1 text-xs font-medium">
                  {traceability.coverageLabel}
                </span>
                <span className="theme-surface-panel theme-muted-text rounded-full border px-2.5 py-1 text-xs font-medium">
                  Actualizado: {traceability.latestUpdatedAt ? formatDate(traceability.latestUpdatedAt, dateFormat) : "Sin fecha"}
                </span>
              </div>
            </div>
            {traceability.warning ? <p className="mt-2 text-xs leading-5 text-amber-700">{traceability.warning}</p> : null}
          </div>

          {subBudgetDetailsError ? (
            <p className="theme-status-error rounded-xl border px-3 py-2 text-sm">{subBudgetDetailsError}</p>
          ) : null}

          {isComparisonOpen ? (
            <BudgetComparisonPanel
              budgets={comparisonBudgets}
              currencyDecimals={currencyDecimals}
              isExcelMode={isExcelMode}
            />
          ) : (
            <div className={cn("border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3", isExcelMode ? "rounded-md" : "rounded-2xl")}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--app-text-strong)]">Comparador tecnico</p>
                  <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                    Activalo solo cuando necesites comparar partidas entre Sub Presupuestos.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoadingSubBudgetDetails}
                  onClick={() => {
                    setIsComparisonOpen(true);
                    void loadSubBudgetDetails();
                  }}
                >
                  {isLoadingSubBudgetDetails ? "Cargando..." : "Comparar subpresupuestos"}
                </Button>
              </div>
            </div>
          )}

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
                    "theme-surface-card-gradient p-5 transition hover:border-sky-300",
                    isExcelMode ? "rounded-md border-[var(--app-border-strong)] shadow-none" : "rounded-3xl theme-soft-shadow",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="theme-strong-text text-base font-semibold">{budget.name}</p>
                      <p className="theme-muted-text mt-1 text-sm">
                        Actualizado {formatDate(budget.updatedAt, dateFormat)}
                      </p>
                    </div>
                    <Badge className="bg-sky-100 text-sky-700">{formatNumber(participation, 1)}%</Badge>
                  </div>

                  <div className="mt-4">
                    <AnimatedCurrencyValue
                      value={budget.totalAmount}
                      currency={budget.currency}
                      className="theme-strong-text px-0 py-0 text-2xl font-semibold"
                    />
                    <p className="theme-muted-text mt-2 text-sm">
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

      <Card className="theme-surface-card rounded-2xl">
        <CardContent className="space-y-4 p-6">
          <OperationalPanel
            title="Tabla consolidada"
            description="Consolida cantidades, estructura y montos de cada sub presupuesto sin entrar todavía al detalle de partidas."
            metrics={
              <>
                <span>Sub Presupuestos: {orderedSubBudgets.length}</span>
                <span className="hidden h-1 w-1 rounded-full bg-[var(--app-border-strong)] md:inline-flex" />
                <span>Partidas: {consolidatedTotals.itemsCount}</span>
                <span className="hidden h-1 w-1 rounded-full bg-[var(--app-border-strong)] md:inline-flex" />
                <span>
                  Última actualización: {latestUpdatedAt ? formatDate(latestUpdatedAt, dateFormat) : "Sin fecha"}
                </span>
              </>
            }
          />

          <div className={getTableFrameClassName(isExcelMode, isExcelMode ? "border-[var(--app-border-strong)]" : "border-[var(--app-border)]")}>
            <Table>
              <THead>
                <TR className="bg-[var(--app-surface-muted)] hover:bg-[var(--app-surface-muted)]">
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
                    <TD className="font-medium text-[var(--app-text-strong)]">{budget.name}</TD>
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
                        className="justify-end px-0 py-0 text-sm font-semibold text-[var(--app-text-strong)]"
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
                <TR className="bg-[var(--app-surface-muted)]/70">
                  <TD className="font-semibold text-[var(--app-text-strong)]">Total consolidado</TD>
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
                      className="justify-end px-0 py-0 text-sm font-semibold text-[var(--app-text-strong)]"
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

      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardContent className="space-y-4 p-6">
          <OperationalPanel
            title="Sub presupuesto conectado al consolidado"
            description="Navega entre Sub Presupuestos desde una vista tipo tabs. Según el Sub Presupuesto activo, abajo se muestra su lectura detallada dentro del consolidado."
          />

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[var(--app-text-muted)]">Sub Presupuestos</span>
              {budgetTabs.map((budgetTab) => (
                <button
                  key={budgetTab.id}
                  type="button"
                  onClick={() => {
                    setActiveBudgetId(budgetTab.id);
                    if (budgetTab.id !== GENERAL_TAB_ID) {
                      void loadSubBudgetDetails();
                    }
                  }}
                  className={
                    budgetTab.id === resolvedActiveBudgetId
                      ? cn("theme-filter-button-active inline-flex border px-3 py-1.5 text-sm transition", isExcelMode ? "rounded-sm" : "rounded-full")
                      : cn("theme-filter-button-inactive inline-flex border px-3 py-1.5 text-sm transition", isExcelMode ? "rounded-sm border-[var(--app-border-strong)]" : "rounded-full")
                  }
                >
                  {budgetTab.label}
                </button>
              ))}
            </div>
            {!isGeneralTabActive ? (
              <div className={cn("theme-muted-panel flex flex-wrap items-center justify-between gap-3 border px-3 py-2", isExcelMode ? "rounded-sm border-[var(--app-border-strong)]" : "rounded-xl")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--app-text-muted)]">Vista</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeSubBudgetDetailView === "items" ? "default" : "outline"}
                    onClick={() => setActiveSubBudgetDetailView("items")}
                  >
                    Partidas
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeSubBudgetDetailView === "subpartidas" ? "default" : "outline"}
                    onClick={() => setActiveSubBudgetDetailView("subpartidas")}
                  >
                    Subpartidas
                  </Button>
                </div>
                {activeSubBudgetDetailView === "subpartidas" ? (
                  <span className="text-sm text-[var(--app-text-muted)]">{activeBudgetSubpartidas.length} subpartidas</span>
                ) : null}
              </div>
            ) : null}

            {isGeneralTabActive ? (
              <>
                <div className={cn("theme-muted-panel flex flex-col gap-3 border px-4 py-4 lg:flex-row lg:items-center lg:justify-between", isExcelMode ? "rounded-md border-[var(--app-border-strong)] shadow-none" : "rounded-2xl border-[var(--app-border-strong)]")}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--app-text-strong)]">Presupuesto general</p>
                      <Badge className="theme-status-info">Consolidado activo</Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-sm text-[var(--app-text-muted)]">
                      <Sparkles className="h-4 w-4 text-sky-600" />
                      Integra {orderedSubBudgets.length} subpresupuestos, {consolidatedTotals.itemsCount} partidas y {consolidatedTotals.levelsCount} niveles dentro del presupuesto general.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <AnimatedCurrencyValue
                      value={consolidatedTotals.totalAmount}
                      currency={currency}
                      className="px-0 py-0 text-xl font-semibold text-[var(--app-text-strong)]"
                    />
                    <Link
                      href={buildBudgetReviewHref({
                        projectId,
                        budgetName: "Presupuesto general",
                        summary: `Consolidado del proyecto con ${orderedSubBudgets.length} sub presupuestos, ${consolidatedTotals.itemsCount} partidas y total ${formatCurrency(consolidatedTotals.totalAmount, currency, currencyDecimals)}.`,
                      })}
                    >
                      <Button size="sm" variant="ghost" className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        Revisar con IA
                      </Button>
                    </Link>
                    <Link href={`/budgets/${generalBudgetId}`}>
                      <ActionButton
                        action="open"
                        label="Abrir presupuesto general"
                        variant="outline"
                        className="border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)]"
                      />
                    </Link>
                  </div>
                </div>

                {showGeneralDetail && isLoadingSubBudgetDetails && generalDetailBudgets.length === 0 ? (
                  <div className={cn("border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-[var(--app-text-muted)]", isExcelMode ? "rounded-md" : "rounded-2xl")}>
                    Cargando detalle consolidado...
                  </div>
                ) : showGeneralDetail ? (
                <div className={getTableFrameClassName(isExcelMode, isExcelMode ? "border-[var(--app-border-strong)]" : "border-[var(--app-border)]")} data-testid="general-budget-tab-table">
                  <Table className="[&_thead_tr]:border-b-[color:var(--app-border-strong)] [&_tbody_tr]:border-b-[color:var(--app-border-strong)] [&_thead_th]:border-r [&_thead_th]:border-[var(--app-border)] [&_thead_th:last-child]:border-r-0 [&_tbody_td]:border-r [&_tbody_td]:border-[var(--app-border)] [&_tbody_td:last-child]:border-r-0">
                    <THead>
                      <TR className="bg-[var(--app-surface-muted)] hover:bg-[var(--app-surface-muted)]">
                        <TH>Código</TH>
                        <TH>Descripción</TH>
                        <TH className="text-center">Unidad</TH>
                        <TH className="text-right">Metrado</TH>
                        <TH className="text-right">P. unitario</TH>
                        <TH className="text-right">Parcial</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {generalDetailBudgets.map((budgetDetail) => (
                        [
                          <TR key={`${budgetDetail.id}-group`} className="bg-[var(--app-surface-strong)]/80 hover:bg-[var(--app-surface-strong)]/80">
                            <TD colSpan={6} className="font-semibold text-[var(--app-text-strong)]">
                              {budgetDetail.name}
                            </TD>
                          </TR>,
                          ...budgetDetail.displayRows.map((row) =>
                          row.kind === "level" ? (
                            <TR key={row.level.id} className={getLevelRowClass(row.level.type)}>
                              <TD className="font-medium text-[var(--app-text)]">{row.level.code}</TD>
                              <TD>
                                <div
                                  className="flex items-center gap-3"
                                  style={{ paddingLeft: `${row.depth * 18}px` }}
                                >
                                  <span className="min-w-0 font-medium text-[var(--app-text-strong)]">{row.level.name}</span>
                                  <span
                                    className={cn(
                                      "shrink-0 bg-[var(--app-surface)]/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]",
                                      isExcelMode ? "rounded-sm border border-[var(--app-border)]" : "rounded-full",
                                    )}
                                  >
                                    {getLevelTypeLabel(row.level.type)}
                                  </span>
                                </div>
                              </TD>
                              <TD colSpan={4} />
                            </TR>
                          ) : (
                            <TR key={row.item.id}>
                              <TD className="font-medium text-[var(--app-text)]">{row.item.code}</TD>
                              <TD>
                                <div style={{ paddingLeft: `${row.depth * 18}px` }}>
                                  <span className="text-[var(--app-text-strong)]">{row.item.description}</span>
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
                                  className="justify-end px-0 py-0 text-sm text-[var(--app-text-strong)]"
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
                ) : (
                  <div className={cn("border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm", isExcelMode ? "rounded-md" : "rounded-2xl")}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[var(--app-text-muted)]">
                        El detalle consolidado se calcula al abrirlo para mantener ligera la carga inicial.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isLoadingSubBudgetDetails}
                        onClick={() => {
                          setShowGeneralDetail(true);
                          void loadSubBudgetDetails();
                        }}
                      >
                        {isLoadingSubBudgetDetails ? "Cargando..." : "Mostrar detalle consolidado"}
                      </Button>
                    </div>
                  </div>
                )}

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
                    onClick={() => {
                      if (!orderedSubBudgets[0]) return;
                      setActiveBudgetId(orderedSubBudgets[0].id);
                      void loadSubBudgetDetails();
                    }}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : activeBudget ? (
              <>
                <div className={cn("flex flex-col gap-3 border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between", isExcelMode ? "rounded-md border-[var(--app-border-strong)] shadow-none" : "rounded-2xl")}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--app-text-strong)]">{activeBudget.name}</p>
                      <Badge className="theme-status-info">Sub Presupuesto activo</Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-sm text-[var(--app-text-muted)]">
                      <Sparkles className="h-4 w-4 text-sky-600" />
                      Integra {activeBudget.itemsCount} partidas y {activeBudget.levelsCount} niveles dentro del presupuesto general.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <AnimatedCurrencyValue
                      value={activeBudget.totalAmount}
                      currency={activeBudget.currency}
                      className="px-0 py-0 text-xl font-semibold text-[var(--app-text-strong)]"
                    />
                    <Link
                      href={buildBudgetReviewHref({
                        projectId,
                        budgetName: activeBudget.name,
                        summary: `${activeBudget.name}: ${activeBudget.itemsCount} partidas, ${activeBudget.levelsCount} niveles, total ${formatCurrency(activeBudget.totalAmount, activeBudget.currency, currencyDecimals)}.`,
                      })}
                    >
                      <Button size="sm" variant="ghost" className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        Revisar con IA
                      </Button>
                    </Link>
                    <Link href={`/budgets/${activeBudget.id}`}>
                      <ActionButton action="open" label="Abrir Sub Presupuesto" variant="outline" />
                    </Link>
                  </div>
                </div>

                {!activeBudgetDetail && isLoadingSubBudgetDetails ? (
                  <div className={cn("border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-[var(--app-text-muted)]", isExcelMode ? "rounded-md" : "rounded-2xl")}>
                    Cargando detalle del Sub Presupuesto...
                  </div>
                ) : null}

                <div
                  className={cn(getTableFrameClassName(isExcelMode, isExcelMode ? "border-[var(--app-border-strong)]" : "border-[var(--app-border)]"), activeSubBudgetDetailView === "subpartidas" && "hidden")}
                  data-testid="active-sub-budget-table"
                >
                  <Table className="[&_thead_tr]:border-b-[color:var(--app-border-strong)] [&_tbody_tr]:border-b-[color:var(--app-border-strong)] [&_thead_th]:border-r [&_thead_th]:border-[var(--app-border)] [&_thead_th:last-child]:border-r-0 [&_tbody_td]:border-r [&_tbody_td]:border-[var(--app-border)] [&_tbody_td:last-child]:border-r-0">
                    <THead>
                      <TR className="bg-[var(--app-surface-muted)] hover:bg-[var(--app-surface-muted)]">
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
                            <TD className="font-medium text-[var(--app-text)]">{row.level.code}</TD>
                            <TD>
                              <div
                                className="flex items-center gap-3"
                                style={{ paddingLeft: `${row.depth * 18}px` }}
                              >
                                <span className="min-w-0 font-medium text-[var(--app-text-strong)]">{row.level.name}</span>
                                <span
                                  className={cn(
                                    "shrink-0 bg-[var(--app-surface)]/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]",
                                    isExcelMode ? "rounded-sm border border-[var(--app-border)]" : "rounded-full",
                                  )}
                                >
                                  {getLevelTypeLabel(row.level.type)}
                                </span>
                              </div>
                            </TD>
                            <TD colSpan={4} />
                          </TR>
                        ) : (
                          <TR key={row.item.id}>
                            <TD className="font-medium text-[var(--app-text)]">{row.item.code}</TD>
                            <TD>
                              <div style={{ paddingLeft: `${row.depth * 18}px` }}>
                                <span className="text-[var(--app-text-strong)]">{row.item.description}</span>
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
                                className="justify-end px-0 py-0 text-sm text-[var(--app-text-strong)]"
                              />
                            </TD>
                          </TR>
                        ),
                      )}
                    </TBody>
                  </Table>
                </div>

                {activeSubBudgetDetailView === "subpartidas" ? (
                  <div className={getTableFrameClassName(isExcelMode, isExcelMode ? "border-[var(--app-border-strong)]" : "border-[var(--app-border)]")} data-testid="active-sub-budget-subpartidas-table">
                    <Table className="[&_thead_tr]:border-b-[color:var(--app-border-strong)] [&_tbody_tr]:border-b-[color:var(--app-border-strong)] [&_thead_th]:border-r [&_thead_th]:border-[var(--app-border)] [&_thead_th:last-child]:border-r-0 [&_tbody_td]:border-r [&_tbody_td]:border-[var(--app-border)] [&_tbody_td:last-child]:border-r-0">
                      <THead>
                        <TR className="bg-[var(--app-surface-muted)] hover:bg-[var(--app-surface-muted)]">
                          <TH>Nombre</TH>
                          <TH className="text-center">Unidad</TH>
                          <TH className="text-right">P. unitario</TH>
                          <TH className="text-center">APU</TH>
                          <TH className="text-right">Acciones</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {activeBudgetSubpartidas.length > 0 ? (
                          activeBudgetSubpartidas.map((subpartida) => (
                            <TR key={subpartida.key}>
                              <TD className="font-medium text-[var(--app-text-strong)]">{subpartida.name}</TD>
                              <TD className="text-center">{subpartida.unit}</TD>
                              <TD className="text-right tabular-nums">
                                {formatCurrencyCell(subpartida.unitPrice, subpartida.currency, currencyDecimals)}
                              </TD>
                              <TD className="text-center">
                                <Badge
                                  className={
                                    subpartida.hasApu
                                      ? "theme-status-success"
                                      : subpartida.hasCatalogPartida
                                      ? "theme-status-warning"
                                      : "theme-badge-slate"
                                  }
                                >
                                  {subpartida.hasApu ? "Con APU" : subpartida.hasCatalogPartida ? "APU vacio" : "Sin partida"}
                                </Badge>
                              </TD>
                              <TD>
                                <div className="flex justify-end">
                                  {!subpartida.hasCatalogPartida ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={creatingSubpartidaKey === subpartida.key}
                                      onClick={() => void createCatalogPartidaForSubpartida(subpartida)}
                                    >
                                      {creatingSubpartidaKey === subpartida.key ? "Creando..." : "Crear partida/APU"}
                                    </Button>
                                  ) : (
                                    <Link href={`/partidas?q=${encodeURIComponent(subpartida.name)}`}>
                                      <Button type="button" size="sm" variant="ghost">
                                        Abrir catalogo
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                              </TD>
                            </TR>
                          ))
                        ) : (
                          <TR>
                            <TD colSpan={5} className="py-8 text-center text-sm text-[var(--app-text-muted)]">
                              Este Sub Presupuesto no tiene subpartidas en sus APU.
                            </TD>
                          </TR>
                        )}
                      </TBody>
                    </Table>
                    {subpartidaCreationError ? (
                      <p className="theme-status-error border-t px-3 py-2 text-sm">{subpartidaCreationError}</p>
                    ) : null}
                  </div>
                ) : null}

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
                          onClick={() => {
                            if (!previousBudget) return;
                            setActiveBudgetId(previousBudget.id);
                            if (previousBudget.id !== GENERAL_TAB_ID) {
                              void loadSubBudgetDetails();
                            }
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Anterior
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2"
                          disabled={!nextBudget}
                          onClick={() => {
                            if (!nextBudget) return;
                            setActiveBudgetId(nextBudget.id);
                            if (nextBudget.id !== GENERAL_TAB_ID) {
                              void loadSubBudgetDetails();
                            }
                          }}
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

function buildSubBudgetSubpartidaRows(
  budget: BudgetRecord,
  createdSubpartidasByResourceId: Record<string, CatalogPartidaRecord>,
): SubBudgetSubpartidaRow[] {
  const rowsByKey = new Map<string, SubBudgetSubpartidaRow>();

  for (const item of budget.items) {
    for (const resource of item.apu?.resources ?? []) {
      if (!isSubpartidaResourceType(resource.resourceType)) continue;

      const createdPartida = createdSubpartidasByResourceId[resource.id];
      const catalogPartida = createdPartida ?? resource.catalogPartida ?? null;
      const key = resource.catalogPartidaId ?? catalogPartida?.id ?? resource.id;
      if (rowsByKey.has(key)) continue;

      const nestedRowsCount = resource.nestedApuRows?.length ?? 0;
      const catalogRowsCount = catalogPartida?.apuRows.length ?? 0;

      rowsByKey.set(key, {
        key,
        apuResourceId: resource.id,
        name: catalogPartida?.description ?? resource.description ?? resource.resource?.description ?? `Subpartida en ${item.description}`,
        unit: catalogPartida?.unit ?? resource.unit ?? resource.resource?.unit ?? "-",
        unitPrice: resource.unitPrice,
        currency: catalogPartida?.currency ?? budget.currency,
        hasApu: nestedRowsCount > 0 || catalogRowsCount > 0,
        hasCatalogPartida: Boolean(catalogPartida ?? resource.catalogPartidaId),
      });
    }
  }

  return [...rowsByKey.values()].sort((left, right) => left.name.localeCompare(right.name, "es"));
}

function buildBudgetReviewHref({
  projectId,
  budgetName,
  summary,
}: {
  projectId: string;
  budgetName: string;
  summary: string;
}) {
  const params = new URLSearchParams({
    action: "review",
    project: projectId,
    module: "Presupuesto",
    selectedItem: budgetName,
    activeTable: "Resumen de presupuesto",
    budgetSummary: summary,
  });

  return `/ai?${params.toString()}`;
}

function getLevelTypeLabel(type: BudgetRecord["levels"][number]["type"]) {
  if (type === "TITLE") return "Título";
  if (type === "SUBTITLE") return "Subtítulo";
  if (type === "ITEM_GROUP") return "Subpartida";
  return "Subitem";
}

function getLevelRowClass(type: BudgetRecord["levels"][number]["type"]) {
  if (type === "TITLE") return "bg-[var(--app-surface-muted)]";
  if (type === "SUBTITLE") return "bg-sky-50/60 dark:bg-sky-950/30";
  return "theme-status-warning-row";
}
