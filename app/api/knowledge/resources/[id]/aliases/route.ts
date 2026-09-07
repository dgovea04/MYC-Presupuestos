import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { prisma } from "@/lib/db/prisma";
import { addResourceAlias } from "@/lib/knowledge/canonical-resources";

const schema = z.object({ alias: z.string().min(1) }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const session = await getAuthSession(); if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 }); try { const resource = await prisma.canonicalResource.findUnique({ where: { id: (await params).id } }); if (!resource) return NextResponse.json({ error: "Recurso no encontrado" }, { status: 404 }); if (resource.scope === "COMPANY") { if (!resource.companyId) return NextResponse.json({ error: "Scope inválido" }, { status: 400 }); await assertWorkspaceMembership({ userId: session.user.id, companyId: resource.companyId, minimumRole: "EDITOR" }); } const body = schema.parse(await request.json()); return NextResponse.json(await addResourceAlias(resource.id, body.alias, true), { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Alias inválido" : error instanceof Error ? error.message : "No se pudo confirmar el alias" }, { status: 400 }); } }
