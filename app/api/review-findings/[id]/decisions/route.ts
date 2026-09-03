import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { recordFindingDecision } from "@/lib/review-intelligence/findings";

const bodySchema = z.object({ resolution: z.enum(["ACCEPTED", "REJECTED", "NOT_APPLICABLE", "NEEDS_MORE_EVIDENCE", "CORRECTED"]), note: z.string().trim().max(5000).optional(), expectedUpdatedAt: z.coerce.date(), reconfirmStale: z.boolean().default(false) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try { await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No tienes acceso al workspace" }, { status: 403 }); }
  try { const body = bodySchema.parse(await request.json()); return NextResponse.json(await recordFindingDecision({ ...body, findingId: (await params).id, companyId, userId: session.user.id }), { status: 201 }); } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Payload inválido" }, { status: 400 }); const message = error instanceof Error ? error.message : "No se pudo registrar la decisión"; return NextResponse.json({ error: message }, { status: /changed|stale|reconfirmation/i.test(message) ? 409 : /not found/i.test(message) ? 404 : 400 }); }
}
