"use client";

import { useEffect, useMemo, useRef } from "react";
import { HistogramChart } from "@/components/risk/histogram-chart";
import { PercentilesTable } from "@/components/risk/percentiles-table";
import { RiskKPICards } from "@/components/risk/risk-kpi-cards";
import { RiskValidationPanel } from "@/components/risk/risk-validation-panel";
import { RiskVariableModal } from "@/components/risk/risk-variable-modal";
import { RiskVariablesTable } from "@/components/risk/risk-variables-table";
import { SCurveChart } from "@/components/risk/s-curve-chart";
import { SimulationToolbar } from "@/components/risk/simulation-toolbar";
import { Card, CardContent } from "@/components/ui/card";
import { runRiskSimulationWorker, type RiskWorkerController } from "@/lib/risk/monte-carlo-worker-client";
import { useRiskAnalysisStore } from "@/lib/risk/store";
import { formatCurrency } from "@/lib/utils";
import { MONTE_CARLO_ITERATIONS, type RiskAnalysisPayload, type RiskSimulationInput, type RiskSimulationSummary, type RiskVariableRecord } from "@/types/risk";

export function RiskAnalysisDashboard({
  currencyDecimals,
  payload,
}: {
  currencyDecimals: number;
  payload: RiskAnalysisPayload;
}) {
  const workerRef = useRef<RiskWorkerController | null>(null);
  const {
    completeSimulation,
    editingItemId,
    error,
    failSimulation,
    latestRun,
    progress,
    setEditingItemId,
    setLatestRun,
    setProgress,
    setVariables,
    startSimulation,
    status,
    variables,
  } = useRiskAnalysisStore();

  useEffect(() => {
    setVariables(payload.variables);
    setLatestRun(payload.latestRun);
  }, [payload.latestRun, payload.variables, setLatestRun, setVariables]);

  useEffect(() => {
    return () => workerRef.current?.cancel();
  }, []);

  const enabledVariableCount = useMemo(() => variables.filter((variable) => variable.enabled).length, [variables]);
  const editingItem = payload.items.find((item) => item.itemId === editingItemId) ?? null;
  const editingVariable = variables.find((variable) => variable.budgetItemId === editingItemId) ?? null;

  const persistRun = async (summary: RiskSimulationSummary) => {
    const response = await fetch(`/api/budgets/${payload.budget.id}/risk-analysis/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    });

    const result: unknown = await response.json();
    if (response.ok && isRiskSimulationSummary(result)) {
      setLatestRun(result);
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
    };

    startSimulation();
    workerRef.current?.cancel();
    workerRef.current = runRiskSimulationWorker({
      input,
      onProgress: setProgress,
      onResult: (summary) => {
        completeSimulation(summary);
        void persistRun(summary);
      },
      onError: failSimulation,
    });
  };

  const saveVariable = async (variable: RiskVariableRecord) => {
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

    setVariables(result.variables);
    setLatestRun(result.latestRun);
    setEditingItemId(null);
  };

  const deleteVariable = async (variable: RiskVariableRecord) => {
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

    setVariables(result.variables);
    setLatestRun(result.latestRun);
    setEditingItemId(null);
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
        onRunSimulation={runSimulation}
        progress={progress}
        status={status}
      />

      <RiskKPICards currency={payload.budget.currency} currencyDecimals={currencyDecimals} result={latestRun} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="overflow-hidden border-slate-200">
          <CardContent className="p-0">
            <RiskVariablesTable
              currency={payload.budget.currency}
              currencyDecimals={currencyDecimals}
              items={payload.items}
              onEditVariable={setEditingItemId}
              variables={variables}
            />
          </CardContent>
        </Card>

        <RiskValidationPanel items={payload.items} variables={variables} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <HistogramChart currency={payload.budget.currency} currencyDecimals={currencyDecimals} result={latestRun} />
        <SCurveChart currency={payload.budget.currency} currencyDecimals={currencyDecimals} result={latestRun} />
      </div>

      <PercentilesTable
        baseTotal={payload.budget.baseTotal}
        currency={payload.budget.currency}
        currencyDecimals={currencyDecimals}
        result={latestRun}
      />

      <RiskVariableModal
        item={editingItem}
        onClose={() => setEditingItemId(null)}
        onDelete={editingVariable ? () => deleteVariable(editingVariable) : undefined}
        onSave={saveVariable}
        variable={editingVariable}
      />
    </div>
  );
}

function readApiError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function isRiskAnalysisPayload(value: unknown): value is RiskAnalysisPayload {
  return isRecord(value) && Array.isArray(value.items) && Array.isArray(value.variables) && isRecord(value.budget);
}

function isRiskSimulationSummary(value: unknown): value is RiskSimulationSummary {
  return isRecord(value) && typeof value.budgetId === "string" && typeof value.p50 === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
