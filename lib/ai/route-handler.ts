import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AiRuntimeError } from "@/lib/ai/errors";
import { AiTokenLimitExceededError } from "@/lib/ai/usage";
import { getAuthSession } from "@/lib/auth/session";
import { OllamaConnectionError, OllamaResponseError } from "@/lib/ai/ollama";

type AiRouteSession = NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;

export async function withAiRoute(handler: (session: AiRouteSession) => Promise<NextResponse>) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.status === "SUSPENDED") {
    return NextResponse.json({ error: "Usuario suspendido" }, { status: 403 });
  }

  try {
    return await handler(session);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Solicitud invalida" }, { status: 400 });
    }

    if (error instanceof OllamaConnectionError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof OllamaResponseError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    if (error instanceof AiRuntimeError) {
      if (error.code === "connection" || error.code === "model_missing" || error.code === "timeout") {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }

      if (error.code === "invalid_response" || error.code === "validation_failed") {
        return NextResponse.json({ error: error.message }, { status: 422 });
      }
    }

    if (error instanceof AiTokenLimitExceededError) {
      return NextResponse.json(
        {
          error: error.message,
          allowance: error.allowance,
          usedTokens: error.usedTokens,
          requestedTokens: error.requestedTokens,
        },
        { status: 429 },
      );
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Error inesperado de IA" }, { status: 500 });
  }
}
