import { NextResponse } from "next/server";
import { generateCatalogBackedApuProposal } from "@/lib/ai/apu-generator";
import { withAiRoute } from "@/lib/ai/route-handler";
import { aiApuCatalogGenerateRequestSchema } from "@/lib/ai/validation";
import { getCatalogPartidas } from "@/lib/data/partidas";
import { getResourcesByUser } from "@/lib/data/resources";
import { assertFeatureAccess } from "@/lib/billing/entitlements";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    await assertFeatureAccess({ userId: session.user.id, feature: "khipu.agent" });
    const data = aiApuCatalogGenerateRequestSchema.parse(await request.json());
    const [partidas, resources] = await Promise.all([
      getCatalogPartidas(),
      getResourcesByUser(session.user.id),
    ]);
    const result = await generateCatalogBackedApuProposal({
      query: data.query,
      unit: data.unit,
      category: data.category,
      projectType: data.project_type,
      partidas,
      resources,
      includeDebug: process.env.NODE_ENV !== "production",
      userId: session.user.id,
    });

    return NextResponse.json(result);
  });
}
