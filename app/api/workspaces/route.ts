import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { listUserWorkspaces, setActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { activeWorkspaceSelectionSchema } from "@/lib/validations/workspace";

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

    await setActiveWorkspaceId(session.user.id, parsed.companyId);

    return NextResponse.json({ ok: true, activeCompanyId: parsed.companyId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cambiar de workspace" },
      { status: 400 },
    );
  }
}
