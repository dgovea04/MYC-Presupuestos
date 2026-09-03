import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { listFindings } from "@/lib/review-intelligence/findings";

const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25), status: z.enum(["PENDING", "IN_REVIEW", "RESOLVED", "REOPENED", "STALE"]).optional(), findingType: z.enum(["QUANTITY_MISMATCH", "UNIT_INCONSISTENCY", "TECHNICAL_SPEC_MISMATCH", "MISSING_DOCUMENTATION", "INCOMPLETE_APU"]).optional(), severity: z.string().trim().min(1).max(30).optional(), confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(), priority: z.coerce.number().min(0).max(1).optional(), discipline: z.string().trim().min(1).max(100).optional(), subbudget: z.string().trim().min(1).max(100).optional(), document: z.string().trim().min(1).max(100).optional() });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try { await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No tienes acceso al workspace" }, { status: 403 }); }
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Filtros o paginación inválidos" }, { status: 400 });
  try { return NextResponse.json(await listFindings({ ...parsed.data, companyId, reviewRunId: (await params).id })); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar los hallazgos" }, { status: 404 }); }
}
