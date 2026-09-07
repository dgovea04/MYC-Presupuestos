import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { createKnowledgeSource } from "@/lib/knowledge/provenance";

const schema = z.object({ sourceType: z.string().min(1), label: z.string().min(1), privacy: z.enum(["PRIVATE", "AGGREGATABLE", "PUBLIC"]).optional(), metadata: z.record(z.string(), z.unknown()).optional() }).strict();

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try { return NextResponse.json(await createKnowledgeSource(schema.parse(await request.json())), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo crear la fuente" }, { status: 400 }); }
}

