import { NextResponse } from "next/server";
import { getAiHealth } from "@/lib/ai/runtime";
import { withAiRoute } from "@/lib/ai/route-handler";

export async function GET() {
  return withAiRoute(async () => {
    const health = await getAiHealth();
    return NextResponse.json(health);
  });
}
