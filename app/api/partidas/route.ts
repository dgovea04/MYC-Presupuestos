import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { saveCatalogPartidasPatch } from "@/lib/data/partidas";

export async function PATCH(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await saveCatalogPartidasPatch(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron guardar las partidas" },
      { status: 400 },
    );
  }
}
