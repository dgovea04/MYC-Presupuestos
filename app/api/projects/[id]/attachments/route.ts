import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { storeProjectAttachment, deleteStoredAttachment } from "@/lib/storage/project-attachments";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { projectAttachmentCategoryValues } from "@/lib/validations/attachment";

const attachmentUploadSchema = z.object({
  category: z.enum(projectAttachmentCategoryValues).default("OTRO"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId },
      select: { id: true, companyId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    await assertWorkspaceMembership({
      userId: session.user.id,
      companyId: project.companyId,
      minimumRole: "EDITOR",
    });

    const formData = await request.formData();
    const category = (formData.get("category") as string) ?? "OTRO";
    const parsed = attachmentUploadSchema.parse({ category });

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const stored = await storeProjectAttachment(projectId, file);

    const attachment = await prisma.projectAttachment.create({
      data: {
        projectId,
        fileName: stored.fileName,
        fileType: stored.fileType,
        fileSize: stored.fileSize,
        filePath: stored.filePath,
        category: parsed.category,
        userId: session.user.id,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el archivo" },
      { status: 400 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { id: true, companyId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const attachments = await prisma.projectAttachment.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      filePath: true,
      category: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });

  return NextResponse.json(attachments);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId },
      select: { id: true, companyId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    await assertWorkspaceMembership({
      userId: session.user.id,
      companyId: project.companyId,
      minimumRole: "EDITOR",
    });

    const { attachmentId } = (await request.json()) as { attachmentId: string };
    if (!attachmentId) {
      return NextResponse.json({ error: "ID de archivo requerido" }, { status: 400 });
    }

    const attachment = await prisma.projectAttachment.findFirst({
      where: { id: attachmentId, projectId },
      select: { id: true, filePath: true },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    await prisma.projectAttachment.delete({ where: { id: attachment.id } });
    await deleteStoredAttachment(attachment.filePath);

    revalidatePath(`/projects/${projectId}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el archivo" },
      { status: 400 },
    );
  }
}
