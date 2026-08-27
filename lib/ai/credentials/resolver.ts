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
import { assertGovernanceContext } from "@/lib/ai/project-governance";

export class AiCredentialResolutionError extends Error {
  readonly statusCode = 403;
  constructor(message: string) { super(message); this.name = "AiCredentialResolutionError"; }
}
type ResolverPrisma = typeof defaultPrisma;
type CredentialRow = { id: string; provider: AiCredentialProvider; encryptedSecret: string | null; status: "ACTIVE" | "INVALID" | "REVOKED" };

export async function resolveAiCredential({ userId, workspaceId: requestedWorkspaceId, projectId, teamId, provider, task, modelPreference, prisma = defaultPrisma }: {
  userId: string; workspaceId?: string | null; projectId?: string | null; teamId?: string | null; provider: AiProviderId; task: KhipuAiTask; modelPreference?: string; prisma?: ResolverPrisma;
}): Promise<ResolvedAiCredential> {
  const workspaceId = requestedWorkspaceId === undefined ? await getActiveWorkspaceId(userId) : requestedWorkspaceId;
  if (workspaceId) {
    assertGovernanceContext({ userId, workspaceId, projectId, teamId });
    await assertResolutionContext({ userId, workspaceId, projectId, teamId, prisma });
  }
  const effectiveProvider = resolveAiProvider({ provider, task });
  const policy = workspaceId ? await getEffectiveAiPolicy({ userId, workspaceId, prisma }) : null;
  if (policy) await assertAiPolicyAllows({ policy, provider: effectiveProvider, task, model: modelPreference });
  const credentialProvider = providerToCredentialProvider(effectiveProvider);
  const model = modelPreference ?? (await resolveModelPreference(userId, effectiveProvider)) ?? defaultModelForProvider(effectiveProvider);
  if (!credentialProvider) return buildEnvironmentResolution(effectiveProvider, model, policy, workspaceId, task);
  if (!workspaceId) return buildLegacyResolution(userId, credentialProvider, effectiveProvider, modelPreference, task);

  const candidates = buildCandidateScopes({ projectId, teamId, mode: policy?.mode ?? "PLATFORM", allowUserKeys: policy?.allowUserKeys ?? false, allowWorkspaceKey: policy?.allowWorkspaceKey ?? false, fallbackEnabled: policy?.fallbackEnabled ?? true });
  for (const candidate of candidates) {
    const credential = await readScopedCredential({ provider: credentialProvider, scope: candidate.scope, userId, workspaceId, projectId, teamId, prisma });
    if (credential) return { provider: effectiveProvider, credentialSource: candidate.source, credentialId: credential.id, apiKey: credential.apiKey, model, billingScope: candidate.billingScope, tokenLimit: candidate.billingScope === "WORKSPACE" ? policy?.workspaceTokenLimit ?? null : candidate.billingScope === "USER" ? policy?.userTokenLimit ?? null : null, budgetLimitMinor: candidate.billingScope === "WORKSPACE" ? policy?.monthlyBudgetMinor ?? null : candidate.billingScope === "USER" ? policy?.monthlyBudgetMinor ?? null : null, hardLimit: policy?.hardLimit ?? true, alertThresholds: policy?.alertThresholds ?? [], allowAgentWrites: policy?.allowAgentWrites ?? true, fallbackAllowed: candidate.fallbackAllowed, workspaceId, task };
  }
  const environmentKey = getEnvironmentKey(effectiveProvider);
  if (environmentKey && candidates.some((candidate) => candidate.allowEnvironment)) return { provider: effectiveProvider, credentialSource: "ENVIRONMENT", credentialId: null, apiKey: environmentKey, model, billingScope: "PLATFORM", tokenLimit: policy?.workspaceTokenLimit ?? null, hardLimit: policy?.hardLimit ?? true, alertThresholds: policy?.alertThresholds ?? [], allowAgentWrites: policy?.allowAgentWrites ?? true, fallbackAllowed: policy?.fallbackEnabled ?? true, workspaceId, task };
  if (policy?.mode === "BYOK_ONLY") throw new AiCredentialResolutionError("Este workspace exige una API key propia del usuario para este proveedor.");
  return { provider: effectiveProvider, credentialSource: "PLATFORM", credentialId: null, apiKey: null, model, billingScope: "PLATFORM", tokenLimit: null, hardLimit: policy?.hardLimit ?? true, alertThresholds: policy?.alertThresholds ?? [], allowAgentWrites: policy?.allowAgentWrites ?? true, fallbackAllowed: policy?.fallbackEnabled ?? true, workspaceId, task };
}

function buildEnvironmentResolution(provider: Exclude<AiProviderId, "auto">, model: string, policy: Awaited<ReturnType<typeof getEffectiveAiPolicy>> | null, workspaceId: string | null, task: KhipuAiTask): ResolvedAiCredential {
  if (provider === "ollama" && process.env.NODE_ENV === "production") throw new AiCredentialResolutionError("Ollama solo está disponible en la aplicación local.");
  return { provider, credentialSource: "ENVIRONMENT", credentialId: null, apiKey: null, model, billingScope: "PLATFORM", tokenLimit: policy?.workspaceTokenLimit ?? null, hardLimit: policy?.hardLimit ?? true, alertThresholds: policy?.alertThresholds ?? [], allowAgentWrites: policy?.allowAgentWrites ?? true, fallbackAllowed: policy?.fallbackEnabled ?? true, workspaceId, task };
}
async function buildLegacyResolution(userId: string, credentialProvider: AiCredentialProvider, provider: Exclude<AiProviderId, "auto">, modelPreference: string | undefined, task: KhipuAiTask): Promise<ResolvedAiCredential> {
  const legacy = await readLegacyCredential({ provider: credentialProvider, scope: "USER", userId }) ?? await readLegacyCredential({ provider: credentialProvider, scope: "PLATFORM", userId });
  return { provider, credentialSource: legacy?.id ? "USER" : "PLATFORM", credentialId: legacy?.id ?? null, apiKey: legacy?.apiKey ?? null, model: modelPreference ?? "", billingScope: legacy?.id ? "USER" : "PLATFORM", hardLimit: true, alertThresholds: [], allowAgentWrites: true, fallbackAllowed: true, workspaceId: null, task };
}
function buildCandidateScopes(input: { mode: "PLATFORM" | "WORKSPACE" | "BYOK_ALLOWED" | "BYOK_ONLY"; projectId?: string | null; teamId?: string | null; allowUserKeys: boolean; allowWorkspaceKey: boolean; fallbackEnabled: boolean }) {
  type Candidate = { scope: "USER" | "WORKSPACE" | "TEAM" | "PROJECT" | "PLATFORM"; source: "USER" | "WORKSPACE" | "PLATFORM"; billingScope: "USER" | "WORKSPACE" | "PLATFORM"; fallbackAllowed: boolean; allowEnvironment: boolean };
  const candidates: Candidate[] = [];
  if (input.projectId) candidates.push({ scope: "PROJECT", source: "WORKSPACE", billingScope: "WORKSPACE", fallbackAllowed: input.fallbackEnabled, allowEnvironment: false });
  if (input.teamId) candidates.push({ scope: "TEAM", source: "WORKSPACE", billingScope: "WORKSPACE", fallbackAllowed: input.fallbackEnabled, allowEnvironment: false });
  if (input.mode === "BYOK_ALLOWED" || input.mode === "BYOK_ONLY") { if (input.allowUserKeys) candidates.push({ scope: "USER", source: "USER", billingScope: "USER", fallbackAllowed: input.mode !== "BYOK_ONLY", allowEnvironment: false }); if (input.mode === "BYOK_ONLY") return candidates; if (input.allowWorkspaceKey) candidates.push({ scope: "WORKSPACE", source: "WORKSPACE", billingScope: "WORKSPACE", fallbackAllowed: input.fallbackEnabled, allowEnvironment: false }); if (input.fallbackEnabled) candidates.push({ scope: "PLATFORM", source: "PLATFORM", billingScope: "PLATFORM", fallbackAllowed: true, allowEnvironment: true }); return candidates; }
  if (input.mode === "WORKSPACE") { if (input.allowWorkspaceKey) candidates.push({ scope: "WORKSPACE", source: "WORKSPACE", billingScope: "WORKSPACE", fallbackAllowed: input.fallbackEnabled, allowEnvironment: false }); if (input.fallbackEnabled) candidates.push({ scope: "PLATFORM", source: "PLATFORM", billingScope: "PLATFORM", fallbackAllowed: true, allowEnvironment: true }); return candidates; }
  candidates.push({ scope: "PLATFORM", source: "PLATFORM", billingScope: "PLATFORM", fallbackAllowed: input.fallbackEnabled, allowEnvironment: true }); return candidates;
}
async function readScopedCredential(input: { provider: AiCredentialProvider; scope: "USER" | "WORKSPACE" | "TEAM" | "PROJECT" | "PLATFORM"; userId: string; workspaceId: string; projectId?: string | null; teamId?: string | null; prisma: ResolverPrisma }) {
  const ownership = input.scope === "USER" ? { userId: input.userId, workspaceId: null, teamId: null, projectId: null } : input.scope === "WORKSPACE" ? { workspaceId: input.workspaceId, userId: null, teamId: null, projectId: null } : input.scope === "TEAM" ? { teamId: input.teamId, userId: null, projectId: null } : input.scope === "PROJECT" ? { projectId: input.projectId, userId: null, teamId: null } : { workspaceId: null, userId: null, teamId: null, projectId: null };
  const rows = await input.prisma.aiCredential.findMany({ where: { provider: input.provider, scope: input.scope as "USER" | "WORKSPACE" | "PLATFORM", status: "ACTIVE", isFallback: false, ...ownership }, orderBy: { updatedAt: "desc" }, take: 1 });
  const row = rows[0] as CredentialRow | undefined;
  if (!row && isLegacyAiCredentialFallbackEnabled() && (input.scope === "USER" || input.scope === "PLATFORM")) return readLegacyCredential({ provider: input.provider, scope: input.scope, userId: input.userId });
  if (!row) return null;
  const apiKey = decryptStoredCredential(row);
  return apiKey ? { id: row.id, apiKey } : null;
}
async function assertResolutionContext(input: { userId: string; workspaceId: string; projectId?: string | null; teamId?: string | null; prisma: ResolverPrisma }) {
  const membership = await input.prisma.companyMembership.findUnique({ where: { companyId_userId: { companyId: input.workspaceId, userId: input.userId } }, select: { status: true } });
  if (!membership || membership.status !== "ACTIVE") throw new AiCredentialResolutionError("No tienes una membresía activa en este workspace.");
  if (input.projectId) { const project = await input.prisma.project.findUnique({ where: { id: input.projectId }, select: { companyId: true } }); if (!project || project.companyId !== input.workspaceId) throw new AiCredentialResolutionError("El proyecto no pertenece al workspace seleccionado."); }
  if (input.teamId) { const team = await input.prisma.workspaceTeam.findUnique({ where: { id: input.teamId }, select: { companyId: true } }); if (!team || team.companyId !== input.workspaceId) throw new AiCredentialResolutionError("El equipo no pertenece al workspace seleccionado."); const teamMember = await input.prisma.workspaceTeamMember.findUnique({ where: { teamId_userId: { teamId: input.teamId, userId: input.userId } }, select: { id: true } }); if (!teamMember) throw new AiCredentialResolutionError("No perteneces al equipo seleccionado."); }
}
async function readLegacyCredential(input: { provider: AiCredentialProvider; scope: "USER" | "PLATFORM"; userId: string }) { if (input.scope === "USER") { const apiKey = input.provider === "OPENAI" ? await getDecryptedOpenaiApiKey(input.userId) : input.provider === "GEMINI" ? await getDecryptedGeminiApiKey(input.userId) : await getDecryptedOpenrouterApiKey(input.userId); return apiKey ? { id: null as string | null, apiKey } : null; } const settings = await getSystemSettings(); const apiKey = input.provider === "OPENAI" ? settings.openaiApiKey : input.provider === "GEMINI" ? settings.geminiApiKey : settings.openrouterApiKey; return apiKey ? { id: null as string | null, apiKey } : null; }
async function resolveModelPreference(userId: string, provider: AiProviderId): Promise<string | undefined> { const [userSettings, systemSettings] = await Promise.all([getAiProviderSettings(userId), getSystemSettings()]); if (provider === "openai") return userSettings.openaiModel || systemSettings.openaiModel || undefined; if (provider === "gemini") return userSettings.geminiModel || systemSettings.geminiModel || undefined; if (provider === "openrouter" || provider === "agent") return userSettings.openrouterModel || systemSettings.openrouterModel || undefined; return undefined; }
function defaultModelForProvider(provider: AiProviderId) { if (provider === "openai") return process.env.OPENAI_MODEL ?? "gpt-5-mini"; if (provider === "gemini") return process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite"; if (provider === "openrouter" || provider === "agent") return process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3-0324:free"; return "llama3.1"; }
function getEnvironmentKey(provider: AiProviderId) { if (provider === "openai") return process.env.OPENAI_API_KEY ?? null; if (provider === "gemini") return process.env.GEMINI_API_KEY ?? null; if (provider === "openrouter" || provider === "agent") return process.env.OPENROUTER_API_KEY ?? null; return null; }
