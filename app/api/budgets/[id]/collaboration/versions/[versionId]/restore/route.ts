import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { restoreBudgetVersionSnapshot } from "@/lib/collaboration/versions";
import { getWorkspaceFeatureAccessStatus } from "@/lib/workspace/entitlements";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId, versionId } = await params;
    const version = await restoreBudgetVersionSnapshot(versionId, budgetId, session.user.id);
    return NextResponse.json({ version });
  } catch (error) {
    console.error("POST restore version failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo restaurar la version" },
      { status: getWorkspaceFeatureAccessStatus(error) },
    );
  }
}
