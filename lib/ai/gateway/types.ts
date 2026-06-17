import type { AiEndpointResult, AiMessage } from "@/lib/ai/types";
import type { z } from "zod";

export type AiProviderId = "auto" | "ollama" | "chatgpt_bridge" | "openai" | "gemini" | "openrouter";

export type KhipuAiTask =
  | "review_apu"
  | "generate_apu"
  | "suggest_insumos"
  | "review_budget"
  | "generate_partida"
  | "review_formula_polinomica"
  | "review_quantity_takeoff"
  | "montecarlo_risk_analysis"
  | "chat"
  | "autocomplete";

export type ExecuteAiTaskInput = {
  provider: AiProviderId;
  task: KhipuAiTask;
  payload: Record<string, unknown>;
  projectId?: string;
  userId: string;
  stream?: boolean;
};

export type AiProviderRequest = {
  task: KhipuAiTask;
  messages: AiMessage[];
  schema?: z.ZodType<unknown>;
  schemaName?: string;
  userId?: string;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  modelPreference?: string;
};

export type AiProviderResult = AiEndpointResult & {
  provider: Exclude<AiProviderId, "auto">;
  promptHash?: string;
  responseHash?: string;
  /** The raw request body sent to the provider API (for debugging) */
  requestBody?: Record<string, unknown>;
};
