import type { AiProviderId, KhipuAiTask } from "@/lib/ai/gateway/types";

export type ResolveAiProviderInput = {
  provider: AiProviderId;
  task: KhipuAiTask;
};

type ExecutableProviderId = Exclude<AiProviderId, "auto">;

const AUTO_PROVIDER_BY_TASK: Record<KhipuAiTask, ExecutableProviderId> = {
  autocomplete: "ollama",
  suggest_insumos: "ollama",
  review_apu: "openai",
  review_budget: "openai",
  generate_apu: "openai",
  generate_partida: "openai",
  review_formula_polinomica: "openai",
  review_quantity_takeoff: "openai",
  montecarlo_risk_analysis: "gemini",
  chat: process.env.NODE_ENV === "development" ? "chatgpt_bridge" : "openai",
};

const CLOUD_FALLBACK_CHAIN: ExecutableProviderId[] = ["openai", "gemini", "ollama"];

export function resolveAiProvider({ provider, task }: ResolveAiProviderInput): ExecutableProviderId {
  if (provider !== "auto") {
    return provider;
  }

  return AUTO_PROVIDER_BY_TASK[task];
}

export function getProviderFallbackChain(input: ResolveAiProviderInput): ExecutableProviderId[] {
  const resolvedProvider = resolveAiProvider(input);

  if (input.provider !== "auto") {
    return [resolvedProvider];
  }

  if (resolvedProvider === "openai") {
    return CLOUD_FALLBACK_CHAIN;
  }

  if (resolvedProvider === "gemini") {
    return ["gemini", "ollama"];
  }

  if (resolvedProvider === "openrouter") {
    return ["openrouter"];
  }

  if (resolvedProvider === "agent") {
    return ["agent"];
  }

  return [resolvedProvider];
}
