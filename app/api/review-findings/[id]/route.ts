import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { getFinding } from "@/lib/review-intelligence/findings";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try { await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" }); return NextResponse.json(await getFinding((await params).id, companyId)); } catch (error) { const message = error instanceof Error ? error.message : "No se pudo cargar el hallazgo"; return NextResponse.json({ error: message }, { status: /access|workspace|rol|acceso/i.test(message) ? 403 : 404 }); }
}
