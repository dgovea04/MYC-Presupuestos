import { NextResponse } from "next/server";
import { z } from "zod";
import { requireKnowledgeAdminSession, knowledgeRouteErrorResponse } from "@/lib/knowledge/route-errors";
import { correctImportLearningAssertion, importDomains, importStatuses, listImportLearningReview } from "@/lib/knowledge/admin-learning";
import type { KnowledgeConfidence, KnowledgeStatus } from "@prisma/client";

const confidenceValues = ["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
const listQuery = z.object({
  companyId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).optional(),
  status: z.enum(importStatuses as [string, ...string[]]).optional(),
  sourceType: z.string().trim().min(1).max(50).optional(),
  domain: z.enum(importDomains as [string, ...string[]]).optional(),
  confidence: z.enum(confidenceValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const correctionBody = z.object({
  companyId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  value: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(1).max(2000),
  correlationId: z.string().trim().min(1).max(200),
}).strict();

export async function GET(request: Request) {
  const authorization = await requireKnowledgeAdminSession("audit.read", request);
  if ("response" in authorization) return authorization.response;
  const url = new URL(request.url);
  try {
    const parsed = listQuery.parse(Object.fromEntries(url.searchParams.entries()));
    return NextResponse.json(await listImportLearningReview({ actorUserId: authorization.session.user.id, ...parsed, status: parsed.status as KnowledgeStatus | undefined, domain: parsed.domain as "ITEM" | "RESOURCE" | "PRICE" | "YIELD" | "APU" | undefined, confidence: parsed.confidence as KnowledgeConfidence | undefined }));
  } catch (error) {
    return knowledgeRouteErrorResponse(error, "No se pudo cargar la revisión de import-learning");
  }
}

export async function PATCH(request: Request) {
  const authorization = await requireKnowledgeAdminSession("knowledge.manage", request);
  if ("response" in authorization) return authorization.response;
  try {
    const body = correctionBody.parse(await request.json());
    const assertionId = new URL(request.url).searchParams.get("assertionId")?.trim();
    if (!assertionId) return NextResponse.json({ error: "assertionId es requerido" }, { status: 400 });
    return NextResponse.json(await correctImportLearningAssertion({ assertionId, actorUserId: authorization.session.user.id, ...body }));
  } catch (error) {
    return knowledgeRouteErrorResponse(error, "No se pudo corregir la assertion de import-learning");
  }
}
