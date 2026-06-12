import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import {
  deleteMetradoSheet,
  getMetradoSheetById,
  updateMetradoSheetMetadata,
} from "@/lib/data/metrados";
import type { MetradoUnit } from "@/types/metrado";

const units = ["m", "m2", "m3", "kg", "und", "glb", "p2", "ml", "pza", "bol", "gal", "ton", "mes", "día", "viaje", "pto", "jgo", "pln", "mll"] as const satisfies MetradoUnit[];

const updateMetadataSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    unit: z.enum(units).optional(),
  })
  .refine((value) => value.name !== undefined || value.unit !== undefined, {
    message: "No hay cambios para guardar.",
  });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const sheet = await getMetradoSheetById(id, session.user.id);

  if (!sheet) {
    return NextResponse.json({ error: "Metrado no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ sheet });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = updateMetadataSchema.parse(await request.json());
    const sheet = await updateMetradoSheetMetadata(id, session.user.id, body);

    if (!sheet) {
      return NextResponse.json({ error: "Metrado no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ sheet });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Revisa los datos del metrado." }, { status: 400 });
    }

    console.error("Metrado PATCH failed", error);
    return NextResponse.json({ error: "No se pudo guardar el metrado." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteMetradoSheet(id, session.user.id);

  if (!deleted) {
    return NextResponse.json({ error: "Metrado no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
