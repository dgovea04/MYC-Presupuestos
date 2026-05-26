"use client";

import { create } from "zustand";
import type { RiskSimulationSummary, RiskVariableRecord } from "@/types/risk";

export type RiskSimulationStatus = "idle" | "running" | "completed" | "failed";

export type RiskAnalysisStoreState = {
  variables: RiskVariableRecord[];
  latestRun: RiskSimulationSummary | null;
  status: RiskSimulationStatus;
  progress: number;
  error: string;
  editingItemId: string | null;
  setVariables: (variables: RiskVariableRecord[]) => void;
  setLatestRun: (latestRun: RiskSimulationSummary | null) => void;
  startSimulation: () => void;
  setProgress: (completedIterations: number, totalIterations: number) => void;
  completeSimulation: (summary: RiskSimulationSummary) => void;
  failSimulation: (message: string) => void;
  setEditingItemId: (editingItemId: string | null) => void;
};

export const useRiskAnalysisStore = create<RiskAnalysisStoreState>((set) => ({
  variables: [],
  latestRun: null,
  status: "idle",
  progress: 0,
  error: "",
  editingItemId: null,
  setVariables: (variables) => set({ variables }),
  setLatestRun: (latestRun) => set({ latestRun }),
  startSimulation: () => set({ status: "running", progress: 0, error: "" }),
  setProgress: (completedIterations, totalIterations) =>
    set({ progress: totalIterations > 0 ? completedIterations / totalIterations : 0 }),
  completeSimulation: (summary) => set({ latestRun: summary, status: "completed", progress: 1, error: "" }),
  failSimulation: (message) => set({ status: "failed", error: message }),
  setEditingItemId: (editingItemId) => set({ editingItemId }),
}));
