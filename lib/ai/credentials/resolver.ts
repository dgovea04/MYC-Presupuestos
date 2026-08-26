import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveAiPolicy, assertAiPolicyAllows } from "@/lib/ai/credentials/policy-service";
import { decryptStoredCredential } from "@/lib/ai/credentials/credential-service";
import { providerToCredentialProvider, type ResolvedAiCredential, type AiCredentialProvider } from "@/lib/ai/credentials/types";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { getAiProviderSettings, getDecryptedGeminiApiKey, getDecryptedOpenaiApiKey, getDecryptedOpenrouterApiKey } from "@/lib/data/settings";
import { getSystemSettings } from "@/lib/data/system-settings";
import { resolveAiProvider } from "@/lib/ai/gateway/router";
import type { AiProviderId, KhipuAiTask } from "@/lib/ai/gateway/types";
import { isLegacyAiCredentialFallbackEnabled } from "@/lib/ai/credentials/rollout";

export class AiCredentialResolutionError extends Error {
  readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = "AiCredentialResolutionError";
  }
}

type ResolverPrisma = typeof defaultPrisma;

type CredentialRow = {
  id: string;
  provider: AiCredentialProvider;
  encryptedSecret: string | null;
  status: "ACTIVE" | "INVALID" | "REVOKED";
};

export async function resolveAiCredential({
  userId,
  workspaceId: requestedWorkspaceId,
  provider,
  task,
  modelPreference,
  prisma = defaultPrisma,
}: {
  userId: string;
  workspaceId?: string | null;
  provider: AiProviderId;
  task: KhipuAiTask;
  modelPreference?: string;
  prisma?: ResolverPrisma;
}): Promise<ResolvedAiCredential> {
  const workspaceId = requestedWorkspaceId === undefined ? await getActiveWorkspaceId(userId) : requestedWorkspaceId;
  const effectiveProvider = resolveAiProvider({ provider, task });
  const policy = workspaceId
    ? await getEffectiveAiPolicy({ userId, workspaceId, prisma })
    : null;

  if (policy) {
    await assertAiPolicyAllows({ policy, provider: effectiveProvider, task, model: modelPreference });
  }

  const credentialProvider = providerToCredentialProvider(effectiveProvider);
  const model = modelPreference ?? (await resolveModelPreference(userId, effectiveProvider)) ?? defaultModelForProvider(effectiveProvider);
  if (!credentialProvider) {
    if (effectiveProvider === "ollama" && process.env.NODE_ENV === "production") {
      throw new AiCredentialResolutionError("Ollama solo está disponible en la aplicación local.");
    }
    return {
      provider: effectiveProvider,
      credentialSource: "ENVIRONMENT",
      credentialId: null,
      apiKey: null,
      model,
      billingScope: "PLATFORM",
      tokenLimit: policy?.workspaceTokenLimit ?? null,
      hardLimit: policy?.hardLimit ?? true,
      alertThresholds: policy?.alertThresholds ?? [],
      allowAgentWrites: policy?.allowAgentWrites ?? true,
      fallbackAllowed: policy?.fallbackEnabled ?? true,
      workspaceId,
      task,
    };
  }

  if (!workspaceId) {
    const legacyCredential = await readLegacyCredential({ provider: credentialProvider, scope: "USER", userId })
      ?? await readLegacyCredential({ provider: credentialProvider, scope: "PLATFORM", userId });
    return {
      provider: effectiveProvider,
      credentialSource: legacyCredential ? (legacyCredential.id ? "USER" : "PLATFORM") : "PLATFORM",
      credentialId: legacyCredential?.id ?? null,
      apiKey: legacyCredential?.apiKey ?? null,
      model: modelPreference ?? (await resolveModelPreference(userId, effectiveProvider)) ?? "",
      billingScope: legacyCredential?.id ? "USER" : "PLATFORM",
      hardLimit: true,
      alertThresholds: [],
      allowAgentWrites: true,
      fallbackAllowed: true,
      workspaceId: null,
      task,
    };
  }

  const candidates = buildCandidateScopes({
    mode: policy?.mode ?? "PLATFORM",
    allowUserKeys: policy?.allowUserKeys ?? false,
    allowWorkspaceKey: policy?.allowWorkspaceKey ?? false,
    fallbackEnabled: policy?.fallbackEnabled ?? true,
  });

  for (const candidate of candidates) {
    const credential = await readScopedCredential({
      provider: credentialProvider,
      scope: candidate.scope,
      userId,
      workspaceId,
      prisma,
    });
    if (credential) {
      return {
        provider: effectiveProvider,
        credentialSource: candidate.source,
        credentialId: credential.id,
        apiKey: credential.apiKey,
        model,
        billingScope: candidate.billingScope,
        tokenLimit: candidate.billingScope === "WORKSPACE" ? policy?.workspaceTokenLimit ?? null : candidate.billingScope === "USER" ? policy?.userTokenLimit ?? null : null,
        budgetLimitMinor: candidate.billingScope === "WORKSPACE" ? policy?.monthlyBudgetMinor ?? null : candidate.billingScope === "USER" ? policy?.monthlyBudgetMinor ?? null : null,
        hardLimit: policy?.hardLimit ?? true,
        alertThresholds: policy?.alertThresholds ?? [],
        allowAgentWrites: policy?.allowAgentWrites ?? true,
        fallbackAllowed: candidate.fallbackAllowed,
        workspaceId,
        task,
      };
    }
  }

  const environmentKey = getEnvironmentKey(effectiveProvider);
  if (environmentKey && candidates.some((candidate) => candidate.allowEnvironment)) {
    return {
      provider: effectiveProvider,
      credentialSource: "ENVIRONMENT",
      credentialId: null,
      apiKey: environmentKey,
      model,
      billingScope: "PLATFORM",
      tokenLimit: policy?.workspaceTokenLimit ?? null,
      hardLimit: policy?.hardLimit ?? true,
      alertThresholds: policy?.alertThresholds ?? [],
      allowAgentWrites: policy?.allowAgentWrites ?? true,
      fallbackAllowed: policy?.fallbackEnabled ?? true,
      workspaceId,
      task,
    };
  }

  if (policy?.mode === "BYOK_ONLY") {
    throw new AiCredentialResolutionError("Este workspace exige una API key propia del usuario para este proveedor.");
  }

  return {
    provider: effectiveProvider,
    credentialSource: "PLATFORM",
    credentialId: null,
    apiKey: null,
    model,
    billingScope: "PLATFORM",
    tokenLimit: null,
    hardLimit: policy?.hardLimit ?? true,
    alertThresholds: policy?.alertThresholds ?? [],
    allowAgentWrites: policy?.allowAgentWrites ?? true,
    fallbackAllowed: policy?.fallbackEnabled ?? true,
    workspaceId,
    task,
  };
}

function buildCandidateScopes({
  mode,
  allowUserKeys,
  allowWorkspaceKey,
  fallbackEnabled,
}: {
  mode: "PLATFORM" | "WORKSPACE" | "BYOK_ALLOWED" | "BYOK_ONLY";
  allowUserKeys: boolean;
  allowWorkspaceKey: boolean;
  fallbackEnabled: boolean;
}) {
  type Candidate = {
    scope: "USER" | "WORKSPACE" | "PLATFORM";
    source: "USER" | "WORKSPACE" | "PLATFORM";
    billingScope: "USER" | "WORKSPACE" | "PLATFORM";
    fallbackAllowed: boolean;
    allowEnvironment: boolean;
  };
  const candidates: Candidate[] = [];
  if (mode === "BYOK_ALLOWED" || mode === "BYOK_ONLY") {
    if (allowUserKeys) candidates.push({ scope: "USER", source: "USER", billingScope: "USER", fallbackAllowed: mode !== "BYOK_ONLY", allowEnvironment: false });
    if (mode === "BYOK_ONLY") return candidates;
    if (allowWorkspaceKey) candidates.push({ scope: "WORKSPACE", source: "WORKSPACE", billingScope: "WORKSPACE", fallbackAllowed: fallbackEnabled, allowEnvironment: false });
    if (fallbackEnabled) candidates.push({ scope: "PLATFORM", source: "PLATFORM", billingScope: "PLATFORM", fallbackAllowed: true, allowEnvironment: true });
    return candidates;
  }
  if (mode === "WORKSPACE") {
    if (allowWorkspaceKey) candidates.push({ scope: "WORKSPACE", source: "WORKSPACE", billingScope: "WORKSPACE", fallbackAllowed: fallbackEnabled, allowEnvironment: false });
    if (fallbackEnabled) candidates.push({ scope: "PLATFORM", source: "PLATFORM", billingScope: "PLATFORM", fallbackAllowed: true, allowEnvironment: true });
    return candidates;
  }
  candidates.push({ scope: "PLATFORM", source: "PLATFORM", billingScope: "PLATFORM", fallbackAllowed: fallbackEnabled, allowEnvironment: true });
  return candidates;
}

async function readScopedCredential({
  provider,
  scope,
  userId,
  workspaceId,
  prisma,
}: {
  provider: AiCredentialProvider;
  scope: "USER" | "WORKSPACE" | "PLATFORM";
  userId: string;
  workspaceId: string | null;
  prisma: ResolverPrisma;
}): Promise<{ id: string | null; apiKey: string } | null> {
  const rows = await prisma.aiCredential.findMany({
    where: {
      provider,
      scope,
      status: "ACTIVE",
      isFallback: false,
      ...(scope === "USER" ? { userId, workspaceId: null } : {}),
      ...(scope === "WORKSPACE" ? { workspaceId, userId: null } : {}),
      ...(scope === "PLATFORM" ? { workspaceId: null, userId: null } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 1,
  });
  const row = rows[0] as CredentialRow | undefined;
  if (!row && isLegacyAiCredentialFallbackEnabled()) {
    return readLegacyCredential({ provider, scope, userId });
  }
  if (!row) return null;
  const apiKey = decryptStoredCredential(row);
  return apiKey ? { id: row.id, apiKey } : null;
}

async function readLegacyCredential({ provider, scope, userId }: { provider: AiCredentialProvider; scope: "USER" | "WORKSPACE" | "PLATFORM"; userId: string }) {
  if (scope === "USER") {
    const apiKey = provider === "OPENAI"
      ? await getDecryptedOpenaiApiKey(userId)
      : provider === "GEMINI"
        ? await getDecryptedGeminiApiKey(userId)
        : await getDecryptedOpenrouterApiKey(userId);
    return apiKey ? { id: null as string | null, apiKey } : null;
  }
  if (scope === "PLATFORM") {
    const settings = await getSystemSettings();
    const apiKey = provider === "OPENAI" ? settings.openaiApiKey : provider === "GEMINI" ? settings.geminiApiKey : settings.openrouterApiKey;
    return apiKey ? { id: null as string | null, apiKey } : null;
  }
  return null;
}

async function resolveModelPreference(userId: string, provider: AiProviderId): Promise<string | undefined> {
  const [userSettings, systemSettings] = await Promise.all([getAiProviderSettings(userId), getSystemSettings()]);
  if (provider === "openai") return userSettings.openaiModel || systemSettings.openaiModel || undefined;
  if (provider === "gemini") return userSettings.geminiModel || systemSettings.geminiModel || undefined;
  if (provider === "openrouter" || provider === "agent") return userSettings.openrouterModel || systemSettings.openrouterModel || undefined;
  return undefined;
}

function defaultModelForProvider(provider: AiProviderId): string {
  if (provider === "openai") return process.env.OPENAI_MODEL ?? "gpt-5-mini";
  if (provider === "gemini") return process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  if (provider === "openrouter" || provider === "agent") return process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3-0324:free";
  return "llama3.1";
}

function getEnvironmentKey(provider: AiProviderId): string | null {
  if (provider === "openai") return process.env.OPENAI_API_KEY ?? null;
  if (provider === "gemini") return process.env.GEMINI_API_KEY ?? null;
  if (provider === "openrouter" || provider === "agent") return process.env.OPENROUTER_API_KEY ?? null;
  return null;
}
