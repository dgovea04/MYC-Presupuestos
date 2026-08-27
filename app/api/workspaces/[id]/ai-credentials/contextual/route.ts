import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import { createScopedAiCredential, listScopedAiCredentials } from "@/lib/ai/credentials/credential-service";
import { recordAiCredentialAudit } from "@/lib/ai/credentials/audit";
import { aiCredentialInputSchema } from "@/lib/ai/credentials/types";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";

const schema = z.object({ scope: z.enum(["TEAM", "PROJECT"]), teamId: z.string().min(1).optional(), projectId: z.string().min(1).optional(), provider: z.enum(["OPENAI", "GEMINI", "OPENROUTER"]), apiKey: z.string().trim().min(1).max(1000), isFallback: z.boolean().optional().default(false) });
const querySchema = z.object({ scope: z.enum(["TEAM", "PROJECT"]).optional(), teamId: z.string().min(1).optional(), projectId: z.string().min(1).optional() });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 }); const { id: workspaceId } = await params;
  try { await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "VIEWER" }); const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams)); const credentials = await listScopedAiCredentials({ workspaceId, scope: query.scope, teamId: query.teamId, projectId: query.projectId }); return NextResponse.json({ credentials }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar las credenciales." }, { status: 400 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 }); const { id: workspaceId } = await params;
  const limit = await consumeRateLimit({ key: `contextual-ai-credential:${workspaceId}:${session.user.id}:${getRequestClientIp(request)}`, maxAttempts: 10, windowMs: 10 * 60 * 1000 }); if (!limit.allowed) return NextResponse.json({ error: "Demasiadas operaciones de credenciales. Intenta más tarde." }, { status: 429, headers: getRateLimitHeaders(limit) });
  try { await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "ADMIN" }); const body = schema.parse(await request.json()); const credential = await createScopedAiCredential({ actorUserId: session.user.id, input: aiCredentialInputSchema.parse({ ...body, workspaceId, userId: null }) }); await recordAiCredentialAudit({ operation: "CREATED", actorUserId: session.user.id, workspaceId, credentialId: credential.id, provider: credential.provider, metadata: { scope: credential.scope, teamId: credential.teamId, projectId: credential.projectId } }); return NextResponse.json({ credential }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la credencial contextual." }, { status: 400 }); }
}
