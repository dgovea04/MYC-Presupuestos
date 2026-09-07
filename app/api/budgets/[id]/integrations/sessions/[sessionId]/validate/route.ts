import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { resolveBudgetOwnership } from "@/lib/collaboration/authorization";
import { transitionIntegrationSession } from "@/lib/integrations/sessions";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) { const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); try { const { id, sessionId } = await params; const { companyId } = await resolveBudgetOwnership(id, session.user.id); await transitionIntegrationSession({ sessionId, companyId, to: "STAGED" }); return NextResponse.json({ session: await transitionIntegrationSession({ sessionId, companyId, to: "VALIDATED" }) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo validar" }, { status: 400 }); } }
