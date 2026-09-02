import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { matchBudgetItemToEvidence, type BudgetItemMatchInput, type EvidenceMatchInput } from "./matching";
import { evaluateFindingRules, type ReviewRuleEvidence, type ReviewRuleItem } from "./rules";
import { parseReviewConfiguration } from "./validation";
import type { ReviewConfiguration, ReviewRunStatus, WarningJson } from "./types";

export const REVIEW_STAGES = ["validating", "extracting", "classifying", "identifying evidence", "matching", "rules", "prioritizing", "completed"] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type TransactionOptions = { isolationLevel?: "Serializable" };

export interface ReviewBudgetItem extends BudgetItemMatchInput, ReviewRuleItem { budgetId: string; companyId?: string; projectId?: string; }
export interface ReviewEvidence extends EvidenceMatchInput, ReviewRuleEvidence { documentVersionId: string; originalText: string; normalizedText?: string; sourceHash: string; evidenceType: string; confidence: "LOW" | "MEDIUM" | "HIGH"; locationJson: Record<string, unknown>; companyId?: string; projectId?: string; }
export interface ReviewDocumentVersionReference { id: string; companyId: string; projectId: string; }
export interface RunReviewJobInput { companyId: string; projectId: string; budgetId: string; createdById: string; documentVersionIds: string[]; documentVersions?: ReviewDocumentVersionReference[]; configuration: ReviewConfiguration; rulesVersion: string; budgetItems: ReviewBudgetItem[]; evidence: ReviewEvidence[]; extractionWarnings?: WarningJson[]; shouldCancel?: () => boolean | Promise<boolean>; humanReviewRequired?: boolean; automaticBudgetMutation?: boolean; }
export interface RunReviewJobResult { reviewRunId: string; status: ReviewRunStatus; stages: ReviewStage[]; warnings: WarningJson[]; idempotencyKey: string; }
export interface ReviewPipelineClient {
  reviewRun: { findFirst(args: { where: Where }): Promise<Row | null>; findUnique(args: { where: Where }): Promise<Row | null>; findMany(args: { where: Where }): Promise<Row[]>; create(args: { data: Row }): Promise<Row>; updateMany(args: { where: Where; data: Row }): Promise<{ count: number }>; };
  reviewRunDocumentVersion: { upsert(args: { where: Where; create: Row; update: Row }): Promise<Row>; };
  reviewEvidence: { findFirst(args: { where: Where }): Promise<Row | null>; create(args: { data: Row }): Promise<Row>; };
  entityLink: { findFirst(args: { where: Where }): Promise<Row | null>; create(args: { data: Row }): Promise<Row>; };
  reviewFinding: { findFirst(args: { where: Where }): Promise<Row | null>; create(args: { data: Row }): Promise<Row>; };
  reviewAuditEvent: { create(args: { data: Row }): Promise<Row>; };
  $transaction<T>(callback: (transaction: ReviewPipelineClient) => Promise<T>, options?: TransactionOptions): Promise<T>;
}

const activeStatuses = ["DRAFT", "QUEUED", "RUNNING"];
const idempotencyKeyFor = (input: RunReviewJobInput): string => createHash("sha256").update(JSON.stringify({ companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, documentVersionIds: [...input.documentVersionIds].sort(), configuration: input.configuration, rulesVersion: input.rulesVersion })).digest("hex");
const runIdFor = (key: string): string => `review-${key}`;
const json = (value: unknown): unknown => value;

export async function runReviewJob(input: RunReviewJobInput, client: ReviewPipelineClient): Promise<RunReviewJobResult> {
  const configuration = parseReviewConfiguration(input.configuration);
  validateInput(input);
  if (input.humanReviewRequired === false || input.automaticBudgetMutation === true) throw new Error("Review guardrails cannot be disabled.");
  const key = idempotencyKeyFor(input);
  const id = runIdFor(key);
  let run: Row;
  try {
    run = await client.$transaction(async (transaction) => {
    const existing = await transaction.reviewRun.findUnique({ where: { id_companyId_projectId: { id, companyId: input.companyId, projectId: input.projectId } } });
    if (existing) return existing;
    const active = await transaction.reviewRun.findMany({ where: { companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, status: { in: activeStatuses } } });
    if (active.length > 0) throw new Error("An active review run already exists for this budget.");
    return transaction.reviewRun.create({ data: { id, companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, createdById: input.createdById, configurationJson: { ...configuration, idempotencyKey: key }, rulesVersion: input.rulesVersion, status: "RUNNING", startedAt: new Date(), progressJson: { stage: "validating", completed: 0, total: 8, percent: 0, checkpoints: [] }, warningsJson: input.extractionWarnings ?? [] } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const concurrent = await client.reviewRun.findUnique({ where: { id_companyId_projectId: { id, companyId: input.companyId, projectId: input.projectId } } });
    if (!concurrent || !(error instanceof Error && error.message.includes("P2002"))) throw error;
    run = concurrent;
  }
  if (run.status === "FAILED" || run.status === "STALE") {
    const resumed = await client.reviewRun.updateMany({ where: { id, companyId: input.companyId, projectId: input.projectId, status: { in: ["FAILED", "STALE"] } }, data: { status: "RUNNING", finishedAt: null } });
    if (resumed.count > 0) run = { ...run, status: "RUNNING" };
  }
  if (["COMPLETED", "COMPLETED_WITH_WARNINGS", "CANCELLED"].includes(String(run.status))) return result(run, key);
  return executeFromCheckpoint(input, client, run, configuration, key);
}

async function executeFromCheckpoint(input: RunReviewJobInput, client: ReviewPipelineClient, run: Row, configuration: ReviewConfiguration, key: string): Promise<RunReviewJobResult> {
  const id = String(run.id);
  const stored = (run.progressJson ?? {}) as { checkpoints?: Array<{ stage?: string; status?: string }> };
  const failedIndex = stored.checkpoints?.findIndex((entry) => entry.status === "FAILED") ?? -1;
  const completed = stored.checkpoints?.filter((entry) => entry.status === "COMPLETED").map((entry) => entry.stage) ?? [];
  const first = failedIndex >= 0 ? failedIndex : Math.max(0, REVIEW_STAGES.findIndex((stage) => !completed.includes(stage)));
  const warnings = [...new Map([...Array.isArray(run.warningsJson) ? run.warningsJson as WarningJson[] : [], ...(input.extractionWarnings ?? [])].map((warning) => [`${warning.code}:${warning.source ?? ""}:${warning.message}`, warning])).values()];
  for (let index = first; index < REVIEW_STAGES.length; index += 1) {
    const stage = REVIEW_STAGES[index];
    const correlationId = `${id}:${stage}:${Date.now()}`;
    try {
      await checkpoint(client, input, id, stage, index, "RUNNING", 0, warnings, correlationId);
      if (await isCancellationRequested(input, client, id)) return cancelResult(client, input, id, stage, warnings, key, correlationId);
      const count = await processStage(stage, input, client, id, configuration);
      await checkpoint(client, input, id, stage, index, "COMPLETED", count, warnings, correlationId);
      await client.reviewAuditEvent.create({ data: { companyId: input.companyId, projectId: input.projectId, reviewRunId: id, actorUserId: input.createdById, eventType: "REVIEW_STAGE_COMPLETED", correlationId, payloadJson: { stage, status: "COMPLETED", count, warnings } } });
    } catch (error) {
      const warning: WarningJson = { code: "STAGE_FAILED", message: error instanceof Error ? error.message : "Review stage failed.", source: stage };
      warnings.push(warning);
      await checkpoint(client, input, id, stage, index, "FAILED", 0, warnings, correlationId).catch(() => undefined);
      await client.reviewAuditEvent.create({ data: { companyId: input.companyId, projectId: input.projectId, reviewRunId: id, actorUserId: input.createdById, eventType: "REVIEW_STAGE_FAILED", correlationId, payloadJson: { stage, status: "FAILED", count: 0, warnings: [warning] } } }).catch(() => undefined);
      await client.reviewRun.updateMany({ where: { id, companyId: input.companyId, projectId: input.projectId, status: "RUNNING" }, data: { status: "FAILED", warningsJson: warnings, finishedAt: new Date() } });
      throw error;
    }
  }
  const status: ReviewRunStatus = warnings.length > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED";
  const changed = await client.reviewRun.updateMany({ where: { id, companyId: input.companyId, projectId: input.projectId, status: "RUNNING" }, data: { status, warningsJson: warnings, finishedAt: new Date() } });
  const final = await ownedRun(client, input, id);
  if (changed.count === 0 && final?.status === "CANCELLED") return result(final, key);
  return result(final ?? { id, status, progressJson: {}, warningsJson: warnings }, key);
}

async function processStage(stage: ReviewStage, input: RunReviewJobInput, client: ReviewPipelineClient, runId: string, configuration: ReviewConfiguration): Promise<number> {
  if (stage === "validating") return input.budgetItems.length + input.documentVersionIds.length;
  if (stage === "extracting") { await client.$transaction(async (transaction) => { for (const documentVersionId of input.documentVersionIds) await transaction.reviewRunDocumentVersion.upsert({ where: { reviewRunId_documentVersionId: { reviewRunId: runId, documentVersionId } }, create: { companyId: input.companyId, projectId: input.projectId, reviewRunId: runId, documentVersionId }, update: {} }); }); return input.documentVersionIds.length; }
  if (stage === "classifying") return input.evidence.length;
  if (stage === "identifying evidence") { await client.$transaction(async (transaction) => { for (const evidence of input.evidence) { const found = await transaction.reviewEvidence.findFirst({ where: { documentVersionId: evidence.documentVersionId, sourceHash: evidence.sourceHash, companyId: input.companyId, projectId: input.projectId } }); if (!found) await transaction.reviewEvidence.create({ data: evidenceData(input, evidence) }); } }); return input.evidence.length; }
  if (stage === "matching") { let count = 0; await client.$transaction(async (transaction) => { for (const item of input.budgetItems) for (const candidate of matchBudgetItemToEvidence(item, input.evidence).filter((entry) => entry.eligibleForFindings)) { const found = await transaction.entityLink.findFirst({ where: { budgetItemId: candidate.budgetItemId, evidenceId: candidate.evidenceId, companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId } }); if (!found) { await transaction.entityLink.create({ data: linkData(input, candidate) }); count += 1; } } }); return count; }
  if (stage === "rules" || stage === "prioritizing") { let count = 0; await client.$transaction(async (transaction) => { for (const item of input.budgetItems) { const candidates = matchBudgetItemToEvidence(item, input.evidence); for (const evidence of input.evidence.filter((entry) => entry.primary)) { const link = candidates.find((entry) => entry.evidenceId === evidence.id && entry.eligibleForFindings); const findings = evaluateFindingRules({ item, evidence, link: link ? { evidenceId: link.evidenceId, confidence: link.confidence, score: link.score } : undefined, tolerance: new Decimal(configuration.tolerancePercent), ruleTypes: configuration.findingTypes }); for (const finding of findings) { if (finding.type === "MISSING_DOCUMENTATION" && input.extractionWarnings?.some((warning) => warning.source === evidence.documentVersionId)) continue; const found = await transaction.reviewFinding.findFirst({ where: { reviewRunId: runId, budgetItemId: finding.budgetItemId, evidenceId: finding.evidenceId, findingType: finding.type, companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId } }); if (!found) { await transaction.reviewFinding.create({ data: findingData(input, runId, finding, link?.evidenceId) }); count += 1; } } } } }); return count; }
  return input.budgetItems.length + input.evidence.length;
}

function validateInput(input: RunReviewJobInput): void {
  if (input.documentVersionIds.length === 0) throw new Error("At least one document version is required.");
  if (input.documentVersions && input.documentVersions.length !== input.documentVersionIds.length) throw new Error("All document versions must be provided.");
  for (const version of input.documentVersions ?? []) if (input.documentVersionIds.includes(version.id) && (version.companyId !== input.companyId || version.projectId !== input.projectId)) throw new Error("Document version does not belong to the requested tenant/project.");
  for (const item of input.budgetItems) if (item.budgetId !== input.budgetId || (item.companyId !== undefined && item.companyId !== input.companyId) || (item.projectId !== undefined && item.projectId !== input.projectId)) throw new Error("Budget item does not belong to the requested tenant/project/budget.");
  for (const evidence of input.evidence) if (!input.documentVersionIds.includes(evidence.documentVersionId) || (evidence.companyId !== undefined && evidence.companyId !== input.companyId) || (evidence.projectId !== undefined && evidence.projectId !== input.projectId)) throw new Error("Evidence does not belong to the requested tenant/project/document version.");
}
async function ownedRun(client: ReviewPipelineClient, input: RunReviewJobInput, id: string): Promise<Row | null> { return client.reviewRun.findUnique({ where: { id_companyId_projectId: { id, companyId: input.companyId, projectId: input.projectId } } }); }
async function checkpoint(client: ReviewPipelineClient, input: RunReviewJobInput, id: string, stage: ReviewStage, index: number, status: string, count: number, warnings: WarningJson[], correlationId: string): Promise<void> { const current = await ownedRun(client, input, id); const existing = (current?.progressJson as { checkpoints?: Array<Record<string, unknown>> } | undefined)?.checkpoints ?? []; const checkpoints = [...existing]; const entry = { stage, status, count, total: 8, warnings, correlationId }; const at = checkpoints.findIndex((value) => value.stage === stage); if (at >= 0) checkpoints[at] = entry; else checkpoints.push(entry); const changed = await client.reviewRun.updateMany({ where: { id, companyId: input.companyId, projectId: input.projectId, status: "RUNNING" }, data: { progressJson: { stage, completed: index, total: 8, percent: stage === "completed" ? 100 : Math.round((index / 8) * 100), checkpoints }, warningsJson: warnings } }); if (changed.count === 0) throw new Error("Review run is no longer active."); }
async function isCancellationRequested(input: RunReviewJobInput, client: ReviewPipelineClient, id: string): Promise<boolean> { return (await ownedRun(client, input, id))?.status === "CANCELLED" || Boolean(await input.shouldCancel?.()); }
async function cancelResult(client: ReviewPipelineClient, input: RunReviewJobInput, id: string, stage: ReviewStage, warnings: WarningJson[], key: string, correlationId: string): Promise<RunReviewJobResult> { await client.reviewRun.updateMany({ where: { id, companyId: input.companyId, projectId: input.projectId, status: "RUNNING" }, data: { status: "CANCELLED", finishedAt: new Date(), warningsJson: warnings } }); await client.reviewAuditEvent.create({ data: { companyId: input.companyId, projectId: input.projectId, reviewRunId: id, actorUserId: input.createdById, eventType: "REVIEW_CANCELLED", correlationId, payloadJson: { stage, warnings } } }); return result((await ownedRun(client, input, id)) ?? { id, status: "CANCELLED", progressJson: {}, warningsJson: warnings }, key); }
function result(run: Row, key: string): RunReviewJobResult { const checkpoints = (run.progressJson as { checkpoints?: Array<{ stage?: string }> } | undefined)?.checkpoints ?? []; const stages = checkpoints.map((entry) => entry.stage).filter((stage): stage is ReviewStage => typeof stage === "string" && (REVIEW_STAGES as readonly string[]).includes(stage)); return { reviewRunId: String(run.id), status: String(run.status) as ReviewRunStatus, stages: [...new Set(stages)], warnings: Array.isArray(run.warningsJson) ? run.warningsJson as WarningJson[] : [], idempotencyKey: key }; }
function evidenceData(input: RunReviewJobInput, evidence: ReviewEvidence): Row { return { id: evidence.id, companyId: input.companyId, projectId: input.projectId, documentVersionId: evidence.documentVersionId, evidenceType: evidence.evidenceType, originalText: evidence.originalText, normalizedText: evidence.normalizedText, locationJson: json(evidence.locationJson), value: evidence.quantity?.toString(), unit: evidence.unit, extractionMethod: "review-pipeline", confidence: evidence.confidence, sourceHash: evidence.sourceHash }; }
function linkData(input: RunReviewJobInput, candidate: ReturnType<typeof matchBudgetItemToEvidence>[number]): Row { return { companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, budgetItemId: candidate.budgetItemId, evidenceId: candidate.evidenceId, signalsJson: json(candidate.signals), score: candidate.score.toString(), confidence: candidate.confidence }; }
function findingData(input: RunReviewJobInput, runId: string, finding: ReturnType<typeof evaluateFindingRules>[number], linkId: string | undefined): Row { return { companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, reviewRunId: runId, budgetItemId: finding.budgetItemId, budgetItemBudgetId: input.budgetId, evidenceId: finding.evidenceId, entityLinkId: linkId, findingType: finding.type, severity: finding.severity, priority: finding.priorityScore.toString(), confidence: finding.confidence, score: finding.priorityScore.toString(), potentialImpact: finding.comparison?.potentialImpact?.toString(), ruleKey: finding.priorityVersion, comparisonJson: json({ message: finding.message, ...finding.comparison }), humanReviewRequired: true, automaticBudgetMutation: false }; }
