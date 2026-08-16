import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { assignBetaGrant, previewBetaAssignments } from "@/lib/beta/assignments";
import { BetaGrantSource } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { getWorkspaceLicenseCacheTag } from "@/lib/workspace/entitlements";

const assignmentSchema = z.object({
  userIds: z.array(z.string().trim().min(1)).min(1).max(50),
  source: z.enum(["ADMIN", "IMPORT"]).default("ADMIN"),
  dryRun: z.boolean().default(false),
  reason: z.string().trim().max(500).nullable().optional(),
  code: z.string().trim().max(80).nullable().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("beta.assign", request);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = assignmentSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "La lista de usuarios o la operación no es válida." }, { status: 400 });
  }

  try {
    const { id: campaignId } = await params;
    const userIds = [...new Set(parsed.data.userIds)];
    const preview = await previewBetaAssignments({ campaignId, userIds, code: parsed.data.code });

    if (parsed.data.dryRun) {
      return NextResponse.json({ dryRun: true, ...preview });
    }

    const assigned: Array<{ userId: string; grantId: string; created: boolean; startsAt: string; expiresAt: string }> = [];
    const errors: Array<{ userId: string; error: string }> = [];

    for (const userId of preview.eligible) {
      try {
        const result = await assignBetaGrant({
          campaignId,
          userId,
          source: parsed.data.source as BetaGrantSource,
          assignedById: session.user.id,
          reason: parsed.data.reason ?? null,
          code: parsed.data.code,
        });
        revalidateTag(getWorkspaceLicenseCacheTag(userId, null), "max");
        assigned.push({
          userId,
          grantId: result.grantId,
          created: result.created,
          startsAt: result.startsAt.toISOString(),
          expiresAt: result.expiresAt.toISOString(),
        });
      } catch (error) {
        errors.push({ userId, error: error instanceof Error ? error.message : "No se pudo asignar el grant." });
      }
    }

    return NextResponse.json({ dryRun: false, preview, assigned, errors });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron asignar los grants beta." },
      { status: 400 },
    );
  }
}
