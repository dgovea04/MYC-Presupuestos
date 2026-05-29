import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { CATALOG_PARTIDAS_CACHE_TAG } from "@/lib/data/partidas";
import { saveGeneratedPartida } from "@/lib/data/partida-generation";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "partidas.similarity" });
    const body = await request.json();
    const result = await saveGeneratedPartida(session.user.id, body);
    revalidateTag(CATALOG_PARTIDAS_CACHE_TAG, "max");
    revalidatePath("/partidas");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la partida generada" },
      { status: 400 },
    );
  }
}
