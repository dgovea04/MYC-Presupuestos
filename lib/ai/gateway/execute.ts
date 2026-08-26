import crypto from "node:crypto";
import { buildKhipuAssembledContext } from "@/lib/ai/context/assembled-context";
import { stableHash } from "@/lib/ai/gateway/hash";
import { getProviderFallbackChain, resolveAiProvider } from "@/lib/ai/gateway/router";
import type { AiProviderId, AiProviderRequest, AiProviderResult, ExecuteAiTaskInput } from "@/lib/ai/gateway/types";
import type { AiEndpointResult } from "@/lib/ai/types";
import { executeAgentProvider } from "@/lib/ai/gateway/providers/agent-provider";
import { executeBridgeProvider } from "@/lib/ai/gateway/providers/bridge-provider";
import { executeGeminiProvider } from "@/lib/ai/gateway/providers/gemini-provider";
import { executeOllamaProvider } from "@/lib/ai/gateway/providers/ollama-provider";
import { executeOpenAIProvider } from "@/lib/ai/gateway/providers/openai-provider";
import { executeOpenRouterProvider } from "@/lib/ai/gateway/providers/openrouter-provider";
import { buildSkillProviderRequest } from "@/lib/ai/skills/registry";
import { resolveAiCredential } from "@/lib/ai/credentials/resolver";
import { buildAiExecutionAttribution } from "@/lib/ai/credentials/usage-attribution";
import { getDecryptedGeminiApiKey, getDecryptedOpenaiApiKey, getDecryptedOpenrouterApiKey, getAiProviderSettings } from "@/lib/data/settings";
import { getSystemSettings } from "@/lib/data/system-settings";
import { reserveAiUsage, recordScopedAiUsage, releaseAiUsage } from "@/lib/ai/usage-scope";
import { isScopedAiResolverEnabled } from "@/lib/ai/credentials/rollout";

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
  openrouter: executeOpenRouterProvider,
  chatgpt_bridge: executeBridgeProvider,
  agent: executeAgentProvider,
};

export async function executeAiTask({
  deps,
  payload,
  projectId,
  provider,
  task,
  userId,
  workspaceId,
  requestId = crypto.randomUUID(),
  modelPreference,
}: ExecuteAiTaskWithDepsInput): Promise<AiProviderResult> {
  const resolvedDeps = resolveDeps(deps);
  const assembledContext = await resolvedDeps.buildKhipuAssembledContext({ projectId, userId, task, payload });
  const baseRequest = buildProviderRequest({ assembledContext, payload, task, userId, projectId });
  const resolvedProvider = resolveAiProvider({ provider, task });
  const credential = workspaceId !== undefined && isScopedAiResolverEnabled()
    ? await resolveAiCredential({ userId, workspaceId, provider: resolvedProvider, task, modelPreference })
    : await resolveLegacyCredential({ userId, provider: resolvedProvider, modelPreference });
  const attribution = buildAiExecutionAttribution(credential, requestId);
  const request: AiProviderRequest = {
    ...baseRequest,
    workspaceId: credential.workspaceId ?? undefined,
    apiKey: credential.apiKey ?? undefined,
    modelPreference: credential.model,
    allowEnvironmentFallback: credential.credentialSource === "ENVIRONMENT",
    credentialSource: attribution.credentialSource,
    credentialId: attribution.credentialId,
    billingScope: attribution.billingScope,
    allowAgentWrites: credential.allowAgentWrites,
    requestId: attribution.requestId,
  };

  const providers = getProviderFallbackChain({ provider, task });
  const promptHash = stableHash(request.messages);
  let lastError: unknown;
  const estimatedTokens = Math.max(1, Math.ceil(request.messages.reduce((total, message) => total + message.content.length, 0) / 4));
  const hasScopedWorkspace = credential.workspaceId !== null && workspaceId !== undefined;
  let scopedReservation: Awaited<ReturnType<typeof reserveAiUsage>> | null = null;
  if (hasScopedWorkspace) {
    scopedReservation = await reserveAiUsage({
      userId,
      workspaceId: credential.workspaceId,
      billingScope: credential.billingScope,
      estimatedTokens,
      allowance: credential.tokenLimit,
      budgetMinor: credential.budgetLimitMinor,
      provider: credential.provider,
      model: credential.model,
      action: task,
      credentialSource: credential.credentialSource,
      credentialId: credential.credentialId,
      requestId,
      hardLimit: credential.hardLimit,
      alertThresholds: credential.alertThresholds,
    });
  }

  for (const providerId of providers) {
    const executor = resolvedDeps.providers[providerId];
    if (!executor) {
      lastError = new Error(`Proveedor ${providerId} no disponible`);
      continue;
    }

    try {
      const result = await executor(request);
      const currentProviderIndex = providers.indexOf(providerId);
      const fallbackUsed = currentProviderIndex > 0;
      const enrichedDebug: AiEndpointResult["debug"] = {
        structuredParseStatus: "not_requested",
        rawAnswer: result.answer,
        context: request.messages.find((m) => m.role === "system")?.content ?? undefined,
        messages: request.messages,
        ai: { answer: result.answer, rawAnswer: result.answer, structuredParseStatus: "not_requested" },
        fallback: {
          used: fallbackUsed,
          reason: fallbackUsed ? `Se uso ${providerId} como fallback tras intentar con ${providers.slice(0, currentProviderIndex).join(", ")}` : undefined,
        },
        validationWarnings: result.warnings,
        requestBody: result.requestBody,
      };

      if (hasScopedWorkspace) {
        await recordScopedAiUsage({
          userId,
          workspaceId: credential.workspaceId,
          billingScope: credential.billingScope,
          credentialSource: credential.credentialSource,
          credentialId: credential.credentialId,
          requestId,
          provider: result.provider ?? providerId,
          model: result.model,
          action: task,
          estimatedTokens,
          actualTokens: Math.max(1, Math.ceil((request.messages.reduce((total, message) => total + message.content.length, 0) + result.answer.length) / 4)),
          reservedCostMinor: scopedReservation?.estimatedCostMinor,
          periodStart: scopedReservation?.periodStart,
          fallbackUsed,
        });
      }

      return {
        ...result,
        provider: result.provider ?? providerId,
        task,
        promptHash,
        responseHash: stableHash(result.answer),
        workspaceId: credential.workspaceId,
        credentialSource: credential.credentialSource,
        credentialId: credential.credentialId,
        billingScope: credential.billingScope,
        requestId,
        debug: enrichedDebug,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (hasScopedWorkspace) {
    await releaseAiUsage({
      userId,
      workspaceId: credential.workspaceId,
      billingScope: credential.billingScope,
      estimatedTokens,
      provider: credential.provider,
      model: credential.model,
      action: task,
      credentialSource: credential.credentialSource,
      credentialId: credential.credentialId,
      requestId,
      estimatedCostMinor: scopedReservation?.estimatedCostMinor,
      periodStart: scopedReservation?.periodStart,
    }).catch(() => undefined);
  }

  throw lastError instanceof Error ? lastError : new Error("No se pudo ejecutar la tarea de IA.");
}

async function resolveLegacyCredential({
  userId,
  provider,
  modelPreference,
}: {
  userId: string;
  provider: ExecutableProviderId;
  modelPreference?: string;
}) {
  const settings = await getAiProviderSettings(userId);
  const system = await getSystemSettings();
  const apiKey = provider === "openai"
    ? await getDecryptedOpenaiApiKey(userId) || system.openaiApiKey || process.env.OPENAI_API_KEY || null
    : provider === "gemini"
      ? await getDecryptedGeminiApiKey(userId) || system.geminiApiKey || process.env.GEMINI_API_KEY || null
      : provider === "openrouter" || provider === "agent"
        ? await getDecryptedOpenrouterApiKey(userId) || system.openrouterApiKey || process.env.OPENROUTER_API_KEY || null
        : null;
  const model = modelPreference || (provider === "openai" ? settings.openaiModel || system.openaiModel : provider === "gemini" ? settings.geminiModel || system.geminiModel : settings.openrouterModel || system.openrouterModel) || defaultModelForProvider(provider);
  return {
    provider,
    credentialSource: apiKey ? "PLATFORM" as const : "ENVIRONMENT" as const,
    credentialId: null,
    apiKey,
    model,
    billingScope: "PLATFORM" as const,
    hardLimit: true,
    alertThresholds: [],
    allowAgentWrites: true,
    fallbackAllowed: true,
    workspaceId: null,
    task: "chat" as const,
  };
}

function defaultModelForProvider(provider: ExecutableProviderId): string {
  if (provider === "openai") return process.env.OPENAI_MODEL ?? "gpt-5-mini";
  if (provider === "gemini") return process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  if (provider === "openrouter" || provider === "agent") return process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3-0324:free";
  return "llama3.1";
}

function resolveDeps(deps: Partial<ExecuteAiTaskDeps> | undefined): ExecuteAiTaskDeps {
  return {
    buildKhipuAssembledContext,
    providers: { ...DEFAULT_PROVIDERS, ...deps?.providers },
    ...deps,
  };
}

function buildProviderRequest({ assembledContext, payload, task, userId, projectId }: Parameters<typeof buildSkillProviderRequest>[0] & { projectId?: string }): AiProviderRequest {
  return {
    ...buildSkillProviderRequest({ assembledContext, task, payload, userId }),
    projectId,
  };
}
