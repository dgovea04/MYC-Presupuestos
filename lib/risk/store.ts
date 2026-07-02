"use client";

import { create } from "zustand";
import type { RiskCorrelationRecord, RiskSimulationSummary, RiskVariableDraftKey, RiskVariableRecord } from "@/types/risk";

export type RiskSimulationStatus = "idle" | "running" | "completed" | "failed";

export type RiskAnalysisStoreState = {
  variables: RiskVariableRecord[];
  correlations: RiskCorrelationRecord[];
  latestRun: RiskSimulationSummary | null;
  status: RiskSimulationStatus;
  progress: number;
  error: string;
  editingVariableKey: RiskVariableDraftKey | null;
  setVariables: (variables: RiskVariableRecord[]) => void;
  setCorrelations: (correlations: RiskCorrelationRecord[]) => void;
  setLatestRun: (latestRun: RiskSimulationSummary | null) => void;
  startSimulation: () => void;
  setProgress: (completedIterations: number, totalIterations: number) => void;
  completeSimulation: (summary: RiskSimulationSummary) => void;
  failSimulation: (message: string) => void;
  setEditingVariableKey: (editingVariableKey: RiskVariableDraftKey | null) => void;
};

export const useRiskAnalysisStore = create<RiskAnalysisStoreState>((set) => ({
  variables: [],
  correlations: [],
  latestRun: null,
  status: "idle",
  progress: 0,
  error: "",
  editingVariableKey: null,
  setVariables: (variables) => set({ variables }),
  setCorrelations: (correlations) => set({ correlations }),
  setLatestRun: (latestRun) => set({ latestRun }),
  startSimulation: () => set({ status: "running", progress: 0, error: "" }),
  setProgress: (completedIterations, totalIterations) =>
    set({ progress: totalIterations > 0 ? completedIterations / totalIterations : 0 }),
  completeSimulation: (summary) => set({ latestRun: summary, status: "completed", progress: 1, error: "" }),
  failSimulation: (message) => set({ status: "failed", error: message }),
  setEditingVariableKey: (editingVariableKey) => set({ editingVariableKey }),
}));
