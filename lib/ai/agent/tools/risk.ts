import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { getWorkScheduleSection } from "@/lib/data/work-schedule";
import { getRiskAnalysisPayload } from "@/lib/risk/data";
import { buildRiskWorkScheduleSummary } from "@/lib/risk/fallback";
import { saveRiskScenario } from "@/lib/risk/scenarios";
import { runAndSaveRiskSimulation } from "@/lib/risk/simulation-service";
import { suggestRiskVariables } from "@/lib/risk/suggestions";
import {
  riskCorrelationInputSchema,
  riskInputSourceSchema,
  riskSuggestionStrategySchema,
  riskVariableInputSchema,
} from "@/lib/validations/risk";
import type {
  RiskAnalysisPayload,
  RiskScenarioRecord,
  RiskSimulationSummary,
  RiskVariableSuggestion,
} from "@/types/risk";

const budgetInputSchema = z.object({
  budgetId: z.string().min(1),
});

const suggestRiskVariablesInputSchema = budgetInputSchema.extend({
  strategy: riskSuggestionStrategySchema.default("balanced"),
  maxSuggestions: z.number().int().min(1).max(50).default(12),
});

const riskScenarioVariableInputSchema = riskVariableInputSchema.extend({
  source: riskInputSourceSchema.optional(),
  confidence: z.number().finite().min(0).max(1).nullable().optional(),
  rationale: z.string().trim().min(1).nullable().optional(),
});

const previewRiskScenarioInputSchema = z.object({
  budgetId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  variables: z.array(riskScenarioVariableInputSchema),
  correlations: z.array(riskCorrelationInputSchema).default([]),
});

const saveRiskScenarioInputSchema = previewRiskScenarioInputSchema;

const runRiskSimulationInputSchema = z.object({
  budgetId: z.string().min(1),
  scenarioId: z.string().min(1).optional(),
  seed: z.string().min(1).optional(),
});

const summarizeRiskSimulationInputSchema = budgetInputSchema;

type BudgetInput = z.infer<typeof budgetInputSchema>;
type SuggestRiskVariablesInput = z.infer<typeof suggestRiskVariablesInputSchema>;
type PreviewRiskScenarioInput = z.infer<typeof previewRiskScenarioInputSchema>;
type SaveRiskScenarioInput = z.infer<typeof saveRiskScenarioInputSchema>;
type RunRiskSimulationInput = z.infer<typeof runRiskSimulationInputSchema>;
type SummarizeRiskSimulationInput = z.infer<typeof summarizeRiskSimulationInputSchema>;

type SuggestRiskVariablesResult = {
  budgetId: string;
  strategy: SuggestRiskVariablesInput["strategy"];
  suggestions: RiskVariableSuggestion[];
};

type PreviewRiskScenarioResult = {
  budgetId: string;
  name: string;
  description: string | null;
  variableCount: number;
  correlationCount: number;
  valid: boolean;
  warnings: string[];
};

type SummarizeRiskSimulationResult = {
  budget: RiskAnalysisPayload["budget"];
  latestRun: RiskSimulationSummary | null;
  hasSimulation: boolean;
  message?: string;
};

export const getRiskAnalysisTool: AgentToolDefinition<BudgetInput, RiskAnalysisPayload> = {
  name: "getRiskAnalysis",
  description: "Lee variables, correlaciones y la ultima simulacion Monte Carlo de un presupuesto.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: budgetInputSchema,
  execute: async (input, context) => getRiskAnalysisPayload(input.budgetId, context.userId),
  summarizeResult: (result) => `Analisis de riesgo cargado para ${result.budget.name}.`,
};

export const suggestRiskVariablesTool: AgentToolDefinition<
  SuggestRiskVariablesInput,
  SuggestRiskVariablesResult
> = {
  name: "suggestRiskVariables",
  description: "Sugiere variables de riesgo con rango minimo, probable, maximo y sustento. No guarda cambios.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: suggestRiskVariablesInputSchema,
  execute: async (input, context) => {
    const payload = await getRiskAnalysisPayload(input.budgetId, context.userId);
    const workScheduleSummary = await loadAgentWorkScheduleSummary(input.budgetId, context.userId, payload.budget.kind);
    const suggestions = suggestRiskVariables({
      payload,
      workScheduleSummary,
      strategy: input.strategy,
      maxSuggestions: input.maxSuggestions,
    });

    return {
      budgetId: input.budgetId,
      strategy: input.strategy,
      suggestions,
    };
  },
  summarizeResult: (result) => `${result.suggestions.length} variables de riesgo sugeridas.`,
};

export const previewRiskScenarioTool: AgentToolDefinition<
  PreviewRiskScenarioInput,
  PreviewRiskScenarioResult
> = {
  name: "previewRiskScenario",
  description: "Valida un borrador de escenario de riesgo antes de guardarlo. No guarda cambios.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: previewRiskScenarioInputSchema,
  execute: async (input) => {
    const warnings = input.variables.length === 0
      ? ["El escenario no contiene variables."]
      : [];

    return {
      budgetId: input.budgetId,
      name: input.name,
      description: input.description ?? null,
      variableCount: input.variables.length,
      correlationCount: input.correlations.length,
      valid: warnings.length === 0,
      warnings,
    };
  },
  summarizeResult: (result) => `Escenario revisado: ${result.variableCount} variables.`,
};

export const saveRiskScenarioTool: AgentToolDefinition<
  SaveRiskScenarioInput,
  RiskScenarioRecord
> = {
  name: "saveRiskScenario",
  description: "Guarda un escenario de riesgo aprobado por el usuario.",
  risk: "financial",
  requiresProjectId: false,
  inputSchema: saveRiskScenarioInputSchema,
  execute: async (input, context) =>
    saveRiskScenario(input.budgetId, context.userId, {
      name: input.name,
      description: input.description ?? null,
      source: "AGENT",
      status: "APPROVED",
      variables: input.variables,
      correlations: input.correlations,
    }),
  summarizeResult: (result) => `Escenario de riesgo guardado: ${result.name}.`,
};

export const runRiskSimulationTool: AgentToolDefinition<
  RunRiskSimulationInput,
  RiskSimulationSummary
> = {
  name: "runRiskSimulation",
  description: "Ejecuta y guarda una simulacion Monte Carlo real despues de confirmacion.",
  risk: "financial",
  requiresProjectId: false,
  inputSchema: runRiskSimulationInputSchema,
  execute: async (input, context) =>
    runAndSaveRiskSimulation(input.budgetId, context.userId, {
      budgetId: input.budgetId,
      scenarioId: input.scenarioId,
      seed: input.seed,
    }),
  summarizeResult: (result) => `Simulacion Monte Carlo guardada: P80 ${result.p80}, P90 ${result.p90}.`,
};

export const summarizeRiskSimulationTool: AgentToolDefinition<
  SummarizeRiskSimulationInput,
  SummarizeRiskSimulationResult
> = {
  name: "summarizeRiskSimulation",
  description: "Resume resultados reales de una simulacion Monte Carlo guardada.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: summarizeRiskSimulationInputSchema,
  execute: async (input, context) => {
    const payload = await getRiskAnalysisPayload(input.budgetId, context.userId);

    if (!payload.latestRun) {
      return {
        budget: payload.budget,
        latestRun: null,
        hasSimulation: false,
        message: "No existe una simulacion vigente para este presupuesto.",
      };
    }

    return {
      budget: payload.budget,
      latestRun: payload.latestRun,
      hasSimulation: true,
    };
  },
  summarizeResult: (result) => {
    if (!result.latestRun) {
      return result.message ?? "No existe una simulacion vigente para este presupuesto.";
    }

    return `Ultima simulacion: P50 ${result.latestRun.p50}, P80 ${result.latestRun.p80}, P90 ${result.latestRun.p90}.`;
  },
};

export const riskTools = [
  getRiskAnalysisTool,
  suggestRiskVariablesTool,
  previewRiskScenarioTool,
  saveRiskScenarioTool,
  runRiskSimulationTool,
  summarizeRiskSimulationTool,
] as const;

async function loadAgentWorkScheduleSummary(
  budgetId: string,
  userId: string,
  budgetKind: string,
) {
  if (budgetKind !== "GENERAL") {
    return null;
  }

  try {
    const section = await getWorkScheduleSection(budgetId, userId);
    return buildRiskWorkScheduleSummary(section);
  } catch {
    return null;
  }
}
