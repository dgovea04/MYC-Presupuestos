import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { buildReviewSummaryExport } from "@/lib/review-intelligence/exports";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" });
    const { id: budgetId, runId } = await params;
    const run = await prisma.reviewRun.findFirst({ where: { id: runId, budgetId, companyId }, select: { id: true, status: true, createdAt: true, rulesVersion: true, progressJson: true } });
    if (!run) return NextResponse.json({ error: "Ejecución no encontrada" }, { status: 404 });
    const findings = await prisma.reviewFinding.findMany({ where: { reviewRunId: run.id, budgetId, companyId }, orderBy: [{ id: "asc" }], select: { id: true, findingType: true, status: true, priority: true, potentialImpact: true, comparisonJson: true, budgetItem: { select: { code: true, description: true } }, evidence: { select: { locationJson: true, documentVersion: { select: { projectDocument: { select: { name: true, originalFileName: true } } } } } } } });
    const payload = buildReviewSummaryExport({ run: { id: run.id, status: String(run.status), createdAt: run.createdAt.toISOString(), rulesVersion: run.rulesVersion }, metrics: readMetrics(run.progressJson), findings: findings.map((finding) => ({ id: finding.id, budgetItemCode: finding.budgetItem?.code ?? null, description: finding.budgetItem?.description ?? null, findingType: String(finding.findingType), status: String(finding.status), priority: finding.priority.toString(), potentialImpact: finding.potentialImpact?.toString() ?? null, evidenceSource: finding.evidence.documentVersion.projectDocument.name || finding.evidence.documentVersion.projectDocument.originalFileName, evidenceLocation: JSON.stringify(finding.evidence.locationJson) })) });
    const format = new URL(request.url).searchParams.get("format") ?? "csv";
    if (format === "json") return new NextResponse(JSON.stringify(payload.json, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="revision-${run.id}.json"` } });
    if (format !== "csv") return NextResponse.json({ error: "Formato no soportado" }, { status: 400 });
    return new NextResponse(payload.csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="revision-${run.id}.csv"` } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo exportar la revisión" }, { status: 403 }); }
}

function readMetrics(value: unknown): Record<string, number> { if (typeof value !== "object" || value === null || Array.isArray(value)) return {}; const metrics = (value as Record<string, unknown>).metrics; if (typeof metrics !== "object" || metrics === null || Array.isArray(metrics)) return {}; return Object.fromEntries(Object.entries(metrics).filter(([, item]) => typeof item === "number")) as Record<string, number>; }
