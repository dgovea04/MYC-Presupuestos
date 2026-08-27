import type { AiEndpointResult, AiMessage } from "@/lib/ai/types";
import type { z } from "zod";

export type AiProviderId = "auto" | "ollama" | "chatgpt_bridge" | "openai" | "gemini" | "openrouter" | "agent";

export type KhipuAiTask =
  | "review_apu"
  | "generate_apu"
  | "suggest_insumos"
  | "review_budget"
  | "generate_partida"
  | "review_formula_polinomica"
  | "review_quantity_takeoff"
  | "montecarlo_risk_analysis"
  | "pdf_import_structure"
  | "chat"
  | "autocomplete";

export type ExecuteAiTaskInput = {
  provider: AiProviderId;
  task: KhipuAiTask;
  payload: Record<string, unknown>;
  projectId?: string;
  userId: string;
  workspaceId?: string | null;
  teamId?: string | null;
  requestId?: string;
  modelPreference?: string;
  stream?: boolean;
};

export type AiProviderRequest = {
  task: KhipuAiTask;
  messages: AiMessage[];
  schema?: z.ZodType<unknown>;
  schemaName?: string;
  userId?: string;
  projectId?: string;
  workspaceId?: string;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  modelPreference?: string;
  allowEnvironmentFallback?: boolean;
  credentialSource?: "PLATFORM" | "WORKSPACE" | "USER" | "ENVIRONMENT";
  credentialId?: string | null;
  billingScope?: "PLATFORM" | "WORKSPACE" | "USER";
  allowAgentWrites?: boolean;
  requestId?: string;
};

export type AiProviderResult = AiEndpointResult & {
  provider: Exclude<AiProviderId, "auto">;
  promptHash?: string;
  responseHash?: string;
  requestBody?: Record<string, unknown>;
};
