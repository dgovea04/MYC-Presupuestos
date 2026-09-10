import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession, requireSuperAdminSession } from "@/lib/auth/session";
import { assertKnowledgeWriteAccess } from "@/lib/knowledge/api-access";
import { addItemAlias } from "@/lib/knowledge/canonical-items";
import { knowledgeRouteErrorResponse } from "@/lib/knowledge/route-errors";

const schema = z.object({ alias: z.string().min(1) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession(); if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const itemId = (await params).id;
    const companyId = session.user.activeCompanyId ?? session.user.companyId;
    const globalSession = await requireSuperAdminSession(request);
    await assertKnowledgeWriteAccess({ actorUserId: session.user.id, entityType: "CanonicalItem", entityId: itemId, companyId: companyId ?? undefined, minimumRole: "EDITOR", capability: globalSession ? "knowledge.manage" : undefined });
    const body = schema.parse(await request.json()); return NextResponse.json(await addItemAlias(itemId, body.alias, true), { status: 201 });
  } catch (error) { return knowledgeRouteErrorResponse(error, "No se pudo confirmar el alias"); }
}
