import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { listScopedAiCredentials, createScopedAiCredential, rotateScopedAiCredential, revokeScopedAiCredential } from "@/lib/ai/credentials/credential-service";
import { aiCredentialInputSchema } from "@/lib/ai/credentials/types";
import { recordAiCredentialAudit } from "@/lib/ai/credentials/audit";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import { z } from "zod";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";

const mutationSchema = z.object({
  provider: z.enum(["OPENAI", "GEMINI", "OPENROUTER"]),
  apiKey: z.string().trim().min(1).max(1000),
  isFallback: z.boolean().optional().default(false),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId } = await params;
  try {
    await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "VIEWER" });
    return NextResponse.json({ credentials: await listScopedAiCredentials({ workspaceId, scope: "WORKSPACE" }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar las credenciales." }, { status: 403 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId } = await params;
  const rateLimit = await consumeRateLimit({ key: `workspace-ai-credential-mutation:${workspaceId}:${getRequestClientIp(request)}:${session.user.id}`, maxAttempts: 10, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Demasiadas operaciones de credenciales. Intenta más tarde." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  try {
    const body = mutationSchema.parse(await request.json());
    const credential = await createScopedAiCredential({
      actorUserId: session.user.id,
      input: aiCredentialInputSchema.parse({ ...body, scope: "WORKSPACE", workspaceId, userId: null }),
    });
    await recordAiCredentialAudit({ operation: "CREATED", actorUserId: session.user.id, workspaceId, credentialId: credential.id, provider: credential.provider });
    return NextResponse.json({ credential }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la credencial." }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId } = await params;
  const rateLimit = await consumeRateLimit({ key: `workspace-ai-credential-rotate:${workspaceId}:${getRequestClientIp(request)}:${session.user.id}`, maxAttempts: 10, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Demasiadas operaciones de credenciales. Intenta más tarde." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  try {
    await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "ADMIN" });
    const body = z.object({ credentialId: z.string().min(1), apiKey: z.string().trim().min(1).max(1000) }).parse(await request.json());
    const credential = await rotateScopedAiCredential({ actorUserId: session.user.id, credentialId: body.credentialId, apiKey: body.apiKey, expectedWorkspaceId: workspaceId });
    await recordAiCredentialAudit({ operation: "ROTATED", actorUserId: session.user.id, workspaceId, credentialId: credential.id, provider: credential.provider });
    return NextResponse.json({ credential });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo rotar la credencial." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId } = await params;
  const rateLimit = await consumeRateLimit({ key: `workspace-ai-credential-revoke:${workspaceId}:${getRequestClientIp(request)}:${session.user.id}`, maxAttempts: 10, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Demasiadas operaciones de credenciales. Intenta más tarde." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  try {
    await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "ADMIN" });
    const body = z.object({ credentialId: z.string().min(1) }).parse(await request.json());
    const credential = await revokeScopedAiCredential({ actorUserId: session.user.id, credentialId: body.credentialId, expectedWorkspaceId: workspaceId });
    await recordAiCredentialAudit({ operation: "REVOKED", actorUserId: session.user.id, workspaceId, credentialId: credential.id, provider: credential.provider });
    return NextResponse.json({ credential });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo revocar la credencial." }, { status: 400 });
  }
}
