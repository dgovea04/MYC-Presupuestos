import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { listProjectAccess, revokeProjectAccess, shareProjectAccess } from "@/lib/workspace/project-access";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { revokeProjectAccessSchema, shareProjectAccessSchema } from "@/lib/validations/workspace";

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof WorkspaceAuthorizationError ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  try {
    const shares = await listProjectAccess({ actorUserId: session.user.id, projectId });
    return NextResponse.json({ shares });
  } catch (error) {
    return errorResponse(error, "No se pudo listar los accesos del proyecto");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  const parsed = shareProjectAccessSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Se requiere un miembro y un rol válido" }, { status: 400 });

  try {
    const share = await shareProjectAccess({ actorUserId: session.user.id, projectId, ...parsed.data });
    return NextResponse.json({ share }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "No se pudo compartir el proyecto");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  const parsed = revokeProjectAccessSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Se requiere un miembro válido" }, { status: 400 });

  try {
    await revokeProjectAccess({ actorUserId: session.user.id, projectId, userId: parsed.data.userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "No se pudo revocar el acceso");
  }
}
