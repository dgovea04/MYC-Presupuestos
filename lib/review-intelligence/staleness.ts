import { createHash } from "node:crypto";

export const reviewStalenessChangeKinds = [
  "budget-item-quantity",
  "budget-item-unit",
  "budget-item-description",
  "budget-item-apu",
  "document-replacement",
  "document-classification",
  "review-rules",
  "review-tolerance",
] as const;

export type ReviewStalenessChangeKind = (typeof reviewStalenessChangeKinds)[number];

const staleableStatuses = ["DRAFT", "QUEUED", "RUNNING", "COMPLETED", "COMPLETED_WITH_WARNINGS"] as const;
type JsonRecord = Record<string, unknown>;
type StaleRun = { id: string; status: string; progressJson?: unknown };

export type StalenessClient = {
  reviewRun: {
    updateMany: (args: { where: JsonRecord; data: JsonRecord }) => Promise<{ count: number }>;
  };
};

type StalenessQueryClient = StalenessClient & {
  budget?: { findFirst: (args: { where: JsonRecord; select?: JsonRecord }) => Promise<{ id: string; parentBudgetId?: string | null } | null> };
  reviewRun: StalenessClient["reviewRun"] & {
    findMany?: (args: { where: JsonRecord; select?: JsonRecord }) => Promise<StaleRun[]>;
  };
  reviewAuditEvent?: { create: (args: { data: JsonRecord }) => Promise<unknown> };
  $transaction?: (callback: (transaction: StalenessQueryClient) => Promise<number>) => Promise<number>;
};

export type StalenessChange = {
  companyId: string;
  projectId: string;
  budgetId?: string;
  kind: ReviewStalenessChangeKind | string;
  id: string;
  payload: unknown;
  actorUserId?: string;
  correlationId?: string;
};

export function changeFingerprint(input: { kind: string; id: string; payload: unknown }): string {
  return createHash("sha256").update(stableSerialize(input)).digest("hex");
}

export async function markReviewRunsStale(
  input: { companyId: string; projectId: string; budgetId?: string; fingerprint: string; change?: Omit<StalenessChange, "companyId" | "projectId" | "budgetId"> },
  client: StalenessClient,
): Promise<number> {
  const adapter = client as StalenessQueryClient;
  if (adapter.$transaction) return adapter.$transaction((transaction) => markReviewRunsStaleInternal(input, transaction));
  return markReviewRunsStaleInternal(input, adapter);
}

export async function markStaleForChange(input: StalenessChange, client: StalenessClient): Promise<number> {
  const fingerprint = changeFingerprint({ kind: input.kind, id: input.id, payload: input.payload });
  return markReviewRunsStale({
    companyId: input.companyId,
    projectId: input.projectId,
    budgetId: input.budgetId,
    fingerprint,
    change: { kind: input.kind, id: input.id, payload: input.payload, actorUserId: input.actorUserId, correlationId: input.correlationId },
  }, client);
}

export function getBudgetPatchStalenessChanges(body: unknown): Array<Pick<StalenessChange, "kind" | "id" | "payload">> {
  if (!isRecord(body)) return [];
  const changes: Array<Pick<StalenessChange, "kind" | "id" | "payload">> = [];
  const items = isRecord(body.items) ? body.items : {};
  const updates = Array.isArray(items.update) ? items.update : [];
  const creates = Array.isArray(items.create) ? items.create : [];

  for (const entry of [...creates, ...updates]) {
    if (!isRecord(entry) || typeof entry.id !== "string") continue;
    const fields = isRecord(entry.changes) ? entry.changes : entry;
    addItemChange(changes, entry.id, fields, "quantity", "budget-item-quantity");
    addItemChange(changes, entry.id, fields, "unit", "budget-item-unit");
    addItemChange(changes, entry.id, fields, "description", "budget-item-description");
    addItemChange(changes, entry.id, fields, "apu", "budget-item-apu");
  }

  if ("rulesVersion" in body || "findingTypes" in body) {
    changes.push({ kind: "review-rules", id: typeof body.rulesVersion === "string" ? body.rulesVersion : "budget", payload: { rulesVersion: body.rulesVersion, findingTypes: body.findingTypes } });
  }
  if ("tolerancePercent" in body) {
    changes.push({ kind: "review-tolerance", id: "budget", payload: body.tolerancePercent });
  }
  return changes;
}

function addItemChange(
  changes: Array<Pick<StalenessChange, "kind" | "id" | "payload">>,
  id: string,
  fields: JsonRecord,
  field: string,
  kind: ReviewStalenessChangeKind,
) {
  if (field in fields) changes.push({ kind, id, payload: fields[field] });
}

async function markReviewRunsStaleInternal(
  input: { companyId: string; projectId: string; budgetId?: string; fingerprint: string; change?: Omit<StalenessChange, "companyId" | "projectId" | "budgetId"> },
  client: StalenessQueryClient,
): Promise<number> {
  const budgetIds = await resolveBudgetScope(input, client);
  const where: JsonRecord = {
    companyId: input.companyId,
    projectId: input.projectId,
    ...(budgetIds ? { budgetId: { in: budgetIds } } : {}),
    status: { in: [...staleableStatuses] },
  };
  if (!client.reviewRun.findMany || !client.reviewAuditEvent) {
    const result = await client.reviewRun.updateMany({ where, data: { status: "STALE", progressJson: { staleFingerprint: input.fingerprint } } });
    return result.count;
  }

  const runs = (await client.reviewRun.findMany({ where, select: { id: true, status: true, progressJson: true } }))
    .filter((run) => (staleableStatuses as readonly string[]).includes(run.status));
  let markedCount = 0;
  for (const run of runs) {
    const previousProgress = isRecord(run.progressJson) ? run.progressJson : {};
    const staleAt = new Date().toISOString();
    const progressJson: JsonRecord = {
      ...previousProgress,
      staleFingerprint: input.fingerprint,
      staleness: { kind: input.change?.kind ?? "unknown", entityId: input.change?.id ?? null, markedAt: staleAt },
    };
    const result = await client.reviewRun.updateMany({ where: { id: run.id, companyId: input.companyId, projectId: input.projectId, status: run.status }, data: { status: "STALE", progressJson } });
    if (result.count === 0) continue;
    markedCount += result.count;
    await client.reviewAuditEvent.create({
      data: {
        companyId: input.companyId,
        projectId: input.projectId,
        reviewRunId: run.id,
        ...(input.change?.actorUserId ? { actorUserId: input.change.actorUserId } : {}),
        eventType: "REVIEW_RUN_STALE",
        correlationId: input.change?.correlationId ?? input.fingerprint,
        payloadJson: { previousStatus: run.status, newStatus: "STALE", fingerprint: input.fingerprint, kind: input.change?.kind ?? "unknown", entityId: input.change?.id ?? null, payload: input.change?.payload ?? null },
      },
    });
  }
  return markedCount;
}

async function resolveBudgetScope(input: { companyId: string; projectId: string; budgetId?: string }, client: StalenessQueryClient): Promise<string[] | undefined> {
  if (!input.budgetId || !client.budget?.findFirst) return input.budgetId ? [input.budgetId] : undefined;
  const ids: string[] = [];
  let current: string | undefined = input.budgetId;
  while (current && !ids.includes(current)) {
    ids.push(current);
    const budget = await client.budget.findFirst({
      where: { id: current, projectId: input.projectId, project: { companyId: input.companyId } },
      select: { id: true, parentBudgetId: true },
    });
    current = typeof budget?.parentBudgetId === "string" ? budget.parentBudgetId : undefined;
  }
  return ids;
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(",")}}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
