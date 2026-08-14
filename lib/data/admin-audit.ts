import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

export type AdminAuditInput = {
  actorUserId: string | null;
  targetUserId: string | null;
  targetEmail: string;
  action: string;
  detail?: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function recordAdminAudit(input: AdminAuditInput, client: typeof prisma = prisma) {
  await client.$executeRaw`
    INSERT INTO "admin_audit_logs" (
      "id", "actorUserId", "targetUserId", "targetEmail", "action", "detail", "metadata", "ipAddress", "userAgent"
    )
    VALUES (
      ${randomUUID()},
      ${input.actorUserId},
      ${input.targetUserId},
      ${input.targetEmail},
      ${input.action},
      ${input.detail ?? null},
      CAST(${input.metadata ? JSON.stringify(input.metadata) : null} AS jsonb),
      ${input.ipAddress ?? null},
      ${input.userAgent ?? null}
    )
  `;
}
