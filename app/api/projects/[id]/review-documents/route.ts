import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { createProjectDocumentAndVersion, validateDocumentFile } from "@/lib/review-intelligence/documents";

const categorySchema = z.enum(["PLAN", "TECHNICAL_SPECIFICATION", "QUANTITY_TAKEOFF", "BUDGET", "APU", "OTHER"]);
const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(25);

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
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    const category = categorySchema.parse(formData.get("category") ?? "OTHER");
    await validateDocumentFile(file);
    const result = await createProjectDocumentAndVersion({ companyId: scope.project.companyId, projectId, createdById: session.user.id, name: String(formData.get("name") ?? file.name), originalFileName: file.name, category, storageKey: `review-documents/${scope.project.companyId}/${projectId}/${randomUUID()}`, file }, prisma as unknown as Parameters<typeof createProjectDocumentAndVersion>[1]);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar el documento" }, { status: 400 });
  }
}
