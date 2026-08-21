import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { recordAdminAudit } from "@/lib/data/admin-audit";
import { purgeDeletedWorkspacesBefore, WORKSPACE_DELETION_RECOVERY_DAYS } from "@/lib/workspace/company-settings";

export async function POST(request: Request) {
  const session = await requireAdminSession("system_settings.manage", request);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await purgeDeletedWorkspacesBefore();
    await recordAdminAudit({
      actorUserId: session.user.id,
      targetUserId: null,
      targetEmail: session.user.email ?? session.user.id,
      action: "WORKSPACE_PURGE_EXECUTED",
      detail: `Se eliminaron ${result.purgedCount} workspaces con más de ${WORKSPACE_DELETION_RECOVERY_DAYS} días en papelera.`,
      metadata: {
        purgedCount: result.purgedCount,
        recoveryDays: WORKSPACE_DELETION_RECOVERY_DAYS,
        cutoff: result.cutoff.toISOString(),
      },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, purgedCount: result.purgedCount, cutoff: result.cutoff.toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo purgar la papelera de workspaces." },
      { status: 400 },
    );
  }
}
