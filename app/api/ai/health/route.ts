import { NextResponse } from "next/server";
import { getAiHealth } from "@/lib/ai/runtime";
import { withAiRoute } from "@/lib/ai/route-handler";
import { getAuthSession } from "@/lib/auth/session";
import { isLocalRuntimeEnabled } from "@/lib/runtime/local-capabilities";

export async function GET() {
  return withAiRoute(async () => {
    const session = await getAuthSession();

    if (!isLocalRuntimeEnabled()) {
      return NextResponse.json({ error: "El diagnostico de Ollama solo esta disponible en la app local." }, { status: 403 });
    }
    const health = await getAiHealth(undefined, session?.user.id);
    return NextResponse.json(health);
  });
}
