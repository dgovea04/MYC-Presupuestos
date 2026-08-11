import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { isLocalRuntimeEnabled } from "@/lib/runtime/local-capabilities";
import { parseS10SnapshotJson } from "@/lib/s10/snapshot-contract";
import {
  isRecord,
  readBooleanRecordValue,
  readOptionalRecordString,
  readRequiredRecordString,
  S10SqlServerRequestError,
} from "@/app/api/imports/s10/sqlserver/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isLocalRuntimeEnabled()) {
    return NextResponse.json({ error: "La lectura local de SQL Server S10 solo esta habilitada en entorno local." }, { status: 403 });
  }

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      throw new S10SqlServerRequestError("Envia un body JSON valido.", 400);
    }

    const { exportLocalS10Snapshot } = await import(/* turbopackIgnore: true */ "@/lib/s10/sqlserver-local");
    const snapshotJson = exportLocalS10Snapshot({
      server: readRequiredRecordString(body, "server"),
      databaseName: readRequiredRecordString(body, "databaseName"),
      budgetCode: readRequiredRecordString(body, "budgetCode"),
      user: readOptionalRecordString(body, "user"),
      password: readOptionalRecordString(body, "password"),
      trustServerCertificate: readBooleanRecordValue(body, "trustServerCertificate", true),
    });

    const { contract } = parseS10SnapshotJson(snapshotJson);
    return NextResponse.json({ snapshot: contract });
  } catch (error) {
    if (error instanceof S10SqlServerRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo exportar el snapshot S10 local." },
      { status: 400 },
    );
  }
}
