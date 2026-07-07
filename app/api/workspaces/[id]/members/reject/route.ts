import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyId } = await params;

  const membership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId,
        userId: session.user.id,
      },
    },
    select: { status: true },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "No tienes una invitación a este workspace" },
      { status: 404 },
    );
  }

  if (membership.status !== "INVITED") {
    return NextResponse.json(
      { error: "Solo puedes rechazar invitaciones pendientes" },
      { status: 409 },
    );
  }

  await prisma.companyMembership.delete({
    where: {
      companyId_userId: {
        companyId,
        userId: session.user.id,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
