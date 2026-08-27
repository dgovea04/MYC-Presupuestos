import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { invalidateStaleAiCredentials } from "@/lib/ai/credentials/lifecycle";

export async function POST(request: Request) {
  const session = await requireAdminSession("ai_usage.read");
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body: unknown = await request.json().catch(() => ({}));
  const staleAfterMs = typeof body === "object" && body !== null && "staleAfterMs" in body && typeof body.staleAfterMs === "number" && body.staleAfterMs > 0 ? body.staleAfterMs : undefined;
  const result = await invalidateStaleAiCredentials({ staleAfterMs });
  return NextResponse.json({ ...result, executedBy: session.user.id }, { headers: { "Cache-Control": "no-store" } });
}
