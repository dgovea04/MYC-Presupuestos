import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceFeatureAccess } from "@/lib/workspace/entitlements";
import { requireWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { createWorkspaceRole, deleteWorkspaceRole, listWorkspaceRoles, updateWorkspaceRole } from "@/lib/workspace/roles";
import { createWorkspaceRoleSchema, deleteWorkspaceRoleSchema, updateWorkspaceRoleSchema } from "@/lib/validations/workspace";

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof WorkspaceAuthorizationError ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: companyId } = await params;
  try {
    await assertWorkspaceFeatureAccess({ userId: session.user.id, companyId, feature: "workspace.management" });
    await requireWorkspaceRole({ userId: session.user.id, companyId, minimumRole: "ADMIN" });
    return NextResponse.json({ roles: await listWorkspaceRoles(companyId) });
  } catch (error) {
    return errorResponse(error, "No tienes permisos para ver los roles");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: companyId } = await params;
  try {
    await assertWorkspaceFeatureAccess({ userId: session.user.id, companyId, feature: "workspace.management" });
  } catch {
    return NextResponse.json({ error: "No tienes acceso a este workspace" }, { status: 403 });
  }

  const parsed = createWorkspaceRoleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el nombre y los permisos del rol" }, { status: 400 });

  try {
    const role = await createWorkspaceRole({ companyId, actorUserId: session.user.id, ...parsed.data });
    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "No se pudo crear el rol");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: companyId } = await params;
  try {
    await assertWorkspaceFeatureAccess({ userId: session.user.id, companyId, feature: "workspace.management" });
  } catch {
    return NextResponse.json({ error: "No tienes acceso a este workspace" }, { status: 403 });
  }

  const parsed = updateWorkspaceRoleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el nombre y los permisos del rol" }, { status: 400 });

  try {
    const role = await updateWorkspaceRole({ companyId, actorUserId: session.user.id, roleId: parsed.data.roleId, name: parsed.data.name, description: parsed.data.description, permissions: parsed.data.permissions });
    return NextResponse.json({ role });
  } catch (error) {
    return errorResponse(error, "No se pudo actualizar el rol");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: companyId } = await params;
  try {
    await assertWorkspaceFeatureAccess({ userId: session.user.id, companyId, feature: "workspace.management" });
  } catch {
    return NextResponse.json({ error: "No tienes acceso a este workspace" }, { status: 403 });
  }

  const parsed = deleteWorkspaceRoleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Rol requerido" }, { status: 400 });

  try {
    await deleteWorkspaceRole({ companyId, actorUserId: session.user.id, roleId: parsed.data.roleId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "No se pudo eliminar el rol");
  }
}
