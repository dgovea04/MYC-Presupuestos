import { after, NextResponse } from "next/server";
import Decimal from "decimal.js";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { runReviewJob, type ReviewPipelineClient } from "@/lib/review-intelligence/pipeline";
import { parseReviewConfiguration } from "@/lib/review-intelligence/validation";
import { assertReviewRunLimits, ReviewRunLimitError } from "@/lib/review-intelligence/limits";

const requestSchema = z.object({
  configuration: z.unknown(),
  documentVersionIds: z.array(z.string().min(1)).min(1).max(10),
  rulesVersion: z.string().min(1).max(100).default("review-rules-v1"),
}).strict();
const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) });
const clearHistorySchema = z.object({ confirmation: z.literal("LIMPIAR REVISIONES") }).strict();

type Context = { params: Promise<{ id: string }> };

async function budgetForUser(budgetId: string, userId: string, currentCompanyId: string | null | undefined, minimumRole: "VIEWER" | "EDITOR") {
  if (!currentCompanyId) return { response: NextResponse.json({ error: "Workspace no disponible" }, { status: 403 }) } as const;
  try { await assertWorkspaceMembership({ userId, companyId: currentCompanyId, minimumRole }); } catch (error) { return { response: NextResponse.json({ error: error instanceof Error ? error.message : "No tienes acceso al workspace" }, { status: 403 }) } as const; }
  const budget = await prisma.budget.findFirst({ where: { id: budgetId }, select: { id: true, projectId: true, project: { select: { id: true, companyId: true } } } });
  if (!budget) return { response: NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 }) } as const;
  if (budget.project.companyId !== currentCompanyId) return { response: NextResponse.json({ error: "No tienes acceso a este presupuesto" }, { status: 403 }) } as const;
  return { budget } as const;
}

export async function GET(request: Request, { params }: Context) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id: budgetId } = await params;
  const scope = await budgetForUser(budgetId, session.user.id, session.user.activeCompanyId ?? session.user.companyId, "VIEWER");
  if ("response" in scope) return scope.response;
  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({ page: url.searchParams.get("page") ?? undefined, pageSize: url.searchParams.get("pageSize") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "Paginación inválida" }, { status: 400 });
  const { page, pageSize } = parsed.data;
  const runs = await prisma.reviewRun.findMany({ where: { companyId: scope.budget.project.companyId, projectId: scope.budget.projectId, budgetId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize + 1, select: { id: true, status: true, configurationJson: true, rulesVersion: true, progressJson: true, warningsJson: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true } });
  return NextResponse.json({ runs: runs.slice(0, pageSize), page, pageSize, hasNextPage: runs.length > pageSize });
}

export async function POST(request: Request, { params }: Context) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 200) return NextResponse.json({ error: "Idempotency-Key requerido" }, { status: 400 });
  const { id: budgetId } = await params;
  const scope = await budgetForUser(budgetId, session.user.id, session.user.activeCompanyId ?? session.user.companyId, "EDITOR");
  if ("response" in scope) return scope.response;
  try {
    const body = requestSchema.parse(await request.json());
    const configuration = parseReviewConfiguration(body.configuration);
    const versions = await prisma.documentVersion.findMany({ where: { id: { in: body.documentVersionIds }, companyId: scope.budget.project.companyId, projectId: scope.budget.projectId }, select: { id: true, companyId: true, projectId: true, projectDocumentId: true, fileSizeBytes: true, mimeType: true, pageCount: true, sheetCount: true } });
    if (versions.length !== body.documentVersionIds.length) throw new Error("Alguna versión de documento no pertenece al proyecto solicitado.");
    assertReviewRunLimits(configuration, versions);
    const evidence = await prisma.reviewEvidence.findMany({ where: { companyId: scope.budget.project.companyId, projectId: scope.budget.projectId, documentVersionId: { in: body.documentVersionIds } }, select: { id: true, documentVersionId: true, originalText: true, normalizedText: true, locationJson: true, value: true, unit: true, extractionMethod: true, confidence: true, sourceHash: true, evidenceType: true, metadataJson: true } });
    const budgets = await prisma.budget.findMany({ where: { project: { companyId: scope.budget.project.companyId }, projectId: scope.budget.projectId }, select: { id: true, parentBudgetId: true } });
    const budgetIds = new Set<string>([budgetId]);
    let frontier = [budgetId];
    while (frontier.length > 0) {
      const children = budgets.filter((budget) => budget.parentBudgetId !== null && frontier.includes(budget.parentBudgetId));
      frontier = children.map((budget) => budget.id).filter((id) => !budgetIds.has(id));
      frontier.forEach((id) => budgetIds.add(id));
    }
    const items = await prisma.budgetItem.findMany({ where: { budgetId: { in: [...budgetIds] } }, select: { id: true, budgetId: true, code: true, description: true, unit: true, quantity: true, unitPrice: true, discipline: true, apu: { select: { name: true, resources: { select: { quantity: true, resource: { select: { code: true, description: true } }, catalogPartida: { select: { description: true } } } } } } } });
    const reviewItems = items.map((item) => ({ ...item, discipline: item.discipline ?? undefined, technicalSpecification: item.apu?.name ?? undefined, apuComponents: item.apu?.resources.map((resource) => resource.resource?.description ?? resource.resource?.code ?? resource.catalogPartida?.description).filter((value): value is string => typeof value === "string" && value.length > 0) }));
    const input = { companyId: scope.budget.project.companyId, projectId: scope.budget.projectId, budgetId, budgetReference: { id: budgetId, companyId: scope.budget.project.companyId, projectId: scope.budget.projectId }, createdById: session.user.id, documentVersionIds: body.documentVersionIds, documentVersions: versions, configuration, rulesVersion: body.rulesVersion, idempotencyKey, defer: true, budgetItems: reviewItems, evidence: evidence.map((entry) => { const metadata = typeof entry.metadataJson === "object" && entry.metadataJson !== null && !Array.isArray(entry.metadataJson) ? entry.metadataJson as Record<string, unknown> : {}; const metadataQuantity = typeof metadata.quantity === "string" && /^-?\d+(?:\.\d+)?$/.test(metadata.quantity) ? new Decimal(metadata.quantity) : undefined; const components = Array.isArray(metadata.apuComponents) ? metadata.apuComponents.filter((value): value is string => typeof value === "string") : undefined; return { id: entry.id, documentVersionId: entry.documentVersionId, originalText: entry.originalText, normalizedText: entry.normalizedText ?? undefined, sourceHash: entry.sourceHash, evidenceType: entry.evidenceType, confidence: entry.confidence, unit: typeof metadata.unit === "string" ? metadata.unit : entry.unit ?? undefined, quantity: metadataQuantity ?? entry.value ?? undefined, code: typeof metadata.code === "string" ? metadata.code : undefined, description: typeof metadata.description === "string" ? metadata.description : undefined, technicalSpecification: typeof metadata.technicalSpec === "string" ? metadata.technicalSpec : typeof metadata.spec === "string" ? metadata.spec : undefined, discipline: typeof metadata.discipline === "string" ? metadata.discipline : undefined, attributes: typeof metadata.attributes === "object" && metadata.attributes !== null ? metadata.attributes as Record<string, string> : undefined, apuComponents: components, primary: true, locationJson: typeof entry.locationJson === "object" && entry.locationJson !== null && !Array.isArray(entry.locationJson) ? entry.locationJson as Record<string, unknown> : {} }; }) };
    const result = await runReviewJob(input, prisma as unknown as ReviewPipelineClient);
    after(async () => {
      await runReviewJob({ ...input, defer: false }, prisma as unknown as ReviewPipelineClient);
    });
    return NextResponse.json({ reviewRunId: result.reviewRunId, status: result.status, idempotencyKey: result.idempotencyKey }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
    if (error instanceof ReviewRunLimitError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    if (error instanceof Error && /active review run|idempotency key was reused/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo iniciar la revisión" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id: budgetId } = await params;
  const scope = await budgetForUser(budgetId, session.user.id, session.user.activeCompanyId ?? session.user.companyId, "EDITOR");
  if ("response" in scope) return scope.response;
  try {
    clearHistorySchema.parse(await request.json());
    const runs = await prisma.reviewRun.findMany({ where: { companyId: scope.budget.project.companyId, projectId: scope.budget.projectId, budgetId }, select: { id: true } });
    const runIds = runs.map((run) => run.id);
    if (runIds.length === 0) return NextResponse.json({ deletedRuns: 0 });
    await prisma.$transaction(async (transaction) => {
      await transaction.findingDecision.deleteMany({ where: { finding: { reviewRunId: { in: runIds }, companyId: scope.budget.project.companyId, projectId: scope.budget.projectId } } });
      await transaction.reviewFinding.deleteMany({ where: { reviewRunId: { in: runIds }, companyId: scope.budget.project.companyId, projectId: scope.budget.projectId } });
      await transaction.reviewAuditEvent.deleteMany({ where: { reviewRunId: { in: runIds }, companyId: scope.budget.project.companyId, projectId: scope.budget.projectId } });
      await transaction.reviewRunDocumentVersion.deleteMany({ where: { reviewRunId: { in: runIds }, companyId: scope.budget.project.companyId, projectId: scope.budget.projectId } });
      await transaction.reviewRun.deleteMany({ where: { id: { in: runIds }, companyId: scope.budget.project.companyId, projectId: scope.budget.projectId, budgetId } });
    });
    return NextResponse.json({ deletedRuns: runIds.length });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Escribe exactamente LIMPIAR REVISIONES para confirmar." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo limpiar el historial de revisiones." }, { status: 400 });
  }
}
