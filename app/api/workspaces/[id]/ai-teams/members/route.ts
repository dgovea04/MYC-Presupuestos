import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({ teamId: z.string().min(1), userId: z.string().min(1), role: z.string().trim().min(1).max(40).default("MEMBER") });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: companyId } = await params;
  try {
    await requireWorkspaceRole({ userId: session.user.id, companyId, minimumRole: "ADMIN" });
    const input = schema.parse(await request.json());
    const [team, membership] = await Promise.all([prisma.workspaceTeam.findUnique({ where: { id: input.teamId }, select: { companyId: true } }), prisma.companyMembership.findUnique({ where: { companyId_userId: { companyId, userId: input.userId } }, select: { status: true } })]);
    if (!team || team.companyId !== companyId) return NextResponse.json({ error: "El equipo no pertenece al workspace." }, { status: 403 });
    if (!membership || membership.status !== "ACTIVE") return NextResponse.json({ error: "El usuario no pertenece activamente al workspace." }, { status: 403 });
    const member = await prisma.workspaceTeamMember.upsert({ where: { teamId_userId: { teamId: input.teamId, userId: input.userId } }, create: { teamId: input.teamId, companyId, userId: input.userId, role: input.role }, update: { role: input.role } });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo añadir el miembro." }, { status: 400 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: companyId } = await params;
  try { await requireWorkspaceRole({ userId: session.user.id, companyId, minimumRole: "ADMIN" }); const input = schema.pick({ teamId: true, userId: true }).parse(await request.json()); const member = await prisma.workspaceTeamMember.findUnique({ where: { teamId_userId: { teamId: input.teamId, userId: input.userId } }, select: { id: true, companyId: true } }); if (!member || member.companyId !== companyId) return NextResponse.json({ error: "Miembro no encontrado." }, { status: 404 }); await prisma.workspaceTeamMember.delete({ where: { id: member.id } }); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el miembro." }, { status: 400 }); }
}
