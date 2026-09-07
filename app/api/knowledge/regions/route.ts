import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { createKnowledgeRegion, listKnowledgeRegions } from "@/lib/knowledge/regions";

const schema = z.object({ level: z.string().min(1), name: z.string().min(1), parentId: z.string().optional() }).strict();

export async function GET(request: Request) {
  if (!(await requireAdminSession("audit.read", request))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json({ regions: await listKnowledgeRegions(new URL(request.url).searchParams.get("level") ?? undefined) });
}

export async function POST(request: Request) {
  if (!(await requireAdminSession("audit.read", request))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try { return NextResponse.json(await createKnowledgeRegion(schema.parse(await request.json())), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo crear la región" }, { status: 400 }); }
}
