import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import { prisma } from "@/lib/db/prisma";
import { recordAiCredentialAudit } from "@/lib/ai/credentials/audit";

const inputSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).optional() });
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 }); const { id: companyId } = await params; try { await requireWorkspaceRole({ userId: session.user.id, companyId, minimumRole: "VIEWER" }); return NextResponse.json({ teams: await prisma.workspaceTeam.findMany({ where: { companyId }, include: { _count: { select: { memberships: true, credentials: true } } }, orderBy: { name: "asc" } }) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No autorizado" }, { status: 403 }); } }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const session = await getAuthSession(); if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 }); const { id: companyId } = await params; try { await requireWorkspaceRole({ userId: session.user.id, companyId, minimumRole: "ADMIN" }); const body = inputSchema.parse(await request.json()); const team = await prisma.workspaceTeam.create({ data: { companyId, ...body } }); await recordAiCredentialAudit({ operation: "POLICY_UPDATED", actorUserId: session.user.id, workspaceId: companyId, metadata: { action: "TEAM_CREATED", teamId: team.id } }); return NextResponse.json({ team }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el equipo." }, { status: 400 }); } }
