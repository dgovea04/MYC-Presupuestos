import { prisma } from "@/lib/db/prisma";
import { decryptApiKey, encryptApiKey, maskApiKey } from "@/lib/ai/encryption";
import { getAiProviderSettings } from "@/lib/data/settings";
import { getSystemSettings } from "@/lib/data/system-settings";
import { aiCredentialInputSchema, type AiCredentialInput, type AiCredentialProvider, type AiCredentialScope } from "@/lib/ai/credentials/types";
import { getAiCredentialHealth } from "@/lib/ai/credentials/lifecycle";

export type SafeAiCredential = {
  id: string; scope: AiCredentialScope; workspaceId: string | null; teamId: string | null; projectId: string | null; userId: string | null;
  provider: AiCredentialProvider; maskedValue: string; status: "ACTIVE" | "INVALID" | "REVOKED"; isFallback: boolean;
  lastValidatedAt: Date | null; lastError: string | null; health: "HEALTHY" | "DEGRADED" | "INVALID" | "REVOKED" | "UNKNOWN";
};

export async function listScopedAiCredentials(options: { userId?: string; workspaceId?: string; scope?: AiCredentialScope; provider?: AiCredentialProvider; teamId?: string; projectId?: string }): Promise<SafeAiCredential[]> {
  const rows = await prisma.aiCredential.findMany({ where: { scope: options.scope, provider: options.provider, workspaceId: options.workspaceId, teamId: options.teamId, projectId: options.projectId, ...(options.userId ? { userId: options.userId } : {}) }, orderBy: { updatedAt: "desc" } });
  return rows.map(toSafeCredential);
}

export async function createScopedAiCredential(options: { actorUserId: string; input: AiCredentialInput }): Promise<SafeAiCredential> {
  const parsed = aiCredentialInputSchema.parse(options.input);
  await ensureScopePermission(options.actorUserId, parsed.scope, parsed.workspaceId ?? null, parsed.userId ?? null, parsed.teamId ?? null, parsed.projectId ?? null);
  const created = await prisma.aiCredential.create({ data: { scope: parsed.scope, workspaceId: parsed.workspaceId ?? null, teamId: parsed.teamId ?? null, projectId: parsed.projectId ?? null, userId: parsed.userId ?? null, provider: parsed.provider, encryptedSecret: encryptApiKey(parsed.apiKey), maskedValue: maskApiKey(parsed.apiKey), isFallback: parsed.isFallback, createdByUserId: options.actorUserId } });
  return toSafeCredential(created);
}

export async function rotateScopedAiCredential(options: { actorUserId: string; credentialId: string; apiKey: string; expectedWorkspaceId?: string }): Promise<SafeAiCredential> {
  const existing = await prisma.aiCredential.findUnique({ where: { id: options.credentialId } });
  if (!existing) throw new Error("Credencial no encontrada.");
  if (options.expectedWorkspaceId && existing.workspaceId !== options.expectedWorkspaceId) throw new Error("La credencial no pertenece a este workspace.");
  await ensureScopePermission(options.actorUserId, existing.scope, existing.workspaceId, existing.userId, existing.teamId, existing.projectId);
  const apiKey = options.apiKey.trim(); if (!apiKey) throw new Error("La API key no puede estar vacía.");
  const updated = await prisma.aiCredential.update({ where: { id: existing.id }, data: { encryptedSecret: encryptApiKey(apiKey), maskedValue: maskApiKey(apiKey), status: "ACTIVE", lastError: null, rotatedAt: new Date() } });
  return toSafeCredential(updated);
}

export async function revokeScopedAiCredential(options: { actorUserId: string; credentialId: string; expectedWorkspaceId?: string }): Promise<SafeAiCredential> {
  const existing = await prisma.aiCredential.findUnique({ where: { id: options.credentialId } });
  if (!existing) throw new Error("Credencial no encontrada.");
  if (options.expectedWorkspaceId && existing.workspaceId !== options.expectedWorkspaceId) throw new Error("La credencial no pertenece a este workspace.");
  await ensureScopePermission(options.actorUserId, existing.scope, existing.workspaceId, existing.userId, existing.teamId, existing.projectId);
  const updated = await prisma.aiCredential.update({ where: { id: existing.id }, data: { status: "REVOKED", encryptedSecret: null, secretReference: null } });
  return toSafeCredential(updated);
}

export function decryptStoredCredential(row: { encryptedSecret: string | null }): string { return row.encryptedSecret ? decryptApiKey(row.encryptedSecret) : ""; }

export async function readLegacyCredential(provider: AiCredentialProvider, scope: "USER" | "PLATFORM", userId: string) {
  if (scope === "USER") { const settings = await getAiProviderSettings(userId); const masked = provider === "OPENAI" ? settings.openaiApiKeyMasked : provider === "GEMINI" ? settings.geminiApiKeyMasked : settings.openrouterApiKeyMasked; const apiKey = provider === "OPENAI" ? await getLegacyUserKey(userId, "openai") : provider === "GEMINI" ? await getLegacyUserKey(userId, "gemini") : await getLegacyUserKey(userId, "openrouter"); return apiKey ? { id: null as string | null, apiKey, masked } : null; }
  const settings = await getSystemSettings(); const apiKey = provider === "OPENAI" ? settings.openaiApiKey : provider === "GEMINI" ? settings.geminiApiKey : settings.openrouterApiKey; return apiKey ? { id: null as string | null, apiKey, masked: maskApiKey(apiKey) } : null;
}
async function getLegacyUserKey(userId: string, provider: "openai" | "gemini" | "openrouter") { const settings = await getAiProviderSettings(userId); if (provider === "openai") return settings.openaiConfigured ? (await import("@/lib/data/settings")).getDecryptedOpenaiApiKey(userId) : ""; if (provider === "gemini") return settings.geminiConfigured ? (await import("@/lib/data/settings")).getDecryptedGeminiApiKey(userId) : ""; return settings.openrouterConfigured ? (await import("@/lib/data/settings")).getDecryptedOpenrouterApiKey(userId) : ""; }

function toSafeCredential(row: { id: string; scope: AiCredentialScope; workspaceId: string | null; teamId?: string | null; projectId?: string | null; userId: string | null; provider: AiCredentialProvider; maskedValue: string; status: "ACTIVE" | "INVALID" | "REVOKED"; isFallback: boolean; lastValidatedAt: Date | null; lastError: string | null }): SafeAiCredential { return { id: row.id, scope: row.scope, workspaceId: row.workspaceId, teamId: row.teamId ?? null, projectId: row.projectId ?? null, userId: row.userId, provider: row.provider, maskedValue: row.maskedValue, status: row.status, isFallback: row.isFallback, lastValidatedAt: row.lastValidatedAt, lastError: row.lastError, health: getAiCredentialHealth({ status: row.status, lastValidatedAt: row.lastValidatedAt, lastError: row.lastError }) }; }

async function ensureScopePermission(userId: string, scope: AiCredentialScope, workspaceId: string | null, ownerUserId: string | null = null, teamId: string | null = null, projectId: string | null = null) {
  if (scope === "PLATFORM") { const user = await prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true, role: true } }); if (!user || (!user.isSuperAdmin && user.role !== "ADMIN")) throw new Error("No autorizado para credenciales de plataforma."); return; }
  if (!workspaceId) throw new Error("Workspace requerido.");
  const membership = await prisma.companyMembership.findUnique({ where: { companyId_userId: { companyId: workspaceId, userId } }, select: { role: true, status: true } });
  if (!membership || membership.status !== "ACTIVE" || (membership.role !== "OWNER" && membership.role !== "ADMIN")) throw new Error("No autorizado para credenciales del workspace.");
  if (scope === "USER") { if (!ownerUserId || ownerUserId !== userId) throw new Error("Solo el propietario puede administrar una credencial USER."); return; }
  if (scope === "TEAM") { if (!teamId) throw new Error("Equipo requerido."); const team = await prisma.workspaceTeam.findUnique({ where: { id: teamId }, select: { companyId: true } }); if (!team || team.companyId !== workspaceId) throw new Error("El equipo no pertenece al workspace."); return; }
  if (scope === "PROJECT") { if (!projectId) throw new Error("Proyecto requerido."); const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } }); if (!project || project.companyId !== workspaceId) throw new Error("El proyecto no pertenece al workspace."); }
}
