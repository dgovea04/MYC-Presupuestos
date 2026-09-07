import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { createYieldObservation } from "@/lib/knowledge/observations";

const schema = z.object({ canonicalItemId: z.string().min(1), apuVersionId: z.string().optional(), value: z.string().min(1), unit: z.string().min(1), crew: z.string().optional(), projectType: z.string().optional(), regionId: z.string().optional(), scope: z.enum(["GLOBAL", "COMPANY", "PROJECT", "USER"]), companyId: z.string().optional(), projectId: z.string().optional(), userId: z.string().optional(), sourceId: z.string().min(1), evidenceId: z.string().optional(), observedAt: z.coerce.date(), confidence: z.enum(["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"]) }).strict();
export async function POST(request: Request) { const session = await getAuthSession(); if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 }); try { const body = schema.parse(await request.json()); return NextResponse.json(await createYieldObservation(body), { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo crear la observación" }, { status: 400 }); } }

