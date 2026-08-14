import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron-auth";
import { notifyDueAdminDeletions } from "@/lib/data/admin-deletion-approvals";

/**
 * GET /api/cron/notify-deletion-reminders
 *
 * Notifica al administrador principal las eliminaciones cuyo periodo de gracia venció.
 * La eliminación definitiva continúa requiriendo ejecución manual con MFA.
 */
export async function GET(request: Request) {
  const authorization = isAuthorizedCronRequest(request);

  if (!authorization.configured) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (!authorization.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await notifyDueAdminDeletions();
    return NextResponse.json({ ...result, checkedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "No se pudieron procesar los recordatorios de eliminación." }, { status: 500 });
  }
}
