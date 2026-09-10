import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession, requireSuperAdminSession } from "@/lib/auth/session";
import { createCanonicalResource } from "@/lib/knowledge/canonical-resources";
import { prisma } from "@/lib/db/prisma";
import { assertKnowledgeReadAccess, assertKnowledgeWriteAccess } from "@/lib/knowledge/api-access";
import { knowledgeRouteErrorResponse } from "@/lib/knowledge/route-errors";

const schema = z.object({ name: z.string().min(1), category: z.string().min(1), canonicalUnit: z.string().optional(), scope: z.enum(["GLOBAL", "COMPANY"]).default("COMPANY") }).strict();

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertKnowledgeReadAccess({ actorUserId: session.user.id, companyId, scope: "COMPANY" });
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const resources = await prisma.canonicalResource.findMany({ where: { normalizedName: { contains: q.toLocaleLowerCase("es-PE") }, OR: [{ scope: "GLOBAL" }, { scope: "COMPANY", companyId }] }, include: { aliases: true }, orderBy: { updatedAt: "desc" }, take: 100 });
    return NextResponse.json({ resources });
  } catch (error) {
    return knowledgeRouteErrorResponse(error, "No se pudieron consultar los recursos");
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    const companyId = session.user.activeCompanyId ?? session.user.companyId;
    const globalSession = body.scope === "GLOBAL" ? await requireSuperAdminSession(request) : null;
    if (body.scope === "GLOBAL" && !globalSession) return NextResponse.json({ error: "Solo un super administrador puede crear conocimiento global" }, { status: 403 });
    if (body.scope === "COMPANY" && !companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
    await assertKnowledgeWriteAccess({ actorUserId: session.user.id, companyId: body.scope === "GLOBAL" ? undefined : companyId ?? undefined, scope: body.scope, capability: globalSession ? "knowledge.manage" : undefined });
    return NextResponse.json(await createCanonicalResource({ ...body, companyId: body.scope === "GLOBAL" ? undefined : companyId ?? undefined }), { status: 201 });
  } catch (error) { return knowledgeRouteErrorResponse(error, "No se pudo crear el recurso"); }
}
