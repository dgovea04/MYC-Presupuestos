import type { AiCredentialStatus, AiCredentialProvider } from "@/lib/ai/credentials/types";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { decryptApiKey } from "@/lib/ai/encryption";
import { validateAiProviderCredential } from "@/lib/ai/credentials/validation-service";
import { recordAiCredentialAudit } from "@/lib/ai/credentials/audit";

export type AiCredentialHealth = "HEALTHY" | "DEGRADED" | "INVALID" | "REVOKED" | "UNKNOWN";

export function getAiCredentialHealth(input: {
  status: AiCredentialStatus;
  lastValidatedAt: Date | null;
  lastError: string | null;
  now?: Date;
  staleAfterMs?: number;
}): AiCredentialHealth {
  if (input.status === "REVOKED") return "REVOKED";
  if (input.status === "INVALID") return "INVALID";
  if (input.lastError) return "DEGRADED";
  if (!input.lastValidatedAt) return "UNKNOWN";
  const age = (input.now ?? new Date()).getTime() - input.lastValidatedAt.getTime();
  return age <= (input.staleAfterMs ?? 24 * 60 * 60 * 1000) ? "HEALTHY" : "DEGRADED";
}

export async function validateStoredAiCredential(options: {
  credentialId: string;
  actorUserId?: string | null;
  prisma?: typeof defaultPrisma;
}) {
  const client = options.prisma ?? defaultPrisma;
  const credential = await client.aiCredential.findUnique({ where: { id: options.credentialId } });
  if (!credential) throw new Error("Credencial no encontrada.");
  if (credential.status === "REVOKED") throw new Error("No se puede validar una credencial revocada.");
  if (!credential.encryptedSecret) throw new Error("La credencial no tiene un secreto almacenado.");

  const apiKey = decryptApiKey(credential.encryptedSecret);
  const result = await validateAiProviderCredential({ provider: credential.provider as AiCredentialProvider, apiKey });
  const updated = await client.aiCredential.update({
    where: { id: credential.id },
    data: {
      status: result.valid ? "ACTIVE" : "INVALID",
      lastValidatedAt: new Date(),
      lastError: result.errorCode,
    },
  });
  await recordAiCredentialAudit({
    operation: "TESTED",
    actorUserId: options.actorUserId,
    workspaceId: credential.workspaceId,
    credentialId: credential.id,
    provider: credential.provider as AiCredentialProvider,
    success: result.valid,
    errorCode: result.errorCode,
  }, client);
  return { credential: updated, validation: result };
}

export async function invalidateStaleAiCredentials(options: {
  staleAfterMs?: number;
  prisma?: typeof defaultPrisma;
}) {
  const client = options.prisma ?? defaultPrisma;
  const cutoff = new Date(Date.now() - (options.staleAfterMs ?? 24 * 60 * 60 * 1000));
  const result = await client.aiCredential.updateMany({
    where: { status: "ACTIVE", OR: [{ lastValidatedAt: null }, { lastValidatedAt: { lt: cutoff } }] },
    data: { status: "INVALID", lastError: "CREDENTIAL_VALIDATION_STALE" },
  });
  return { invalidated: result.count, cutoff };
}
