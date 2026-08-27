import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import { rotateScopedAiCredential, revokeScopedAiCredential } from "@/lib/ai/credentials/credential-service";
import { recordAiCredentialAudit } from "@/lib/ai/credentials/audit";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";

const rotationSchema = z.object({ apiKey: z.string().trim().min(1).max(1000) });
type RouteContext = { params: Promise<{ id: string; credentialId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId, credentialId } = await params;
  const limit = await consumeRateLimit({ key: `contextual-ai-credential-rotate:${workspaceId}:${session.user.id}:${getRequestClientIp(request)}`, maxAttempts: 10, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: "Demasiadas operaciones de credenciales. Intenta más tarde." }, { status: 429, headers: getRateLimitHeaders(limit) });
  try { await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "ADMIN" }); const { apiKey } = rotationSchema.parse(await request.json()); const credential = await rotateScopedAiCredential({ actorUserId: session.user.id, credentialId, apiKey, expectedWorkspaceId: workspaceId }); if (credential.scope !== "TEAM" && credential.scope !== "PROJECT") return NextResponse.json({ error: "La credencial no es contextual." }, { status: 400 }); await recordAiCredentialAudit({ operation: "ROTATED", actorUserId: session.user.id, workspaceId, credentialId: credential.id, provider: credential.provider, metadata: { scope: credential.scope, teamId: credential.teamId, projectId: credential.projectId } }); return NextResponse.json({ credential }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo rotar la credencial." }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 }); const { id: workspaceId, credentialId } = await params;
  const limit = await consumeRateLimit({ key: `contextual-ai-credential-revoke:${workspaceId}:${session.user.id}:${getRequestClientIp(request)}`, maxAttempts: 10, windowMs: 10 * 60 * 1000 }); if (!limit.allowed) return NextResponse.json({ error: "Demasiadas operaciones de credenciales. Intenta más tarde." }, { status: 429, headers: getRateLimitHeaders(limit) });
  try { await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "ADMIN" }); const credential = await revokeScopedAiCredential({ actorUserId: session.user.id, credentialId, expectedWorkspaceId: workspaceId }); if (credential.scope !== "TEAM" && credential.scope !== "PROJECT") return NextResponse.json({ error: "La credencial no es contextual." }, { status: 400 }); await recordAiCredentialAudit({ operation: "REVOKED", actorUserId: session.user.id, workspaceId, credentialId: credential.id, provider: credential.provider, metadata: { scope: credential.scope, teamId: credential.teamId, projectId: credential.projectId } }); return NextResponse.json({ credential }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo revocar la credencial." }, { status: 400 }); }
}
