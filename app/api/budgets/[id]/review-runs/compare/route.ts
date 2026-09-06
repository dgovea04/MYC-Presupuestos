import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { compareReviewRuns, type ComparableFinding } from "@/lib/review-intelligence/run-comparison";

const querySchema = z.object({ baseRunId: z.string().min(1), compareRunId: z.string().min(1) });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" });
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Debe indicar ambas ejecuciones" }, { status: 400 });
    const budgetId = (await params).id;
    const runs = await prisma.reviewRun.findMany({ where: { id: { in: [parsed.data.baseRunId, parsed.data.compareRunId] }, budgetId, companyId }, select: { id: true, status: true, progressJson: true } });
    if (runs.length !== 2) return NextResponse.json({ error: "Las ejecuciones no pertenecen al presupuesto" }, { status: 404 });
    const findings = await prisma.reviewFinding.findMany({ where: { reviewRunId: { in: runs.map((run) => run.id) }, budgetId, companyId }, select: { reviewRunId: true, budgetItemId: true, findingType: true, evidenceId: true, status: true, comparisonJson: true } });
    const row = (runId: string): ComparableFinding[] => findings.filter((finding) => finding.reviewRunId === runId).map((finding) => ({ budgetItemId: finding.budgetItemId, findingType: String(finding.findingType), evidenceId: finding.evidenceId, status: String(finding.status), comparison: recordStrings(finding.comparisonJson) }));
    const base = runs.find((run) => run.id === parsed.data.baseRunId)!; const compare = runs.find((run) => run.id === parsed.data.compareRunId)!;
    return NextResponse.json(compareReviewRuns({ baseRun: { id: base.id, status: String(base.status), metrics: readMetrics(base.progressJson) }, compareRun: { id: compare.id, status: String(compare.status), metrics: readMetrics(compare.progressJson) }, baseFindings: row(base.id), compareFindings: row(compare.id) }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron comparar las ejecuciones" }, { status: 403 }); }
}
function recordStrings(value: unknown): Record<string, string> { if (typeof value !== "object" || value === null || Array.isArray(value)) return {}; return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "string")) as Record<string, string>; }
function readMetrics(value: unknown): Record<string, number> { if (typeof value !== "object" || value === null || Array.isArray(value)) return {}; const metrics = (value as Record<string, unknown>).metrics; if (typeof metrics !== "object" || metrics === null || Array.isArray(metrics)) return {}; return Object.fromEntries(Object.entries(metrics).filter(([, item]) => typeof item === "number")) as Record<string, number>; }
