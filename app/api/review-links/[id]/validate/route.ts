import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { validateReviewLink } from "@/lib/review-intelligence/findings";

const bodySchema = z.object({ validationStatus: z.enum(["CONFIRMED", "REJECTED"]) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  let role = "EDITOR";
  try { const membership = await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" }); role = membership?.role ?? role; } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No tienes acceso al workspace" }, { status: 403 }); }
  try { const body = bodySchema.parse(await request.json()); return NextResponse.json(await validateReviewLink({ ...body, linkId: (await params).id, companyId, userId: session.user.id, role, correlationId: request.headers.get("X-Correlation-Id")?.trim() || randomUUID() })); } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: "Validación humana inválida" }, { status: 400 }); return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo validar el vínculo" }, { status: 400 }); }
}
