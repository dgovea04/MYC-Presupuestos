import { NextRequest, NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getMetradoProjectSummary } from "@/lib/data/metrados";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";

export async function GET(request: NextRequest) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "metrados.advanced");
  if (accessResponse) return accessResponse;

  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Se requiere projectId." }, { status: 400 });
  }

  try {
    const summary = await getMetradoProjectSummary(projectId, session.user.id);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo obtener el resumen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
