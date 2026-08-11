import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { isLocalRuntimeEnabled } from "@/lib/runtime/local-capabilities";
import {
  parseConnectionInputFromUrl,
  readRequiredUrlString,
  S10SqlServerRequestError,
} from "@/app/api/imports/s10/sqlserver/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isLocalRuntimeEnabled()) {
    return NextResponse.json({ error: "La lectura local de SQL Server S10 solo esta habilitada en entorno local." }, { status: 403 });
  }

  try {
    const connection = parseConnectionInputFromUrl(request);
    const databaseName = readRequiredUrlString(request, "database");
    const { listLocalS10Budgets } = await import(/* turbopackIgnore: true */ "@/lib/s10/sqlserver-local");
    const budgets = listLocalS10Budgets({ ...connection, databaseName });

    return NextResponse.json({ budgets });
  } catch (error) {
    if (error instanceof S10SqlServerRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron leer los presupuestos S10 locales." },
      { status: 400 },
    );
  }
}
