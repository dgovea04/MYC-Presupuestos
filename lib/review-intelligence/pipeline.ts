import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { matchBudgetItemToEvidence, type BudgetItemMatchInput, type EvidenceMatchInput } from "./matching";
import { evaluateFindingRules, type ReviewRuleEvidence, type ReviewRuleItem } from "./rules";
import { parseReviewConfiguration } from "./validation";
import type { ReviewConfiguration, ReviewRunStatus, ProgressJson, WarningJson } from "./types";

export const REVIEW_STAGES = ["validating", "extracting", "classifying", "identifying evidence", "matching", "rules", "prioritizing", "completed"] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];

export interface ReviewBudgetItem extends BudgetItemMatchInput, ReviewRuleItem { budgetId: string; }
export interface ReviewEvidence extends EvidenceMatchInput, ReviewRuleEvidence {
  documentVersionId: string; originalText: string; normalizedText?: string; sourceHash: string; evidenceType: string; confidence: "LOW" | "MEDIUM" | "HIGH"; locationJson: Record<string, unknown>;
}

export interface RunReviewJobInput {
  companyId: string; projectId: string; budgetId: string; createdById: string; documentVersionIds: string[];
  configuration: ReviewConfiguration; rulesVersion: string; budgetItems: ReviewBudgetItem[]; evidence: ReviewEvidence[];
  extractionWarnings?: WarningJson[]; shouldCancel?: () => boolean | Promise<boolean>; humanReviewRequired?: boolean; automaticBudgetMutation?: boolean;
}

export interface RunReviewJobResult { reviewRunId: string; status: ReviewRunStatus; stages: ReviewStage[]; warnings: WarningJson[]; idempotencyKey: string; }

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
export interface ReviewPipelineClient {
  reviewRun: { findFirst(args: { where: Where }): Promise<Row | null>; findMany(args: { where: Where }): Promise<Row[]>; create(args: { data: Row }): Promise<Row>; update(args: { where: Where; data: Row }): Promise<Row>; };
  reviewRunDocumentVersion: { upsert(args: { where: Where; create: Row; update: Row }): Promise<Row>; };
  reviewEvidence: { findFirst(args: { where: Where }): Promise<Row | null>; create(args: { data: Row }): Promise<Row>; };
  entityLink: { findFirst(args: { where: Where }): Promise<Row | null>; create(args: { data: Row }): Promise<Row>; };
  reviewFinding: { findFirst(args: { where: Where }): Promise<Row | null>; create(args: { data: Row }): Promise<Row>; };
  reviewAuditEvent: { create(args: { data: Row }): Promise<Row>; };
  $transaction<T>(callback: (transaction: ReviewPipelineClient) => Promise<T>): Promise<T>;
}

const activeStatuses = new Set(["DRAFT", "QUEUED", "RUNNING"]);
const json = (value: unknown): unknown => value;
const stableKey = (input: RunReviewJobInput): string => createHash("sha256").update(JSON.stringify({ budgetId: input.budgetId, documentVersionIds: [...input.documentVersionIds].sort(), configuration: input.configuration, rulesVersion: input.rulesVersion })).digest("hex");

export async function runReviewJob(input: RunReviewJobInput, client: ReviewPipelineClient): Promise<RunReviewJobResult> {
  const configuration = parseReviewConfiguration(input.configuration);
  if (input.humanReviewRequired === false || input.automaticBudgetMutation === true) throw new Error("Review guardrails cannot be disabled.");
  if (input.documentVersionIds.length === 0) throw new Error("At least one document version is required.");
  const idempotencyKey = stableKey(input);
  const existingRuns = await client.reviewRun.findMany({ where: { companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId } });
  const existing = existingRuns.find((candidate) => (candidate.configurationJson as { idempotencyKey?: string } | undefined)?.idempotencyKey === idempotencyKey) ?? null;
  if (existing && existing.status !== "FAILED" && existing.status !== "STALE") return result(existing, idempotencyKey);
  const active = await client.reviewRun.findMany({ where: { companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId } });
  if (active.some((run) => activeStatuses.has(String(run.status)))) throw new Error("An active review run already exists for this budget.");

  const run = await client.reviewRun.create({ data: { companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, createdById: input.createdById, configurationJson: { ...configuration, idempotencyKey }, rulesVersion: input.rulesVersion, status: "RUNNING", startedAt: new Date(), progressJson: progress(REVIEW_STAGES[0], 0), warningsJson: input.extractionWarnings ?? [] } });
  const runId = String(run.id);
  const warnings = [...(input.extractionWarnings ?? [])];
  for (const [index, stage] of REVIEW_STAGES.entries()) {
    await checkpoint(client, runId, input, stage, index);
    if (await cancelled(input, client, runId)) return finish(client, runId, "CANCELLED", stage, warnings, idempotencyKey);
    if (stage === "extracting") {
      await client.$transaction(async (transaction) => { for (const documentVersionId of input.documentVersionIds) await transaction.reviewRunDocumentVersion.upsert({ where: { reviewRunId_documentVersionId: { reviewRunId: runId, documentVersionId } }, create: { companyId: input.companyId, projectId: input.projectId, reviewRunId: runId, documentVersionId }, update: {} }); });
    }
    if (stage === "identifying evidence") {
      await client.$transaction(async (transaction) => { for (const evidence of input.evidence) { const existingEvidence = await transaction.reviewEvidence.findFirst({ where: { documentVersionId: evidence.documentVersionId, sourceHash: evidence.sourceHash } }); if (!existingEvidence) await transaction.reviewEvidence.create({ data: evidenceData(input, evidence) }); } });
    }
    if (stage === "matching") {
      await client.$transaction(async (transaction) => { for (const item of input.budgetItems) { const candidates = matchBudgetItemToEvidence(item, input.evidence); for (const candidate of candidates.filter((entry) => entry.eligibleForFindings)) { const found = await transaction.entityLink.findFirst({ where: { budgetItemId: candidate.budgetItemId, evidenceId: candidate.evidenceId } }); if (!found) await transaction.entityLink.create({ data: linkData(input, runId, candidate) }); } } });
    }
    if (stage === "rules") {
      await client.$transaction(async (transaction) => { for (const item of input.budgetItems) { const candidates = matchBudgetItemToEvidence(item, input.evidence).filter((entry) => entry.eligibleForFindings); for (const link of candidates) { const evidence = input.evidence.find((entry) => entry.id === link.evidenceId); if (!evidence) continue; for (const finding of evaluateFindingRules({ item, evidence, link: { evidenceId: link.evidenceId, confidence: link.confidence, score: link.score }, tolerance: new Decimal(configuration.tolerancePercent), ruleTypes: configuration.findingTypes })) { const affected = warnings.some((warning) => warning.source === evidence.documentVersionId); if (finding.type === "MISSING_DOCUMENTATION" && affected) continue; const found = await transaction.reviewFinding.findFirst({ where: { reviewRunId: runId, budgetItemId: finding.budgetItemId, evidenceId: finding.evidenceId, findingType: finding.type } }); if (!found) await transaction.reviewFinding.create({ data: findingData(input, runId, finding, link.evidenceId) }); } } } });
    }
    if (stage === "completed") return finish(client, runId, warnings.length ? "COMPLETED_WITH_WARNINGS" : "COMPLETED", stage, warnings, idempotencyKey);
  }
  return finish(client, runId, warnings.length ? "COMPLETED_WITH_WARNINGS" : "COMPLETED", "completed", warnings, idempotencyKey);
}

function progress(stage: ReviewStage, index: number): ProgressJson { return { stage, completed: index, total: REVIEW_STAGES.length, percent: Math.round((index / REVIEW_STAGES.length) * 100) }; }
async function checkpoint(client: ReviewPipelineClient, id: string, input: RunReviewJobInput, stage: ReviewStage, index: number): Promise<void> { await client.reviewRun.update({ where: { id, companyId: input.companyId, projectId: input.projectId }, data: { progressJson: progress(stage, index) } }); }
async function cancelled(input: RunReviewJobInput, client: ReviewPipelineClient, id: string): Promise<boolean> { const run = await client.reviewRun.findFirst({ where: { id, companyId: input.companyId, projectId: input.projectId } }); return run?.status === "CANCELLED" || Boolean(await input.shouldCancel?.()); }
async function finish(client: ReviewPipelineClient, id: string, status: ReviewRunStatus, stage: ReviewStage, warnings: WarningJson[], key: string): Promise<RunReviewJobResult> { const updated = await client.reviewRun.update({ where: { id }, data: { status, progressJson: progress(stage, stage === "completed" ? REVIEW_STAGES.length : REVIEW_STAGES.indexOf(stage)), warningsJson: warnings, finishedAt: new Date() } }); return result(updated, key); }
function result(run: Row, key: string): RunReviewJobResult { const p = (run.progressJson ?? {}) as Partial<ProgressJson>; const stage = typeof p.stage === "string" && (REVIEW_STAGES as readonly string[]).includes(p.stage) ? p.stage as ReviewStage : "validating"; return { reviewRunId: String(run.id), status: String(run.status) as ReviewRunStatus, stages: REVIEW_STAGES.slice(0, Math.max(0, REVIEW_STAGES.indexOf(stage) + 1)), warnings: Array.isArray(run.warningsJson) ? run.warningsJson as WarningJson[] : [], idempotencyKey: key }; }
function evidenceData(input: RunReviewJobInput, evidence: ReviewEvidence): Row { return { id: evidence.id, companyId: input.companyId, projectId: input.projectId, documentVersionId: evidence.documentVersionId, evidenceType: evidence.evidenceType, originalText: evidence.originalText, normalizedText: evidence.normalizedText, locationJson: json(evidence.locationJson), value: evidence.quantity?.toString(), unit: evidence.unit, extractionMethod: "review-pipeline", confidence: evidence.confidence, sourceHash: evidence.sourceHash }; }
function linkData(input: RunReviewJobInput, _runId: string, candidate: ReturnType<typeof matchBudgetItemToEvidence>[number]): Row { return { companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, budgetItemId: candidate.budgetItemId, evidenceId: candidate.evidenceId, signalsJson: json(candidate.signals), score: candidate.score.toString(), confidence: candidate.confidence }; }
function findingData(input: RunReviewJobInput, runId: string, finding: ReturnType<typeof evaluateFindingRules>[number], linkId: string): Row { return { companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, reviewRunId: runId, budgetItemId: finding.budgetItemId, budgetItemBudgetId: input.budgetId, evidenceId: finding.evidenceId, entityLinkId: linkId, findingType: finding.type, severity: finding.severity, priority: finding.priorityScore.toString(), confidence: finding.confidence, score: finding.priorityScore.toString(), potentialImpact: finding.comparison?.potentialImpact?.toString(), ruleKey: finding.priorityVersion, comparisonJson: json({ message: finding.message, ...finding.comparison }), humanReviewRequired: true, automaticBudgetMutation: false }; }
