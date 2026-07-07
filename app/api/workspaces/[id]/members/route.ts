import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { inviteWorkspaceMemberSchema, changeRoleSchema, removeMemberSchema, toggleStatusSchema } from "@/lib/validations/workspace";

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
    await assertWorkspaceMembership({
      userId: session.user.id,
      companyId,
      minimumRole: "ADMIN",
    });
  } catch {
    return NextResponse.json(
      { error: "No tienes permisos para ver los miembros de este workspace" },
      { status: 403 },
    );
  }

  const members = await prisma.companyMembership.findMany({
    where: { companyId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      invitedBy: { select: { id: true, name: true } },
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
      status: m.status,
      invitedByName: m.invitedBy?.name ?? null,
      joinedAt: m.joinedAt.toISOString(),
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

  const normalizedEmail = parsed.email.toLowerCase();

  // Find the user by email
  const invitee = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true },
  });

  if (!invitee) {
    return NextResponse.json(
      { error: "No se encontró un usuario con ese email" },
      { status: 404 },
    );
  }

  // Cannot invite yourself
  if (invitee.id === session.user.id) {
    return NextResponse.json(
      { error: "No puedes invitarte a ti mismo" },
      { status: 400 },
    );
  }

  // Check if user is already a member
  const existingMembership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId,
        userId: invitee.id,
      },
    },
    select: { status: true, role: true },
  });

  if (existingMembership) {
    const statusLabel =
      existingMembership.status === "ACTIVE"
        ? "ya es miembro activo"
        : existingMembership.status === "INVITED"
          ? "ya tiene una invitación pendiente"
          : "está suspendido";
    return NextResponse.json(
      {
        error: `El usuario ${statusLabel} de este workspace`,
        existingStatus: existingMembership.status,
      },
      { status: 409 },
    );
  }

  // Create the membership with INVITED status
  const membership = await prisma.companyMembership.create({
    data: {
      companyId,
      userId: invitee.id,
      role: "EDITOR",
      status: "INVITED",
      invitedById: session.user.id,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      invitedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(
    {
      member: {
        id: membership.id,
        userId: membership.userId,
        userName: membership.user.name,
        userEmail: membership.user.email,
        userAvatarUrl: membership.user.avatarUrl,
        role: membership.role,
        status: membership.status,
        invitedByName: membership.invitedBy?.name ?? null,
        joinedAt: membership.joinedAt.toISOString(),
      },
    },
    { status: 201 },
  );
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

  // Try role change first, then status toggle
  const roleResult = changeRoleSchema.safeParse(body);
  const statusResult = toggleStatusSchema.safeParse(body);

  if (!roleResult.success && !statusResult.success) {
    return NextResponse.json(
      { error: "Se requiere userId con role o status válidos" },
      { status: 400 },
    );
  }

  // Determine what to update
  const targetUserId = roleResult.success ? roleResult.data.userId : statusResult.data!.userId;
  const isRoleChange = roleResult.success;

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

  // Cannot change your own role or status
  if (targetUserId === session.user.id) {
    return NextResponse.json(
      { error: isRoleChange ? "No puedes cambiar tu propio rol" : "No puedes cambiar tu propio estado" },
      { status: 400 },
    );
  }

  // Cannot toggle status on an OWNER (role change handles OWNER demotion separately)
  if (!isRoleChange && targetMembership.role === "OWNER") {
    return NextResponse.json(
      { error: "No puedes suspender al Owner del workspace" },
      { status: 403 },
    );
  }

  // Cannot suspend a member with INVITED status
  if (!isRoleChange && targetMembership.status === "INVITED") {
    return NextResponse.json(
      { error: "No puedes suspender a un miembro con invitación pendiente" },
      { status: 400 },
    );
  }

  const updateData = isRoleChange
    ? { role: roleResult.data!.role }
    : { status: statusResult.data!.status };

  const updated = await prisma.companyMembership.update({
    where: { id: targetMembership.id },
    data: updateData,
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      invitedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    member: {
      id: updated.id,
      userId: updated.userId,
      userName: updated.user.name,
      userEmail: updated.user.email,
      userAvatarUrl: updated.user.avatarUrl,
      role: updated.role,
      status: updated.status,
      invitedByName: updated.invitedBy?.name ?? null,
      joinedAt: updated.joinedAt.toISOString(),
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

  return NextResponse.json({ ok: true });
}
