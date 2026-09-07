import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertBudgetCollaborationAccess } from "@/lib/collaboration/authorization";
import { createIntegrationSession } from "@/lib/integrations/sessions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const { id: budgetId } = await params; const body = await request.json() as { adapter?: string; contractVersion?: string; payload?: string; requestId?: string }; const context = await assertBudgetCollaborationAccess({ userId: session.user.id, budgetId, action: "EDIT" }); if (!body.adapter || typeof body.payload !== "string") return NextResponse.json({ error: "adapter y payload son obligatorios" }, { status: 400 }); const result = await createIntegrationSession({ companyId: context.companyId, projectId: context.projectId, budgetId, createdById: session.user.id, adapter: body.adapter, contractVersion: body.contractVersion ?? "1", payload: body.payload, requestId: body.requestId }); return NextResponse.json({ session: result }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la sesión" }, { status: 403 }); }
}
