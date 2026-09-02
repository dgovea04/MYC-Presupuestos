import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { runReviewJob, type ReviewPipelineClient } from "@/lib/review-intelligence/pipeline";
import { parseReviewConfiguration } from "@/lib/review-intelligence/validation";

const requestSchema = z.object({
  configuration: z.unknown(),
  documentVersionIds: z.array(z.string().min(1)).min(1).max(10),
  rulesVersion: z.string().min(1).max(100).default("review-rules-v1"),
}).strict();
const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) });

type Context = { params: Promise<{ id: string }> };

async function budgetForUser(budgetId: string, userId: string, minimumRole: "VIEWER" | "EDITOR") {
  const budget = await prisma.budget.findFirst({ where: { id: budgetId }, select: { id: true, projectId: true, project: { select: { id: true, companyId: true } } } });
  if (!budget) return { response: NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 }) } as const;
  try {
    await assertWorkspaceMembership({ userId, companyId: budget.project.companyId, minimumRole });
  } catch (error) {
    return { response: NextResponse.json({ error: error instanceof Error ? error.message : "No tienes acceso al presupuesto" }, { status: 403 }) } as const;
  }
  return { budget } as const;
}

export async function GET(request: Request, { params }: Context) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id: budgetId } = await params;
  const scope = await budgetForUser(budgetId, session.user.id, "VIEWER");
  if ("response" in scope) return scope.response;
  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({ page: url.searchParams.get("page") ?? undefined, pageSize: url.searchParams.get("pageSize") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "Paginación inválida" }, { status: 400 });
  const { page, pageSize } = parsed.data;
  const runs = await prisma.reviewRun.findMany({ where: { companyId: scope.budget.project.companyId, projectId: scope.budget.projectId, budgetId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, status: true, configurationJson: true, rulesVersion: true, progressJson: true, warningsJson: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true } });
  return NextResponse.json({ runs, page, pageSize, hasNextPage: runs.length === pageSize });
}

export async function POST(request: Request, { params }: Context) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 200) return NextResponse.json({ error: "Idempotency-Key requerido" }, { status: 400 });
  const { id: budgetId } = await params;
  const scope = await budgetForUser(budgetId, session.user.id, "EDITOR");
  if ("response" in scope) return scope.response;
  try {
    const body = requestSchema.parse(await request.json());
    const configuration = parseReviewConfiguration(body.configuration);
    const versions = await prisma.documentVersion.findMany({ where: { id: { in: body.documentVersionIds }, companyId: scope.budget.project.companyId, projectId: scope.budget.projectId }, select: { id: true, companyId: true, projectId: true, projectDocumentId: true } });
    const evidence = await prisma.reviewEvidence.findMany({ where: { companyId: scope.budget.project.companyId, projectId: scope.budget.projectId, documentVersionId: { in: body.documentVersionIds } }, select: { id: true, documentVersionId: true, originalText: true, normalizedText: true, locationJson: true, value: true, unit: true, extractionMethod: true, confidence: true, sourceHash: true, evidenceType: true } });
    const items = await prisma.budgetItem.findMany({ where: { budgetId }, select: { id: true, budgetId: true, code: true, description: true, unit: true, quantity: true, unitPrice: true } });
    const result = await runReviewJob({ companyId: scope.budget.project.companyId, projectId: scope.budget.projectId, budgetId, budgetReference: { id: budgetId, companyId: scope.budget.project.companyId, projectId: scope.budget.projectId }, createdById: session.user.id, documentVersionIds: body.documentVersionIds, documentVersions: versions, configuration, rulesVersion: body.rulesVersion, budgetItems: items, evidence: evidence.map((entry) => ({ id: entry.id, documentVersionId: entry.documentVersionId, originalText: entry.originalText, normalizedText: entry.normalizedText ?? undefined, sourceHash: entry.sourceHash, evidenceType: entry.evidenceType, confidence: entry.confidence, unit: entry.unit ?? undefined, primary: true, locationJson: typeof entry.locationJson === "object" && entry.locationJson !== null && !Array.isArray(entry.locationJson) ? entry.locationJson as Record<string, unknown> : {} })), }, prisma as unknown as ReviewPipelineClient);
    return NextResponse.json({ reviewRunId: result.reviewRunId, status: result.status, idempotencyKey: result.idempotencyKey }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
    if (error instanceof Error && /active review run/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo iniciar la revisión" }, { status: 400 });
  }
}
