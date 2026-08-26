import type { AiCredentialAuditOperation, AiCredentialProvider, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";

export async function recordAiCredentialAudit(input: {
  operation: AiCredentialAuditOperation;
  actorUserId?: string | null;
  workspaceId?: string | null;
  credentialId?: string | null;
  provider?: AiCredentialProvider | null;
  success?: boolean;
  errorCode?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}, client: Pick<PrismaClient, "aiCredentialAuditEvent"> = defaultPrisma) {
  return client.aiCredentialAuditEvent.create({
    data: {
      operation: input.operation,
      actorUserId: input.actorUserId ?? null,
      workspaceId: input.workspaceId ?? null,
      credentialId: input.credentialId ?? null,
      provider: input.provider ?? null,
      success: input.success ?? true,
      errorCode: input.errorCode ?? null,
      metadata: input.metadata ?? {},
    },
  });
}
