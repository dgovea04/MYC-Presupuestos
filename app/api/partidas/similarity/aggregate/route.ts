import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { aggregatePartidaGenerationSuggestions } from "@/lib/data/partida-generation";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await aggregatePartidaGenerationSuggestions(session.user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron agregar los insumos sugeridos" },
      { status: 400 },
    );
  }
}
