import { NextResponse } from "next/server";
import { z } from "zod";
import { requireKnowledgeAdminSession, knowledgeRouteErrorResponse } from "@/lib/knowledge/route-errors";
import { createKnowledgeRegion, listKnowledgeRegions } from "@/lib/knowledge/regions";

const schema = z.object({ level: z.string().min(1), name: z.string().min(1), parentId: z.string().optional() }).strict();

export async function GET(request: Request) {
  const authorization = await requireKnowledgeAdminSession("audit.read", request);
  if ("response" in authorization) return authorization.response;
  try { return NextResponse.json({ regions: await listKnowledgeRegions(new URL(request.url).searchParams.get("level") ?? undefined) }); }
  catch (error) { return knowledgeRouteErrorResponse(error, "No se pudieron consultar las regiones"); }
}

export async function POST(request: Request) {
  const authorization = await requireKnowledgeAdminSession("knowledge.manage", request);
  if ("response" in authorization) return authorization.response;
  try { return NextResponse.json(await createKnowledgeRegion(schema.parse(await request.json())), { status: 201 }); }
  catch (error) { return knowledgeRouteErrorResponse(error, "No se pudo crear la región"); }
}
