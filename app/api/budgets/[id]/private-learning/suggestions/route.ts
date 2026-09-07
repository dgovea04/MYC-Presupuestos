import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { resolveBudgetOwnership } from "@/lib/collaboration/authorization";
import { retrievePrivateExamples } from "@/lib/private-learning/retrieval";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id: budgetId } = await params;
    const { companyId } = await resolveBudgetOwnership(budgetId, session.user.id);
    const url = new URL(request.url);
    const signalType = url.searchParams.get("signalType") ?? "EXPLICIT_CORRECTION";
    const suggestions = await retrievePrivateExamples({ companyId, signalType, normalizedInput: {}, schemaVersion: url.searchParams.get("schemaVersion") ?? undefined, limit: Number(url.searchParams.get("limit") ?? 10) });
    return NextResponse.json({ suggestions, guardrail: "Las sugerencias privadas no modifican automáticamente el presupuesto." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron recuperar sugerencias" }, { status: 403 }); }
}
