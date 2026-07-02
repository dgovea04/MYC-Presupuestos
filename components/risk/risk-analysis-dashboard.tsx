"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { PercentilesTable } from "@/components/risk/percentiles-table";
import { RiskCorrelationsPanel } from "@/components/risk/risk-correlations-panel";
import { RiskKPICards } from "@/components/risk/risk-kpi-cards";
import { RiskScheduleAnalysisPanel } from "@/components/risk/risk-schedule-analysis-panel";
import { RiskValidationPanel } from "@/components/risk/risk-validation-panel";
import { RiskVariableModal } from "@/components/risk/risk-variable-modal";
import { RiskVariablesTable } from "@/components/risk/risk-variables-table";
import { RiskWorkSchedulePanel } from "@/components/risk/risk-work-schedule-panel";
import { SimulationToolbar } from "@/components/risk/simulation-toolbar";
import { Card, CardContent } from "@/components/ui/card";
import { runRiskSimulationWorker, type RiskWorkerController } from "@/lib/risk/monte-carlo-worker-client";
import { buildTornadoSensitivity } from "@/lib/risk/statistics";
import { buildBoxPlotStats } from "@/lib/risk/statistics";
import { useRiskAnalysisStore } from "@/lib/risk/store";
import { formatCurrency } from "@/lib/utils";
import {
  MONTE_CARLO_ITERATIONS,
  type RiskAnalysisPayload,
  type RiskBudgetItem,
  type RiskSimulationInput,
  type RiskSimulationSummary,
  type RiskVariableDraftKey,
  type RiskVariableRecord,
  type RiskVariableType,
  type RiskWorkScheduleSummary,
} from "@/types/risk";

const HistogramChart = dynamic(() => import("@/components/risk/histogram-chart").then((mod) => mod.HistogramChart));
const SCurveChart = dynamic(() => import("@/components/risk/s-curve-chart").then((mod) => mod.SCurveChart));
const TornadoChart = dynamic(() => import("@/components/risk/tornado-chart").then((mod) => mod.TornadoChart));
const BoxPlotChart = dynamic(() => import("@/components/risk/box-plot-chart").then((mod) => mod.BoxPlotChart));

export function RiskAnalysisDashboard({
  currencyDecimals,
  payload,
  workScheduleSummary = null,
}: {
  currencyDecimals: number;
  payload: RiskAnalysisPayload;
  workScheduleSummary?: RiskWorkScheduleSummary | null;
}) {
  const workerRef = useRef<RiskWorkerController | null>(null);
  const activeBudgetIdRef = useRef(payload.budget.id);
  const modelVersionRef = useRef(0);
  const [qualityPanelCollapsed, setQualityPanelCollapsed] = useState(true);
  const {
    completeSimulation,
    correlations,
    editingVariableKey,
    error,
    failSimulation,
    latestRun,
    progress,
    setCorrelations,
    setEditingVariableKey,
    setLatestRun,
    setProgress,
    setVariables,
    startSimulation,
    status,
    variables,
  } = useRiskAnalysisStore();

  useEffect(() => {
    setCorrelations(payload.correlations);
    setVariables(payload.variables);
    setLatestRun(payload.latestRun);
  }, [payload.correlations, payload.latestRun, payload.variables, setCorrelations, setLatestRun, setVariables]);

  useEffect(() => {
    activeBudgetIdRef.current = payload.budget.id;
    workerRef.current?.cancel();
    workerRef.current = null;
    setEditingVariableKey(null);
    useRiskAnalysisStore.setState({ error: "", progress: 0, status: "idle" });
  }, [payload.budget.id, setEditingVariableKey]);

  useEffect(() => {
    return () => {
      workerRef.current?.cancel();
      workerRef.current = null;
    };
  }, []);

  const enabledVariableCount = useMemo(() => variables.filter((variable) => variable.enabled).length, [variables]);
  const tornadoRows = useMemo(
    () => buildTornadoSensitivity(payload.items, variables, payload.budget.baseTotal),
    [payload.budget.baseTotal, payload.items, variables],
  );
  const boxPlotStats = useMemo(() => (latestRun ? buildBoxPlotStats(latestRun) : null), [latestRun]);
  const editingContext = useMemo(() => parseDraftKey(editingVariableKey), [editingVariableKey]);
  const criticalItemById = useMemo(
    () => new Map((workScheduleSummary?.criticalItems ?? []).map((item) => [item.budgetItemId, item])),
    [workScheduleSummary],
  );
  const editingItem =
    payload.items.find((item) => item.itemId === editingContext?.itemId) ??
    buildScheduleRiskItem(editingContext?.itemId ?? null, criticalItemById, payload.budget.id);
  const editingVariableType = editingContext?.variableType ?? null;
  const editingVariable =
    variables.find(
      (variable) =>
        variable.budgetItemId === editingContext?.itemId && variable.variableType === editingContext?.variableType,
    ) ?? null;
  const editingDurationBaseValue =
    editingVariableType === "DURATION"
      ? criticalItemById.get(editingContext?.itemId ?? "")?.durationDays ?? null
      : null;

  const persistRun = async (summary: RiskSimulationSummary) => {
    try {
      const response = await fetch(`/api/budgets/${summary.budgetId}/risk-analysis/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      });

      if (!response.ok) {
        const result = await readOptionalJson(response);
        throw new Error(readApiError(result, "La simulacion termino, pero no se pudo guardar el resultado."));
      }

      const result = await readOptionalJson(response);
      if (!isRiskSimulationSummary(result)) {
        throw new Error("La simulacion termino, pero no se pudo guardar el resultado.");
      }

      if (result.budgetId === activeBudgetIdRef.current) {
        setLatestRun(result);
      }
    } catch (error) {
      if (summary.budgetId === activeBudgetIdRef.current) {
        failSimulation(
          error instanceof Error ? error.message : "La simulacion termino, pero no se pudo guardar el resultado.",
        );
      }
    }
  };

  const runSimulation = () => {
    if (status === "running") {
      return;
    }

    const input: RiskSimulationInput = {
      budgetId: payload.budget.id,
      baseTotal: payload.budget.baseTotal,
      iterations: MONTE_CARLO_ITERATIONS,
      items: payload.items,
      variables,
      correlations,
      workSchedule: workScheduleSummary ? { lines: workScheduleSummary.simulationLines } : null,
    };

    startSimulation();
    workerRef.current?.cancel();
    const runBudgetId = payload.budget.id;
    const runModelVersion = modelVersionRef.current;
    workerRef.current = runRiskSimulationWorker({
      input,
      onProgress: (completedIterations, totalIterations) => {
        if (runBudgetId === activeBudgetIdRef.current) {
          setProgress(completedIterations, totalIterations);
        }
      },
      onResult: (summary) => {
        if (summary.budgetId !== activeBudgetIdRef.current || runModelVersion !== modelVersionRef.current) {
          return;
        }

        completeSimulation(summary);
        void persistRun(summary);
      },
      onError: (message) => {
        if (runBudgetId === activeBudgetIdRef.current) {
          failSimulation(message);
        }
      },
    });
  };

  const exportPdf = () => {
    if (!latestRun) {
      return;
    }

    window.open(`/api/budgets/${payload.budget.id}/risk-analysis/report`, "_blank", "noopener,noreferrer");
  };

  const saveVariable = async (variable: RiskVariableRecord) => {
    if (status === "running") {
      throw new Error("Espera a que termine la simulacion antes de editar variables.");
    }

    const response = await fetch(`/api/budgets/${payload.budget.id}/risk-analysis/variables`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables: [variable] }),
    });

    const result: unknown = await response.json();
    if (!response.ok) {
      throw new Error(readApiError(result, "No se pudo guardar la variable de riesgo."));
    }

    if (!isRiskAnalysisPayload(result)) {
      throw new Error("No se pudo leer la respuesta de variables de riesgo.");
    }

    modelVersionRef.current += 1;
    setCorrelations(result.correlations);
    setVariables(result.variables);
    setLatestRun(result.latestRun);
    setEditingVariableKey(null);
  };

  const deleteVariable = async (variable: RiskVariableRecord) => {
    if (status === "running") {
      throw new Error("Espera a que termine la simulacion antes de editar variables.");
    }

    const response = await fetch(`/api/budgets/${payload.budget.id}/risk-analysis/variables`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables: [{ ...variable, delete: true }] }),
    });

    const result: unknown = await response.json();
    if (!response.ok) {
      throw new Error(readApiError(result, "No se pudo eliminar la variable de riesgo."));
    }

    if (!isRiskAnalysisPayload(result)) {
      throw new Error("No se pudo leer la respuesta de variables de riesgo.");
    }

    modelVersionRef.current += 1;
    setCorrelations(result.correlations);
    setVariables(result.variables);
    setLatestRun(result.latestRun);
    setEditingVariableKey(null);
  };

  const saveCorrelations = async (
    nextCorrelations: Array<{ sourceVariableId: string; targetVariableId: string; coefficient: number }>,
  ) => {
    if (status === "running") {
      throw new Error("Espera a que termine la simulacion antes de editar correlaciones.");
    }

    const response = await fetch(`/api/budgets/${payload.budget.id}/risk-analysis/correlations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correlations: nextCorrelations }),
    });

    const result: unknown = await response.json();
    if (!response.ok) {
      throw new Error(readApiError(result, "No se pudo guardar la correlacion de riesgo."));
    }

    if (!isRiskAnalysisPayload(result)) {
      throw new Error("No se pudo leer la respuesta de correlaciones de riesgo.");
    }

    modelVersionRef.current += 1;
    setCorrelations(result.correlations);
    setVariables(result.variables);
    setLatestRun(result.latestRun);
  };

  return (
    <div className="space-y-5">
      <SimulationToolbar
        baseTotal={formatCurrency(payload.budget.baseTotal, payload.budget.currency, currencyDecimals)}
        budgetKind={payload.budget.kind}
        budgetName={payload.budget.name}
        enabledVariables={enabledVariableCount}
        error={error}
        itemCount={payload.items.length}
        lastRunAt={latestRun?.createdAt ?? null}
        onExportPdf={exportPdf}
        onRunSimulation={runSimulation}
        progress={progress}
        status={status}
      />

      <RiskKPICards currency={payload.budget.currency} currencyDecimals={currencyDecimals} result={latestRun} />

      <div
        className={
          qualityPanelCollapsed
            ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_64px]"
            : "grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]"
        }
      >
        <Card className="theme-surface-card overflow-hidden">
          <CardContent className="p-0">
            <RiskVariablesTable
              currency={payload.budget.currency}
              currencyDecimals={currencyDecimals}
              disabled={status === "running"}
              items={payload.items}
              onEditVariable={setEditingVariableKey}
              variables={variables}
            />
          </CardContent>
        </Card>

        <RiskValidationPanel
          collapsed={qualityPanelCollapsed}
          items={payload.items}
          onToggleCollapsed={() => setQualityPanelCollapsed((current) => !current)}
          variables={variables}
        />
      </div>

      <RiskCorrelationsPanel
        correlations={correlations}
        disabled={status === "running"}
        items={payload.items}
        onSaveCorrelations={saveCorrelations}
        variables={variables}
      />

      <RiskWorkSchedulePanel
        disabled={status === "running"}
        onEditDurationVariable={setEditingVariableKey}
        summary={workScheduleSummary}
        variables={variables}
      />

      <RiskScheduleAnalysisPanel result={latestRun} />

      <div className="grid gap-5 xl:grid-cols-3">
        <HistogramChart currency={payload.budget.currency} currencyDecimals={currencyDecimals} result={latestRun} />
        <SCurveChart currency={payload.budget.currency} currencyDecimals={currencyDecimals} result={latestRun} />
        <TornadoChart currency={payload.budget.currency} currencyDecimals={currencyDecimals} rows={tornadoRows} />
      </div>

      <BoxPlotChart currency={payload.budget.currency} currencyDecimals={currencyDecimals} result={boxPlotStats} />

      <PercentilesTable
        baseTotal={payload.budget.baseTotal}
        currency={payload.budget.currency}
        currencyDecimals={currencyDecimals}
        result={latestRun}
      />

      <RiskVariableModal
        baseValueLabel={editingVariableType === "DURATION" ? "duracion" : undefined}
        baseValueOverride={editingDurationBaseValue}
        item={editingItem}
        onClose={() => setEditingVariableKey(null)}
        onDelete={editingVariable ? () => deleteVariable(editingVariable) : undefined}
        onSave={saveVariable}
        variableType={editingVariableType}
        variable={editingVariable}
      />
    </div>
  );
}

function readApiError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

async function readOptionalJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isRiskAnalysisPayload(value: unknown): value is RiskAnalysisPayload {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    Array.isArray(value.variables) &&
    Array.isArray(value.correlations) &&
    isRecord(value.budget)
  );
}

function isRiskSimulationSummary(value: unknown): value is RiskSimulationSummary {
  return isRecord(value) && typeof value.budgetId === "string" && typeof value.p50 === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDraftKey(value: RiskVariableDraftKey | null): { itemId: string; variableType: RiskVariableType } | null {
  if (!value) return null;

  const separatorIndex = value.lastIndexOf(":");
  if (separatorIndex <= 0) return null;

  const itemId = value.slice(0, separatorIndex);
  const variableType = value.slice(separatorIndex + 1);
  if (variableType !== "QUANTITY" && variableType !== "UNIT_PRICE" && variableType !== "DURATION") {
    return null;
  }

  return { itemId, variableType };
}

function buildScheduleRiskItem(
  itemId: string | null,
  criticalItemById: Map<string, RiskWorkScheduleSummary["criticalItems"][number]>,
  budgetId: string,
): RiskBudgetItem | null {
  if (!itemId) {
    return null;
  }

  const item = criticalItemById.get(itemId);
  if (!item) {
    return null;
  }

  return {
    itemId: item.budgetItemId,
    budgetId,
    sourceBudgetName: item.subBudgetName,
    code: item.itemCode,
    description: item.description,
    unit: "dia",
    baseQuantity: 0,
    unitPrice: 0,
    baseTotal: item.partial,
    updatedAt: item.endDate ?? item.startDate ?? new Date(0).toISOString(),
  };
}
