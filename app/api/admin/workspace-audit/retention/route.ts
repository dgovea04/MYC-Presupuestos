import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { recordAdminAudit } from "@/lib/data/admin-audit";
import { purgeWorkspaceAuditEventsBefore, WORKSPACE_AUDIT_RETENTION_MONTHS } from "@/lib/workspace/audit-retention";

export async function POST(request: Request) {
  const session = await requireAdminSession("audit.manage_retention", request);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await purgeWorkspaceAuditEventsBefore();
    await recordAdminAudit({
      actorUserId: session.user.id,
      targetUserId: null,
      targetEmail: session.user.email ?? session.user.id,
      action: "WORKSPACE_AUDIT_RETENTION_PURGED",
      detail: `Se eliminaron ${result.purgedCount} eventos de auditoría de workspace con más de ${WORKSPACE_AUDIT_RETENTION_MONTHS} meses.`,
      metadata: {
        purgedCount: result.purgedCount,
        retentionMonths: WORKSPACE_AUDIT_RETENTION_MONTHS,
        cutoff: result.cutoff.toISOString(),
      },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      purgedCount: result.purgedCount,
      cutoff: result.cutoff.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo aplicar la política de retención." },
      { status: 400 },
    );
  }
}
