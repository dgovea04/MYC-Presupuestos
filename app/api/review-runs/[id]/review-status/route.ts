import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { markReviewRunStatus, readReviewRunStatus } from "@/lib/review-intelligence/lifecycle";

const bodySchema = z.object({
  targetStatus: z.enum(["UNDER_REVIEW", "REVIEWED"]),
  expectedUpdatedAt: z.coerce.date(),
  correlationId: z.string().trim().min(1).max(200).optional(),
}).strict();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" });
    return NextResponse.json(await readReviewRunStatus({ runId: (await params).id, companyId }, prisma as never));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar el estado de revisión";
    return NextResponse.json({ error: message }, { status: /acceso|workspace|rol/i.test(message) ? 403 : 404 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    const membership = await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" });
    const body = bodySchema.parse(await request.json());
    const result = await markReviewRunStatus({ runId: (await params).id, companyId, userId: session.user.id, role: membership?.role ?? "EDITOR", targetStatus: body.targetStatus, expectedUpdatedAt: body.expectedUpdatedAt, correlationId: body.correlationId ?? request.headers.get("X-Correlation-Id")?.trim() ?? randomUUID() }, prisma as never);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
    const message = error instanceof Error ? error.message : "No se pudo actualizar el lifecycle de la revisión";
    const status = /acceso|workspace|rol/i.test(message) ? 403 : /not found/i.test(message) ? 404 : /changed|pending|stale|Only|Cannot/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
