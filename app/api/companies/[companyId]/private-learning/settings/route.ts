import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { prisma } from "@/lib/db/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const { companyId } = await params; await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" }); const policy = await prisma.privateLearningPolicy.findUnique({ where: { companyId }, select: { enabled: true, retentionDays: true, allowExternalProviders: true } }); return NextResponse.json({ policy: policy ?? { enabled: false, retentionDays: 365, allowExternalProviders: false } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar la política" }, { status: 403 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const { companyId } = await params; await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "ADMIN" }); const body = await request.json() as { enabled?: boolean; retentionDays?: number; allowExternalProviders?: boolean }; const retentionDays = body.retentionDays ?? 365; if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) return NextResponse.json({ error: "retentionDays debe estar entre 1 y 3650" }, { status: 400 }); const policy = await prisma.privateLearningPolicy.upsert({ where: { companyId }, create: { companyId, enabled: body.enabled ?? false, retentionDays, allowExternalProviders: body.allowExternalProviders === true }, update: { ...(body.enabled !== undefined ? { enabled: body.enabled } : {}), retentionDays, allowExternalProviders: body.allowExternalProviders === true } }); return NextResponse.json({ policy: { enabled: policy.enabled, retentionDays: policy.retentionDays, allowExternalProviders: policy.allowExternalProviders } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la política" }, { status: 403 }); }
}
