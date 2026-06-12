import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { listMetradoTemplates } from "@/lib/data/metrados";

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const templates = await listMetradoTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Metrado templates GET failed", error);
    return NextResponse.json(
      { error: "No se pudieron cargar las plantillas." },
      { status: 500 },
    );
  }
}
