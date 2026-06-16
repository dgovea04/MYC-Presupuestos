import { NextResponse } from "next/server";
import { getAiHealth } from "@/lib/ai/runtime";
import { withAiRoute } from "@/lib/ai/route-handler";
import { getAuthSession } from "@/lib/auth/session";

export async function GET() {
  return withAiRoute(async () => {
    const session = await getAuthSession();
    const health = await getAiHealth(undefined, session?.user.id);
    return NextResponse.json(health);
  });
}
