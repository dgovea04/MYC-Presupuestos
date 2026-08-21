import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { recordWorkspaceAudit } from "@/lib/workspace/audit";
import { inviteWorkspaceMember } from "@/lib/workspace/invitations";
import { assertWorkspaceHasSeat, WorkspaceSeatLimitError } from "@/lib/workspace/seats";
import { assertWorkspaceFeatureAccess } from "@/lib/workspace/entitlements";
import { inviteWorkspaceMemberSchema, changeRoleSchema, assignCustomRoleSchema, removeMemberSchema, toggleStatusSchema } from "@/lib/validations/workspace";

export async function GET(
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
    await assertWorkspaceMembership({
      userId: session.user.id,
      companyId,
      minimumRole: "VIEWER",
    });
  } catch {
    return NextResponse.json(
      { error: "No tienes permisos para ver los miembros de este workspace" },
      { status: 403 },
    );
  }

  // Note: auto-reactivation of expired suspensions happens lazily via assertWorkspaceMembership
  const members = await prisma.companyMembership.findMany({
    where: { companyId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      invitedBy: { select: { id: true, name: true } },
      customRole: { select: { id: true, name: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      userName: m.user.name,
      userEmail: m.user.email,
      userAvatarUrl: m.user.avatarUrl,
      role: m.role,
      customRoleId: m.customRoleId,
      customRoleName: m.customRole?.name ?? null,
      status: m.status,
      invitedByName: m.invitedBy?.name ?? null,
      joinedAt: m.joinedAt.toISOString(),
      suspendedUntil: m.suspendedUntil?.toISOString() ?? null,
      lastActiveAt: m.lastActiveAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyId } = await params;

  // Ensure caller has ADMIN or OWNER role
  try {
    await assertWorkspaceFeatureAccess({
      userId: session.user.id,
      companyId,
      feature: "workspace.management",
    });
    await assertWorkspaceMembership({
      userId: session.user.id,
      companyId,
      minimumRole: "ADMIN",
    });
  } catch {
    return NextResponse.json(
      { error: "No tienes permisos para invitar usuarios a este workspace" },
      { status: 403 },
    );
  }

  // Parse and validate the invitation payload
  let parsed: { email: string };
  try {
    const body = await request.json();
    parsed = inviteWorkspaceMemberSchema.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Se requiere un email válido para invitar" },
      { status: 400 },
    );
  }

  try {
    const result = await inviteWorkspaceMember({
      companyId,
      actorUserId: session.user.id,
      email: parsed.email,
    });

    if (result.ok) {
      return NextResponse.json({ member: result.member }, { status: 201 });
    }

    if (result.code === "NOT_FOUND") {
      return NextResponse.json(
        { error: "No se encontró un usuario con ese email" },
        { status: 404 },
      );
    }

    if (result.code === "SELF") {
      return NextResponse.json(
        { error: "No puedes invitarte a ti mismo" },
        { status: 400 },
      );
    }

    const statusLabel =
      result.existingStatus === "ACTIVE"
        ? "ya es miembro activo"
        : result.existingStatus === "INVITED"
          ? "ya tiene una invitación pendiente"
          : "está suspendido";
    return NextResponse.json(
      {
        error: `El usuario ${statusLabel} de este workspace`,
        existingStatus: result.existingStatus,
      },
      { status: 409 },
    );
  } catch (error) {
    if (error instanceof WorkspaceSeatLimitError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyId } = await params;

  // Only OWNER can change roles or status
  try {
    await assertWorkspaceFeatureAccess({
      userId: session.user.id,
      companyId,
      feature: "workspace.management",
    });
    await assertWorkspaceMembership({
      userId: session.user.id,
      companyId,
      minimumRole: "OWNER",
    });
  } catch {
    return NextResponse.json(
      { error: "Solo el Owner puede modificar miembros" },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido" },
      { status: 400 },
    );
  }

  // Try role change, custom role assignment, then status toggle
  const roleResult = changeRoleSchema.safeParse(body);
  const statusResult = toggleStatusSchema.safeParse(body);
  const customRoleResult = assignCustomRoleSchema.safeParse(body);

  const isRoleChange = roleResult.success;
  const isCustomRoleChange = customRoleResult.success;
  const isStatusChange = statusResult.success && !isRoleChange && !isCustomRoleChange;

  if (!isRoleChange && !isCustomRoleChange && !isStatusChange) {
    return NextResponse.json(
      { error: "Se requiere userId con role, customRoleId o status válidos" },
      { status: 400 },
    );
  }

  // Determine what to update
  const targetUserId = isRoleChange
    ? roleResult.data.userId
    : isCustomRoleChange
      ? customRoleResult.data.userId
      : statusResult.data!.userId;

  // Resolve the current membership of the target user
  const targetMembership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId,
        userId: targetUserId,
      },
    },
    select: { id: true, role: true, status: true },
  });

  if (!targetMembership) {
    return NextResponse.json(
      { error: "Miembro no encontrado" },
      { status: 404 },
    );
  }

  // Cannot demote the last OWNER (only for role changes)
  if (isRoleChange && targetMembership.role === "OWNER" && roleResult.data!.role !== "OWNER") {
    const ownerCount = await prisma.companyMembership.count({
      where: {
        companyId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "No puedes remover el último Owner del workspace" },
        { status: 403 },
      );
    }
  }

  // Custom roles only apply to EDITOR/VIEWER members
  if (isCustomRoleChange && (targetMembership.role === "OWNER" || targetMembership.role === "ADMIN")) {
    return NextResponse.json(
      { error: "Los miembros Owner y Admin no usan roles personalizados" },
      { status: 403 },
    );
  }

  // Cannot change your own role, custom role, or status
  if (targetUserId === session.user.id) {
    return NextResponse.json(
      {
        error: isRoleChange
          ? "No puedes cambiar tu propio rol"
          : isCustomRoleChange
            ? "No puedes asignarte un rol personalizado"
            : "No puedes cambiar tu propio estado",
      },
      { status: 400 },
    );
  }

  // Cannot toggle status on an OWNER (role change handles OWNER demotion separately)
  if (isStatusChange && targetMembership.role === "OWNER") {
    return NextResponse.json(
      { error: "No puedes suspender al Owner del workspace" },
      { status: 403 },
    );
  }

  if (isStatusChange && statusResult.data!.status === "ACTIVE" && targetMembership.status === "SUSPENDED") {
    try {
      await assertWorkspaceHasSeat(companyId);
    } catch (error) {
      if (error instanceof WorkspaceSeatLimitError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
      }
      throw error;
    }
  }

  // Cannot suspend a member with INVITED status
  if (isStatusChange && targetMembership.status === "INVITED") {
    return NextResponse.json(
      { error: "No puedes suspender a un miembro con invitación pendiente" },
      { status: 400 },
    );
  }

  let customRoleName: string | null = null;
  if (isCustomRoleChange && customRoleResult.data!.customRoleId) {
    const customRole = await prisma.workspaceRole.findFirst({
      where: { id: customRoleResult.data!.customRoleId, companyId },
      select: { id: true, name: true },
    });
    if (!customRole) {
      return NextResponse.json({ error: "Rol personalizado no encontrado" }, { status: 404 });
    }
    customRoleName = customRole.name;
  }

  const updateData = isRoleChange
    ? { role: roleResult.data!.role }
    : isCustomRoleChange
      ? { customRoleId: customRoleResult.data!.customRoleId }
      : {
          status: statusResult.data!.status,
          suspendedUntil: statusResult.data!.status === "SUSPENDED"
            ? (statusResult.data!.suspendedUntil ? new Date(statusResult.data!.suspendedUntil) : null)
            : null,
        };

  const updated = await prisma.companyMembership.update({
    where: { id: targetMembership.id },
    data: updateData,
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      invitedBy: { select: { id: true, name: true } },
      customRole: { select: { id: true, name: true } },
    },
  });

  await recordWorkspaceAudit({
    companyId,
    actorUserId: session.user.id,
    action: isStatusChange
      ? (statusResult.data!.status === "SUSPENDED" ? "MEMBER_SUSPENDED" : "MEMBER_REACTIVATED")
      : "MEMBER_ROLE_CHANGED",
    targetType: "MEMBER",
    targetId: updated.userId,
    targetLabel: updated.user.name ?? updated.user.email,
    metadata: isRoleChange
      ? { role: updated.role }
      : isCustomRoleChange
        ? { customRoleId: updated.customRoleId, customRoleName }
        : { status: updated.status, suspendedUntil: updated.suspendedUntil?.toISOString() ?? null },
  });

  return NextResponse.json({
    member: {
      id: updated.id,
      userId: updated.userId,
      userName: updated.user.name,
      userEmail: updated.user.email,
      userAvatarUrl: updated.user.avatarUrl,
      role: updated.role,
      customRoleId: updated.customRoleId,
      customRoleName: updated.customRole?.name ?? null,
      status: updated.status,
      invitedByName: updated.invitedBy?.name ?? null,
      joinedAt: updated.joinedAt.toISOString(),
      suspendedUntil: updated.suspendedUntil?.toISOString() ?? null,
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyId } = await params;

  // Only OWNER can remove members
  try {
    await assertWorkspaceFeatureAccess({
      userId: session.user.id,
      companyId,
      feature: "workspace.management",
    });
    await assertWorkspaceMembership({
      userId: session.user.id,
      companyId,
      minimumRole: "OWNER",
    });
  } catch {
    return NextResponse.json(
      { error: "Solo el Owner puede remover miembros" },
      { status: 403 },
    );
  }

  let parsed: { userId: string };
  try {
    const body = await request.json();
    parsed = removeMemberSchema.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Se requiere userId válido" },
      { status: 400 },
    );
  }

  // Cannot remove yourself
  if (parsed.userId === session.user.id) {
    return NextResponse.json(
      { error: "No puedes removerte a ti mismo del workspace" },
      { status: 400 },
    );
  }

  // Find the target membership
  const targetMembership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId,
        userId: parsed.userId,
      },
    },
    select: { id: true, role: true },
  });

  if (!targetMembership) {
    return NextResponse.json(
      { error: "Miembro no encontrado" },
      { status: 404 },
    );
  }

  // Cannot remove the last OWNER
  if (targetMembership.role === "OWNER") {
    const ownerCount = await prisma.companyMembership.count({
      where: {
        companyId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "No puedes remover el último Owner del workspace" },
        { status: 403 },
      );
    }
  }

  await prisma.companyMembership.delete({
    where: { id: targetMembership.id },
  });

  await recordWorkspaceAudit({
    companyId,
    actorUserId: session.user.id,
    action: "MEMBER_REMOVED",
    targetType: "MEMBER",
    targetId: parsed.userId,
    metadata: { previousRole: targetMembership.role },
  });

  return NextResponse.json({ ok: true });
}
