import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { inviteWorkspaceMemberSchema } from "@/lib/validations/workspace";

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
