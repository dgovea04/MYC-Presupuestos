import { NextResponse } from "next/server";
import { z } from "zod";
import { requireKnowledgeAdminSession, knowledgeRouteErrorResponse } from "@/lib/knowledge/route-errors";
import { createKnowledgeSupplier, listKnowledgeSuppliers } from "@/lib/knowledge/suppliers";

const schema = z.object({ name: z.string().min(1), legalName: z.string().optional(), ruc: z.string().optional(), regionId: z.string().optional(), sourceId: z.string().optional(), website: z.string().url().optional(), phone: z.string().optional(), email: z.string().email().optional(), status: z.string().optional() }).strict();

export async function GET(request: Request) {
  const authorization = await requireKnowledgeAdminSession("audit.read", request);
  if ("response" in authorization) return authorization.response;
  try { return NextResponse.json({ suppliers: await listKnowledgeSuppliers(new URL(request.url).searchParams.get("regionId") ?? undefined) }); }
  catch (error) { return knowledgeRouteErrorResponse(error, "No se pudieron consultar los proveedores"); }
}

export async function POST(request: Request) {
  const authorization = await requireKnowledgeAdminSession("knowledge.manage", request);
  if ("response" in authorization) return authorization.response;
  try { return NextResponse.json(await createKnowledgeSupplier(schema.parse(await request.json())), { status: 201 }); }
  catch (error) { return knowledgeRouteErrorResponse(error, "No se pudo crear el proveedor"); }
}
