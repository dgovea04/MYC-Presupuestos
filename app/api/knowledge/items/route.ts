import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession, requireSuperAdminSession } from "@/lib/auth/session";
import { createCanonicalItem } from "@/lib/knowledge/canonical-items";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";

const schema = z.object({ name: z.string().min(1), canonicalUnit: z.string().optional(), classification: z.string().optional(), specialty: z.string().optional(), scope: z.enum(["GLOBAL", "COMPANY"]).default("COMPANY") }).strict();

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const items = await prisma.canonicalItem.findMany({ where: { normalizedName: { contains: q.toLocaleLowerCase("es-PE") }, OR: [{ scope: "GLOBAL" }, { scope: "COMPANY", companyId }] }, include: { aliases: true }, orderBy: { updatedAt: "desc" }, take: 100 });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    const companyId = session.user.activeCompanyId ?? session.user.companyId;
    if (body.scope === "GLOBAL" && !(await requireSuperAdminSession(request))) return NextResponse.json({ error: "Solo un super administrador puede crear conocimiento global" }, { status: 403 });
    if (body.scope === "COMPANY" && !companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
    if (body.scope === "COMPANY") await assertWorkspaceMembership({ userId: session.user.id, companyId: companyId!, minimumRole: "EDITOR" });
    return NextResponse.json(await createCanonicalItem({ ...body, companyId: body.scope === "GLOBAL" ? undefined : companyId ?? undefined }), { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo crear la partida" }, { status: 400 }); }
}
