import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { CATALOG_PARTIDAS_CACHE_TAG, saveCatalogPartidasPatch } from "@/lib/data/partidas";

export async function PATCH(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await saveCatalogPartidasPatch(body);
    revalidateTag(CATALOG_PARTIDAS_CACHE_TAG, "max");
    revalidatePath("/partidas");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron guardar las partidas" },
      { status: 400 },
    );
  }
}
