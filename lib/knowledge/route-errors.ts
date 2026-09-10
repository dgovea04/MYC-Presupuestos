import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { getAuthSession, requireAdminSession } from "@/lib/auth/session";

export class KnowledgeRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeRequestValidationError";
  }
}

type KnowledgeSession = NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;

export type KnowledgeAdminSessionResult =
  | { session: KnowledgeSession }
  | { response: NextResponse };

export async function requireKnowledgeAdminSession(capability: Parameters<typeof requireAdminSession>[0], request: Request): Promise<KnowledgeAdminSessionResult> {
  const authorizedSession = await requireAdminSession(capability, request);
  if (authorizedSession?.user?.id) return { session: authorizedSession };

  const session = await getAuthSession();
  return session?.user?.id
    ? { response: NextResponse.json({ error: "No autorizado" }, { status: 403 }) }
    : { response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
}

export function knowledgeRouteErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof ZodError || error instanceof KnowledgeRequestValidationError) {
    return NextResponse.json({ error: error instanceof ZodError ? "Payload inválido" : error.message }, { status: 400 });
  }
  if (error instanceof WorkspaceAuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}
