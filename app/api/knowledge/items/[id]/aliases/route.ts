import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession, requireSuperAdminSession } from "@/lib/auth/session";
import { assertKnowledgeEntityAccess } from "@/lib/knowledge/api-access";
import { prisma } from "@/lib/db/prisma";
import { addItemAlias } from "@/lib/knowledge/canonical-items";

const schema = z.object({ alias: z.string().min(1) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(); if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const item = await prisma.canonicalItem.findUnique({ where: { id: (await params).id } });
    if (!item) return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
    if (item.scope === "GLOBAL" && !(await requireSuperAdminSession(request))) return NextResponse.json({ error: "Solo un superadministrador puede confirmar alias globales" }, { status: 403 });
    const companyId = session.user.activeCompanyId ?? session.user.companyId;
    if (!companyId) return NextResponse.json({ error: "No hay company activa" }, { status: 403 });
    await assertKnowledgeEntityAccess({ actorUserId: session.user.id, entityType: "CanonicalItem", entityId: item.id, companyId, minimumRole: "EDITOR" });
    const body = schema.parse(await request.json()); return NextResponse.json(await addItemAlias(item.id, body.alias, true), { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Alias inválido" : error instanceof Error ? error.message : "No se pudo confirmar el alias" }, { status: 400 }); }
}
