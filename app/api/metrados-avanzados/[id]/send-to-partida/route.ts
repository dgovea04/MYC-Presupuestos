import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { sendMetradoTotalToPartida } from "@/lib/data/metrados";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "metrados.advanced");
  if (accessResponse) return accessResponse;

  try {
    const { id } = await params;
    const result = await sendMetradoTotalToPartida(id, session.user.id);

    return NextResponse.json(result);
  } catch (error) {
    if (isMissingRecordError(error) || isMissingPartidaLinkError(error)) {
      return NextResponse.json({ error: "Metrado o partida vinculada no encontrada" }, { status: 404 });
    }

    if (isSendDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Metrado send-to-partida POST failed", error);
    return NextResponse.json({ error: "No se pudo enviar el total a la partida." }, { status: 500 });
  }
}

function isMissingRecordError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function isMissingPartidaLinkError(error: unknown): boolean {
  return error instanceof Error && error.message === "La hoja no tiene una partida vinculada.";
}

function isSendDomainError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.message === "La partida vinculada no pertenece al presupuesto de la hoja."
  );
}
