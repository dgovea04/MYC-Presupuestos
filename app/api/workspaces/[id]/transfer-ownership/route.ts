import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceFeatureAccess } from "@/lib/workspace/entitlements";
import { requireWorkspaceOwner, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { recordWorkspaceAudit } from "@/lib/workspace/audit";
import { transferWorkspaceOwnershipSchema } from "@/lib/validations/workspace";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: companyId } = await params;
  try {
    await assertWorkspaceFeatureAccess({ userId: session.user.id, companyId, feature: "workspace.management" });
    await requireWorkspaceOwner({ userId: session.user.id, companyId });
  } catch (error) {
    const message = error instanceof WorkspaceAuthorizationError ? error.message : "No tienes permisos para transferir el ownership";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const parsed = transferWorkspaceOwnershipSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Se requiere un miembro activo válido" }, { status: 400 });
  if (parsed.data.userId === session.user.id) return NextResponse.json({ error: "El nuevo Owner debe ser otro miembro" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentOwner = await tx.companyMembership.findUnique({
        where: { companyId_userId: { companyId, userId: session.user.id } },
        select: { id: true, role: true, status: true },
      });
      const target = await tx.companyMembership.findUnique({
        where: { companyId_userId: { companyId, userId: parsed.data.userId } },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      if (!currentOwner || currentOwner.role !== "OWNER" || currentOwner.status !== "ACTIVE") throw new Error("El ownership actual no está disponible");
      if (!target || target.status !== "ACTIVE") throw new Error("El destinatario debe ser un miembro activo");

      const demoted = await tx.companyMembership.update({ where: { id: currentOwner.id }, data: { role: "ADMIN" } });
      const promoted = await tx.companyMembership.update({ where: { id: target.id }, data: { role: "OWNER" }, include: { user: { select: { id: true, name: true, email: true } } } });
      await recordWorkspaceAudit({
        companyId,
        actorUserId: session.user.id,
        action: "OWNERSHIP_TRANSFERRED",
        targetType: "MEMBER",
        targetId: target.userId,
        targetLabel: target.user.name ?? target.user.email,
        metadata: { previousOwnerId: session.user.id, newOwnerId: target.userId },
      }, tx);
      return { demoted, promoted };
    });
    return NextResponse.json({ ok: true, previousOwnerId: result.demoted.userId, owner: result.promoted.user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo transferir el ownership";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
