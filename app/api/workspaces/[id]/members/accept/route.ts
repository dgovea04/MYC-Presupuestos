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
      {
        error:
          membership.status === "ACTIVE"
            ? "Ya eres miembro activo de este workspace"
            : "No puedes aceptar esta invitación",
      },
      { status: 409 },
    );
  }

  const updated = await prisma.companyMembership.update({
    where: {
      companyId_userId: {
        companyId,
        userId: session.user.id,
      },
    },
    data: { status: "ACTIVE", joinedAt: new Date() },
    include: {
      company: { select: { id: true, name: true, logoUrl: true } },
      invitedBy: { select: { name: true } },
    },
  });

  return NextResponse.json({
    workspace: {
      id: updated.companyId,
      name: updated.company.name,
      role: updated.role,
      logoUrl: updated.company.logoUrl,
    },
  });
}
