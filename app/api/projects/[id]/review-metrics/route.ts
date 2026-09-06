import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { calculateReviewPilotMetrics } from "@/lib/review-intelligence/pilot-metrics";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id: projectId } = await params;
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try { await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No tienes acceso al workspace" }, { status: 403 }); }
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get("from"), new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), false);
  const to = parseDate(url.searchParams.get("to"), new Date(), true);
  if (!from || !to || from > to) return NextResponse.json({ error: "La ventana de métricas es inválida" }, { status: 400 });
  const runs = await prisma.reviewRun.findMany({ where: { companyId, projectId, createdAt: { gte: from, lte: to } }, select: { id: true, status: true, createdAt: true, startedAt: true, finishedAt: true, progressJson: true } });
  const runIds = runs.map((run) => run.id);
  const [findings, decisions] = runIds.length === 0 ? [[], []] : await Promise.all([
    prisma.reviewFinding.findMany({ where: { companyId, projectId, reviewRunId: { in: runIds } }, select: { findingType: true, status: true, createdAt: true } }),
    prisma.findingDecision.findMany({ where: { companyId, projectId, finding: { reviewRunId: { in: runIds } } }, select: { resolution: true, createdAt: true } }),
  ]);
  const metrics = calculateReviewPilotMetrics({ window: { from, to }, runs: runs.map((run) => ({ status: String(run.status), createdAt: run.createdAt, startedAt: run.startedAt, finishedAt: run.finishedAt, coveragePercent: readCoverage(run.progressJson) })), findings: findings.map((finding) => ({ findingType: String(finding.findingType), status: String(finding.status), createdAt: finding.createdAt })), decisions: decisions.map((decision) => ({ resolution: String(decision.resolution), createdAt: decision.createdAt })) });
  return NextResponse.json(metrics);
}

function parseDate(value: string | null, fallback: Date, endOfDay: boolean): Date | null { if (!value) return fallback; const date = new Date(value.length === 10 ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : value); return Number.isNaN(date.getTime()) ? null : date; }
function readCoverage(value: unknown): number { if (typeof value !== "object" || value === null || Array.isArray(value)) return 0; const metrics = (value as Record<string, unknown>).metrics; if (typeof metrics !== "object" || metrics === null || Array.isArray(metrics)) return 0; const coverage = (metrics as Record<string, unknown>).coveragePercent; return typeof coverage === "number" && Number.isFinite(coverage) ? coverage : 0; }
