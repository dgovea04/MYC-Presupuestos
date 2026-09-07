import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { createKnowledgeSupplier, listKnowledgeSuppliers } from "@/lib/knowledge/suppliers";

const schema = z.object({ name: z.string().min(1), legalName: z.string().optional(), ruc: z.string().optional(), regionId: z.string().optional(), sourceId: z.string().optional(), website: z.string().url().optional(), phone: z.string().optional(), email: z.string().email().optional(), status: z.string().optional() }).strict();

export async function GET(request: Request) {
  if (!(await requireAdminSession("audit.read", request))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json({ suppliers: await listKnowledgeSuppliers(new URL(request.url).searchParams.get("regionId") ?? undefined) });
}

export async function POST(request: Request) {
  if (!(await requireAdminSession("audit.read", request))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try { return NextResponse.json(await createKnowledgeSupplier(schema.parse(await request.json())), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo crear el proveedor" }, { status: 400 }); }
}
