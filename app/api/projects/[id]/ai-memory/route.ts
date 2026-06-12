import { NextResponse } from "next/server";
import { z } from "zod";

import { getProjectAiMemory, recordProjectAiMemory } from "@/lib/ai/context/project-memory";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectHeaderById } from "@/lib/data/projects";

const aiMemoryCreateSchema = z.object({
  memoryType: z.enum(["FACT", "PREFERENCE", "CONSTRAINT", "ASSUMPTION"]).default("FACT"),
  fact: z.string().trim().min(3),
  confidence: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).default("user"),
});

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
    const entries = await getProjectAiMemory({ projectId: id, userId: session.user.id, limit });

    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: "Unable to load project memory" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const data = aiMemoryCreateSchema.parse(await request.json());
    const entry = await recordProjectAiMemory({
      projectId: id,
      userId: session.user.id,
      memoryType: data.memoryType,
      fact: data.fact,
      confidence: data.confidence,
      source: data.source,
    });

    if (!entry) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid memory payload" }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to record project memory" }, { status: 500 });
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
