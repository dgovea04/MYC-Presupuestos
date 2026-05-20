"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { CalendarDays, ChartSpline, Package2, PenSquare, Save, X } from "lucide-react";
import type ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type {
  WorkScheduleCurvePointRecord,
  WorkScheduleLineRecord,
  WorkScheduleDisplayRowRecord,
  WorkScheduleMonthlyDistributionRecord,
  WorkSchedulePeriodRecord,
  WorkScheduleResourceCalendarRow,
  WorkScheduleValuationCalendarRow,
  WorkScheduleViewRecord,
} from "@/types/work-schedule";

type WorkSchedulePageContentProps = {
  initialData: WorkScheduleViewRecord;
};

type ActiveView = "overview" | "valuation" | "resources" | "curve";
type WorkbookExportScope = "detail_only" | "detail_and_total" | "detail_subtotals_and_total";
type WorkbookExportProfile = "minimal" | "executive" | "analytical";
type WorkbookCell = {
  value: ExcelJS.CellValue;
  numFmt?: string;
};

type WorkbookTableData = {
  headers: string[];
  rows: WorkbookCell[][];
  subtotalRowIndexes?: number[];
  totalRow?: WorkbookCell[];
};

type EditableLine = {
  budgetItemId: string;
  description: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  predecessor: string;
  crew: string;
  monthlyDistributions: WorkScheduleMonthlyDistributionRecord[];
};

type OverviewFilter = "all" | "pending" | "incomplete_distribution" | "scheduled";

const dayFormatter = new Intl.DateTimeFormat("es-PE", { weekday: "short" });
const DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH = 972;
const MIN_OVERVIEW_TIMELINE_PANEL_WIDTH = 360;
const OVERVIEW_HEADER_HEIGHT_CLASS = "h-[72px]";
const OVERVIEW_GROUP_ROW_HEIGHT_CLASS = "h-10";
const OVERVIEW_BOTTOM_FOOTER_HEIGHT_CLASS = "h-[44px]";
const OVERVIEW_TIMELINE_PANEL_WIDTH_CSS_VAR = "--work-schedule-timeline-panel-width";
export function WorkSchedulePageContent({ initialData }: WorkSchedulePageContentProps) {
  return <WorkSchedulePageContentInner key={initialData.budgetId} initialData={initialData} />;
}

function WorkSchedulePageContentInner({ initialData }: WorkSchedulePageContentProps) {
  const { currencyDecimals, dateFormat } = useFormattingSettings();
  const { isExcelMode } = useAppViewMode();
  const [data, setData] = useState(initialData);
  const [activeView, setActiveView] = useState<ActiveView>(() => readActiveView(initialData.budgetId));
  const [editingLine, setEditingLine] = useState<EditableLine | null>(() => readEditingLine(initialData));
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => readCollapsedGroups(initialData.budgetId));
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>(() => readOverviewFilter(initialData.budgetId));
  const [executiveWorkbookScope, setExecutiveWorkbookScope] = useState<WorkbookExportScope>(() =>
    readExecutiveWorkbookScope(initialData.budgetId),
  );
  const [valuationWorkbookScope, setValuationWorkbookScope] = useState<WorkbookExportScope>(() =>
    readValuationWorkbookScope(initialData.budgetId),
  );
  const [resourceWorkbookScope, setResourceWorkbookScope] = useState<WorkbookExportScope>(() =>
    readResourceWorkbookScope(initialData.budgetId),
  );
  const [curveWorkbookScope, setCurveWorkbookScope] = useState<WorkbookExportScope>(() =>
    readCurveWorkbookScope(initialData.budgetId),
  );
  const [overviewScrollRequest, setOverviewScrollRequest] = useState<number | null>(null);
  const [highlightedBudgetItemId, setHighlightedBudgetItemId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  const timelineDays = useMemo(() => buildTimelineDays(data.timeline.startDate, data.timeline.endDate), [data.timeline.endDate, data.timeline.startDate]);
  const timelineDayIndexByIso = useMemo(
    () => new Map(timelineDays.map((day, index) => [day.iso, index])),
    [timelineDays],
  );
  const summary = useMemo(() => summarizeView(data), [data]);
  const orderedLines = useMemo(() => data.groups.flatMap((group) => group.lines), [data.groups]);
  const visibleOrderedLines = useMemo(
    () =>
      data.groups.flatMap((group) =>
        collapsedGroups[group.subBudgetId] === true ? [] : group.lines,
      ),
    [collapsedGroups, data.groups],
  );
  const filteredVisibleLines = useMemo(
    () => visibleOrderedLines.filter((line) => matchesOverviewFilter(line, overviewFilter)),
    [overviewFilter, visibleOrderedLines],
  );
  const shouldPrepareValuationRows = activeView !== "resources";
  const shouldPrepareResourceRows = activeView === "resources";
  const shouldPrepareCurveSeries = activeView === "curve";
  const filteredLineIds = useMemo(
    () => (shouldPrepareValuationRows ? new Set(filteredVisibleLines.map((line) => line.budgetItemId)) : new Set<string>()),
    [filteredVisibleLines, shouldPrepareValuationRows],
  );
  const filteredResourceIds = useMemo(
    () =>
      shouldPrepareResourceRows
        ? new Set(
            filteredVisibleLines.flatMap((line) => (line.resources ?? []).map((resource) => resource.resourceId)),
          )
        : new Set<string>(),
    [filteredVisibleLines, shouldPrepareResourceRows],
  );
  const navigationLines = filteredVisibleLines.length > 0 ? filteredVisibleLines : visibleOrderedLines.length > 0 ? visibleOrderedLines : orderedLines;
  const editingLineIndex = editingLine ? navigationLines.findIndex((line) => line.budgetItemId === editingLine.budgetItemId) : -1;
  const canNavigateToPreviousLine = editingLineIndex > 0;
  const canNavigateToNextLine = editingLineIndex >= 0 && editingLineIndex < navigationLines.length - 1;
  const filteredValuationRows = useMemo(
    () =>
      !shouldPrepareValuationRows
        ? []
        : overviewFilter === "all"
        ? data.valuationCalendar.rows
        : data.valuationCalendar.rows.filter((row) => filteredLineIds.has(row.budgetItemId)),
    [data.valuationCalendar.rows, filteredLineIds, overviewFilter, shouldPrepareValuationRows],
  );
  const filteredResourceRows = useMemo(
    () =>
      !shouldPrepareResourceRows
        ? []
        : overviewFilter === "all"
        ? data.resourceCalendar.rows
        : data.resourceCalendar.rows.filter((row) => filteredResourceIds.has(row.resourceId)),
    [data.resourceCalendar.rows, filteredResourceIds, overviewFilter, shouldPrepareResourceRows],
  );
  const filteredCurveSeries = useMemo(
    () => (shouldPrepareCurveSeries ? buildCurveSeriesFromValuationRows(filteredValuationRows, data.valuationCalendar.periods) : []),
    [data.valuationCalendar.periods, filteredValuationRows, shouldPrepareCurveSeries],
  );

  async function handleSave() {
    if (!editingLine) return;

    setSaveState("saving");
    setError("");

    try {
      const response = await fetch(`/api/budgets/${data.budgetId}/work-schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetItemId: editingLine.budgetItemId,
          startDate: editingLine.startDate,
          endDate: editingLine.endDate,
          durationDays: Number(editingLine.durationDays),
          predecessor: editingLine.predecessor,
          crew: editingLine.crew.trim() ? Number(editingLine.crew) : null,
          monthlyDistributions: editingLine.monthlyDistributions.map((distribution) => ({
            year: distribution.year,
            month: distribution.month,
            percentage: Number(distribution.percentage),
          })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "No se pudo guardar la programacion");
      }

      const nextData = (await response.json()) as WorkScheduleViewRecord;
      writeEditingLineBudgetItemId(data.budgetId, null);
      setData(nextData);
      setEditingLine(null);
      setSaveState("idle");
    } catch (saveError) {
      setSaveState("error");
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la programacion");
    }
  }

  useLayoutEffect(() => {
    writeActiveView(data.budgetId, activeView);
  }, [activeView, data.budgetId]);

  useEffect(() => {
    writeCollapsedGroups(data.budgetId, collapsedGroups);
  }, [collapsedGroups, data.budgetId]);

  useEffect(() => {
    writeOverviewFilter(data.budgetId, overviewFilter);
  }, [data.budgetId, overviewFilter]);

  useEffect(() => {
    writeExecutiveWorkbookScope(data.budgetId, executiveWorkbookScope);
  }, [data.budgetId, executiveWorkbookScope]);

  useEffect(() => {
    writeValuationWorkbookScope(data.budgetId, valuationWorkbookScope);
  }, [data.budgetId, valuationWorkbookScope]);

  useEffect(() => {
    writeResourceWorkbookScope(data.budgetId, resourceWorkbookScope);
  }, [data.budgetId, resourceWorkbookScope]);

  useEffect(() => {
    writeCurveWorkbookScope(data.budgetId, curveWorkbookScope);
  }, [data.budgetId, curveWorkbookScope]);

  useEffect(() => {
    writeEditingLineBudgetItemId(data.budgetId, editingLine?.budgetItemId ?? null);
  }, [data.budgetId, editingLine]);

  useEffect(() => {
    if (!highlightedBudgetItemId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedBudgetItemId((current) => (current === highlightedBudgetItemId ? null : current));
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedBudgetItemId]);

  const navigateEditingLine = useEffectEvent((direction: "previous" | "next") => {
    handleNavigateEditingLine(direction);
  });

  useEffect(() => {
    if (!editingLine) {
      return;
    }

    function handleEditingLineKeyboardNavigation(event: KeyboardEvent) {
      if (!event.altKey) {
        return;
      }

      if (event.key === "ArrowLeft" && canNavigateToPreviousLine) {
        event.preventDefault();
        navigateEditingLine("previous");
      }

      if (event.key === "ArrowRight" && canNavigateToNextLine) {
        event.preventDefault();
        navigateEditingLine("next");
      }
    }

    window.addEventListener("keydown", handleEditingLineKeyboardNavigation);
    return () => window.removeEventListener("keydown", handleEditingLineKeyboardNavigation);
  }, [canNavigateToNextLine, canNavigateToPreviousLine, editingLine]);

  function handleCloseEditor() {
    writeEditingLineBudgetItemId(data.budgetId, null);
    setEditingLine(null);
    setSaveState("idle");
    setError("");
  }

  function handleJumpToSchedule() {
    if (!editingLine) {
      return;
    }

    setActiveView("overview");
    setOverviewScrollRequest(calculateOverviewScrollTarget(editingLine.startDate, timelineDays, timelineDayIndexByIso));
    setHighlightedBudgetItemId(editingLine.budgetItemId);
  }

  function handleNavigateEditingLine(direction: "previous" | "next") {
    if (!editingLine) {
      return;
    }

    const currentIndex = navigationLines.findIndex((line) => line.budgetItemId === editingLine.budgetItemId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = direction === "previous" ? currentIndex - 1 : currentIndex + 1;
    const targetLine = navigationLines[nextIndex];
    if (!targetLine) {
      return;
    }

    setEditingLine(createEditableLine(targetLine));
    setActiveView("overview");
    setOverviewScrollRequest(calculateOverviewScrollTarget(targetLine.startDate ?? "", timelineDays, timelineDayIndexByIso));
    setHighlightedBudgetItemId(targetLine.budgetItemId);
  }

  function handleExportCsv() {
    const exportPayload = buildWorkScheduleCsvExport({
      activeView,
      overviewLines: filteredVisibleLines,
      valuationRows: filteredValuationRows,
      resourceRows: filteredResourceRows,
      curvePoints: filteredCurveSeries,
      periods: data.valuationCalendar.periods,
      currency: data.currency,
      currencyDecimals,
      dateFormat,
    });

    if (!exportPayload) {
      return;
    }

    downloadTextFile(exportPayload.fileName, exportPayload.content, "text/csv;charset=utf-8;");
  }

  function handleExportOverviewSummaryCsv() {
    const exportPayload = buildWorkScheduleOverviewSummaryCsvExport({
      overviewLines: filteredVisibleLines,
      currency: data.currency,
      currencyDecimals,
      dateFormat,
    });

    downloadTextFile(exportPayload.fileName, exportPayload.content, "text/csv;charset=utf-8;");
  }

  function handleExportOverviewMonthlySummaryCsv() {
    const exportPayload = buildWorkScheduleOverviewMonthlySummaryCsvExport({
      valuationRows: filteredValuationRows,
      periods: data.valuationCalendar.periods,
      currency: data.currency,
      currencyDecimals,
    });

    downloadTextFile(exportPayload.fileName, exportPayload.content, "text/csv;charset=utf-8;");
  }

  function handleExportOverviewExecutivePackageCsv() {
    const exportPayload = buildWorkScheduleOverviewExecutivePackageCsvExport({
      overviewLines: filteredVisibleLines,
      valuationRows: filteredValuationRows,
      periods: data.valuationCalendar.periods,
      currency: data.currency,
      currencyDecimals,
      dateFormat,
    });

    downloadTextFile(exportPayload.fileName, exportPayload.content, "text/csv;charset=utf-8;");
  }

  async function handleExportOverviewExecutivePackageXlsx() {
    const workbookBuffer = await buildWorkScheduleOverviewExecutivePackageWorkbook({
      overviewLines: filteredVisibleLines,
      valuationRows: filteredValuationRows,
      periods: data.valuationCalendar.periods,
      currency: data.currency,
      currencyDecimals,
      dateFormat,
      scope: executiveWorkbookScope,
    });

    downloadBinaryFile(
      "work-schedule-cronograma-paquete-ejecutivo.xlsx",
      workbookBuffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  }

  async function handleExportActiveViewXlsx() {
    const exportPayload = await buildWorkScheduleActiveViewWorkbook({
      activeView,
      overviewLines: filteredVisibleLines,
      valuationRows: filteredValuationRows,
      resourceRows: filteredResourceRows,
      curvePoints: filteredCurveSeries,
      periods: data.valuationCalendar.periods,
      currency: data.currency,
      currencyDecimals,
      dateFormat,
      curveWorkbookScope,
      valuationWorkbookScope,
      resourceWorkbookScope,
    });

    if (!exportPayload) {
      return;
    }

    downloadBinaryFile(
      exportPayload.fileName,
      exportPayload.content,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  }

  return (
    <div className="space-y-5">
      <Card className="border-slate-200">
        <CardContent className="space-y-5 p-6">
          <OperationalPanel
            title="Programacion de obra"
            description="Cronograma consolidado del proyecto, valorizacion mensual derivada, calendario de insumos y curva S basica."
            metrics={
              <>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                  {summary.programmedItems} partidas programadas
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                  {summary.periods} periodos valorizados
                </span>
              </>
            }
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoTile label="Proyecto" value={data.projectName} />
            <InfoTile label="Ventana" value={formatTimelineRange(data.timeline.startDate, data.timeline.endDate, dateFormat)} />
            <InfoTile label="Total programado" value={formatCurrency(summary.totalAmount, data.currency, currencyDecimals)} />
            <InfoTile label="Insumos derivados" value={`${data.resourceCalendar.rows.length}`} />
          </div>

          <div className="flex flex-wrap gap-2">
            <ViewButton active={activeView === "overview"} icon={<CalendarDays className="h-4 w-4" />} onClick={() => setActiveView("overview")}>
              Cronograma
            </ViewButton>
            <ViewButton active={activeView === "valuation"} icon={<PenSquare className="h-4 w-4" />} onClick={() => setActiveView("valuation")}>
              Calendario valorizado
            </ViewButton>
            <ViewButton active={activeView === "resources"} icon={<Package2 className="h-4 w-4" />} onClick={() => setActiveView("resources")}>
              Calendario de insumos
            </ViewButton>
            <ViewButton active={activeView === "curve"} icon={<ChartSpline className="h-4 w-4" />} onClick={() => setActiveView("curve")}>
              Curva S
            </ViewButton>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              Exportar CSV
            </Button>
            {activeView !== "overview" ? (
              <Button variant="outline" size="sm" onClick={() => void handleExportActiveViewXlsx()}>
                Exportar XLSX
              </Button>
            ) : null}
            {activeView === "overview" ? (
              <Button variant="outline" size="sm" onClick={handleExportOverviewSummaryCsv}>
                Exportar resumen CSV
              </Button>
            ) : null}
            {activeView === "overview" ? (
              <Button variant="outline" size="sm" onClick={handleExportOverviewMonthlySummaryCsv}>
                Exportar resumen mensual CSV
              </Button>
            ) : null}
            {activeView === "overview" ? (
              <Button variant="outline" size="sm" onClick={handleExportOverviewExecutivePackageCsv}>
                Exportar paquete ejecutivo CSV
              </Button>
            ) : null}
            {activeView === "overview" ? (
              <Button variant="outline" size="sm" onClick={() => void handleExportOverviewExecutivePackageXlsx()}>
                Exportar paquete ejecutivo XLSX
              </Button>
            ) : null}
          </div>

          {activeView === "overview" || activeView === "valuation" || activeView === "resources" || activeView === "curve" ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Preferencias de exportacion XLSX:</span>
                <span className="text-xs text-slate-500">{getWorkbookExportTargetLabel(activeView)}</span>
                <span className="text-xs font-medium text-slate-500">Perfiles:</span>
                {getSupportedWorkbookProfiles(activeView).map((profile) => (
                  <ExportPreferenceButton
                    key={profile}
                    active={
                      getWorkbookExportProfileFromScope(activeView, getWorkbookExportScopeForView(activeView, {
                        executiveWorkbookScope,
                        valuationWorkbookScope,
                        resourceWorkbookScope,
                        curveWorkbookScope,
                      })) === profile
                    }
                    onClick={() => {
                      const nextScope = getWorkbookExportScopeFromProfile(activeView, profile);
                      if (activeView === "overview") {
                        setExecutiveWorkbookScope(nextScope);
                        return;
                      }

                      if (activeView === "valuation") {
                        setValuationWorkbookScope(nextScope);
                        return;
                      }

                      if (activeView === "resources") {
                        setResourceWorkbookScope(nextScope);
                        return;
                      }

                      setCurveWorkbookScope(nextScope);
                    }}
                  >
                    {getWorkbookExportProfileLabel(profile)}
                  </ExportPreferenceButton>
                ))}
                <span className="text-xs font-medium text-slate-500">Alcance:</span>
                {activeView === "overview" ? (
                  <>
                    <ExportPreferenceButton active={executiveWorkbookScope === "detail_only"} onClick={() => setExecutiveWorkbookScope("detail_only")}>
                      Solo detalle
                    </ExportPreferenceButton>
                    <ExportPreferenceButton active={executiveWorkbookScope === "detail_and_total"} onClick={() => setExecutiveWorkbookScope("detail_and_total")}>
                      Detalle + total
                    </ExportPreferenceButton>
                    <ExportPreferenceButton
                      active={executiveWorkbookScope === "detail_subtotals_and_total"}
                      onClick={() => setExecutiveWorkbookScope("detail_subtotals_and_total")}
                    >
                      Detalle + subtotales + total
                    </ExportPreferenceButton>
                  </>
                ) : null}
                {activeView === "valuation" ? (
                  <>
                    <ExportPreferenceButton active={valuationWorkbookScope === "detail_only"} onClick={() => setValuationWorkbookScope("detail_only")}>
                      Solo detalle
                    </ExportPreferenceButton>
                    <ExportPreferenceButton active={valuationWorkbookScope === "detail_and_total"} onClick={() => setValuationWorkbookScope("detail_and_total")}>
                      Detalle + total
                    </ExportPreferenceButton>
                    <ExportPreferenceButton
                      active={valuationWorkbookScope === "detail_subtotals_and_total"}
                      onClick={() => setValuationWorkbookScope("detail_subtotals_and_total")}
                    >
                      Detalle + subtotales + total
                    </ExportPreferenceButton>
                  </>
                ) : null}
                {activeView === "resources" ? (
                  <>
                    <ExportPreferenceButton active={resourceWorkbookScope === "detail_only"} onClick={() => setResourceWorkbookScope("detail_only")}>
                      Solo detalle
                    </ExportPreferenceButton>
                    <ExportPreferenceButton active={resourceWorkbookScope === "detail_and_total"} onClick={() => setResourceWorkbookScope("detail_and_total")}>
                      Detalle + total
                    </ExportPreferenceButton>
                    <ExportPreferenceButton
                      active={resourceWorkbookScope === "detail_subtotals_and_total"}
                      onClick={() => setResourceWorkbookScope("detail_subtotals_and_total")}
                    >
                      Detalle + subtotales + total
                    </ExportPreferenceButton>
                  </>
                ) : null}
                {activeView === "curve" ? (
                  <>
                    <ExportPreferenceButton active={curveWorkbookScope === "detail_only"} onClick={() => setCurveWorkbookScope("detail_only")}>
                      Solo detalle
                    </ExportPreferenceButton>
                    <ExportPreferenceButton active={curveWorkbookScope === "detail_and_total"} onClick={() => setCurveWorkbookScope("detail_and_total")}>
                      Detalle + total
                    </ExportPreferenceButton>
                  </>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                {describeWorkbookExportPreview(activeView, {
                  executiveWorkbookScope,
                  valuationWorkbookScope,
                  resourceWorkbookScope,
                  curveWorkbookScope,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {buildWorkbookExportPreviewBadges(
                  activeView,
                  {
                    executiveWorkbookScope,
                    valuationWorkbookScope,
                    resourceWorkbookScope,
                    curveWorkbookScope,
                  },
                ).map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {overviewFilter !== "all" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {`Filtro activo: ${formatOverviewFilterLabel(overviewFilter)}`}
              </span>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setOverviewFilter("all")}>
                Limpiar filtro
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {activeView === "overview" ? (
        <WorkScheduleOverview
          data={data}
          isExcelMode={isExcelMode}
          timelineDays={timelineDays}
          dateFormat={dateFormat}
          currencyDecimals={currencyDecimals}
          collapsedGroups={collapsedGroups}
          onToggleGroup={(subBudgetId) =>
            setCollapsedGroups((current) => ({
              ...current,
              [subBudgetId]: !current[subBudgetId],
            }))
          }
          onCollapseAll={() =>
            setCollapsedGroups(Object.fromEntries(data.groups.map((group) => [group.subBudgetId, true])))
          }
          onExpandAll={() => setCollapsedGroups({})}
          overviewFilter={overviewFilter}
          onOverviewFilterChange={setOverviewFilter}
          highlightedBudgetItemId={highlightedBudgetItemId}
          scrollRequest={overviewScrollRequest}
          onScrollRequestHandled={() => setOverviewScrollRequest(null)}
          onEditLine={(line) => setEditingLine(createEditableLine(line))}
        />
      ) : null}

      {activeView === "valuation" ? (
        <ValuationCalendarView
          rows={filteredValuationRows}
          periods={data.valuationCalendar.periods}
          currency={data.currency}
          currencyDecimals={currencyDecimals}
          activeFilterLabel={overviewFilter !== "all" ? formatOverviewFilterLabel(overviewFilter) : null}
        />
      ) : null}

      {activeView === "resources" ? (
        <ResourceCalendarView
          rows={filteredResourceRows}
          periods={data.resourceCalendar.periods}
          currency={data.currency}
          currencyDecimals={currencyDecimals}
          activeFilterLabel={overviewFilter !== "all" ? formatOverviewFilterLabel(overviewFilter) : null}
        />
      ) : null}

      {activeView === "curve" ? (
        <CurveSView
          points={filteredCurveSeries}
          currency={data.currency}
          currencyDecimals={currencyDecimals}
          activeFilterLabel={overviewFilter !== "all" ? formatOverviewFilterLabel(overviewFilter) : null}
        />
      ) : null}

      {editingLine ? (
        <WorkScheduleEditorSheet
          line={editingLine}
          open
          saveState={saveState}
          error={error}
          onClose={handleCloseEditor}
          onJumpToSchedule={handleJumpToSchedule}
          canNavigateToPreviousLine={canNavigateToPreviousLine}
          canNavigateToNextLine={canNavigateToNextLine}
          onNavigateToPreviousLine={() => handleNavigateEditingLine("previous")}
          onNavigateToNextLine={() => handleNavigateEditingLine("next")}
          onSave={handleSave}
          onChange={setEditingLine}
        />
      ) : null}
    </div>
  );
}

function WorkScheduleOverview({
  data,
  isExcelMode,
  timelineDays,
  dateFormat,
  currencyDecimals,
  collapsedGroups,
  onToggleGroup,
  onCollapseAll,
  onExpandAll,
  overviewFilter,
  onOverviewFilterChange,
  highlightedBudgetItemId,
  scrollRequest,
  onScrollRequestHandled,
  onEditLine,
}: {
  data: WorkScheduleViewRecord;
  isExcelMode: boolean;
  timelineDays: TimelineDay[];
  dateFormat: string;
  currencyDecimals: number;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (subBudgetId: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  overviewFilter: OverviewFilter;
  onOverviewFilterChange: (filter: OverviewFilter) => void;
  highlightedBudgetItemId: string | null;
  scrollRequest: number | null;
  onScrollRequestHandled: () => void;
  onEditLine: (line: WorkScheduleLineRecord) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const overviewCanvasRef = useRef<HTMLDivElement | null>(null);
  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const timelinePanelRef = useRef<HTMLDivElement | null>(null);
  const resizeSessionRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const pendingScrollWriteFrameRef = useRef<number | null>(null);
  const groupRowRefs = useRef(new Map<string, HTMLElement>());
  const lineRowRefs = useRef(new Map<string, HTMLElement>());
  const [timelinePanelWidth, setTimelinePanelWidth] = useState(() => readOverviewTimelinePanelWidth(data.budgetId));
  const timelinePanelWidthRef = useRef(timelinePanelWidth);
  const pendingViewportMeasureFrameRef = useRef<number | null>(null);
  const [showCostColumns, setShowCostColumns] = useState(() => readOverviewCostColumnsVisibility(data.budgetId));
  const [tableGroupHeights, setTableGroupHeights] = useState<Record<string, number>>({});
  const [tableLineHeights, setTableLineHeights] = useState<Record<string, number>>({});
  const [leftTableViewportWidth, setLeftTableViewportWidth] = useState<number | null>(null);
  const hasCollapsedGroups = data.groups.some((group) => collapsedGroups[group.subBudgetId] === true);
  const hasExpandedGroups = data.groups.some((group) => collapsedGroups[group.subBudgetId] !== true);
  const allLines = useMemo(() => data.groups.flatMap((group) => group.lines), [data.groups]);
  const timelineDayIndexByIso = useMemo(
    () => new Map(timelineDays.map((day, index) => [day.iso, index])),
    [timelineDays],
  );
  const lineOverviewStats = useMemo(() => {
    const pendingLineIds = new Set<string>();
    const scheduledLineIds = new Set<string>();
    const incompleteDistributionLineIds = new Set<string>();

    for (const line of allLines) {
      if (isPendingWorkScheduleLine(line)) {
        pendingLineIds.add(line.budgetItemId);
      } else {
        scheduledLineIds.add(line.budgetItemId);
      }

      if (hasIncompleteDistribution(line)) {
        incompleteDistributionLineIds.add(line.budgetItemId);
      }
    }

    return {
      pendingCount: pendingLineIds.size,
      scheduledCount: scheduledLineIds.size,
      incompleteDistributionCount: incompleteDistributionLineIds.size,
      pendingLineIds,
      scheduledLineIds,
      incompleteDistributionLineIds,
    };
  }, [allLines]);
  const pendingCount = lineOverviewStats.pendingCount;
  const incompleteDistributionCount = lineOverviewStats.incompleteDistributionCount;
  const scheduledCount = lineOverviewStats.scheduledCount;
  const visibleGroups = useMemo(
    () => {
      const groups: typeof data.groups = [];

      for (const group of data.groups) {
        const visibleLineIds = new Set<string>();
        const visibleLines: WorkScheduleLineRecord[] = [];

        for (const line of group.lines) {
          if (!matchesOverviewFilterWithStats(line, overviewFilter, lineOverviewStats)) {
            continue;
          }

          visibleLineIds.add(line.budgetItemId);
          visibleLines.push(line);
        }

        const visibleRows = group.rows.filter((row) => isVisibleOverviewRow(row, visibleLineIds));
        const isCollapsed = collapsedGroups[group.subBudgetId] === true;

        if (!isCollapsed && visibleRows.length === 0) {
          continue;
        }

        if (visibleRows.length > 0 || isCollapsed) {
          groups.push({
            ...group,
            lines: visibleLines,
            rows: visibleRows,
          });
        }
      }

      return groups;
    },
    [collapsedGroups, data, lineOverviewStats, overviewFilter],
  );
  const segmentLegend = [
    { label: "1er periodo", colorClassName: "bg-sky-600" },
    { label: "2do periodo", colorClassName: "bg-cyan-500" },
    { label: "3er periodo", colorClassName: "bg-indigo-500" },
    { label: "4to periodo", colorClassName: "bg-emerald-500" },
  ];
  const setGroupRowRef = useCallback((subBudgetId: string, element: HTMLElement | null) => {
    if (element) {
      groupRowRefs.current.set(subBudgetId, element);
      return;
    }

    groupRowRefs.current.delete(subBudgetId);
  }, []);
  const setLineRowRef = useCallback((rowId: string, element: HTMLElement | null) => {
    if (element) {
      lineRowRefs.current.set(rowId, element);
      return;
    }

    lineRowRefs.current.delete(rowId);
  }, []);

  function measureLeftTableViewportWidth() {
    const leftPanel = leftPanelRef.current;
    const timelinePanel = timelinePanelRef.current;

    if (!leftPanel) {
      return;
    }

    if (!timelinePanel) {
      setLeftTableViewportWidth(null);
      return;
    }

    const leftRect = leftPanel.getBoundingClientRect();
    const timelineRect = timelinePanel.getBoundingClientRect();
    const overlap = Math.max(0, Math.ceil(leftRect.right - timelineRect.left));
    const nextViewportWidth = overlap > 0 ? Math.max(Math.floor(leftRect.width - overlap), 240) : Math.floor(leftRect.width);

    setLeftTableViewportWidth((currentWidth) => (currentWidth === nextViewportWidth ? currentWidth : nextViewportWidth));
  }

  useEffect(() => {
    if (!scrollContainerRef.current) {
      return;
    }

    scrollContainerRef.current.scrollLeft = readOverviewScrollPosition(data.budgetId);
  }, [data.budgetId]);

  useLayoutEffect(() => {
    measureLeftTableViewportWidth();

    const scheduleViewportMeasurement = () => {
      if (pendingViewportMeasureFrameRef.current !== null) {
        return;
      }

      pendingViewportMeasureFrameRef.current = window.requestAnimationFrame(() => {
        pendingViewportMeasureFrameRef.current = null;
        measureLeftTableViewportWidth();
      });
    };

    const handleResize = () => {
      scheduleViewportMeasurement();
    };

    window.addEventListener("resize", handleResize);

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        scheduleViewportMeasurement();
      });

      if (leftPanelRef.current) {
        observer.observe(leftPanelRef.current);
      }

      if (timelinePanelRef.current) {
        observer.observe(timelinePanelRef.current);
      }

      return () => {
        if (pendingViewportMeasureFrameRef.current !== null) {
          window.cancelAnimationFrame(pendingViewportMeasureFrameRef.current);
          pendingViewportMeasureFrameRef.current = null;
        }
        window.removeEventListener("resize", handleResize);
        observer.disconnect();
      };
    }

    return () => {
      if (pendingViewportMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingViewportMeasureFrameRef.current);
        pendingViewportMeasureFrameRef.current = null;
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [timelinePanelWidth, showCostColumns]);

  useEffect(() => {
    if (scrollRequest === null || !scrollContainerRef.current) {
      return;
    }

    scrollContainerRef.current.scrollLeft = scrollRequest;
    writeOverviewScrollPosition(data.budgetId, scrollRequest);
    onScrollRequestHandled();
  }, [data.budgetId, onScrollRequestHandled, scrollRequest]);

  function handleOverviewScroll() {
    if (!scrollContainerRef.current) {
      return;
    }

    if (pendingScrollWriteFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingScrollWriteFrameRef.current);
    }

    const nextScrollLeft = scrollContainerRef.current.scrollLeft;
    pendingScrollWriteFrameRef.current = window.requestAnimationFrame(() => {
      writeOverviewScrollPosition(data.budgetId, nextScrollLeft);
      pendingScrollWriteFrameRef.current = null;
    });
  }

  useEffect(() => {
    syncOverviewTimelinePanelWidthCssVariable(timelinePanelWidth);
    timelinePanelWidthRef.current = timelinePanelWidth;
  }, [timelinePanelWidth]);

  useEffect(() => {
    writeOverviewCostColumnsVisibility(data.budgetId, showCostColumns);
  }, [data.budgetId, showCostColumns]);

  useEffect(() => {
    return () => {
      if (pendingScrollWriteFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingScrollWriteFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      const session = resizeSessionRef.current;
      if (!session) {
        return;
      }

      const nextWidth = clampOverviewTimelinePanelWidth(
        session.startWidth + (session.startX - event.clientX),
        overviewCanvasRef.current?.clientWidth ?? null,
      );
      timelinePanelWidthRef.current = nextWidth;
      setTimelinePanelWidth(nextWidth);
    }

    function handlePointerUp() {
      if (!resizeSessionRef.current) {
        return;
      }

      resizeSessionRef.current = null;
      writeOverviewTimelinePanelWidth(data.budgetId, timelinePanelWidthRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [data.budgetId]);

  useEffect(() => {
    function measureTableHeights() {
      const nextGroupHeights: Record<string, number> = {};
      const nextLineHeights: Record<string, number> = {};

      for (const group of visibleGroups) {
        const groupRow = groupRowRefs.current.get(group.subBudgetId);
        if (groupRow instanceof HTMLElement && groupRow.offsetHeight > 0) {
          nextGroupHeights[group.subBudgetId] = groupRow.offsetHeight;
        }

        for (const row of group.rows) {
          const lineRow = lineRowRefs.current.get(row.rowId);
          if (lineRow instanceof HTMLElement && lineRow.offsetHeight > 0) {
            nextLineHeights[row.rowId] = lineRow.offsetHeight;
          }
        }
      }

      setTableGroupHeights((current) => (areHeightMapsEqual(current, nextGroupHeights) ? current : nextGroupHeights));
      setTableLineHeights((current) => (areHeightMapsEqual(current, nextLineHeights) ? current : nextLineHeights));
    }

    measureTableHeights();
    window.addEventListener("resize", measureTableHeights);

    return () => {
      window.removeEventListener("resize", measureTableHeights);
    };
  }, [showCostColumns, timelinePanelWidth, visibleGroups]);

  function handleTimelineResizeStart(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    resizeSessionRef.current = {
      startX: event.clientX,
      startWidth: timelinePanelWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-4 p-0">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Cronograma basico</p>
              <p className="mt-1 text-sm text-slate-500">
                Referencia visual basada en la hoja de programacion: tabla valorizada a la izquierda y banda temporal semanal con detalle diario.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={overviewFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => onOverviewFilterChange(overviewFilter === "pending" ? "all" : "pending")}
              >
                {`Solo pendientes (${pendingCount})`}
              </Button>
              <Button
                variant={overviewFilter === "incomplete_distribution" ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  onOverviewFilterChange(overviewFilter === "incomplete_distribution" ? "all" : "incomplete_distribution")
                }
              >
                {`Distribucion incompleta (${incompleteDistributionCount})`}
              </Button>
              <Button
                variant={overviewFilter === "scheduled" ? "default" : "outline"}
                size="sm"
                onClick={() => onOverviewFilterChange(overviewFilter === "scheduled" ? "all" : "scheduled")}
              >
                {`Solo programadas (${scheduledCount})`}
              </Button>
              <Button variant="outline" size="sm" onClick={onCollapseAll} disabled={!hasExpandedGroups}>
                Contraer todo
              </Button>
              <Button variant="outline" size="sm" onClick={onExpandAll} disabled={!hasCollapsedGroups}>
                Expandir todo
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCostColumns((current) => !current)}>
                {showCostColumns ? "Ocultar PU y Parcial" : "Mostrar PU y Parcial"}
              </Button>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-900">Resumen rapido</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              {`Pendientes: ${pendingCount}`}
            </span>
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
              {`Distribucion incompleta: ${incompleteDistributionCount}`}
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              {`Programadas: ${scheduledCount}`}
            </span>
          </div>
        </div>

        <div ref={overviewCanvasRef} className="relative px-4 pb-4">
          <div
            ref={leftPanelRef}
            data-testid="work-schedule-left-panel"
            className={cn(
              "overflow-hidden border bg-white pt-[32px]",
              isExcelMode ? "rounded-none border-slate-300" : "rounded-2xl border-slate-200",
            )}
          >
            <div
              data-testid="work-schedule-left-scroll"
              className="overflow-x-auto"
              style={leftTableViewportWidth ? { width: `${leftTableViewportWidth}px`, maxWidth: "100%" } : undefined}
            >
              <div className="w-[1200px] min-w-[1200px]">
                <Table className="[&_td]:p-2 [&_td]:text-xs [&_th]:px-2 [&_th]:text-[11px]">
                  <THead className="bg-slate-50">
                    <TR className={OVERVIEW_HEADER_HEIGHT_CLASS}>
                      <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Item</TH>
                      <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Partida</TH>
                      <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Duracion</TH>
                      <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Inicio</TH>
                      <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Fin</TH>
                      <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Predecesora</TH>
                      <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Cuadrilla</TH>
                      <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Rendimiento</TH>
                      <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Unidad</TH>
                      <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Metrado</TH>
                      {showCostColumns ? <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>PU</TH> : null}
                      {showCostColumns ? <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Parcial</TH> : null}
                      <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "w-[88px] py-0 align-middle")}>Accion</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {visibleGroups.map((group) => (
                      <GroupRows
                        key={group.subBudgetId}
                        group={group}
                        collapsed={collapsedGroups[group.subBudgetId] === true}
                        dateFormat={dateFormat}
                        currency={data.currency}
                        currencyDecimals={currencyDecimals}
                        showCostColumns={showCostColumns}
                        highlightedBudgetItemId={highlightedBudgetItemId}
                        onEditLine={onEditLine}
                        onRegisterGroupRow={setGroupRowRef}
                        onRegisterLineRow={setLineRowRef}
                        onToggleGroup={() => onToggleGroup(group.subBudgetId)}
                      />
                    ))}
                  </TBody>
                </Table>
                <div
                  data-testid="work-schedule-left-footer-spacer"
                  className={cn(
                    "border-t bg-slate-50 px-2.5",
                    OVERVIEW_BOTTOM_FOOTER_HEIGHT_CLASS,
                    isExcelMode ? "border-slate-300" : "border-slate-200",
                  )}
                />
              </div>
            </div>
          </div>

          <div
            ref={timelinePanelRef}
            data-testid="work-schedule-timeline-panel"
            suppressHydrationWarning
            className={cn(
              "absolute right-4 top-0 bottom-4 z-30 overflow-hidden border bg-white",
              isExcelMode ? "rounded-none border-slate-300 shadow-none" : "rounded-2xl border-slate-200 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)]",
            )}
            style={{ width: `var(${OVERVIEW_TIMELINE_PANEL_WIDTH_CSS_VAR}, ${timelinePanelWidth}px)` }}
          >
            <div
              data-testid="work-schedule-timeline-resize-handle"
              className={cn(
                "absolute inset-y-0 left-0 z-40 flex cursor-col-resize items-center justify-center bg-slate-100/80 backdrop-blur-sm transition hover:bg-slate-200/90",
                isExcelMode ? "w-2" : "w-3",
              )}
              onMouseDown={handleTimelineResizeStart}
            >
              <span className={cn("bg-slate-300", isExcelMode ? "h-8 w-px rounded-sm" : "h-10 w-1 rounded-full")} />
            </div>

            <div
              ref={scrollContainerRef}
              data-testid="work-schedule-overview-scroll"
              className="h-full overflow-x-auto pl-3"
              onScroll={handleOverviewScroll}
            >
              <div className="min-w-[480px] text-xs">
                <TimelineHeader timelineDays={timelineDays} isExcelMode={isExcelMode} />
                <div className="divide-y divide-slate-100">
                  {visibleGroups.map((group) => (
                    <div key={group.subBudgetId}>
                      <div
                        data-testid={`work-schedule-timeline-group-row-${group.subBudgetId}`}
                        className={cn("flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-900", OVERVIEW_GROUP_ROW_HEIGHT_CLASS)}
                        style={tableGroupHeights[group.subBudgetId] ? { height: `${tableGroupHeights[group.subBudgetId]}px` } : undefined}
                      >
                        <span>{group.subBudgetName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => onToggleGroup(group.subBudgetId)}
                        >
                          {collapsedGroups[group.subBudgetId] === true ? `Expandir ${group.subBudgetName}` : `Contraer ${group.subBudgetName}`}
                        </Button>
                      </div>
                      {collapsedGroups[group.subBudgetId] === true
                        ? null
                        : group.rows.map((row) => (
                            <TimelineRow
                              key={row.rowId}
                              row={row}
                              timelineDays={timelineDays}
                              timelineDayIndexByIso={timelineDayIndexByIso}
                              currency={data.currency}
                              currencyDecimals={currencyDecimals}
                              highlighted={row.kind === "line" && highlightedBudgetItemId === row.line.budgetItemId}
                              rowHeight={tableLineHeights[row.rowId]}
                            />
                          ))}
                    </div>
                  ))}
                </div>
                <div className={cn("border-t bg-slate-50 px-2.5", OVERVIEW_BOTTOM_FOOTER_HEIGHT_CLASS, isExcelMode ? "border-slate-300" : "border-slate-200")}>
                  <div className="flex h-full flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-900">Leyenda de segmentos</span>
                    {segmentLegend.map((item) => (
                      <span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1">
                        <span className={cn("h-2.5 w-2.5 rounded-full", item.colorClassName)} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GroupRows({
  group,
  collapsed,
  dateFormat,
  currency,
  currencyDecimals,
  showCostColumns,
  highlightedBudgetItemId,
  onEditLine,
  onRegisterGroupRow,
  onRegisterLineRow,
  onToggleGroup,
}: {
  group: WorkScheduleViewRecord["groups"][number];
  collapsed: boolean;
  dateFormat: string;
  currency: string;
  currencyDecimals: number;
  showCostColumns: boolean;
  highlightedBudgetItemId: string | null;
  onEditLine: (line: WorkScheduleLineRecord) => void;
  onRegisterGroupRow: (subBudgetId: string, element: HTMLElement | null) => void;
  onRegisterLineRow: (rowId: string, element: HTMLElement | null) => void;
  onToggleGroup: () => void;
}) {
  return (
    <>
      <TR
        ref={(element) => onRegisterGroupRow(group.subBudgetId, element)}
        data-testid={`work-schedule-table-group-row-${group.subBudgetId}`}
        className={cn("bg-slate-50/90 hover:bg-slate-50/90", OVERVIEW_GROUP_ROW_HEIGHT_CLASS)}
      >
        <TD colSpan={showCostColumns ? 11 : 10} className="align-middle font-semibold text-slate-900">
          <div className="flex items-center justify-between gap-3">
            <span>SP: {group.subBudgetName}</span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={onToggleGroup}>
              {collapsed ? `Expandir ${group.subBudgetName}` : `Contraer ${group.subBudgetName}`}
            </Button>
          </div>
        </TD>
        {showCostColumns ? <TD className="align-middle font-semibold text-slate-900">{formatCurrency(group.totalAmount, currency, currencyDecimals)}</TD> : null}
        <TD className="bg-slate-50/95" />
      </TR>
      {collapsed
        ? null
        : group.rows.map((row) =>
            row.kind === "line" ? (
              <WorkScheduleLineTableRow
                key={row.rowId}
                line={row.line}
                dateFormat={dateFormat}
                currency={currency}
                currencyDecimals={currencyDecimals}
                showCostColumns={showCostColumns}
                highlighted={highlightedBudgetItemId === row.line.budgetItemId}
                onEditLine={onEditLine}
                onRegisterRow={onRegisterLineRow}
              />
            ) : (
              <WorkScheduleLevelTableRow
                key={row.rowId}
                row={row}
                dateFormat={dateFormat}
                currency={currency}
                currencyDecimals={currencyDecimals}
                showCostColumns={showCostColumns}
                onRegisterRow={onRegisterLineRow}
              />
            ),
          )}
    </>
  );
}

function WorkScheduleLineTableRow({
  line,
  dateFormat,
  currency,
  currencyDecimals,
  showCostColumns,
  highlighted,
  onEditLine,
  onRegisterRow,
}: {
  line: WorkScheduleLineRecord;
  dateFormat: string;
  currency: string;
  currencyDecimals: number;
  showCostColumns: boolean;
  highlighted: boolean;
  onEditLine: (line: WorkScheduleLineRecord) => void;
  onRegisterRow: (rowId: string, element: HTMLElement | null) => void;
}) {
  return (
    <TR
      ref={(element) => onRegisterRow(line.budgetItemId, element)}
      data-testid={`work-schedule-table-row-${line.budgetItemId}`}
      data-highlighted={highlighted ? "true" : "false"}
      className={cn("min-h-[42px]", highlighted ? "bg-amber-50 ring-1 ring-inset ring-amber-200" : "")}
    >
      <TD className="align-middle">{line.itemCode}</TD>
      <TD className="align-middle">
        <div className="space-y-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              <p className="min-w-0 truncate whitespace-nowrap text-xs font-medium text-slate-900" title={line.description}>
                {line.description}
              </p>
              {highlighted ? (
                <span
                  data-testid={`work-schedule-active-badge-${line.budgetItemId}`}
                  className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                >
                  Partida activa
                </span>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 shrink-0 p-0 text-slate-600 hover:text-slate-900"
              style={{ height: "16px", width: "16px", padding: 0 }}
              title="Editar"
              aria-label={`Editar ${line.description}`}
              onClick={() => onEditLine(line)}
            >
              <PenSquare className="h-[13px] w-[13px]" style={{ height: "13px", width: "13px" }} />
            </Button>
          </div>
          {line.monthlyDistributions.length > 0 ? (
            <div className="flex flex-nowrap items-center gap-1 overflow-hidden pt-0.5 whitespace-nowrap">
              <span className="shrink-0 truncate whitespace-nowrap text-[11px] text-slate-500">
                {line.monthlyDistributions.length || 0} periodos
              </span>
              {line.monthlyDistributions.map((distribution) => (
                <span
                  key={`${line.budgetItemId}-${distribution.year}-${distribution.month}`}
                  className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700"
                  title={formatDistributionLabel(distribution)}
                >
                  {formatDistributionLabel(distribution)}
                </span>
              ))}
            </div>
          ) : (
            <p className="truncate whitespace-nowrap text-[11px] text-slate-500">{line.monthlyDistributions.length || 0} periodos</p>
          )}
        </div>
      </TD>
      <TD className="align-middle">{line.durationDays ?? "-"}</TD>
      <TD className="align-middle">{line.startDate ? formatDate(line.startDate, dateFormat as never) : "Pendiente"}</TD>
      <TD className="align-middle">{line.endDate ? formatDate(line.endDate, dateFormat as never) : "Pendiente"}</TD>
      <TD className="align-middle">{line.predecessor || "-"}</TD>
      <TD className="align-middle">{line.crew != null ? formatNumber(line.crew, 2) : "-"}</TD>
      <TD className="align-middle">{line.performanceLabel || (line.performance != null ? `${formatNumber(line.performance, 2)} ${line.unit}/DIA` : "-")}</TD>
      <TD className="align-middle">{line.unit}</TD>
      <TD className="align-middle">{formatNumber(line.quantity, 2)}</TD>
      {showCostColumns ? <TD className="align-middle">{formatCurrency(line.unitPrice, currency, currencyDecimals)}</TD> : null}
      {showCostColumns ? <TD className="align-middle">{formatCurrency(line.partial, currency, currencyDecimals)}</TD> : null}
      <TD className="align-middle bg-white">
        <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onEditLine(line)}>
          Editar
        </Button>
      </TD>
    </TR>
  );
}

function WorkScheduleLevelTableRow({
  row,
  dateFormat,
  currency,
  currencyDecimals,
  showCostColumns,
  onRegisterRow,
}: {
  row: Extract<WorkScheduleDisplayRowRecord, { kind: "level" }>;
  dateFormat: string;
  currency: string;
  currencyDecimals: number;
  showCostColumns: boolean;
  onRegisterRow: (rowId: string, element: HTMLElement | null) => void;
}) {
  const toneClassName =
    row.levelType === "TITLE"
      ? "bg-slate-200/90 font-semibold text-slate-900"
      : "bg-slate-100/90 font-medium text-slate-800";

  return (
    <TR ref={(element) => onRegisterRow(row.rowId, element)} data-testid={`work-schedule-table-row-${row.rowId}`} className={cn("min-h-[42px]", toneClassName)}>
      <TD className="align-middle">{row.itemCode}</TD>
      <TD className="align-middle">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
          <span className="shrink-0 rounded-full border border-slate-300 bg-white/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
            {row.levelType === "TITLE" ? "Titulo" : "Subtitulo"}
          </span>
          <p className="min-w-0 truncate whitespace-nowrap text-xs" title={row.description}>
            {row.description}
          </p>
        </div>
      </TD>
      <TD className="align-middle">{row.durationDays ?? "-"}</TD>
      <TD className="align-middle">{row.startDate ? formatDate(row.startDate, dateFormat as never) : "Pendiente"}</TD>
      <TD className="align-middle">{row.endDate ? formatDate(row.endDate, dateFormat as never) : "Pendiente"}</TD>
      <TD className="align-middle">-</TD>
      <TD className="align-middle">-</TD>
      <TD className="align-middle">-</TD>
      <TD className="align-middle">-</TD>
      <TD className="align-middle">-</TD>
      {showCostColumns ? <TD className="align-middle">-</TD> : null}
      {showCostColumns ? <TD className="align-middle">{formatCurrency(row.partial, currency, currencyDecimals)}</TD> : null}
      <TD className="align-middle bg-transparent" />
    </TR>
  );
}

function TimelineHeader({ timelineDays, isExcelMode }: { timelineDays: TimelineDay[]; isExcelMode: boolean }) {
  const months = groupTimelineMonths(timelineDays);
  const weeks = groupTimelineWeeks(timelineDays);

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="grid gap-px bg-slate-200" style={{ gridTemplateColumns: `repeat(${timelineDays.length || 1}, minmax(16px, 1fr))` }}>
        {months.map((month, index) => (
          <div
            key={month.key}
            data-testid="work-schedule-month-band"
            className={cn(
              "flex h-5 items-center justify-center px-1.5 text-center text-[11px] font-semibold",
              isExcelMode
                ? index % 2 === 0
                  ? "bg-[--color-slate-50] text-slate-700"
                  : "bg-slate-300 text-slate-900"
                : index % 2 === 0
                  ? "bg-slate-900 text-white"
                  : "bg-slate-700 text-slate-100",
            )}
            style={{ gridColumn: `span ${month.length}` }}
          >
            {month.label}
          </div>
        ))}
      </div>
      <div className="grid gap-px bg-slate-200" style={{ gridTemplateColumns: `repeat(${timelineDays.length || 1}, minmax(16px, 1fr))` }}>
        {weeks.map((week) => (
          <div
            key={week.key}
            className="flex h-5 items-center justify-center bg-slate-50 px-1.5 text-center text-[11px] font-semibold text-slate-600"
            style={{ gridColumn: `span ${week.length}` }}
          >
            {week.label}
          </div>
        ))}
      </div>
      <div className="grid gap-px bg-slate-100" style={{ gridTemplateColumns: `repeat(${timelineDays.length || 1}, minmax(16px, 1fr))` }}>
        {timelineDays.map((day) => (
          <div
            key={day.iso}
            data-testid="work-schedule-timeline-day-header"
            className="flex h-8 items-center justify-center bg-white text-[9px] uppercase tracking-wide text-slate-500"
          >
            {dayFormatter.format(day.date).slice(0, 1)}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineRow({
  row,
  timelineDays,
  timelineDayIndexByIso,
  currency,
  currencyDecimals,
  highlighted,
  rowHeight,
}: {
  row: WorkScheduleDisplayRowRecord;
  timelineDays: TimelineDay[];
  timelineDayIndexByIso: Map<string, number>;
  currency: string;
  currencyDecimals: number;
  highlighted: boolean;
  rowHeight?: number;
}) {
  const line = row.kind === "line" ? row.line : null;
  const startDate = row.kind === "line" ? row.line.startDate : row.startDate;
  const endDate = row.kind === "line" ? row.line.endDate : row.endDate;
  const itemCode = row.kind === "line" ? row.line.itemCode : row.itemCode;
  const description = row.kind === "line" ? row.line.description : row.description;
  const partial = row.kind === "line" ? row.line.partial : row.partial;
  const startIndex = startDate ? (timelineDayIndexByIso.get(startDate) ?? -1) : -1;
  const endIndex = endDate ? (timelineDayIndexByIso.get(endDate) ?? -1) : -1;
  const span = startIndex >= 0 && endIndex >= startIndex ? endIndex - startIndex + 1 : 0;
  const segmentColors = [
    "bg-sky-600",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
  ] as const;

  return (
    <div
      data-testid="work-schedule-timeline-row"
      data-line-id={row.rowId}
      data-highlighted={highlighted ? "true" : "false"}
      className={cn("grid min-h-[42px] gap-px bg-slate-100 px-0.5 py-1", highlighted ? "bg-amber-200/80" : "")}
      style={{
        gridTemplateColumns: `repeat(${timelineDays.length || 1}, minmax(16px, 1fr))`,
        height: rowHeight ? `${rowHeight}px` : undefined,
      }}
    >
      {timelineDays.map((day, index) => {
        const isActive = span > 0 && index >= startIndex && index <= endIndex;

        return (
          <div
            key={`${row.rowId}-${day.iso}`}
            className={cn("relative bg-white", isActive ? "bg-sky-100" : "bg-white")}
          >
            {isActive && index === startIndex ? (
              <div
                className={cn(
                  "absolute inset-y-2 left-0 right-0 z-20 overflow-visible rounded-full",
                  row.kind === "line"
                    ? "shadow-[0_10px_20px_-16px_rgba(37,99,235,0.9)]"
                    : "bg-slate-500/90",
                )}
                style={{
                  width: `calc(${Math.max(span, 1)} * 100% + ${(Math.max(span, 1) - 1) * 1}px)`,
                }}
                title={description}
              >
                <div className="absolute inset-0 flex overflow-hidden rounded-full">
                  {line && line.monthlyDistributions.length > 0 ? (
                    line.monthlyDistributions.map((distribution, distributionIndex) => (
                      <div
                        key={`${row.rowId}-${distribution.year}-${distribution.month}`}
                        data-testid={`work-schedule-bar-segment-${row.rowId}`}
                        className={cn(
                          "h-full border-r border-white/40 last:border-r-0",
                          segmentColors[distributionIndex % segmentColors.length],
                        )}
                        style={{ width: `${distribution.percentage}%` }}
                        title={formatDistributionTooltip(distribution, partial, currency, currencyDecimals)}
                      />
                    ))
                  ) : line ? (
                    <div className="h-full w-full bg-sky-600" />
                  ) : (
                    <div className="h-full w-full bg-slate-500" />
                  )}
                </div>
                <div className="absolute inset-0 px-1 text-[9px] font-semibold text-white">
                  <span className="line-clamp-1 block truncate py-1">{itemCode}</span>
                </div>
                {highlighted ? (
                  <div className="absolute -top-5 left-0">
                    <span
                      data-testid={`work-schedule-active-timeline-badge-${row.rowId}`}
                      className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 shadow-sm"
                    >
                      Partida activa
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ValuationCalendarView({
  rows,
  periods,
  currency,
  currencyDecimals,
  activeFilterLabel,
}: {
  rows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  activeFilterLabel: string | null;
}) {
  return (
    <DerivedTableCard
      title="Calendario valorizado"
      description="Vista mensual valorizada inspirada en el archivo Calendario_Valorizado.xlsx."
      activeFilterLabel={activeFilterLabel}
    >
      <Table>
        <THead className="bg-slate-50">
          <TR>
            <TH>Item</TH>
            <TH>Partida</TH>
            <TH>Unidad</TH>
            <TH>Metrado</TH>
            <TH>PU</TH>
            <TH>Parcial</TH>
            {periods.map((period) => (
              <TH key={period.key}>{formatPeriodLabel(period)}</TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.budgetItemId}>
              <TD>{row.itemCode}</TD>
              <TD>{row.description}</TD>
              <TD>{row.unit}</TD>
              <TD>{formatNumber(row.quantity, 2)}</TD>
              <TD>{formatCurrency(row.unitPrice, currency, currencyDecimals)}</TD>
              <TD>{formatCurrency(row.partial, currency, currencyDecimals)}</TD>
              {periods.map((period) => (
                <TD key={period.key}>{formatCurrency(row.periodAmounts[period.key] ?? 0, currency, currencyDecimals)}</TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </DerivedTableCard>
  );
}

function ResourceCalendarView({
  rows,
  periods,
  currency,
  currencyDecimals,
  activeFilterLabel,
}: {
  rows: WorkScheduleResourceCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  activeFilterLabel: string | null;
}) {
  return (
    <DerivedTableCard
      title="Calendario de insumos"
      description="Consumo y valorizacion mensual de materiales e insumos derivado desde la programacion de partidas."
      activeFilterLabel={activeFilterLabel}
    >
      <Table>
        <THead className="bg-slate-50">
          <TR>
            <TH>Item</TH>
            <TH>Insumo</TH>
            <TH>Unidad</TH>
            <TH>Cantidad</TH>
            <TH>PU</TH>
            <TH>Parcial</TH>
            {periods.map((period) => (
              <TH key={period.key}>{formatPeriodLabel(period)}</TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {rows.map((row, index) => (
            <TR key={row.resourceId}>
              <TD>{index + 1}</TD>
              <TD>{row.description}</TD>
              <TD>{row.unit}</TD>
              <TD>{formatNumber(row.quantity, 2)}</TD>
              <TD>{formatCurrency(row.unitPrice, currency, currencyDecimals)}</TD>
              <TD>{formatCurrency(row.partial, currency, currencyDecimals)}</TD>
              {periods.map((period) => (
                <TD key={period.key}>
                  <div className="space-y-1">
                    <p>{formatNumber(row.periodQuantities[period.key] ?? 0, 2)}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(row.periodAmounts[period.key] ?? 0, currency, currencyDecimals)}</p>
                  </div>
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </DerivedTableCard>
  );
}

function CurveSView({
  points,
  currency,
  currencyDecimals,
  activeFilterLabel,
}: {
  points: WorkScheduleCurvePointRecord[];
  currency: string;
  currencyDecimals: number;
  activeFilterLabel: string | null;
}) {
  const maxAmount = Math.max(...points.map((point) => point.accumulatedAmount), 0);

  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-5 p-6">
        <div>
          <p className="text-sm font-semibold text-slate-900">Curva S basica</p>
          <p className="mt-1 text-sm text-slate-500">Programado mensual y acumulado del proyecto consolidado.</p>
          {activeFilterLabel ? (
            <div className="mt-3">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {`Filtro aplicado: ${activeFilterLabel}`}
              </span>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex h-56 items-end gap-3">
            {points.map((point) => {
              const height = maxAmount > 0 ? Math.max((point.accumulatedAmount / maxAmount) * 100, 4) : 0;
              return (
                <div key={point.key} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-col justify-end rounded-t-2xl bg-sky-100 px-2" style={{ height: `${height}%` }}>
                    <div className="rounded-t-xl bg-sky-600 px-2 py-2 text-center text-xs font-semibold text-white">
                      {point.accumulatedPercentage.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center text-xs text-slate-600">
                    <p className="font-medium">{formatPeriodLabel(point)}</p>
                    <p>{formatCurrency(point.monthlyAmount, currency, currencyDecimals)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Table>
          <THead className="bg-slate-50">
            <TR>
              <TH>Periodo</TH>
              <TH>Programado mensual</TH>
              <TH>Acumulado</TH>
              <TH>% acumulado</TH>
            </TR>
          </THead>
          <TBody>
            {points.map((point) => (
              <TR key={point.key}>
                <TD>{formatPeriodLabel(point)}</TD>
                <TD>{formatCurrency(point.monthlyAmount, currency, currencyDecimals)}</TD>
                <TD>{formatCurrency(point.accumulatedAmount, currency, currencyDecimals)}</TD>
                <TD>{formatNumber(point.accumulatedPercentage, 2)}%</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WorkScheduleEditorSheet({
  line,
  open,
  saveState,
  error,
  onClose,
  onJumpToSchedule,
  canNavigateToPreviousLine,
  canNavigateToNextLine,
  onNavigateToPreviousLine,
  onNavigateToNextLine,
  onSave,
  onChange,
}: {
  line: EditableLine | null;
  open: boolean;
  saveState: "idle" | "saving" | "error";
  error: string;
  onClose: () => void;
  onJumpToSchedule: () => void;
  canNavigateToPreviousLine: boolean;
  canNavigateToNextLine: boolean;
  onNavigateToPreviousLine: () => void;
  onNavigateToNextLine: () => void;
  onSave: () => void;
  onChange: (line: EditableLine | null) => void;
}) {
  const totalPercentage = line?.monthlyDistributions.reduce((sum, distribution) => sum + Number(distribution.percentage), 0) ?? 0;
  const percentageDifference = 100 - totalPercentage;

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content asChild>
          <div
            className="fixed inset-y-0 right-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-slate-50 p-5 shadow-2xl outline-none"
            data-testid="work-schedule-editor-panel"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title asChild>
                  <h3 className="text-2xl font-semibold text-slate-900">Programar partida</h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <div className="mt-1 space-y-2 text-sm text-slate-500">
                    <p>{line?.description ?? "Selecciona una partida para programarla."}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">Atajos</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Alt + Left: anterior</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Alt + Right: siguiente</span>
                    </div>
                  </div>
                </Dialog.Description>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onNavigateToPreviousLine} disabled={!canNavigateToPreviousLine}>
                  Anterior
                </Button>
                <Button variant="outline" onClick={onNavigateToNextLine} disabled={!canNavigateToNextLine}>
                  Siguiente
                </Button>
                <Button variant="outline" onClick={onJumpToSchedule}>
                  Ir al cronograma
                </Button>
                <Button variant="outline" onClick={onClose}>
                  <X className="mr-2 h-4 w-4" />
                  Cerrar
                </Button>
              </div>
            </div>

            {line ? (
              <div className="space-y-5">
                <Card className="border-slate-200">
                  <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                    <Field label="Inicio">
                      <Input
                        type="date"
                        value={line.startDate}
                        onChange={(event) => onChange(updateEditableLineDates(line, { startDate: event.target.value }))}
                      />
                    </Field>
                    <Field label="Fin">
                      <Input
                        type="date"
                        value={line.endDate}
                        onChange={(event) => onChange(updateEditableLineDates(line, { endDate: event.target.value }))}
                      />
                    </Field>
                    <Field label="Duracion">
                      <Input
                        value={String(line.durationDays)}
                        readOnly
                      />
                    </Field>
                    <Field label="Predecesora">
                      <Input value={line.predecessor} onChange={(event) => onChange({ ...line, predecessor: event.target.value })} />
                    </Field>
                    <Field label="Cuadrilla">
                      <Input value={line.crew} onChange={(event) => onChange({ ...line, crew: event.target.value })} />
                    </Field>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Distribucion mensual</p>
                        <p className="mt-1 text-sm text-slate-500">La suma debe cerrar exactamente al 100%.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onChange({
                            ...line,
                            monthlyDistributions: [
                              ...line.monthlyDistributions,
                              createNextDistribution(line.monthlyDistributions),
                            ],
                          })
                        }
                      >
                        Agregar periodo
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {line.monthlyDistributions.map((distribution, index) => (
                        <div
                          key={`${distribution.year}-${distribution.month}-${index}`}
                          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
                          data-testid="work-schedule-distribution-row"
                        >
                          <Field label="Ano">
                            <Input
                              value={String(distribution.year)}
                              onChange={(event) => updateDistribution(line, index, "year", Number(event.target.value) || distribution.year, onChange)}
                            />
                          </Field>
                          <Field label="Mes">
                            <Input
                              value={String(distribution.month)}
                              onChange={(event) => updateDistribution(line, index, "month", Number(event.target.value) || distribution.month, onChange)}
                            />
                          </Field>
                          <Field label="%">
                            <Input
                              value={String(distribution.percentage)}
                              onChange={(event) =>
                                updateDistribution(line, index, "percentage", Number(event.target.value) || 0, onChange)
                              }
                            />
                          </Field>
                          <div className="flex items-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                onChange({
                                  ...line,
                                  monthlyDistributions: line.monthlyDistributions.filter((_, rowIndex) => rowIndex !== index),
                                })
                              }
                            >
                              Quitar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <span className="font-medium text-slate-900">Total:</span> {formatNumber(totalPercentage, 4)}%{" "}
                      <span className={cn("ml-2 font-medium", percentageDifference === 0 ? "text-emerald-600" : "text-amber-600")}>
                        Diferencia: {formatNumber(percentageDifference, 4)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button onClick={onSave} disabled={saveState === "saving"}>
                    <Save className="mr-2 h-4 w-4" />
                    {saveState === "saving" ? "Guardando..." : "Guardar programacion"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DerivedTableCard({
  title,
  description,
  activeFilterLabel,
  children,
}: {
  title: string;
  description: string;
  activeFilterLabel?: string | null;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-4 p-6">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
          {activeFilterLabel ? (
            <div className="mt-3">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {`Filtro aplicado: ${activeFilterLabel}`}
              </span>
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ViewButton({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ExportPreferenceButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

type TimelineDay = {
  iso: string;
  date: Date;
};

function buildTimelineDays(startDate: string | null, endDate: string | null): TimelineDay[] {
  if (!startDate || !endDate) {
    return [];
  }

  const days: TimelineDay[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() - cursor.getUTCDay());
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  while (cursor.getTime() <= end.getTime()) {
    days.push({
      iso: cursor.toISOString().slice(0, 10),
      date: new Date(cursor),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function groupTimelineWeeks(days: TimelineDay[]) {
  const groups: Array<{ key: string; label: string; length: number }> = [];
  let currentKey = "";

  for (const day of days) {
    const weekStart = new Date(day.date);
    weekStart.setUTCDate(day.date.getUTCDate() - day.date.getUTCDay());
    const key = weekStart.toISOString().slice(0, 10);

    const current = groups[groups.length - 1];
    if (!current || currentKey !== key) {
      currentKey = key;
      groups.push({
        key,
        label: formatDate(weekStart, "DD_MMM_YYYY"),
        length: 1,
      });
      continue;
    }

    current.length += 1;
  }

  return groups;
}

function groupTimelineMonths(days: TimelineDay[]) {
  const groups: Array<{ key: string; label: string; length: number }> = [];
  let currentKey = "";

  for (const day of days) {
    const key = `${day.date.getUTCFullYear()}-${String(day.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const current = groups[groups.length - 1];

    if (!current || currentKey !== key) {
      currentKey = key;
      groups.push({
        key,
        label: `${String(day.date.getUTCMonth() + 1).padStart(2, "0")}/${day.date.getUTCFullYear()}`,
        length: 1,
      });
      continue;
    }

    current.length += 1;
  }

  return groups;
}

function summarizeView(data: WorkScheduleViewRecord) {
  const programmedItems = data.groups.reduce(
    (sum, group) => sum + group.lines.filter((line) => line.monthlyDistributions.length > 0).length,
    0,
  );
  const totalAmount = data.groups.reduce((sum, group) => sum + group.totalAmount, 0);

  return {
    programmedItems,
    totalAmount,
    periods: data.valuationCalendar.periods.length,
  };
}

function formatPeriodLabel(period: { year: number; month: number }) {
  return `${period.month.toString().padStart(2, "0")}/${period.year}`;
}

function formatDistributionLabel(distribution: WorkScheduleMonthlyDistributionRecord) {
  return `${formatPeriodLabel(distribution)} · ${distribution.percentage.toFixed(4)}%`;
}

function formatDistributionTooltip(
  distribution: WorkScheduleMonthlyDistributionRecord,
  partial: number,
  currency: string,
  currencyDecimals: number,
) {
  const amount = partial * (distribution.percentage / 100);
  return `${formatDistributionLabel(distribution)} · ${formatCurrency(amount, currency, currencyDecimals)}`;
}

function describeWorkbookExportPreview(
  activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
) {
  if (activeView === "overview") {
    return buildWorkbookScopePreview("paquete ejecutivo", scopes.executiveWorkbookScope, "partida y resumen");
  }

  if (activeView === "valuation") {
    return buildWorkbookScopePreview("calendario valorizado", scopes.valuationWorkbookScope, "partida");
  }

  if (activeView === "resources") {
    return buildWorkbookScopePreview("calendario de insumos", scopes.resourceWorkbookScope, "insumo");
  }

  return buildWorkbookScopePreview("curva S", scopes.curveWorkbookScope, "periodo");
}

function getWorkbookExportTargetLabel(activeView: ActiveView) {
  if (activeView === "overview") {
    return "Paquete ejecutivo";
  }

  if (activeView === "valuation") {
    return "Calendario valorizado";
  }

  if (activeView === "resources") {
    return "Calendario de insumos";
  }

  return "Curva S";
}

function getSupportedWorkbookProfiles(activeView: ActiveView): WorkbookExportProfile[] {
  if (activeView === "curve") {
    return ["minimal", "executive"];
  }

  return ["minimal", "executive", "analytical"];
}

function getWorkbookExportProfileLabel(profile: WorkbookExportProfile) {
  if (profile === "minimal") {
    return "Minimo";
  }

  if (profile === "executive") {
    return "Ejecutivo";
  }

  return "Analitico";
}

function getWorkbookExportScopeForView(
  activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
) {
  if (activeView === "overview") {
    return scopes.executiveWorkbookScope;
  }

  if (activeView === "valuation") {
    return scopes.valuationWorkbookScope;
  }

  if (activeView === "resources") {
    return scopes.resourceWorkbookScope;
  }

  return scopes.curveWorkbookScope;
}

function getWorkbookExportProfileFromScope(activeView: ActiveView, scope: WorkbookExportScope): WorkbookExportProfile {
  if (scope === "detail_only") {
    return "minimal";
  }

  if (scope === "detail_and_total") {
    return "executive";
  }

  return activeView === "curve" ? "executive" : "analytical";
}

function getWorkbookExportScopeFromProfile(activeView: ActiveView, profile: WorkbookExportProfile): WorkbookExportScope {
  if (profile === "minimal") {
    return "detail_only";
  }

  if (profile === "executive") {
    return "detail_and_total";
  }

  return activeView === "curve" ? "detail_and_total" : "detail_subtotals_and_total";
}

function buildWorkbookScopePreview(target: string, scope: WorkbookExportScope, detailUnit: string) {
  if (scope === "detail_only") {
    return `Se exportara ${target} con solo detalle por ${detailUnit}.`;
  }

  if (scope === "detail_and_total") {
    return `Se exportara ${target} con detalle por ${detailUnit} y total general.`;
  }

  return `Se exportara ${target} con detalle por ${detailUnit}, subtotales y total general.`;
}

function buildWorkbookExportPreviewBadges(
  activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
) {
  const scope =
    activeView === "overview"
      ? scopes.executiveWorkbookScope
      : activeView === "valuation"
        ? scopes.valuationWorkbookScope
        : activeView === "resources"
          ? scopes.resourceWorkbookScope
          : scopes.curveWorkbookScope;

  const badges = ["Detalle"];

  if (scope === "detail_only") {
    badges.push("Solo detalle");
    return badges;
  }

  badges.push("Incluye total");

  if (scope === "detail_subtotals_and_total") {
    badges.push("Incluye subtotales");
  }

  return badges;
}

function getCollapsedGroupsStorageKey(budgetId: string) {
  return `work-schedule-collapsed-groups:${budgetId}`;
}

function getActiveViewStorageKey(budgetId: string) {
  return `work-schedule-active-view:${budgetId}`;
}

function getEditingLineStorageKey(budgetId: string) {
  return `work-schedule-editing-line:${budgetId}`;
}

function getOverviewScrollStorageKey(budgetId: string) {
  return `work-schedule-overview-scroll:${budgetId}`;
}

function getOverviewTimelinePanelWidthStorageKey(budgetId: string) {
  return `work-schedule-overview-timeline-panel-width:${budgetId}`;
}

function getOverviewCostColumnsVisibilityStorageKey(budgetId: string) {
  return `work-schedule-overview-cost-columns:${budgetId}`;
}

function getOverviewFilterStorageKey(budgetId: string) {
  return `work-schedule-overview-filter:${budgetId}`;
}

function getExecutiveWorkbookScopeStorageKey(budgetId: string) {
  return `work-schedule-executive-workbook-scope:${budgetId}`;
}

function getValuationWorkbookScopeStorageKey(budgetId: string) {
  return `work-schedule-valuation-workbook-scope:${budgetId}`;
}

function getResourceWorkbookScopeStorageKey(budgetId: string) {
  return `work-schedule-resource-workbook-scope:${budgetId}`;
}

function getCurveWorkbookScopeStorageKey(budgetId: string) {
  return `work-schedule-curve-workbook-scope:${budgetId}`;
}

function readCollapsedGroups(budgetId: string): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const storedValue = window.localStorage.getItem(getCollapsedGroupsStorageKey(budgetId));
    if (!storedValue) {
      return {};
    }

    const parsedValue = JSON.parse(storedValue) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsedValue).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
    );
  } catch {
    return {};
  }
}

function writeCollapsedGroups(budgetId: string, collapsedGroups: Record<string, boolean>) {
  if (typeof window === "undefined") {
    return;
  }

  const activeCollapsedGroups = Object.fromEntries(Object.entries(collapsedGroups).filter((entry) => entry[1] === true));

  if (Object.keys(activeCollapsedGroups).length === 0) {
    window.localStorage.removeItem(getCollapsedGroupsStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getCollapsedGroupsStorageKey(budgetId), JSON.stringify(activeCollapsedGroups));
}

function isActiveView(value: string): value is ActiveView {
  return value === "overview" || value === "valuation" || value === "resources" || value === "curve";
}

function readActiveView(budgetId: string): ActiveView {
  if (typeof window === "undefined") {
    return "overview";
  }

  const storedValue = window.localStorage.getItem(getActiveViewStorageKey(budgetId));
  return storedValue && isActiveView(storedValue) ? storedValue : "overview";
}

function writeActiveView(budgetId: string, activeView: ActiveView) {
  if (typeof window === "undefined") {
    return;
  }

  if (activeView === "overview") {
    window.localStorage.removeItem(getActiveViewStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getActiveViewStorageKey(budgetId), activeView);
}

function readEditingLineBudgetItemId(budgetId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(getEditingLineStorageKey(budgetId));
  return storedValue && storedValue.trim() ? storedValue : null;
}

function writeEditingLineBudgetItemId(budgetId: string, budgetItemId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!budgetItemId) {
    window.localStorage.removeItem(getEditingLineStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getEditingLineStorageKey(budgetId), budgetItemId);
}

function readEditingLine(data: WorkScheduleViewRecord): EditableLine | null {
  const budgetItemId = readEditingLineBudgetItemId(data.budgetId);
  if (!budgetItemId) {
    return null;
  }

  const matchingLine = data.groups.flatMap((group) => group.lines).find((line) => line.budgetItemId === budgetItemId);
  return matchingLine ? createEditableLine(matchingLine) : null;
}

function readOverviewScrollPosition(budgetId: string) {
  if (typeof window === "undefined") {
    return 0;
  }

  const storedValue = window.localStorage.getItem(getOverviewScrollStorageKey(budgetId));
  if (!storedValue) {
    return 0;
  }

  const parsedValue = Number(storedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
}

function writeOverviewScrollPosition(budgetId: string, scrollLeft: number) {
  if (typeof window === "undefined") {
    return;
  }

  if (scrollLeft <= 0) {
    window.localStorage.removeItem(getOverviewScrollStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getOverviewScrollStorageKey(budgetId), String(Math.round(scrollLeft)));
}

function clampOverviewTimelinePanelWidth(width: number, availableWidth: number | null) {
  const fallbackViewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const maxWidth = Math.max(
    MIN_OVERVIEW_TIMELINE_PANEL_WIDTH,
    (availableWidth && availableWidth > 0 ? availableWidth : fallbackViewportWidth) - 48,
  );

  return Math.min(Math.max(Math.round(width), MIN_OVERVIEW_TIMELINE_PANEL_WIDTH), maxWidth);
}

function areHeightMapsEqual(left: Record<string, number>, right: Record<string, number>) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function readOverviewTimelinePanelWidth(budgetId: string) {
  if (typeof window === "undefined") {
    return DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH;
  }

  const storedValue = window.localStorage.getItem(getOverviewTimelinePanelWidthStorageKey(budgetId));
  if (!storedValue) {
    return DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH;
  }

  const parsedValue = Number(storedValue);
  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH;
  }

  return clampOverviewTimelinePanelWidth(parsedValue, null);
}

function writeOverviewTimelinePanelWidth(budgetId: string, width: number) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedWidth = clampOverviewTimelinePanelWidth(width, null);
  if (normalizedWidth === DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH) {
    window.localStorage.removeItem(getOverviewTimelinePanelWidthStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getOverviewTimelinePanelWidthStorageKey(budgetId), String(normalizedWidth));
}

function syncOverviewTimelinePanelWidthCssVariable(width: number) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.style.setProperty(
    OVERVIEW_TIMELINE_PANEL_WIDTH_CSS_VAR,
    `${clampOverviewTimelinePanelWidth(width, null)}px`,
  );
}

function readOverviewCostColumnsVisibility(budgetId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(getOverviewCostColumnsVisibilityStorageKey(budgetId)) === "true";
}

function writeOverviewCostColumnsVisibility(budgetId: string, visible: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (!visible) {
    window.localStorage.removeItem(getOverviewCostColumnsVisibilityStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getOverviewCostColumnsVisibilityStorageKey(budgetId), "true");
}

function isOverviewFilter(value: string): value is OverviewFilter {
  return value === "all" || value === "pending" || value === "incomplete_distribution" || value === "scheduled";
}

function readOverviewFilter(budgetId: string): OverviewFilter {
  if (typeof window === "undefined") {
    return "all";
  }

  const storedValue = window.localStorage.getItem(getOverviewFilterStorageKey(budgetId));
  return storedValue && isOverviewFilter(storedValue) ? storedValue : "all";
}

function writeOverviewFilter(budgetId: string, overviewFilter: OverviewFilter) {
  if (typeof window === "undefined") {
    return;
  }

  if (overviewFilter === "all") {
    window.localStorage.removeItem(getOverviewFilterStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getOverviewFilterStorageKey(budgetId), overviewFilter);
}

function readExecutiveWorkbookScope(budgetId: string): WorkbookExportScope {
  if (typeof window === "undefined") {
    return "detail_subtotals_and_total";
  }

  const storedValue = window.localStorage.getItem(getExecutiveWorkbookScopeStorageKey(budgetId));
  if (storedValue === "detail_only" || storedValue === "detail_and_total" || storedValue === "detail_subtotals_and_total") {
    return storedValue;
  }

  return "detail_subtotals_and_total";
}

function writeExecutiveWorkbookScope(budgetId: string, scope: WorkbookExportScope) {
  if (typeof window === "undefined") {
    return;
  }

  if (scope === "detail_subtotals_and_total") {
    window.localStorage.removeItem(getExecutiveWorkbookScopeStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getExecutiveWorkbookScopeStorageKey(budgetId), scope);
}

function readValuationWorkbookScope(budgetId: string): WorkbookExportScope {
  if (typeof window === "undefined") {
    return "detail_subtotals_and_total";
  }

  const storedValue = window.localStorage.getItem(getValuationWorkbookScopeStorageKey(budgetId));
  if (storedValue === "detail_only" || storedValue === "detail_and_total" || storedValue === "detail_subtotals_and_total") {
    return storedValue;
  }

  return "detail_subtotals_and_total";
}

function writeValuationWorkbookScope(budgetId: string, scope: WorkbookExportScope) {
  if (typeof window === "undefined") {
    return;
  }

  if (scope === "detail_subtotals_and_total") {
    window.localStorage.removeItem(getValuationWorkbookScopeStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getValuationWorkbookScopeStorageKey(budgetId), scope);
}

function readResourceWorkbookScope(budgetId: string): WorkbookExportScope {
  if (typeof window === "undefined") {
    return "detail_subtotals_and_total";
  }

  const storedValue = window.localStorage.getItem(getResourceWorkbookScopeStorageKey(budgetId));
  if (storedValue === "detail_only" || storedValue === "detail_and_total" || storedValue === "detail_subtotals_and_total") {
    return storedValue;
  }

  return "detail_subtotals_and_total";
}

function writeResourceWorkbookScope(budgetId: string, scope: WorkbookExportScope) {
  if (typeof window === "undefined") {
    return;
  }

  if (scope === "detail_subtotals_and_total") {
    window.localStorage.removeItem(getResourceWorkbookScopeStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getResourceWorkbookScopeStorageKey(budgetId), scope);
}

function readCurveWorkbookScope(budgetId: string): WorkbookExportScope {
  if (typeof window === "undefined") {
    return "detail_and_total";
  }

  const storedValue = window.localStorage.getItem(getCurveWorkbookScopeStorageKey(budgetId));
  if (storedValue === "detail_only" || storedValue === "detail_and_total") {
    return storedValue;
  }

  return "detail_and_total";
}

function writeCurveWorkbookScope(budgetId: string, scope: WorkbookExportScope) {
  if (typeof window === "undefined") {
    return;
  }

  if (scope === "detail_and_total") {
    window.localStorage.removeItem(getCurveWorkbookScopeStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getCurveWorkbookScopeStorageKey(budgetId), scope);
}

function calculateOverviewScrollTarget(startDate: string, timelineDays: TimelineDay[], timelineDayIndexByIso?: Map<string, number>) {
  if (!startDate) {
    return 0;
  }

  const startIndex = timelineDayIndexByIso?.get(startDate) ?? timelineDays.findIndex((day) => day.iso === startDate);
  if (startIndex < 0) {
    return 0;
  }

  const leftTableWidth = 720;
  const gridGapWidth = 16;
  const timelineDayWidth = 19;
  const leftPadding = 48;

  return Math.max(leftTableWidth + gridGapWidth + startIndex * timelineDayWidth - leftPadding, 0);
}

function isPendingWorkScheduleLine(line: WorkScheduleLineRecord) {
  if (!line.startDate || !line.endDate || line.durationDays == null) {
    return true;
  }

  if (line.monthlyDistributions.length === 0) {
    return true;
  }

  return hasIncompleteDistribution(line);
}

function hasIncompleteDistribution(line: WorkScheduleLineRecord) {
  const totalPercentage = line.monthlyDistributions.reduce((sum, distribution) => sum + Number(distribution.percentage), 0);
  return Math.abs(totalPercentage - 100) > 0.0001;
}

function isFullyScheduledWorkScheduleLine(line: WorkScheduleLineRecord) {
  return !isPendingWorkScheduleLine(line);
}

function matchesOverviewFilter(line: WorkScheduleLineRecord, overviewFilter: OverviewFilter) {
  if (overviewFilter === "all") {
    return true;
  }

  if (overviewFilter === "pending") {
    return isPendingWorkScheduleLine(line);
  }

  if (overviewFilter === "scheduled") {
    return isFullyScheduledWorkScheduleLine(line);
  }

  return hasIncompleteDistribution(line);
}

function matchesOverviewFilterWithStats(
  line: WorkScheduleLineRecord,
  overviewFilter: OverviewFilter,
  lineOverviewStats: {
    pendingLineIds: Set<string>;
    scheduledLineIds: Set<string>;
    incompleteDistributionLineIds: Set<string>;
  },
) {
  if (overviewFilter === "all") {
    return true;
  }

  if (overviewFilter === "pending") {
    return lineOverviewStats.pendingLineIds.has(line.budgetItemId);
  }

  if (overviewFilter === "scheduled") {
    return lineOverviewStats.scheduledLineIds.has(line.budgetItemId);
  }

  return lineOverviewStats.incompleteDistributionLineIds.has(line.budgetItemId);
}

function isVisibleOverviewRow(row: WorkScheduleDisplayRowRecord, visibleLineIds: Set<string>) {
  if (row.kind === "line") {
    return visibleLineIds.has(row.line.budgetItemId);
  }

  return row.childLineIds.some((lineId) => visibleLineIds.has(lineId));
}

function formatOverviewFilterLabel(overviewFilter: OverviewFilter) {
  if (overviewFilter === "pending") {
    return "Solo pendientes";
  }

  if (overviewFilter === "incomplete_distribution") {
    return "Distribucion incompleta";
  }

  if (overviewFilter === "scheduled") {
    return "Solo programadas";
  }

  return "Todo";
}

function buildCurveSeriesFromValuationRows(
  rows: WorkScheduleValuationCalendarRow[],
  periods: WorkSchedulePeriodRecord[],
): WorkScheduleCurvePointRecord[] {
  const totalAmount = rows.reduce((sum, row) => sum + row.rowTotal, 0);
  let accumulatedAmount = 0;

  return periods.map((period) => {
    const monthlyAmount = rows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0);
    accumulatedAmount += monthlyAmount;

    return {
      year: period.year,
      month: period.month,
      key: period.key,
      monthlyAmount,
      accumulatedAmount,
      accumulatedPercentage: totalAmount > 0 ? (accumulatedAmount / totalAmount) * 100 : 0,
    };
  });
}

function buildWorkScheduleCsvExport({
  activeView,
  overviewLines,
  valuationRows,
  resourceRows,
  curvePoints,
  periods,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  activeView: ActiveView;
  overviewLines: WorkScheduleLineRecord[];
  valuationRows: WorkScheduleValuationCalendarRow[];
  resourceRows: WorkScheduleResourceCalendarRow[];
  curvePoints: WorkScheduleCurvePointRecord[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  if (activeView === "overview") {
    const headers = ["Item", "Partida", "Duracion", "Inicio", "Fin", "Predecesora", "Cuadrilla", "Unidad", "Metrado", "PU", "Parcial"];
    const rows = overviewLines.map((line) => [
      line.itemCode,
      line.description,
      line.durationDays != null ? String(line.durationDays) : "-",
      line.startDate ? formatDate(line.startDate, dateFormat as never) : "Pendiente",
      line.endDate ? formatDate(line.endDate, dateFormat as never) : "Pendiente",
      line.predecessor || "-",
      line.crew != null ? formatNumber(line.crew, 2) : "-",
      line.unit,
      formatNumber(line.quantity, 2),
      formatCurrency(line.unitPrice, currency, currencyDecimals),
      formatCurrency(line.partial, currency, currencyDecimals),
    ]);

    return {
      fileName: "work-schedule-cronograma.csv",
      content: buildCsvContent(headers, rows),
    };
  }

  if (activeView === "valuation") {
    const headers = ["Item", "Partida", "Unidad", "Metrado", "PU", "Parcial", ...periods.map((period) => formatPeriodLabel(period))];
    const rows = valuationRows.map((row) => [
      row.itemCode,
      row.description,
      row.unit,
      formatNumber(row.quantity, 2),
      formatCurrency(row.unitPrice, currency, currencyDecimals),
      formatCurrency(row.partial, currency, currencyDecimals),
      ...periods.map((period) => formatCurrency(row.periodAmounts[period.key] ?? 0, currency, currencyDecimals)),
    ]);

    return {
      fileName: "work-schedule-calendario-valorizado.csv",
      content: buildCsvContent(headers, rows),
    };
  }

  if (activeView === "resources") {
    const periodHeaders = periods.flatMap((period) => [`${formatPeriodLabel(period)} Cantidad`, `${formatPeriodLabel(period)} Monto`]);
    const headers = ["Item", "Insumo", "Unidad", "Cantidad", "PU", "Parcial", ...periodHeaders];
    const rows = resourceRows.map((row, index) => [
      String(index + 1),
      row.description,
      row.unit,
      formatNumber(row.quantity, 2),
      formatCurrency(row.unitPrice, currency, currencyDecimals),
      formatCurrency(row.partial, currency, currencyDecimals),
      ...periods.flatMap((period) => [
        formatNumber(row.periodQuantities[period.key] ?? 0, 2),
        formatCurrency(row.periodAmounts[period.key] ?? 0, currency, currencyDecimals),
      ]),
    ]);

    return {
      fileName: "work-schedule-calendario-insumos.csv",
      content: buildCsvContent(headers, rows),
    };
  }

  const headers = ["Periodo", "Programado mensual", "Acumulado", "% acumulado"];
  const rows = curvePoints.map((point) => [
    formatPeriodLabel(point),
    formatCurrency(point.monthlyAmount, currency, currencyDecimals),
    formatCurrency(point.accumulatedAmount, currency, currencyDecimals),
    `${formatNumber(point.accumulatedPercentage, 2)}%`,
  ]);

  return {
    fileName: "work-schedule-curva-s.csv",
    content: buildCsvContent(headers, rows),
  };
}

function buildWorkScheduleValuationWorkbookTableData({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
  scope,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  scope: WorkbookExportScope;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const decimalFormat = buildWorkbookDecimalFormat(2);
  const rows: WorkbookCell[][] = [];
  const subtotalRowIndexes: number[] = [];
  let currentSubBudgetName = "";
  let currentGroupRows: WorkScheduleValuationCalendarRow[] = [];

  function pushCurrentGroupSubtotal() {
    if (currentGroupRows.length === 0) {
      return;
    }

    rows.push([
      { value: "" },
      { value: `Subtotal ${currentSubBudgetName}` },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
      ...periods.map((period) => ({
        value: currentGroupRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
        numFmt: currencyFormat,
      })),
    ]);
    subtotalRowIndexes.push(rows.length - 1);
  }

  for (const row of valuationRows) {
    if (scope === "detail_subtotals_and_total" && currentGroupRows.length > 0 && row.subBudgetName !== currentSubBudgetName) {
      pushCurrentGroupSubtotal();
      currentGroupRows = [];
    }

    currentSubBudgetName = row.subBudgetName;
    currentGroupRows.push(row);
    rows.push([
      { value: row.itemCode },
      { value: row.description },
      { value: row.unit },
      { value: row.quantity, numFmt: decimalFormat },
      { value: row.unitPrice, numFmt: currencyFormat },
      { value: row.partial, numFmt: currencyFormat },
      ...periods.map((period) => ({ value: row.periodAmounts[period.key] ?? 0, numFmt: currencyFormat })),
    ]);
  }

  if (scope === "detail_subtotals_and_total") {
    pushCurrentGroupSubtotal();
  }

  return {
    headers: ["Item", "Partida", "Unidad", "Metrado", "PU", "Parcial", ...periods.map((period) => formatPeriodLabel(period))],
    rows,
    subtotalRowIndexes: scope === "detail_subtotals_and_total" ? subtotalRowIndexes : [],
    totalRow:
      scope === "detail_only"
        ? undefined
        : [
            { value: "" },
            { value: "Total" },
            { value: "" },
            { value: valuationRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
            { value: "" },
            { value: valuationRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
            ...periods.map((period) => ({
              value: valuationRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
              numFmt: currencyFormat,
            })),
          ],
  };
}

function buildWorkScheduleResourceWorkbookTableData({
  resourceRows,
  periods,
  currency,
  currencyDecimals,
  scope,
}: {
  resourceRows: WorkScheduleResourceCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  scope: WorkbookExportScope;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const decimalFormat = buildWorkbookDecimalFormat(2);
  const rows: WorkbookCell[][] = [];
  const subtotalRowIndexes: number[] = [];
  let currentFamilyCode = "";
  let currentGroupRows: WorkScheduleResourceCalendarRow[] = [];

  function pushCurrentFamilySubtotal() {
    if (currentGroupRows.length === 0) {
      return;
    }

    rows.push([
      { value: "" },
      { value: `Subtotal ${currentFamilyCode}` },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
      ...periods.flatMap((period) => [
        {
          value: currentGroupRows.reduce((sum, row) => sum + (row.periodQuantities[period.key] ?? 0), 0),
          numFmt: decimalFormat,
        },
        {
          value: currentGroupRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
          numFmt: currencyFormat,
        },
      ]),
    ]);
    subtotalRowIndexes.push(rows.length - 1);
  }

  for (const [index, row] of resourceRows.entries()) {
    const familyCode = scope === "detail_subtotals_and_total" ? getResourceWorkbookFamilyCode(row.code) : "Sin subtotales";
    if (scope === "detail_subtotals_and_total" && currentGroupRows.length > 0 && familyCode !== currentFamilyCode) {
      pushCurrentFamilySubtotal();
      currentGroupRows = [];
    }

    currentFamilyCode = familyCode;
    currentGroupRows.push(row);
    rows.push([
      { value: index + 1 },
      { value: row.description },
      { value: row.unit },
      { value: row.quantity, numFmt: decimalFormat },
      { value: row.unitPrice, numFmt: currencyFormat },
      { value: row.partial, numFmt: currencyFormat },
      ...periods.flatMap((period) => [
        { value: row.periodQuantities[period.key] ?? 0, numFmt: decimalFormat },
        { value: row.periodAmounts[period.key] ?? 0, numFmt: currencyFormat },
      ]),
    ]);
  }

  if (scope === "detail_subtotals_and_total") {
    pushCurrentFamilySubtotal();
  }

  return {
    headers: ["Item", "Insumo", "Unidad", "Cantidad", "PU", "Parcial", ...periods.flatMap((period) => [`${formatPeriodLabel(period)} Cantidad`, `${formatPeriodLabel(period)} Monto`])],
    rows,
    subtotalRowIndexes: scope === "detail_subtotals_and_total" ? subtotalRowIndexes : [],
    totalRow:
      scope === "detail_only"
        ? undefined
        : [
            { value: "" },
            { value: "Total" },
            { value: "" },
            { value: resourceRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
            { value: "" },
            { value: resourceRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
            ...periods.flatMap((period) => [
              {
                value: resourceRows.reduce((sum, row) => sum + (row.periodQuantities[period.key] ?? 0), 0),
                numFmt: decimalFormat,
              },
              {
                value: resourceRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
                numFmt: currencyFormat,
              },
            ]),
          ],
  };
}

function buildWorkScheduleCurveWorkbookTableData({
  curvePoints,
  currency,
  currencyDecimals,
  scope,
}: {
  curvePoints: WorkScheduleCurvePointRecord[];
  currency: string;
  currencyDecimals: number;
  scope: WorkbookExportScope;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const percentageFormat = "0.00%";

  return {
    headers: ["Periodo", "Programado mensual", "Acumulado", "% acumulado"],
    rows: curvePoints.map((point) => [
      { value: formatPeriodLabel(point) },
      { value: point.monthlyAmount, numFmt: currencyFormat },
      { value: point.accumulatedAmount, numFmt: currencyFormat },
      { value: point.accumulatedPercentage / 100, numFmt: percentageFormat },
    ]),
    totalRow:
      scope === "detail_only"
        ? undefined
        : [
            { value: "Total" },
            { value: curvePoints.reduce((sum, point) => sum + point.monthlyAmount, 0), numFmt: currencyFormat },
            { value: curvePoints.at(-1)?.accumulatedAmount ?? 0, numFmt: currencyFormat },
            { value: (curvePoints.at(-1)?.accumulatedPercentage ?? 0) / 100, numFmt: percentageFormat },
          ],
  };
}

function buildWorkScheduleOverviewSummaryCsvExport({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  const tableData = buildWorkScheduleOverviewSummaryTableData({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });

  return {
    fileName: "work-schedule-cronograma-resumen.csv",
    content: buildCsvContent(tableData.headers, tableData.rows),
  };
}

function buildWorkScheduleOverviewWorkbookTableData({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const decimalFormat = buildWorkbookDecimalFormat(2);
  const rows: WorkbookCell[][] = [];
  const subtotalRowIndexes: number[] = [];
  let currentSubBudgetId = "";
  let currentSubBudgetName = "";
  let currentGroupLines: WorkScheduleLineRecord[] = [];

  function pushCurrentGroupSubtotal() {
    if (currentGroupLines.length === 0) {
      return;
    }

    rows.push([
      { value: "" },
      { value: `Subtotal ${currentSubBudgetName}` },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: currentGroupLines.reduce((sum, line) => sum + line.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: currentGroupLines.reduce((sum, line) => sum + line.partial, 0), numFmt: currencyFormat },
    ]);
    subtotalRowIndexes.push(rows.length - 1);
  }

  for (const line of overviewLines) {
    if (currentGroupLines.length > 0 && line.subBudgetId !== currentSubBudgetId) {
      pushCurrentGroupSubtotal();
      currentGroupLines = [];
    }

    currentSubBudgetId = line.subBudgetId;
    currentSubBudgetName = line.subBudgetName;
    currentGroupLines.push(line);
    rows.push([
      { value: line.itemCode },
      { value: line.description },
      { value: line.durationDays ?? "-" },
      { value: line.startDate ? formatDate(line.startDate, dateFormat as never) : "Pendiente" },
      { value: line.endDate ? formatDate(line.endDate, dateFormat as never) : "Pendiente" },
      { value: line.predecessor || "-" },
      { value: line.crew ?? "-" },
      { value: line.unit },
      { value: line.quantity, numFmt: decimalFormat },
      { value: line.unitPrice, numFmt: currencyFormat },
      { value: line.partial, numFmt: currencyFormat },
    ]);
  }

  pushCurrentGroupSubtotal();

  return {
    headers: ["Item", "Partida", "Duracion", "Inicio", "Fin", "Predecesora", "Cuadrilla", "Unidad", "Metrado", "PU", "Parcial"],
    rows,
    subtotalRowIndexes,
    totalRow: [
      { value: "" },
      { value: "Total" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: overviewLines.reduce((sum, line) => sum + line.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: overviewLines.reduce((sum, line) => sum + line.partial, 0), numFmt: currencyFormat },
    ],
  };
}

function buildWorkScheduleOverviewMonthlySummaryCsvExport({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
}) {
  const tableData = buildWorkScheduleOverviewMonthlySummaryTableData({
    valuationRows,
    periods,
    currency,
    currencyDecimals,
  });

  return {
    fileName: "work-schedule-cronograma-resumen-mensual.csv",
    content: buildCsvContent(tableData.headers, tableData.rows),
  };
}

function buildWorkScheduleOverviewExecutivePackageCsvExport({
  overviewLines,
  valuationRows,
  periods,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  const summaryExport = buildWorkScheduleOverviewSummaryCsvExport({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });
  const monthlySummaryExport = buildWorkScheduleOverviewMonthlySummaryCsvExport({
    valuationRows,
    periods,
    currency,
    currencyDecimals,
  });

  const content = [
    "Paquete ejecutivo - Resumen por subpresupuesto",
    summaryExport.content,
    "",
    "Paquete ejecutivo - Resumen mensual",
    monthlySummaryExport.content,
  ].join("\n");

  return {
    fileName: "work-schedule-cronograma-paquete-ejecutivo.csv",
    content,
  };
}

function buildWorkScheduleOverviewSummaryTableData({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  const groupedLines = new Map<
    string,
    {
      subBudgetName: string;
      lines: WorkScheduleLineRecord[];
    }
  >();

  for (const line of overviewLines) {
    const currentGroup = groupedLines.get(line.subBudgetId);
    if (currentGroup) {
      currentGroup.lines.push(line);
      continue;
    }

    groupedLines.set(line.subBudgetId, {
      subBudgetName: line.subBudgetName,
      lines: [line],
    });
  }

  const headers = ["Subpresupuesto", "Partidas", "Programadas", "Pendientes", "Distribucion incompleta", "Inicio", "Fin", "Total parcial"];
  const rows = [...groupedLines.values()].map((group) => {
    const groupStartDates = group.lines
      .map((line) => line.startDate)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .sort();
    const groupEndDates = group.lines
      .map((line) => line.endDate)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .sort();
    const totalPartial = group.lines.reduce((accumulator, line) => accumulator + line.partial, 0);

    return [
      group.subBudgetName,
      String(group.lines.length),
      String(group.lines.filter(isFullyScheduledWorkScheduleLine).length),
      String(group.lines.filter(isPendingWorkScheduleLine).length),
      String(group.lines.filter(hasIncompleteDistribution).length),
      groupStartDates[0] ? formatDate(groupStartDates[0], dateFormat as never) : "-",
      groupEndDates.at(-1) ? formatDate(groupEndDates.at(-1) as string, dateFormat as never) : "-",
      formatCurrency(totalPartial, currency, currencyDecimals),
    ];
  });

  return { headers, rows };
}

function buildWorkScheduleOverviewSummaryWorkbookTableData({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}): WorkbookTableData {
  const groupedLines = new Map<
    string,
    {
      subBudgetName: string;
      lines: WorkScheduleLineRecord[];
    }
  >();
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);

  for (const line of overviewLines) {
    const currentGroup = groupedLines.get(line.subBudgetId);
    if (currentGroup) {
      currentGroup.lines.push(line);
      continue;
    }

    groupedLines.set(line.subBudgetId, {
      subBudgetName: line.subBudgetName,
      lines: [line],
    });
  }

  return {
    headers: ["Subpresupuesto", "Partidas", "Programadas", "Pendientes", "Distribucion incompleta", "Inicio", "Fin", "Total parcial"],
    rows: [...groupedLines.values()].map((group) => {
      const groupStartDates = group.lines
        .map((line) => line.startDate)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .sort();
      const groupEndDates = group.lines
        .map((line) => line.endDate)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .sort();
      const totalPartial = group.lines.reduce((accumulator, line) => accumulator + line.partial, 0);

      return [
        { value: group.subBudgetName },
        { value: group.lines.length },
        { value: group.lines.filter(isFullyScheduledWorkScheduleLine).length },
        { value: group.lines.filter(isPendingWorkScheduleLine).length },
        { value: group.lines.filter(hasIncompleteDistribution).length },
        { value: groupStartDates[0] ? formatDate(groupStartDates[0], dateFormat as never) : "-" },
        { value: groupEndDates.at(-1) ? formatDate(groupEndDates.at(-1) as string, dateFormat as never) : "-" },
        { value: totalPartial, numFmt: currencyFormat },
      ];
    }),
    totalRow: [
      { value: "Total" },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.length, 0) },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.filter(isFullyScheduledWorkScheduleLine).length, 0) },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.filter(isPendingWorkScheduleLine).length, 0) },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.filter(hasIncompleteDistribution).length, 0) },
      { value: "" },
      { value: "" },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.reduce((subtotal, line) => subtotal + line.partial, 0), 0), numFmt: currencyFormat },
    ],
  };
}

function buildWorkScheduleOverviewMonthlySummaryTableData({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
}) {
  const totalAmount = periods.reduce(
    (accumulator, period) =>
      accumulator +
      valuationRows.reduce((periodAccumulator, row) => periodAccumulator + (row.periodAmounts[period.key] ?? 0), 0),
    0,
  );

  let accumulatedAmount = 0;
  const headers = ["Periodo", "Partidas con monto", "Programado mensual", "Acumulado", "% acumulado"];
  const rows = periods.map((period) => {
    const monthlyRows = valuationRows.filter((row) => (row.periodAmounts[period.key] ?? 0) > 0);
    const monthlyAmount = monthlyRows.reduce((accumulator, row) => accumulator + (row.periodAmounts[period.key] ?? 0), 0);
    accumulatedAmount += monthlyAmount;

    return [
      formatPeriodLabel(period),
      String(monthlyRows.length),
      formatCurrency(monthlyAmount, currency, currencyDecimals),
      formatCurrency(accumulatedAmount, currency, currencyDecimals),
      `${formatNumber(totalAmount > 0 ? (accumulatedAmount / totalAmount) * 100 : 0, 2)}%`,
    ];
  });

  return { headers, rows };
}

function buildWorkScheduleOverviewMonthlySummaryWorkbookTableData({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
}): WorkbookTableData {
  const totalAmount = periods.reduce(
    (accumulator, period) =>
      accumulator +
      valuationRows.reduce((periodAccumulator, row) => periodAccumulator + (row.periodAmounts[period.key] ?? 0), 0),
    0,
  );
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const percentageFormat = "0.00%";
  let accumulatedAmount = 0;

  return {
    headers: ["Periodo", "Partidas con monto", "Programado mensual", "Acumulado", "% acumulado"],
    rows: periods.map((period) => {
      const monthlyRows = valuationRows.filter((row) => (row.periodAmounts[period.key] ?? 0) > 0);
      const monthlyAmount = monthlyRows.reduce((accumulator, row) => accumulator + (row.periodAmounts[period.key] ?? 0), 0);
      accumulatedAmount += monthlyAmount;

      return [
        { value: formatPeriodLabel(period) },
        { value: monthlyRows.length },
        { value: monthlyAmount, numFmt: currencyFormat },
        { value: accumulatedAmount, numFmt: currencyFormat },
        { value: totalAmount > 0 ? accumulatedAmount / totalAmount : 0, numFmt: percentageFormat },
      ];
    }),
    totalRow: [
      { value: "Total" },
      { value: periods.reduce((sum, period) => sum + valuationRows.filter((row) => (row.periodAmounts[period.key] ?? 0) > 0).length, 0) },
      { value: totalAmount, numFmt: currencyFormat },
      { value: accumulatedAmount, numFmt: currencyFormat },
      { value: totalAmount > 0 ? accumulatedAmount / totalAmount : 0, numFmt: percentageFormat },
    ],
  };
}

async function buildWorkScheduleOverviewExecutivePackageWorkbook({
  overviewLines,
  valuationRows,
  periods,
  currency,
  currencyDecimals,
  dateFormat,
  scope,
}: {
  overviewLines: WorkScheduleLineRecord[];
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
  scope: WorkbookExportScope;
}) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MYC Presupuestos";
  const summaryTable = buildWorkScheduleOverviewSummaryWorkbookTableData({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });
  const monthlyTable = buildWorkScheduleOverviewMonthlySummaryWorkbookTableData({
    valuationRows,
    periods,
    currency,
    currencyDecimals,
  });
  const overviewTable = buildWorkScheduleOverviewWorkbookTableData({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });
  const scopedSummaryTable = {
    ...summaryTable,
    totalRow: scope === "detail_only" ? undefined : summaryTable.totalRow,
  };
  const scopedMonthlyTable = {
    ...monthlyTable,
    totalRow: scope === "detail_only" ? undefined : monthlyTable.totalRow,
  };
  const scopedOverviewTable = {
    ...overviewTable,
    subtotalRowIndexes: scope === "detail_subtotals_and_total" ? overviewTable.subtotalRowIndexes : [],
    totalRow: scope === "detail_only" ? undefined : overviewTable.totalRow,
  };

  appendWorkbookSheet(workbook, {
    sheetName: "Resumen subpresupuesto",
    title: "PROGRAMACION DE OBRA - RESUMEN POR SUBPRESUPUESTO",
    subtitle: "Vista ejecutiva consolidada por subpresupuesto sobre las partidas visibles y filtradas.",
    headers: scopedSummaryTable.headers,
    rows: scopedSummaryTable.rows,
    totalRow: scopedSummaryTable.totalRow,
  });
  appendWorkbookSheet(workbook, {
    sheetName: "Resumen mensual",
    title: "PROGRAMACION DE OBRA - RESUMEN MENSUAL",
    subtitle: "Programado mensual y acumulado derivado de la valorizacion filtrada.",
    headers: scopedMonthlyTable.headers,
    rows: scopedMonthlyTable.rows,
    totalRow: scopedMonthlyTable.totalRow,
  });
  appendWorkbookSheet(workbook, {
    sheetName: "Cronograma partidas",
    title: "PROGRAMACION DE OBRA - CRONOGRAMA DE PARTIDAS",
    subtitle: "Detalle resumido de partidas programadas visibles en el cronograma.",
    headers: scopedOverviewTable.headers,
    rows: scopedOverviewTable.rows,
    subtotalRowIndexes: scopedOverviewTable.subtotalRowIndexes,
    totalRow: scopedOverviewTable.totalRow,
  });

  return workbook.xlsx.writeBuffer();
}

async function buildWorkScheduleActiveViewWorkbook({
  activeView,
  valuationRows,
  resourceRows,
  curvePoints,
  periods,
  currency,
  currencyDecimals,
  curveWorkbookScope,
  valuationWorkbookScope,
  resourceWorkbookScope,
}: {
  activeView: ActiveView;
  valuationRows: WorkScheduleValuationCalendarRow[];
  resourceRows: WorkScheduleResourceCalendarRow[];
  curvePoints: WorkScheduleCurvePointRecord[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  curveWorkbookScope: WorkbookExportScope;
  valuationWorkbookScope: WorkbookExportScope;
  resourceWorkbookScope: WorkbookExportScope;
}) {
  if (activeView === "overview") {
    return null;
  }

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MYC Presupuestos";

  if (activeView === "valuation") {
    const tableData = buildWorkScheduleValuationWorkbookTableData({
      valuationRows,
      periods,
      currency,
      currencyDecimals,
      scope: valuationWorkbookScope,
    });

    appendWorkbookSheet(workbook, {
      sheetName: "Calendario valorizado",
      title: "PROGRAMACION DE OBRA - CALENDARIO VALORIZADO",
      subtitle: "Vista valorizada por partida sobre el conjunto filtrado y visible.",
      headers: tableData.headers,
      rows: tableData.rows,
      totalRow: tableData.totalRow,
    });

    return {
      fileName: "work-schedule-calendario-valorizado.xlsx",
      content: await workbook.xlsx.writeBuffer(),
    };
  }

  if (activeView === "resources") {
    const tableData = buildWorkScheduleResourceWorkbookTableData({
      resourceRows,
      periods,
      currency,
      currencyDecimals,
      scope: resourceWorkbookScope,
    });

    appendWorkbookSheet(workbook, {
      sheetName: "Calendario de insumos",
      title: "PROGRAMACION DE OBRA - CALENDARIO DE INSUMOS",
      subtitle: "Consumo y monto por periodo para los insumos derivados de las partidas filtradas.",
      headers: tableData.headers,
      rows: tableData.rows,
      totalRow: tableData.totalRow,
    });

    return {
      fileName: "work-schedule-calendario-insumos.xlsx",
      content: await workbook.xlsx.writeBuffer(),
    };
  }

  const tableData = buildWorkScheduleCurveWorkbookTableData({
    curvePoints,
    currency,
    currencyDecimals,
    scope: curveWorkbookScope,
  });

  appendWorkbookSheet(workbook, {
    sheetName: "Curva S",
    title: "PROGRAMACION DE OBRA - CURVA S",
    subtitle: "Serie programada mensual y acumulada para el conjunto filtrado.",
    headers: tableData.headers,
    rows: tableData.rows,
    totalRow: tableData.totalRow,
  });

  return {
    fileName: "work-schedule-curva-s.xlsx",
    content: await workbook.xlsx.writeBuffer(),
  };
}

function appendWorkbookSheet(
  workbook: ExcelJS.Workbook,
  {
    sheetName,
    title,
    subtitle,
    headers,
    rows,
    subtotalRowIndexes,
    totalRow,
  }: {
    sheetName: string;
    title: string;
    subtitle: string;
    headers: string[];
    rows: WorkbookCell[][];
    subtotalRowIndexes?: number[];
    totalRow?: WorkbookCell[];
  },
) {
  const worksheet = workbook.addWorksheet(sheetName);
  const lastColumnLetter = getExcelColumnLetter(headers.length);
  worksheet.mergeCells(`A1:${lastColumnLetter}1`);
  worksheet.mergeCells(`A2:${lastColumnLetter}2`);
  worksheet.getCell("A1").value = title;
  worksheet.getCell("A1").font = { bold: true, size: 15, color: { argb: "FF0F172A" } };
  worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell("A2").value = subtitle;
  worksheet.getCell("A2").font = { size: 11, color: { argb: "FF475569" } };
  worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  worksheet.addRow(headers);
  for (const row of rows) {
    const worksheetRow = worksheet.addRow(row.map((cell) => cell.value));
    row.forEach((cell, index) => {
      if (cell.numFmt) {
        worksheetRow.getCell(index + 1).numFmt = cell.numFmt;
      }
    });
  }

  const worksheetTotalRow = totalRow ? worksheet.addRow(totalRow.map((cell) => cell.value)) : null;
  if (worksheetTotalRow && totalRow) {
    totalRow.forEach((cell, index) => {
      if (cell.numFmt) {
        worksheetTotalRow.getCell(index + 1).numFmt = cell.numFmt;
      }
    });
  }

  worksheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  worksheet.getRow(3).alignment = { horizontal: "center", vertical: "middle" };
  worksheet.views = [{ state: "frozen", ySplit: 3 }];
  worksheet.autoFilter = `A3:${lastColumnLetter}3`;
  worksheet.columns = headers.map((header, columnIndex) => ({
    width: Math.max(header.length + 4, ...rows.map((row) => getWorkbookCellDisplayWidth(row[columnIndex])), 14),
  }));
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  const firstDataRowNumber = 4;
  const lastDataRowNumber = firstDataRowNumber + rows.length - 1;
  for (let rowNumber = firstDataRowNumber; rowNumber <= lastDataRowNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if ((rowNumber - firstDataRowNumber) % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
  }

  const subtotalRowNumbers = new Set((subtotalRowIndexes ?? []).map((index) => firstDataRowNumber + index));
  for (const rowNumber of subtotalRowNumbers) {
    const row = worksheet.getRow(rowNumber);
    row.font = { bold: true, color: { argb: "FF0F172A" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FF0EA5E9" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }

  if (worksheetTotalRow) {
    worksheetTotalRow.font = { bold: true, color: { argb: "FF0F172A" } };
    worksheetTotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
    worksheetTotalRow.alignment = { vertical: "middle" };
    worksheetTotalRow.eachCell((cell) => {
      cell.border = {
        top: { style: "medium", color: { argb: "FF10B981" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }
}

function getWorkbookCellDisplayWidth(cell: WorkbookCell | undefined) {
  if (!cell) {
    return 14;
  }

  return String(cell.value).length + 2;
}

function getResourceWorkbookFamilyCode(resourceCode: string) {
  const [familyCode] = resourceCode.split("-");
  return familyCode?.trim() || "Sin grupo";
}

function buildWorkbookDecimalFormat(decimalPlaces: number) {
  if (decimalPlaces <= 0) {
    return "#,##0";
  }

  return `#,##0.${"0".repeat(decimalPlaces)}`;
}

function createWorkbookCurrencyNumberFormat(currency: string, decimalPlaces: number) {
  return `${resolveWorkbookCurrencySymbol(currency)} ${buildWorkbookDecimalFormat(decimalPlaces)}`;
}

function resolveWorkbookCurrencySymbol(currency: string) {
  if (currency === "USD") return "$";
  if (currency === "PEN") return "S/";
  if (currency === "EUR") return "EUR";
  return currency;
}

function getExcelColumnLetter(columnNumber: number) {
  let current = columnNumber;
  let result = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function buildCsvContent(headers: string[], rows: string[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(fileName, blob);
}

function downloadBinaryFile(fileName: string, content: BlobPart, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(fileName, blob);
}

function downloadBlob(fileName: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function formatTimelineRange(startDate: string | null, endDate: string | null, dateFormat: string) {
  if (!startDate || !endDate) {
    return "Pendiente";
  }

  return `${formatDate(startDate, dateFormat as never)} - ${formatDate(endDate, dateFormat as never)}`;
}

function createEditableLine(line: WorkScheduleLineRecord): EditableLine {
  const fallbackDistributions =
    line.monthlyDistributions.length > 0
      ? line.monthlyDistributions.map((distribution) => ({ ...distribution }))
      : buildInitialDistributionsFromRange(line.startDate ?? "", line.endDate ?? "");

  return updateEditableLineDates(
    {
      budgetItemId: line.budgetItemId,
      description: line.description,
      startDate: line.startDate ?? "",
      endDate: line.endDate ?? "",
      durationDays: line.durationDays ?? 0,
      predecessor: line.predecessor ?? "",
      crew: line.crew != null ? String(line.crew) : "",
      monthlyDistributions: fallbackDistributions,
    },
    {},
  );
}

function createNextDistribution(distributions: WorkScheduleMonthlyDistributionRecord[]) {
  const lastDistribution = distributions[distributions.length - 1];
  if (!lastDistribution) {
    const currentDate = new Date();
    return {
      year: currentDate.getUTCFullYear(),
      month: currentDate.getUTCMonth() + 1,
      percentage: 100,
    };
  }

  const nextMonth = lastDistribution.month === 12 ? 1 : lastDistribution.month + 1;
  const nextYear = lastDistribution.month === 12 ? lastDistribution.year + 1 : lastDistribution.year;

  return {
    year: nextYear,
    month: nextMonth,
    percentage: 0,
  };
}

function createDistributionFromStartDate(startDate: string) {
  if (startDate) {
    const [year, month] = startDate.split("-").map((segment) => Number(segment));
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return {
        year,
        month,
        percentage: 100,
      };
    }
  }

  const currentDate = new Date();
  return {
    year: currentDate.getUTCFullYear(),
    month: currentDate.getUTCMonth() + 1,
    percentage: 100,
  };
}

function buildInitialDistributionsFromRange(startDate: string, endDate: string) {
  if (!startDate) {
    return [createDistributionFromStartDate("")];
  }

  const safeEndDate = endDate && compareIsoDates(endDate, startDate) >= 0 ? endDate : startDate;
  const months = listMonthsInRange(startDate, safeEndDate);

  if (months.length <= 1) {
    return [createDistributionFromStartDate(startDate)];
  }

  const basePercentage = 100 / months.length;
  const roundedBase = Number(basePercentage.toFixed(4));
  const distributions = months.map((month) => ({
    year: month.year,
    month: month.month,
    percentage: roundedBase,
  }));

  const assigned = distributions.reduce((sum, distribution) => sum + distribution.percentage, 0);
  const difference = Number((100 - assigned).toFixed(4));
  const lastIndex = distributions.length - 1;

  if (lastIndex >= 0 && difference !== 0) {
    distributions[lastIndex] = {
      ...distributions[lastIndex],
      percentage: Number((distributions[lastIndex].percentage + difference).toFixed(4)),
    };
  }

  return distributions;
}

function updateDistribution(
  line: EditableLine,
  index: number,
  field: keyof WorkScheduleMonthlyDistributionRecord,
  value: number,
  onChange: (line: EditableLine | null) => void,
) {
  const nextDistributions = line.monthlyDistributions.map((distribution, rowIndex) =>
    rowIndex === index ? { ...distribution, [field]: value } : distribution,
  );

  onChange({
    ...line,
    monthlyDistributions: nextDistributions,
  });
}

function updateEditableLineDates(
  line: EditableLine,
  changes: Partial<Pick<EditableLine, "startDate" | "endDate">>,
) {
  const nextLine = {
    ...line,
    ...changes,
  };

  if (nextLine.startDate) {
    if (!nextLine.endDate || compareIsoDates(nextLine.endDate, nextLine.startDate) < 0) {
      nextLine.endDate = nextLine.startDate;
    }

    if (shouldHydrateInitialDistribution(line)) {
      nextLine.monthlyDistributions = buildInitialDistributionsFromRange(nextLine.startDate, nextLine.endDate);
    }
  }

  if (!nextLine.startDate || !nextLine.endDate) {
    return {
      ...nextLine,
      durationDays: 0,
    };
  }

  const durationDays = calculateInclusiveDurationDays(nextLine.startDate, nextLine.endDate);

  return {
    ...nextLine,
    durationDays,
  };
}

function calculateInclusiveDurationDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.round((end.getTime() - start.getTime()) / millisecondsPerDay);
  return diff >= 0 ? diff + 1 : 0;
}

function compareIsoDates(left: string, right: string) {
  return left.localeCompare(right);
}

function shouldHydrateInitialDistribution(previousLine: EditableLine) {
  if (!previousLine.startDate) {
    return previousLine.monthlyDistributions.length === 1 && Number(previousLine.monthlyDistributions[0]?.percentage) === 100;
  }

  const expected = buildInitialDistributionsFromRange(previousLine.startDate, previousLine.endDate);
  if (expected.length !== previousLine.monthlyDistributions.length) {
    return false;
  }

  return expected.every((distribution, index) => {
    const current = previousLine.monthlyDistributions[index];
    return (
      current?.year === distribution.year &&
      current?.month === distribution.month &&
      Number(current?.percentage) === distribution.percentage
    );
  });
}

function listMonthsInRange(startDate: string, endDate: string) {
  const months: Array<{ year: number; month: number }> = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  cursor.setUTCDate(1);
  end.setUTCDate(1);

  while (cursor.getTime() <= end.getTime()) {
    months.push({
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}
