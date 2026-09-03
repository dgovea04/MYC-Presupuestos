import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { FindingResolution, FindingStatus } from "./types";

type Client = Pick<PrismaClient, "reviewRun" | "reviewFinding" | "findingDecision" | "reviewAuditEvent" | "entityLink" | "reviewEvidence"> & {
  $transaction<T>(callback: (transaction: Client) => Promise<T>): Promise<T>;
};
type FindingRow = Prisma.ReviewFindingGetPayload<{
  select: {
    id: true; companyId: true; projectId: true; budgetId: true; reviewRunId: true; budgetItemId: true; entityLinkId: true; evidenceId: true;
    findingType: true; status: true; severity: true; priority: true; confidence: true; score: true; potentialImpact: true; ruleKey: true;
    comparisonJson: true; humanReviewRequired: true; automaticBudgetMutation: true; createdAt: true; updatedAt: true;
    budgetItem: { select: { id: true; code: true; description: true; unit: true; quantity: true; unitPrice: true } };
    evidence: { select: { id: true; documentVersionId: true; evidenceType: true; originalText: true; normalizedText: true; locationJson: true; unit: true; extractionMethod: true; confidence: true; sourceHash: true } };
    entityLink: { select: { id: true; score: true; confidence: true; validationStatus: true; signalsJson: true } };
    decisions: { select: { id: true; userId: true; resolution: true; note: true; expectedUpdatedAt: true; createdAt: true }; orderBy: { createdAt: "desc" } };
  }
}>;

export type FindingFilters = {
  companyId: string; projectId?: string; budgetId?: string; reviewRunId: string; page: number; pageSize: number;
  status?: FindingStatus; findingType?: Prisma.ReviewFindingWhereInput["findingType"]; severity?: string; confidence?: Prisma.ReviewFindingWhereInput["confidence"]; priority?: number; discipline?: string; subbudget?: string; document?: string;
};
export type PaginatedFindings = { findings: Array<Record<string, unknown>>; page: number; pageSize: number; hasNextPage: boolean };
export type FindingDecisionInput = { findingId: string; companyId: string; userId: string; role: string; resolution: FindingResolution; note?: string; expectedUpdatedAt: Date; reconfirmStale?: boolean; correlationId: string; correctionVersionId?: string };
export type FindingDecisionRecord = { id: string; findingId: string; resolution: FindingResolution; note: string | null; expectedUpdatedAt: string; createdAt: string };

const decimal = (value: unknown): string | null => value === null || value === undefined ? null : String(value);
const jsonObject = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
const secret = () => process.env.REVIEW_EVIDENCE_SIGNING_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? null;

function temporaryToken(evidenceId: string, expiresAt: number): string {
  const configuredSecret = secret();
  if (!configuredSecret) throw new Error("Temporary evidence URLs are unavailable until a signing secret is configured.");
  const payload = `${evidenceId}.${expiresAt}`;
  return `${expiresAt}.${createHmac("sha256", configuredSecret).update(payload).digest("base64url")}`;
}

export function verifyTemporaryEvidenceToken(evidenceId: string, token: string): boolean {
  const configuredSecret = secret();
  if (!configuredSecret) return false;
  const [expires, signature] = token.split(".");
  const expiresAt = Number(expires);
  if (!Number.isInteger(expiresAt) || expiresAt < Date.now() || !signature) return false;
  const expected = createHmac("sha256", configuredSecret).update(`${evidenceId}.${expiresAt}`).digest("base64url");
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function serializeFinding(row: FindingRow): Record<string, unknown> {
  const evidence = row.evidence ? {
    id: row.evidence.id, documentVersionId: row.evidence.documentVersionId, evidenceType: row.evidence.evidenceType,
    originalText: row.evidence.originalText, normalizedText: row.evidence.normalizedText, location: row.evidence.locationJson,
    unit: row.evidence.unit, extractionMethod: row.evidence.extractionMethod, confidence: row.evidence.confidence, sourceHash: row.evidence.sourceHash,
    viewUrl: `/api/review-evidence/${encodeURIComponent(row.evidence.id)}/view?token=${encodeURIComponent(temporaryToken(row.evidence.id, Date.now() + 5 * 60 * 1000))}`,
  } : null;
  return {
    id: row.id, companyId: row.companyId, projectId: row.projectId, budgetId: row.budgetId, reviewRunId: row.reviewRunId,
    budgetItemId: row.budgetItemId, entityLinkId: row.entityLinkId, evidenceId: row.evidenceId, findingType: row.findingType,
    status: row.status, severity: row.severity, priority: decimal(row.priority), confidence: row.confidence, score: decimal(row.score),
    potentialImpact: decimal(row.potentialImpact), ruleKey: row.ruleKey, comparison: row.comparisonJson, humanReviewRequired: row.humanReviewRequired,
    automaticBudgetMutation: row.automaticBudgetMutation, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    budgetItem: row.budgetItem ? { ...row.budgetItem, quantity: decimal(row.budgetItem.quantity), unitPrice: decimal(row.budgetItem.unitPrice) } : null,
    evidence, entityLink: row.entityLink ? { ...row.entityLink, score: decimal(row.entityLink.score) } : null,
    latestDecision: row.decisions[0] ? { ...row.decisions[0], expectedUpdatedAt: row.decisions[0].expectedUpdatedAt.toISOString(), createdAt: row.decisions[0].createdAt.toISOString() } : null,
    decisionHistory: row.decisions.map((decision) => ({ ...decision, expectedUpdatedAt: decision.expectedUpdatedAt.toISOString(), createdAt: decision.createdAt.toISOString() })),
  };
}

const findingSelect = {
  id: true, companyId: true, projectId: true, budgetId: true, reviewRunId: true, budgetItemId: true, entityLinkId: true, evidenceId: true,
  findingType: true, status: true, severity: true, priority: true, confidence: true, score: true, potentialImpact: true, ruleKey: true,
  comparisonJson: true, humanReviewRequired: true, automaticBudgetMutation: true, createdAt: true, updatedAt: true,
  budgetItem: { select: { id: true, code: true, description: true, unit: true, quantity: true, unitPrice: true } },
  evidence: { select: { id: true, documentVersionId: true, evidenceType: true, originalText: true, normalizedText: true, locationJson: true, unit: true, extractionMethod: true, confidence: true, sourceHash: true } },
  entityLink: { select: { id: true, score: true, confidence: true, validationStatus: true, signalsJson: true } },
  decisions: { select: { id: true, userId: true, resolution: true, note: true, expectedUpdatedAt: true, createdAt: true }, orderBy: { createdAt: "desc" } },
} satisfies Prisma.ReviewFindingSelect;

export async function listFindings(filters: FindingFilters, client: Client = prisma): Promise<PaginatedFindings> {
  const run = await client.reviewRun.findFirst({ where: { id: filters.reviewRunId, companyId: filters.companyId, ...(filters.projectId ? { projectId: filters.projectId } : {}), ...(filters.budgetId ? { budgetId: filters.budgetId } : {}) }, select: { id: true, projectId: true, budgetId: true } });
  if (!run) throw new Error("Review run not found.");
  const where: Prisma.ReviewFindingWhereInput = { companyId: filters.companyId, projectId: run.projectId, budgetId: run.budgetId, reviewRunId: run.id, status: filters.status, findingType: filters.findingType, severity: filters.severity, confidence: filters.confidence, ...(filters.priority === undefined ? {} : { priority: { gte: filters.priority } }), ...(filters.discipline === undefined ? {} : { comparisonJson: { path: ["discipline"], equals: filters.discipline } }), ...(filters.subbudget === undefined ? {} : { budgetItem: { levelId: filters.subbudget } }), ...(filters.document === undefined ? {} : { evidence: { documentVersion: { projectDocumentId: filters.document } } }) };
  const rows = await client.reviewFinding.findMany({ where, orderBy: [{ priority: "desc" }, { potentialImpact: "desc" }, { confidence: "desc" }, { budgetItem: { code: "asc" } }, { id: "asc" }], skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize + 1, select: findingSelect });
  return { findings: rows.slice(0, filters.pageSize).map(serializeFinding), page: filters.page, pageSize: filters.pageSize, hasNextPage: rows.length > filters.pageSize };
}

export async function getFinding(findingId: string, companyId: string, client: Client = prisma): Promise<Record<string, unknown>> {
  const row = await client.reviewFinding.findFirst({ where: { id: findingId, companyId, project: { companyId }, budget: { project: { companyId } } }, select: findingSelect });
  if (!row) throw new Error("Finding not found.");
  return serializeFinding(row);
}

export async function recordFindingDecision(input: FindingDecisionInput, client: Client = prisma): Promise<FindingDecisionRecord> {
  return client.$transaction(async (tx) => {
    const current = await tx.reviewFinding.findFirst({ where: { id: input.findingId, companyId: input.companyId, project: { companyId: input.companyId }, budget: { project: { companyId: input.companyId } } }, select: { id: true, companyId: true, projectId: true, budgetId: true, reviewRunId: true, status: true, updatedAt: true } });
    if (!current) throw new Error("Finding not found.");
    const run = await tx.reviewRun.findFirst({ where: { id: current.reviewRunId, companyId: input.companyId, projectId: current.projectId, budgetId: current.budgetId }, select: { id: true, status: true } });
    if (!run) throw new Error("Review run not found.");
    if ((current.status === "STALE" || run.status === "STALE") && !input.reconfirmStale) throw new Error("Finding or review run is stale; reconfirmation required.");
    const newStatus = input.resolution === "NEEDS_MORE_INFORMATION" ? "IN_REVIEW" : input.resolution === "CORRECTED" || input.resolution === "CONFIRMED_ISSUE" || input.resolution === "VALID_AS_IS" || input.resolution === "FALSE_POSITIVE" || input.resolution === "NOT_APPLICABLE" ? "RESOLVED" : "REOPENED";
    const changed = await tx.reviewFinding.updateMany({ where: { id: input.findingId, companyId: input.companyId, projectId: current.projectId, budgetId: current.budgetId, updatedAt: input.expectedUpdatedAt }, data: { status: newStatus } });
    if (changed.count !== 1) throw new Error("Finding changed; reconfirmation required.");
    const decision = await tx.findingDecision.create({ data: { companyId: input.companyId, projectId: current.projectId, findingId: input.findingId, userId: input.userId, resolution: input.resolution, note: input.note, expectedUpdatedAt: input.expectedUpdatedAt } });
    await tx.reviewAuditEvent.create({ data: { companyId: input.companyId, projectId: current.projectId, reviewRunId: current.reviewRunId, actorUserId: input.userId, correlationId: input.correlationId, eventType: "FINDING_DECISION_RECORDED", payloadJson: { findingId: input.findingId, previousStatus: current.status, newStatus, resolution: input.resolution, role: input.role, expectedUpdatedAt: input.expectedUpdatedAt.toISOString(), ...(input.correctionVersionId ? { correctionVersionId: input.correctionVersionId } : {}) } } });
    return { id: decision.id, findingId: decision.findingId, resolution: decision.resolution as FindingResolution, note: decision.note, expectedUpdatedAt: decision.expectedUpdatedAt.toISOString(), createdAt: decision.createdAt.toISOString() };
  });
}

export async function validateReviewLink(input: { linkId: string; companyId: string; userId: string; validationStatus: "CONFIRMED" | "REJECTED" }, client: Client = prisma) {
  return client.$transaction(async (tx) => {
    const link = await tx.entityLink.findFirst({ where: { id: input.linkId, companyId: input.companyId, project: { companyId: input.companyId }, budget: { project: { companyId: input.companyId } } }, select: { id: true, projectId: true, budgetId: true, budgetItemId: true, evidenceId: true, validationStatus: true } });
    if (!link) throw new Error("Review link not found.");
    const updated = await tx.entityLink.update({ where: { id_companyId_projectId: { id: link.id, companyId: input.companyId, projectId: link.projectId } }, data: { validationStatus: input.validationStatus, validatedById: input.userId, validatedAt: new Date() }, select: { id: true, validationStatus: true, validatedById: true, validatedAt: true } });
    await tx.reviewAuditEvent.create({ data: { companyId: input.companyId, projectId: link.projectId, actorUserId: input.userId, eventType: "REVIEW_LINK_VALIDATED", payloadJson: { linkId: link.id, budgetId: link.budgetId, budgetItemId: link.budgetItemId, evidenceId: link.evidenceId, previousStatus: link.validationStatus, validationStatus: input.validationStatus } } });
    return updated;
  });
}

export async function viewReviewEvidence(input: { evidenceId: string; companyId: string; userId: string; token?: string }, client: Client = prisma) {
  if (!input.token || !verifyTemporaryEvidenceToken(input.evidenceId, input.token)) throw new Error("Temporary evidence URL is invalid or expired.");
  const evidence = await client.reviewEvidence.findFirst({ where: { id: input.evidenceId, companyId: input.companyId, project: { companyId: input.companyId } }, select: { id: true, projectId: true, documentVersionId: true, evidenceType: true, originalText: true, normalizedText: true, locationJson: true, unit: true, extractionMethod: true, confidence: true, sourceHash: true } });
  if (!evidence) throw new Error("Evidence not found.");
  return { evidenceId: evidence.id, projectId: evidence.projectId, documentVersionId: evidence.documentVersionId, evidenceType: evidence.evidenceType, originalText: evidence.originalText, normalizedText: evidence.normalizedText, location: jsonObject(evidence.locationJson), unit: evidence.unit, extractionMethod: evidence.extractionMethod, confidence: evidence.confidence, sourceHash: evidence.sourceHash, expiresAt: new Date(Number(input.token.split(".")[0])).toISOString() };
}
