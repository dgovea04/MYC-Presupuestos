import { buildKhipuAssembledContext } from "@/lib/ai/context/assembled-context";
import { stableHash } from "@/lib/ai/gateway/hash";
import { getProviderFallbackChain } from "@/lib/ai/gateway/router";
import type { AiProviderId, AiProviderRequest, AiProviderResult, ExecuteAiTaskInput } from "@/lib/ai/gateway/types";
import { executeBridgeProvider } from "@/lib/ai/gateway/providers/bridge-provider";
import { executeGeminiProvider } from "@/lib/ai/gateway/providers/gemini-provider";
import { executeOllamaProvider } from "@/lib/ai/gateway/providers/ollama-provider";
import { executeOpenAIProvider } from "@/lib/ai/gateway/providers/openai-provider";
import { buildSkillProviderRequest } from "@/lib/ai/skills/registry";

type ExecutableProviderId = Exclude<AiProviderId, "auto">;

export type AiProviderExecutor = (request: AiProviderRequest) => Promise<AiProviderResult>;

export type ExecuteAiTaskDeps = {
  buildKhipuAssembledContext: typeof buildKhipuAssembledContext;
  providers: Partial<Record<ExecutableProviderId, AiProviderExecutor>>;
};

export type ExecuteAiTaskWithDepsInput = ExecuteAiTaskInput & {
  deps?: Partial<ExecuteAiTaskDeps>;
};

const DEFAULT_PROVIDERS: Record<ExecutableProviderId, AiProviderExecutor> = {
  ollama: executeOllamaProvider,
  openai: executeOpenAIProvider,
  gemini: executeGeminiProvider,
  chatgpt_bridge: executeBridgeProvider,
};

export async function executeAiTask({
  deps,
  payload,
  projectId,
  provider,
  task,
  userId,
}: ExecuteAiTaskWithDepsInput): Promise<AiProviderResult> {
  const resolvedDeps = resolveDeps(deps);
  const assembledContext = await resolvedDeps.buildKhipuAssembledContext({
    projectId,
    userId,
    task,
    payload,
  });
  const request = buildProviderRequest({
    assembledContext,
    payload,
    task,
    userId,
  });
  const providers = getProviderFallbackChain({ provider, task });
  const promptHash = stableHash(request.messages);
  let lastError: unknown;

  for (const providerId of providers) {
    const executor = resolvedDeps.providers[providerId];

    if (!executor) {
      lastError = new Error(`Proveedor ${providerId} no disponible`);
      continue;
    }

    try {
      const result = await executor(request);
      return {
        ...result,
        provider: result.provider ?? providerId,
        task,
        promptHash,
        responseHash: stableHash(result.answer),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No se pudo ejecutar la tarea de IA.");
}

function resolveDeps(deps: Partial<ExecuteAiTaskDeps> | undefined): ExecuteAiTaskDeps {
  return {
    buildKhipuAssembledContext,
    providers: {
      ...DEFAULT_PROVIDERS,
      ...deps?.providers,
    },
    ...deps,
  };
}

function buildProviderRequest({
  assembledContext,
  payload,
  task,
  userId,
}: Parameters<typeof buildSkillProviderRequest>[0]): AiProviderRequest {
  return buildSkillProviderRequest({
    assembledContext,
    task,
    payload,
    userId,
  });
}
