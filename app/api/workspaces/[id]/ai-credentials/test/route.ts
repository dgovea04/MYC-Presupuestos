import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import { recordAiCredentialAudit } from "@/lib/ai/credentials/audit";
import { validateAiProviderCredential } from "@/lib/ai/credentials/validation-service";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";
import { z } from "zod";

const inputSchema = z.object({
  provider: z.enum(["OPENAI", "GEMINI", "OPENROUTER"]),
  apiKey: z.string().trim().min(1).max(1000),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId } = await params;
  const rateLimit = await consumeRateLimit({ key: `workspace-ai-credential-test:${workspaceId}:${getRequestClientIp(request)}:${session.user.id}`, maxAttempts: 5, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Demasiadas pruebas de credencial. Intenta más tarde." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  try {
    await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "ADMIN" });
    const input = inputSchema.parse(await request.json());
    const validation = await validateAiProviderCredential({ provider: input.provider, apiKey: input.apiKey });
    await recordAiCredentialAudit({ operation: "TESTED", actorUserId: session.user.id, workspaceId, provider: input.provider, success: validation.valid, errorCode: validation.errorCode });
    return NextResponse.json({ valid: validation.valid, errorCode: validation.errorCode });
  } catch (error) {
    return NextResponse.json({ valid: false, error: error instanceof Error ? error.message : "No se pudo probar la credencial." }, { status: 400 });
  }
}

