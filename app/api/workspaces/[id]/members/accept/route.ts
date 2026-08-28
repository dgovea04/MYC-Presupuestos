import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { WORKSPACE_LIST_CACHE_TAG } from "@/lib/workspace/active-workspace";
import { assertWorkspaceHasSeat, WorkspaceSeatLimitError } from "@/lib/workspace/seats";

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

  try {
    await assertWorkspaceHasSeat(companyId);
  } catch (error) {
    if (error instanceof WorkspaceSeatLimitError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    throw error;
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

  revalidateTag(`${WORKSPACE_LIST_CACHE_TAG}-${session.user.id}`, "max");

  return NextResponse.json({
    workspace: {
      id: updated.companyId,
      name: updated.company.name,
      role: updated.role,
      logoUrl: updated.company.logoUrl,
    },
  });
}
