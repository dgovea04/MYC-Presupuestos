import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";
import { acceptWorkspaceInviteLink } from "@/lib/workspace/invite-links";
import { WorkspaceSeatLimitError } from "@/lib/workspace/seats";
import { WORKSPACE_LIST_CACHE_TAG } from "@/lib/workspace/active-workspace";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Debes iniciar sesión para aceptar la invitación" }, { status: 401 });
  const rateLimit = await consumeRateLimit({ key: `workspace-invite-links:accept:${session.user.id}:${getRequestClientIp(request)}`, maxAttempts: 10, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Demasiados intentos. Intenta nuevamente más tarde." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  const { token } = await params;
  try {
    const result = await acceptWorkspaceInviteLink({ token, userId: session.user.id });
    revalidateTag(`${WORKSPACE_LIST_CACHE_TAG}-${session.user.id}`, "max");
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof WorkspaceSeatLimitError ? 409 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "El enlace no es válido" }, { status });
  }
}
