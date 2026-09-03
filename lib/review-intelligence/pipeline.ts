import { createHash, randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { matchBudgetItemToEvidence, type BudgetItemMatchInput, type EvidenceMatchInput } from "./matching";
import { evaluateFindingRules, type ReviewRuleEvidence, type ReviewRuleItem } from "./rules";
import { parseReviewConfiguration } from "./validation";
import type { ReviewConfiguration, ReviewRunStatus, WarningJson } from "./types";

export const REVIEW_STAGES = ["validating", "extracting", "classifying", "identifying evidence", "matching", "rules", "prioritizing", "completed"] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type QueryArgs = { where: Where; select?: Record<string, unknown>; orderBy?: Record<string, unknown> };
type TransactionOptions = { isolationLevel?: "Serializable" };

export interface ReviewBudgetItem extends BudgetItemMatchInput, ReviewRuleItem { budgetId: string; companyId?: string; projectId?: string; discipline?: string; baseSnapshotId?: string; }
export interface ReviewEvidence extends EvidenceMatchInput, ReviewRuleEvidence { documentVersionId: string; originalText: string; normalizedText?: string; sourceHash: string; evidenceType: string; confidence: "LOW" | "MEDIUM" | "HIGH"; locationJson: Record<string, unknown>; companyId?: string; projectId?: string; }
export interface ReviewDocumentVersionReference { id: string; companyId: string; projectId: string; }
export interface ReviewBudgetReference { id: string; companyId: string; projectId: string; }
export interface RunReviewJobInput { companyId: string; projectId: string; budgetId: string; budgetReference: ReviewBudgetReference; createdById: string; documentVersionIds: string[]; documentVersions: ReviewDocumentVersionReference[]; configuration: ReviewConfiguration; rulesVersion: string; budgetItems: ReviewBudgetItem[]; evidence: ReviewEvidence[]; extractionWarnings?: WarningJson[]; shouldCancel?: () => boolean | Promise<boolean>; humanReviewRequired?: boolean; automaticBudgetMutation?: boolean; idempotencyKey?: string; defer?: boolean; }
export interface RunReviewJobResult { reviewRunId: string; status: ReviewRunStatus; stages: ReviewStage[]; warnings: WarningJson[]; idempotencyKey: string; }
export interface ReviewPipelineClient {
  budget: { findFirst(args: QueryArgs): Promise<Row | null>; findMany(args: QueryArgs): Promise<Row[]> };
  project: { findFirst(args: { where: Where }): Promise<Row | null> };
  projectDocument: { findFirst(args: { where: Where }): Promise<Row | null> };
  documentVersion: { findFirst(args: { where: Where }): Promise<Row | null> };
  budgetItem: { findFirst(args: { where: Where }): Promise<Row | null> };
  budgetVersionSnapshot: { findFirst(args: QueryArgs): Promise<Row | null> };
  reviewRun: { findFirst(args: { where: Where }): Promise<Row | null>; findUnique(args: { where: Where }): Promise<Row | null>; findMany(args: { where: Where }): Promise<Row[]>; create(args: { data: Row }): Promise<Row>; updateMany(args: { where: Where; data: Row }): Promise<{ count: number }>; };
  reviewRunDocumentVersion: { upsert(args: { where: Where; create: Row; update: Row }): Promise<Row>; };
  reviewEvidence: { findFirst(args: { where: Where }): Promise<Row | null>; upsert(args: { where: Where; create: Row; update: Row }): Promise<Row>; };
  entityLink: { findFirst(args: { where: Where }): Promise<Row | null>; upsert(args: { where: Where; create: Row; update: Row }): Promise<Row>; };
  reviewFinding: { findFirst(args: { where: Where }): Promise<Row | null>; upsert(args: { where: Where; create: Row; update: Row }): Promise<Row>; };
  reviewAuditEvent: { create(args: { data: Row }): Promise<Row>; };
  $transaction<T>(callback: (transaction: ReviewPipelineClient) => Promise<T>, options?: TransactionOptions): Promise<T>;
}

const activeStatuses = ["DRAFT", "QUEUED", "RUNNING"];
const requestFingerprintFor = (input: RunReviewJobInput): string => createHash("sha256").update(JSON.stringify({ documentVersionIds: [...input.documentVersionIds].sort(), configuration: input.configuration, rulesVersion: input.rulesVersion })).digest("hex");
const idempotencyKeyFor = (input: RunReviewJobInput): string => input.idempotencyKey ?? createHash("sha256").update(JSON.stringify({ companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, requestFingerprint: requestFingerprintFor(input) })).digest("hex");
const runIdFor = (input: RunReviewJobInput, key: string): string => `review-${createHash("sha256").update(`${input.companyId}:${input.projectId}:${input.budgetId}:${key}`).digest("hex")}`;
const json = (value: unknown): unknown => value;
const isRetryableUniqueOrSerializationConflict = (error: unknown): boolean => { if (typeof error === "object" && error !== null && "code" in error) return error.code === "P2002" || error.code === "P2034"; return error instanceof Error && (/P2002|P2034|serialization/i).test(error.message); };

export async function runReviewJob(input: RunReviewJobInput, client: ReviewPipelineClient): Promise<RunReviewJobResult> {
  const configuration = parseReviewConfiguration(input.configuration);
  await validateInput(input, client);
  if (input.humanReviewRequired === false || input.automaticBudgetMutation === true) throw new Error("Review guardrails cannot be disabled.");
  const key = idempotencyKeyFor(input);
  const id = runIdFor(input, key);
  const claimToken = randomUUID();
  let run: Row;
  try {
    run = await client.$transaction(async (transaction) => {
    const existing = await transaction.reviewRun.findUnique({ where: { id_companyId_projectId: { id, companyId: input.companyId, projectId: input.projectId } } });
    if (existing) {
      const configurationJson = existing.configurationJson as { idempotencyKey?: string; requestFingerprint?: string } | undefined;
      if (configurationJson?.idempotencyKey === key && configurationJson.requestFingerprint !== undefined && configurationJson.requestFingerprint !== requestFingerprintFor(input)) throw new Error("Idempotency key was reused with a different request.");
      return existing;
    }
    const active = await transaction.reviewRun.findMany({ where: { companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, status: { in: activeStatuses } } });
    if (active.length > 0) throw new Error("An active review run already exists for this budget.");
    return transaction.reviewRun.create({ data: { id, companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, createdById: input.createdById, configurationJson: { ...configuration, idempotencyKey: key, requestFingerprint: requestFingerprintFor(input) }, rulesVersion: input.rulesVersion, status: input.defer ? "QUEUED" : "RUNNING", startedAt: input.defer ? null : new Date(), progressJson: { stage: "validating", completed: 0, total: 8, percent: 0, checkpoints: [], lease: { token: claimToken, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() } }, warningsJson: input.extractionWarnings ?? [] } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const concurrent = await client.reviewRun.findUnique({ where: { id_companyId_projectId: { id, companyId: input.companyId, projectId: input.projectId } } });
    if (!concurrent || !isRetryableUniqueOrSerializationConflict(error)) throw error;
    run = concurrent;
  }
  if (input.defer) return result(run, key);
  if (["COMPLETED", "COMPLETED_WITH_WARNINGS", "CANCELLED"].includes(String(run.status))) return result(run, key);
  const ownsRun = await claimRun(client, input, run, claimToken);
  if (!ownsRun) return result((await ownedRun(client, input, id)) ?? run, key);
  return executeFromCheckpoint(input, client, run, configuration, key, claimToken);
}

async function claimRun(client: ReviewPipelineClient, input: RunReviewJobInput, run: Row, token: string): Promise<boolean> {
  const progress = (run.progressJson ?? {}) as { lease?: { token?: string; expiresAt?: string } };
  if (run.status === "RUNNING" && progress.lease?.token && progress.lease.token !== token && progress.lease.expiresAt && Date.parse(progress.lease.expiresAt) > Date.now()) return false;
  const status: Where["status"] = run.status === "RUNNING" ? "RUNNING" : { in: ["QUEUED", "FAILED", "STALE"] };
  const changed = await client.reviewRun.updateMany({ where: { id: String(run.id), companyId: input.companyId, projectId: input.projectId, status, progressJson: { equals: run.progressJson } }, data: { status: "RUNNING", finishedAt: null, progressJson: { ...(run.progressJson as Record<string, unknown> | null ?? {}), lease: { token, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() } } } });
  return changed.count > 0;
}

async function executeFromCheckpoint(input: RunReviewJobInput, client: ReviewPipelineClient, run: Row, configuration: ReviewConfiguration, key: string, claimToken: string): Promise<RunReviewJobResult> {
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
      await checkpoint(client, input, id, stage, index, "RUNNING", 0, warnings, correlationId, claimToken);
      if (await isCancellationRequested(input, client, id)) return cancelResult(client, input, id, stage, warnings, key, correlationId, claimToken);
      const count = await processStage(stage, input, client, id, configuration, claimToken);
      await checkpoint(client, input, id, stage, index, "COMPLETED", count, warnings, correlationId, claimToken);
      await createAudit(client, input, id, claimToken, { stage, status: "COMPLETED", count, warnings }, correlationId, "REVIEW_STAGE_COMPLETED");
    } catch (error) {
      const warning: WarningJson = { code: "STAGE_FAILED", message: error instanceof Error ? error.message : "Review stage failed.", source: stage };
      warnings.push(warning);
      await checkpoint(client, input, id, stage, index, "FAILED", 0, warnings, correlationId, claimToken).catch(() => undefined);
      await failRun(client, input, id, claimToken, stage, warning, warnings, correlationId).catch(() => undefined);
      throw error;
    }
  }
  const status: ReviewRunStatus = warnings.length > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED";
  const changed = await closeRun(client, input, id, claimToken, status, warnings);
  const final = await ownedRun(client, input, id);
  if (changed.count === 0 && final?.status === "CANCELLED") return result(final, key);
  return result(final ?? { id, status, progressJson: {}, warningsJson: warnings }, key);
}

async function processStage(stage: ReviewStage, input: RunReviewJobInput, client: ReviewPipelineClient, runId: string, configuration: ReviewConfiguration, token: string): Promise<number> {
  if (stage === "validating") return input.budgetItems.length + input.documentVersionIds.length;
  if (stage === "extracting") { await client.$transaction(async (transaction) => { await assertLease(transaction, input, runId, token); for (const documentVersionId of input.documentVersionIds) await transaction.reviewRunDocumentVersion.upsert({ where: { reviewRunId_documentVersionId: { reviewRunId: runId, documentVersionId } }, create: { companyId: input.companyId, projectId: input.projectId, reviewRunId: runId, documentVersionId }, update: {} }); }); return input.documentVersionIds.length; }
  if (stage === "classifying") return input.evidence.length;
  if (stage === "identifying evidence") { await client.$transaction(async (transaction) => { await assertLease(transaction, input, runId, token); for (const evidence of input.evidence) await transaction.reviewEvidence.upsert({ where: { documentVersionId_sourceHash: { documentVersionId: evidence.documentVersionId, sourceHash: evidence.sourceHash } }, create: evidenceData(input, evidence), update: {} }); }); return input.evidence.length; }
  const persistedEvidence = await getPersistedEvidence(input, client);
  if (stage === "matching") { let count = 0; await client.$transaction(async (transaction) => { await assertLease(transaction, input, runId, token); for (const item of input.budgetItems) for (const candidate of matchBudgetItemToEvidence(item, persistedEvidence).filter((entry) => entry.eligibleForFindings)) { await transaction.entityLink.upsert({ where: { budgetItemId_evidenceId: { budgetItemId: candidate.budgetItemId, evidenceId: candidate.evidenceId } }, create: linkData(input, candidate), update: {} }); count += 1; } }); return count; }
  if (stage === "rules" || stage === "prioritizing") { let count = 0; await client.$transaction(async (transaction) => { await assertLease(transaction, input, runId, token); for (const item of input.budgetItems) { const candidates = matchBudgetItemToEvidence(item, persistedEvidence); for (const evidence of persistedEvidence.filter((entry) => entry.primary)) { const link = candidates.find((entry) => entry.evidenceId === evidence.id && entry.eligibleForFindings); const persistedLink = link ? await transaction.entityLink.findFirst({ where: { budgetItemId: link.budgetItemId, evidenceId: link.evidenceId, companyId: input.companyId, projectId: input.projectId } }) : null; const persistedLinkId = typeof persistedLink?.id === "string" ? persistedLink.id : undefined; if (link && !persistedLinkId) throw new Error("Matched entity link was not persisted for the requested tenant/project."); const findings = evaluateFindingRules({ item, evidence, link: link ? { evidenceId: link.evidenceId, confidence: link.confidence, score: link.score } : undefined, tolerance: new Decimal(configuration.tolerancePercent), ruleTypes: configuration.findingTypes }); for (const finding of findings) { if (finding.type === "MISSING_DOCUMENTATION" && input.extractionWarnings?.some((warning) => warning.source === evidence.documentVersionId)) continue; await transaction.reviewFinding.upsert({ where: { id_companyId_projectId: { id: stableId("finding", runId, finding.budgetItemId, finding.evidenceId, finding.type), companyId: input.companyId, projectId: input.projectId } }, create: findingData(input, runId, finding, persistedLinkId), update: {} }); count += 1; } } } }); return count; }
  return input.budgetItems.length + input.evidence.length;
}

async function validateInput(input: RunReviewJobInput, client: ReviewPipelineClient): Promise<void> {
  if (input.documentVersionIds.length === 0) throw new Error("At least one document version is required.");
  if (!await client.project.findFirst({ where: { id: input.projectId, companyId: input.companyId } })) throw new Error("Project does not belong to the requested company.");
  if (!await client.budget.findFirst({ where: { id: input.budgetId, project: { companyId: input.companyId }, projectId: input.projectId } })) throw new Error("Budget does not belong to the requested tenant/project.");
  if (input.documentVersions.length !== input.documentVersionIds.length || new Set(input.documentVersionIds).size !== input.documentVersionIds.length || new Set(input.documentVersions.map((version) => version.id)).size !== input.documentVersions.length || input.documentVersions.some((version) => !input.documentVersionIds.includes(version.id))) throw new Error("Requested document version set is not exact.");
  for (const version of input.documentVersions) { const stored = await client.documentVersion.findFirst({ where: { id: version.id, companyId: input.companyId, projectId: input.projectId } }); if (!stored) throw new Error("Document version is not present in the database for this tenant/project."); if (!await client.projectDocument.findFirst({ where: { id: stored.projectDocumentId, companyId: input.companyId, projectId: input.projectId } })) throw new Error("Project document is not present in the database for this tenant/project."); }
  const budgets = await client.budget.findMany({ where: { project: { companyId: input.companyId }, projectId: input.projectId } });
  const budgetIds = new Set<string>([input.budgetId]);
  let frontier = [input.budgetId];
  while (frontier.length > 0) {
    const children = budgets.filter((budget) => typeof budget.id === "string" && typeof budget.parentBudgetId === "string" && frontier.includes(budget.parentBudgetId));
    frontier = children.map((budget) => String(budget.id)).filter((id) => !budgetIds.has(id));
    frontier.forEach((id) => budgetIds.add(id));
  }
  for (const item of input.budgetItems) {
    if (!budgetIds.has(item.budgetId) || !await client.budgetItem.findFirst({ where: { id: item.id, budgetId: item.budgetId } })) throw new Error("Budget item does not belong to the requested tenant/project/budget hierarchy.");
    if (!item.baseSnapshotId) {
      const base = await client.budgetVersionSnapshot.findFirst({ where: { budgetId: item.budgetId, companyId: input.companyId, projectId: input.projectId }, orderBy: { versionNumber: "desc" } });
      if (!base || typeof base.id !== "string") throw new Error("Budget item requires a persisted base budget snapshot before review.");
      item.baseSnapshotId = base.id;
    } else {
      const base = await client.budgetVersionSnapshot.findFirst({ where: { id: item.baseSnapshotId, budgetId: item.budgetId, companyId: input.companyId, projectId: input.projectId } });
      if (!base) throw new Error("Base budget snapshot does not belong to the requested tenant/project/budget.");
    }
  }
  for (const evidence of input.evidence) if (!input.documentVersionIds.includes(evidence.documentVersionId)) throw new Error("Evidence does not belong to the requested tenant/project/document version.");
}
async function getPersistedEvidence(input: RunReviewJobInput, client: ReviewPipelineClient): Promise<ReviewEvidence[]> { const persisted: ReviewEvidence[] = []; for (const evidence of input.evidence) { const stored = await client.reviewEvidence.findFirst({ where: { documentVersionId: evidence.documentVersionId, sourceHash: evidence.sourceHash, companyId: input.companyId, projectId: input.projectId } }); if (!stored) throw new Error("Evidence was not persisted for the requested document version."); persisted.push({ ...evidence, id: String(stored.id) }); } return persisted; }
async function ownedRun(client: ReviewPipelineClient, input: RunReviewJobInput, id: string): Promise<Row | null> { return client.reviewRun.findUnique({ where: { id_companyId_projectId: { id, companyId: input.companyId, projectId: input.projectId } } }); }
function leaseFor(token: string): { token: string; expiresAt: string } { return { token, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() }; }
function leaseValid(run: Row | null, token: string): boolean { const lease = ((run?.progressJson ?? {}) as { lease?: { token?: string; expiresAt?: string } }).lease; return run?.status === "RUNNING" && lease?.token === token && !!lease.expiresAt && Date.parse(lease.expiresAt) > Date.now(); }
async function checkpoint(client: ReviewPipelineClient, input: RunReviewJobInput, id: string, stage: ReviewStage, index: number, status: string, count: number, warnings: WarningJson[], correlationId: string, token: string): Promise<void> { const current = await ownedRun(client, input, id); if (!leaseValid(current, token)) throw new Error("Review lease is no longer active."); const existing = (current?.progressJson as { checkpoints?: Array<Record<string, unknown>> } | undefined)?.checkpoints ?? []; const checkpoints = [...existing]; const entry = { stage, status, count, total: 8, warnings, correlationId }; const at = checkpoints.findIndex((value) => value.stage === stage); if (at >= 0) checkpoints[at] = entry; else checkpoints.push(entry); const changed = await client.reviewRun.updateMany({ where: { id, companyId: input.companyId, projectId: input.projectId, status: "RUNNING", progressJson: { equals: current?.progressJson } }, data: { progressJson: { stage, completed: index, total: 8, percent: stage === "completed" ? 100 : Math.round((index / 8) * 100), checkpoints, lease: leaseFor(token) }, warningsJson: warnings } }); if (changed.count === 0) throw new Error("Review run is no longer active."); }
async function isCancellationRequested(input: RunReviewJobInput, client: ReviewPipelineClient, id: string): Promise<boolean> { return (await ownedRun(client, input, id))?.status === "CANCELLED" || Boolean(await input.shouldCancel?.()); }
async function assertLease(client: ReviewPipelineClient, input: RunReviewJobInput, id: string, token: string): Promise<void> { const current = await ownedRun(client, input, id); if (!leaseValid(current, token)) throw new Error("Review lease is no longer active."); const changed = await client.reviewRun.updateMany({ where: { id, companyId: input.companyId, projectId: input.projectId, status: "RUNNING", progressJson: { equals: current?.progressJson } }, data: { progressJson: { ...(current?.progressJson as Record<string, unknown>), lease: leaseFor(token) } } }); if (changed.count === 0) throw new Error("Review lease is no longer active."); }
async function createAudit(client: ReviewPipelineClient, input: RunReviewJobInput, id: string, token: string, payload: Row, correlationId: string, eventType: string): Promise<void> { await client.$transaction(async (transaction) => { await assertLease(transaction, input, id, token); await transaction.reviewAuditEvent.create({ data: { companyId: input.companyId, projectId: input.projectId, reviewRunId: id, actorUserId: input.createdById, eventType, correlationId, payloadJson: { ...payload, leaseToken: token } } }); }); }
async function cancelResult(client: ReviewPipelineClient, input: RunReviewJobInput, id: string, stage: ReviewStage, warnings: WarningJson[], key: string, correlationId: string, token: string): Promise<RunReviewJobResult> { await client.$transaction(async (transaction) => { const current = await ownedRun(transaction, input, id); if (current?.status === "CANCELLED") return; await assertLease(transaction, input, id, token); const changed = await transaction.reviewRun.updateMany({ where: { id, companyId: input.companyId, projectId: input.projectId, status: "RUNNING", progressJson: { equals: (await ownedRun(transaction, input, id))?.progressJson } }, data: { status: "CANCELLED", finishedAt: new Date(), warningsJson: warnings } }); if (changed.count === 0) throw new Error("Review run is no longer active."); await transaction.reviewAuditEvent.create({ data: { companyId: input.companyId, projectId: input.projectId, reviewRunId: id, actorUserId: input.createdById, eventType: "REVIEW_CANCELLED", correlationId, payloadJson: { stage, warnings, leaseToken: token } } }); }); return result((await ownedRun(client, input, id)) ?? { id, status: "CANCELLED", progressJson: {}, warningsJson: warnings }, key); }
async function failRun(client: ReviewPipelineClient, input: RunReviewJobInput, id: string, token: string, stage: ReviewStage, warning: WarningJson, warnings: WarningJson[], correlationId: string): Promise<void> { await client.$transaction(async (transaction) => { await assertLease(transaction, input, id, token); const current = await ownedRun(transaction, input, id); const changed = await transaction.reviewRun.updateMany({ where: { id, companyId: input.companyId, projectId: input.projectId, status: "RUNNING", progressJson: { equals: current?.progressJson } }, data: { status: "FAILED", warningsJson: warnings, finishedAt: new Date() } }); if (changed.count === 0) throw new Error("Review run is no longer active."); await transaction.reviewAuditEvent.create({ data: { companyId: input.companyId, projectId: input.projectId, reviewRunId: id, actorUserId: input.createdById, eventType: "REVIEW_STAGE_FAILED", correlationId, payloadJson: { stage, status: "FAILED", count: 0, warnings: [warning], leaseToken: token } } }); }); }
async function closeRun(client: ReviewPipelineClient, input: RunReviewJobInput, id: string, token: string, status: ReviewRunStatus, warnings: WarningJson[]): Promise<{ count: number }> { return client.$transaction(async (transaction) => { await assertLease(transaction, input, id, token); const current = await ownedRun(transaction, input, id); return transaction.reviewRun.updateMany({ where: { id, companyId: input.companyId, projectId: input.projectId, status: "RUNNING", progressJson: { equals: current?.progressJson } }, data: { status, warningsJson: warnings, finishedAt: new Date() } }); }); }
function result(run: Row, key: string): RunReviewJobResult { const checkpoints = (run.progressJson as { checkpoints?: Array<{ stage?: string }> } | undefined)?.checkpoints ?? []; const stages = checkpoints.map((entry) => entry.stage).filter((stage): stage is ReviewStage => typeof stage === "string" && (REVIEW_STAGES as readonly string[]).includes(stage)); return { reviewRunId: String(run.id), status: String(run.status) as ReviewRunStatus, stages: [...new Set(stages)], warnings: Array.isArray(run.warningsJson) ? run.warningsJson as WarningJson[] : [], idempotencyKey: key }; }
function stableId(prefix: string, ...parts: string[]): string { return `${prefix}-${createHash("sha256").update(parts.join("\u001f")).digest("hex")}`; }
function evidenceData(input: RunReviewJobInput, evidence: ReviewEvidence): Row { return { id: stableId("evidence", evidence.documentVersionId, evidence.sourceHash), companyId: input.companyId, projectId: input.projectId, documentVersionId: evidence.documentVersionId, evidenceType: evidence.evidenceType, originalText: evidence.originalText, normalizedText: evidence.normalizedText, locationJson: json(evidence.locationJson), value: evidence.quantity?.toString(), unit: evidence.unit, extractionMethod: "review-pipeline", confidence: evidence.confidence, sourceHash: evidence.sourceHash }; }
function linkData(input: RunReviewJobInput, candidate: ReturnType<typeof matchBudgetItemToEvidence>[number]): Row { const item = input.budgetItems.find((entry) => entry.id === candidate.budgetItemId); return { id: stableId("link", candidate.budgetItemId, candidate.evidenceId), companyId: input.companyId, projectId: input.projectId, budgetId: item?.budgetId ?? input.budgetId, budgetItemId: candidate.budgetItemId, evidenceId: candidate.evidenceId, signalsJson: json(candidate.signals), score: candidate.score.toString(), confidence: candidate.confidence }; }
function findingData(input: RunReviewJobInput, runId: string, finding: ReturnType<typeof evaluateFindingRules>[number], linkId: string | undefined): Row { const item = input.budgetItems.find((candidate) => candidate.id === finding.budgetItemId); return { id: stableId("finding", runId, finding.budgetItemId, finding.evidenceId, finding.type), companyId: input.companyId, projectId: input.projectId, budgetId: item?.budgetId ?? input.budgetId, reviewRunId: runId, budgetItemId: finding.budgetItemId, budgetItemBudgetId: item?.budgetId ?? input.budgetId, evidenceId: finding.evidenceId, baseSnapshotId: item?.baseSnapshotId, entityLinkId: linkId, findingType: finding.type, severity: finding.severity, priority: finding.priorityScore.toString(), confidence: finding.confidence, score: finding.priorityScore.toString(), potentialImpact: finding.comparison?.potentialImpact?.toString(), ruleKey: finding.priorityVersion, comparisonJson: json({ message: finding.message, ...finding.comparison }), discipline: item?.discipline, humanReviewRequired: true, automaticBudgetMutation: false }; }
