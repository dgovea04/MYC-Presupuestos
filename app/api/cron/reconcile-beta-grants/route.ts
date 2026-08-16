import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron-auth";
import { reconcileBetaGrants } from "@/lib/beta/reconciliation";

export async function GET(request: Request) {
  const authorization = isAuthorizedCronRequest(request);

  if (!authorization.configured) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (!authorization.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await reconcileBetaGrants());
  } catch {
    return NextResponse.json({ error: "No se pudo reconciliar la beta." }, { status: 500 });
  }
}
