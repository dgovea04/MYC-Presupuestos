import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { retrieveCanonicalItems } from "@/lib/knowledge/retrieval";
import { assertWorkspaceMembership, assertProjectInWorkspace } from "@/lib/workspace/access";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? session.user.activeCompanyId ?? session.user.companyId;
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!companyId || !query) return NextResponse.json({ error: "companyId y q son requeridos" }, { status: 400 });
  try {
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" });
    const projectId = url.searchParams.get("projectId") ?? undefined;
    if (projectId) await assertProjectInWorkspace({ companyId, projectId });
    return NextResponse.json({ items: await retrieveCanonicalItems({ companyId, projectId, query, limit: Number(url.searchParams.get("limit") ?? "20") }) });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo recuperar conocimiento" }, { status: 403 }); }
}
