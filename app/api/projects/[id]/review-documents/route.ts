import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { createDocumentVersion, createProjectDocumentAndVersion, validateDocumentFile } from "@/lib/review-intelligence/documents";
import { extractAndPersistDocumentVersion } from "@/lib/review-intelligence/extraction-persistence";
import { markStaleForChange } from "@/lib/review-intelligence/stale";

const categorySchema = z.enum(["PLAN", "TECHNICAL_SPECIFICATION", "QUANTITY_TAKEOFF", "BUDGET", "APU", "OTHER"]);
const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(25);
const clearDocumentsSchema = z.object({ confirmation: z.literal("ELIMINAR DOCUMENTOS FUENTE") }).strict();

type RouteContext = { params: Promise<{ id: string }> };

async function projectForUser(projectId: string, userId: string, currentCompanyId: string | null | undefined, minimumRole: "VIEWER" | "EDITOR") {
  if (!currentCompanyId) return { response: NextResponse.json({ error: "Workspace no disponible" }, { status: 403 }) } as const;
  try { await assertWorkspaceMembership({ userId, companyId: currentCompanyId, minimumRole }); } catch (error) { return { response: NextResponse.json({ error: error instanceof Error ? error.message : "No tienes acceso al workspace" }, { status: 403 }) } as const; }
  const project = await prisma.project.findFirst({ where: { id: projectId }, select: { id: true, companyId: true } });
  if (!project) return { response: NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 }) } as const;
  if (project.companyId !== currentCompanyId) return { response: NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 }) } as const;
  return { project } as const;
}

export async function GET(request: Request, { params }: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id: projectId } = await params;
  const scope = await projectForUser(projectId, session.user.id, session.user.activeCompanyId ?? session.user.companyId, "VIEWER");
  if ("response" in scope) return scope.response;
  const url = new URL(request.url);
  const parsed = z.object({ page: pageSchema, pageSize: pageSizeSchema }).safeParse({ page: url.searchParams.get("page") ?? undefined, pageSize: url.searchParams.get("pageSize") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "Paginación inválida" }, { status: 400 });
  const { page, pageSize } = parsed.data;
  const documents = await prisma.projectDocument.findMany({
    where: { companyId: scope.project.companyId, projectId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: { id: true, name: true, originalFileName: true, category: true, status: true, currentVersionId: true, createdAt: true, updatedAt: true, currentVersion: { select: { id: true, versionNumber: true, mimeType: true, fileSizeBytes: true, sha256: true, extractionStatus: true, extractionWarnings: true, pageCount: true, sheetCount: true } } },
  });
  return NextResponse.json({ documents: documents.slice(0, pageSize), page, pageSize, hasNextPage: documents.length > pageSize });
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id: projectId } = await params;
  const scope = await projectForUser(projectId, session.user.id, session.user.activeCompanyId ?? session.user.companyId, "EDITOR");
  if ("response" in scope) return scope.response;
  try {
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) return NextResponse.json({ error: "Idempotency-Key requerido" }, { status: 400 });
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    const category = categorySchema.parse(formData.get("category") ?? "OTHER");
    const validated = await validateDocumentFile(file);
    const targetDocumentId = String(formData.get("documentId") ?? "");
    const storageKey = `review-documents/${scope.project.companyId}/${projectId}/${idempotencyKey}/${targetDocumentId || "new"}/${validated.sha256}`;
    if (typeof prisma.documentVersion.findMany === "function") {
      const previous = await prisma.documentVersion.findMany({ where: { companyId: scope.project.companyId, projectId, storageKey: { startsWith: `review-documents/${scope.project.companyId}/${projectId}/${idempotencyKey}/` } }, select: { id: true, projectDocumentId: true, storageKey: true, sha256: true } });
      if (previous.some((version) => version.storageKey !== storageKey || version.sha256 !== validated.sha256 || (targetDocumentId && version.projectDocumentId !== targetDocumentId))) throw new Error("Idempotency key conflict: target or payload differs.");
    }
    const result = targetDocumentId ? await createDocumentVersion({ companyId: scope.project.companyId, projectId, projectDocumentId: targetDocumentId, storageKey, file }, prisma as unknown as Parameters<typeof createDocumentVersion>[1]).then((version) => ({ document: { id: targetDocumentId }, version })) : await createProjectDocumentAndVersion({ companyId: scope.project.companyId, projectId, createdById: session.user.id, name: String(formData.get("name") ?? file.name), originalFileName: file.name, category, storageKey, file }, prisma as unknown as Parameters<typeof createProjectDocumentAndVersion>[1]);
    await extractAndPersistDocumentVersion({ file, version: result.version, companyId: scope.project.companyId, projectId }, prisma as unknown as Parameters<typeof extractAndPersistDocumentVersion>[1]);
    await markStaleForChange({ companyId: scope.project.companyId, projectId, kind: "document-replacement", id: result.version.id, payload: result.version.sha256, actorUserId: session.user.id }, prisma);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
    const message = error instanceof Error ? error.message : "No se pudo cargar el documento";
    return NextResponse.json({ error: message }, { status: /idempotency key conflict/i.test(message) ? 409 : 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id: projectId } = await params;
  const scope = await projectForUser(projectId, session.user.id, session.user.activeCompanyId ?? session.user.companyId, "EDITOR");
  if ("response" in scope) return scope.response;
  try {
    clearDocumentsSchema.parse(await request.json());
    const documents = await prisma.projectDocument.findMany({ where: { companyId: scope.project.companyId, projectId }, select: { id: true, currentVersionId: true } });
    const documentIds = documents.map((document) => document.id);
    const versionIds = documents.flatMap((document) => document.currentVersionId ? [document.currentVersionId] : []);
    const versions = versionIds.length > 0 ? await prisma.documentVersion.findMany({ where: { companyId: scope.project.companyId, projectId, projectDocumentId: { in: documentIds } }, select: { id: true } }) : [];
    const allVersionIds = versions.map((version) => version.id);
    const runs = await prisma.reviewRun.findMany({ where: { companyId: scope.project.companyId, projectId }, select: { id: true } });
    const runIds = runs.map((run) => run.id);
    await prisma.$transaction(async (transaction) => {
      if (runIds.length > 0) {
        await transaction.findingDecision.deleteMany({ where: { finding: { reviewRunId: { in: runIds }, companyId: scope.project.companyId, projectId } } });
        await transaction.reviewFinding.deleteMany({ where: { reviewRunId: { in: runIds }, companyId: scope.project.companyId, projectId } });
        await transaction.reviewAuditEvent.deleteMany({ where: { reviewRunId: { in: runIds }, companyId: scope.project.companyId, projectId } });
        await transaction.reviewRunDocumentVersion.deleteMany({ where: { reviewRunId: { in: runIds }, companyId: scope.project.companyId, projectId } });
        await transaction.reviewRun.deleteMany({ where: { id: { in: runIds }, companyId: scope.project.companyId, projectId } });
      }
      if (documentIds.length > 0) await transaction.projectDocument.updateMany({ where: { id: { in: documentIds }, companyId: scope.project.companyId, projectId }, data: { currentVersionId: null } });
      if (allVersionIds.length > 0) await transaction.documentVersion.deleteMany({ where: { id: { in: allVersionIds }, companyId: scope.project.companyId, projectId } });
      if (documentIds.length > 0) await transaction.projectDocument.deleteMany({ where: { id: { in: documentIds }, companyId: scope.project.companyId, projectId } });
    });
    return NextResponse.json({ deletedDocuments: documentIds.length });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Escribe exactamente ELIMINAR DOCUMENTOS FUENTE para confirmar." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron eliminar los documentos fuente." }, { status: 400 });
  }
}
