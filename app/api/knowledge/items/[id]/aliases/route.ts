import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession, requireSuperAdminSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { prisma } from "@/lib/db/prisma";
import { addItemAlias } from "@/lib/knowledge/canonical-items";

const schema = z.object({ alias: z.string().min(1) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(); if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const item = await prisma.canonicalItem.findUnique({ where: { id: (await params).id } });
    if (!item) return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
    if (item.scope === "GLOBAL" && !(await requireSuperAdminSession(request))) return NextResponse.json({ error: "Solo un superadministrador puede confirmar alias globales" }, { status: 403 });
    if (item.scope === "COMPANY") { if (!item.companyId) return NextResponse.json({ error: "Scope inválido" }, { status: 400 }); await assertWorkspaceMembership({ userId: session.user.id, companyId: item.companyId, minimumRole: "EDITOR" }); }
    const body = schema.parse(await request.json()); return NextResponse.json(await addItemAlias(item.id, body.alias, true), { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Alias inválido" : error instanceof Error ? error.message : "No se pudo confirmar el alias" }, { status: 400 }); }
}
