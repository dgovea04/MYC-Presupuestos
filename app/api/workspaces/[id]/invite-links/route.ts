import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";
import { assertWorkspaceFeatureAccess } from "@/lib/workspace/entitlements";
import { requireWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { createWorkspaceInviteLinkSchema } from "@/lib/validations/workspace";
import { createWorkspaceInviteLink, listWorkspaceInviteLinks, revokeWorkspaceInviteLink } from "@/lib/workspace/invite-links";

async function authorize(userId: string, companyId: string) {
  await assertWorkspaceFeatureAccess({ userId, companyId, feature: "workspace.management" });
  return requireWorkspaceRole({ userId, companyId, minimumRole: "ADMIN" });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: companyId } = await params;
  try { await authorize(session.user.id, companyId); return NextResponse.json({ links: await listWorkspaceInviteLinks(companyId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof WorkspaceAuthorizationError ? error.message : "No tienes permisos" }, { status: 403 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: companyId } = await params;
  const rateLimit = await consumeRateLimit({ key: `workspace-invite-links:create:${session.user.id}:${getRequestClientIp(request)}`, maxAttempts: 10, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Demasiadas invitaciones. Intenta nuevamente más tarde." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  const parsed = createWorkspaceInviteLinkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Parámetros de invitación inválidos" }, { status: 400 });
  try { await authorize(session.user.id, companyId); const result = await createWorkspaceInviteLink({ companyId, actorUserId: session.user.id, ...parsed.data }); return NextResponse.json({ link: result.link, token: result.token }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el enlace" }, { status: 403 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: companyId } = await params;
  const body = await request.json().catch(() => null) as { linkId?: unknown } | null;
  if (!body || typeof body.linkId !== "string" || !body.linkId) return NextResponse.json({ error: "linkId requerido" }, { status: 400 });
  try { await revokeWorkspaceInviteLink({ companyId, actorUserId: session.user.id, linkId: body.linkId }); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo revocar el enlace" }, { status: 403 }); }
}
