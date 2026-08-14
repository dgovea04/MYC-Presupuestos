import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { anonymizeAdminAuditLogsBefore } from "@/lib/data/admin-audit-retention";

export async function POST(request: Request) {
  const session = await requireAdminSession("audit.manage_retention", request);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await anonymizeAdminAuditLogsBefore({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? session.user.id,
      context: getAdminActionContext(request),
    });

    return NextResponse.json({
      ok: true,
      anonymizedCount: result.anonymizedCount,
      cutoff: result.cutoff.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo aplicar la política de retención." },
      { status: 400 },
    );
  }
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
