import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { isS10LocalSqlServerEnabled, listLocalS10Databases } from "@/lib/s10/sqlserver-local";
import { parseConnectionInputFromUrl, S10SqlServerRequestError } from "@/app/api/imports/s10/sqlserver/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isS10LocalSqlServerEnabled()) {
    return NextResponse.json({ error: "La lectura local de SQL Server S10 solo esta habilitada en entorno local." }, { status: 403 });
  }

  try {
    const connection = parseConnectionInputFromUrl(request);
    const databases = listLocalS10Databases(connection);

    return NextResponse.json({ databases });
  } catch (error) {
    if (error instanceof S10SqlServerRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron leer las bases S10 locales." },
      { status: 400 },
    );
  }
}
