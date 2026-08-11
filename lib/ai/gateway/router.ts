import type { AiProviderId, KhipuAiTask } from "@/lib/ai/gateway/types";
import { isLocalRuntimeEnabled } from "@/lib/runtime/local-capabilities";

export type ResolveAiProviderInput = {
  provider: AiProviderId;
  task: KhipuAiTask;
};

type ExecutableProviderId = Exclude<AiProviderId, "auto">;

function getAutoProviderByTask(task: KhipuAiTask): ExecutableProviderId {
  if (task === "autocomplete" || task === "suggest_insumos") {
    return isLocalRuntimeEnabled() ? "ollama" : "openai";
  }

  if (task === "chat" && process.env.NODE_ENV === "development") {
    return "chatgpt_bridge";
  }

  if (task === "montecarlo_risk_analysis") return "gemini";
  return "openai";
}

function getCloudFallbackChain(): ExecutableProviderId[] {
  return isLocalRuntimeEnabled() ? ["openai", "gemini", "ollama"] : ["openai", "gemini"];
}

export function resolveAiProvider({ provider, task }: ResolveAiProviderInput): ExecutableProviderId {
  if (provider !== "auto") {
    return provider;
  }

  return getAutoProviderByTask(task);
}

export function getProviderFallbackChain(input: ResolveAiProviderInput): ExecutableProviderId[] {
  const resolvedProvider = resolveAiProvider(input);

  if (input.provider !== "auto") {
    return [resolvedProvider];
  }

  if (resolvedProvider === "openai") {
    return getCloudFallbackChain();
  }

  if (resolvedProvider === "gemini") {
    return isLocalRuntimeEnabled() ? ["gemini", "ollama"] : ["gemini", "openai"];
  }

  if (resolvedProvider === "openrouter") {
    return ["openrouter"];
  }

  if (resolvedProvider === "agent") {
    return ["agent"];
  }

  return [resolvedProvider];
}
