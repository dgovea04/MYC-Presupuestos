import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { updateWorkspaceSettings, deleteWorkspace } from "@/lib/workspace/company-settings";
import { companySchema } from "@/lib/validations/company";

const deleteSchema = z.object({ confirmationName: z.string().trim().min(1) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id: companyId } = await params;
  const parsed = companySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el nombre y RUC del workspace" }, { status: 400 });
  try {
    const company = await updateWorkspaceSettings({ companyId, actorUserId: session.user.id, ...parsed.data });
    return NextResponse.json(company);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el workspace" }, { status: 403 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id: companyId } = await params;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escribe el nombre exacto del workspace" }, { status: 400 });
  try {
    const deleted = await deleteWorkspace({ companyId, actorUserId: session.user.id, confirmationName: parsed.data.confirmationName });
    return NextResponse.json({ ok: true, workspace: deleted });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el workspace" }, { status: 403 });
  }
}
