import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { listUserWorkspaces, setActiveWorkspaceId, WORKSPACE_LIST_CACHE_TAG } from "@/lib/workspace/active-workspace";
import { activeWorkspaceSelectionSchema } from "@/lib/validations/workspace";
import { assertWorkspaceFeatureAccess, isWorkspaceFeatureAccessError } from "@/lib/workspace/entitlements";

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await listUserWorkspaces(session.user.id);
  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = activeWorkspaceSelectionSchema.parse(body);

    await assertWorkspaceFeatureAccess({
      userId: session.user.id,
      companyId: parsed.companyId,
      feature: "workspace.management",
    });
    await setActiveWorkspaceId(session.user.id, parsed.companyId);

    revalidatePath("/", "layout");
    revalidateTag(`${WORKSPACE_LIST_CACHE_TAG}-${session.user.id}`, "max");

    return NextResponse.json({ ok: true, activeCompanyId: parsed.companyId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cambiar de workspace" },
      { status: isWorkspaceFeatureAccessError(error) ? 403 : 400 },
    );
  }
}
