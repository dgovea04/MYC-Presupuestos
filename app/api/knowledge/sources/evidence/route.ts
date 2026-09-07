import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { createKnowledgeEvidence } from "@/lib/knowledge/provenance";

const schema = z.object({ sourceId: z.string().min(1), documentId: z.string().optional(), fileName: z.string().optional(), page: z.string().optional(), sheet: z.string().optional(), cellRange: z.string().optional(), url: z.string().url().optional(), quote: z.string().optional(), checksum: z.string().optional(), metadata: z.record(z.string(), z.unknown()).optional() }).strict();

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try { return NextResponse.json(await createKnowledgeEvidence(schema.parse(await request.json())), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo crear la evidencia" }, { status: 400 }); }
}

