import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getRiskAnalysisPayload } from "@/lib/risk/data";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = await getRiskAnalysisPayload(id, session.user.id);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el analisis de riesgo" },
      { status: 400 },
    );
  }
}
