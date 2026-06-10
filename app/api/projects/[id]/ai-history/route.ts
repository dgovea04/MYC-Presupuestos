import { NextResponse } from "next/server";

import { getAiProjectHistory } from "@/lib/ai/project-history";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectHeaderById } from "@/lib/data/projects";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await getProjectHeaderById(id, session.user.id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const limit = readLimit(new URL(request.url).searchParams.get("limit"));
    const entries = await getAiProjectHistory(id, session.user.id, limit);

    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: "Unable to load project history" }, { status: 500 });
  }
}

function readLimit(value: string | null) {
  if (value === null) {
    return undefined;
  }

  const limit = Number(value);

  if (!Number.isFinite(limit) || limit <= 0) {
    return undefined;
  }

  return limit;
}
