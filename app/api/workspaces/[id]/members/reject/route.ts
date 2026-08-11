import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { WORKSPACE_LIST_CACHE_TAG } from "@/lib/workspace/active-workspace";
import { assertWorkspaceFeatureAccess } from "@/lib/workspace/entitlements";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyId } = await params;

  try {
    await assertWorkspaceFeatureAccess({
      userId: session.user.id,
      companyId,
      feature: "workspace.management",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workspace no disponible" },
      { status: 403 },
    );
  }

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

  revalidateTag(`${WORKSPACE_LIST_CACHE_TAG}-${session.user.id}`, "max");

  return NextResponse.json({ ok: true });
}
