import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createResourceForUser, saveResourcesPatch } from "@/lib/data/resources";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const resource = await createResourceForUser(session.user.id, body);
    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el insumo" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await saveResourcesPatch(session.user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron guardar los insumos" }, { status: 400 });
  }
}
