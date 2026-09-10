import "dotenv/config";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@/lib/db/prisma";
import { buildKnowledgeBackfillPlan, buildMigrationEvidenceKey, buildMigrationSourceKey, recordMigrationProvenanceOutcome, resolveBackfillCanonicalResource, summarizeBackfillApuResourceResolutions } from "@/lib/knowledge/backfill";
import { buildCanonicalResourceLookupIndex, deduplicateCanonicalResourceLookupCandidates, type CanonicalResourceLookupCandidateInput } from "@/lib/knowledge/canonical-resources";
import { normalizeKnowledgeText, normalizeKnowledgeUnit } from "@/lib/knowledge/normalization";
import { isKnowledgeFeatureEnabled } from "@/lib/knowledge/feature-flags";
import { logKnowledgeOperation } from "@/lib/knowledge/observability";
import { createMigrationKnowledgeProvenance, linkMigrationKnowledgeEntity } from "@/lib/knowledge/provenance-bridge";

type KnowledgeBackfillCounters = {
  items: number;
  resources: number;
  apus: number;
  apuResources: number;
  prices: number;
  sources: number;
  evidence: number;
};

export type KnowledgeBackfillReport = {
  dryRun: boolean;
  correlationId: string;
  companyId: string | null;
  projectId: string | null;
  candidates: KnowledgeBackfillCounters;
  created: KnowledgeBackfillCounters;
  skipped: KnowledgeBackfillCounters;
  resolutionConflicts: Array<{ domain: "apu-resource" | "apu"; apuId: string; resourceId: string | null; reason: "NO_MATCH" | "AMBIGUOUS" | "CONTENT_CHANGED" }>;
  errors: Array<{ domain: string; id: string; message: string }>;
};

export type KnowledgeBackfillOptions = {
  companyId?: string;
  projectId?: string;
  dryRun?: boolean;
  correlationId?: string;
};

class KnowledgeBackfillDisabledError extends Error {
  constructor(readonly correlationId: string) {
    super("Knowledge backfill feature is disabled");
  }
}

export async function runKnowledgeBackfill(options: KnowledgeBackfillOptions = {}): Promise<KnowledgeBackfillReport> {
  const companyId = options.companyId;
  const projectId = options.projectId;
  const dryRun = options.dryRun ?? false;
  const correlationId = options.correlationId ?? `knowledge-backfill:${companyId ?? "all"}:${projectId ?? "all"}`;

  if (!dryRun && !isKnowledgeFeatureEnabled("backfill")) {
    throw new KnowledgeBackfillDisabledError(correlationId);
  }

const budgetFilter = projectId ? { projectId } : companyId ? { project: { companyId } } : undefined;
const [resources, items, apus] = await Promise.all([
    prisma.resource.findMany({ where: companyId ? { companyId } : undefined, select: { id: true, description: true, unit: true, companyId: true, currency: true, unitPrice: true, priceObservedAt: true }, take: 10_000 }),
    prisma.budgetItem.findMany({ where: budgetFilter ? { budget: budgetFilter } : undefined, select: { id: true, description: true, unit: true, budget: { select: { projectId: true, project: { select: { companyId: true } } } } }, take: 10_000 }),
    prisma.apu.findMany({ where: budgetFilter ? { budgetItem: { budget: budgetFilter } } : undefined, select: { id: true, name: true, unit: true, performance: true, budgetItem: { select: { budget: { select: { projectId: true, project: { select: { companyId: true } } } } } }, resources: { select: { resourceId: true, quantity: true, unitPrice: true, resourceType: true, resource: { select: { description: true, unit: true } } } } }, take: 10_000 }),
  ]);
  const resourcePlans = resources.flatMap((row) => buildKnowledgeBackfillPlan([row], { companyId, dryRun }));
  const report: KnowledgeBackfillReport = { dryRun, correlationId, companyId: companyId ?? null, projectId: projectId ?? null, candidates: { items: 0, resources: 0, apus: 0, apuResources: 0, prices: 0, sources: 0, evidence: 0 }, created: { items: 0, resources: 0, apus: 0, apuResources: 0, prices: 0, sources: 0, evidence: 0 }, skipped: { items: 0, resources: 0, apus: 0, apuResources: 0, prices: 0, sources: 0, evidence: 0 }, resolutionConflicts: [], errors: [] };

  async function createProvenance(input: { domain: "item" | "resource" | "price" | "apu"; sourceRecordId: string; tenantCompanyId: string; tenantProjectId?: string }) {
    const sourceKey = buildMigrationSourceKey({ companyId: input.tenantCompanyId, projectId: input.tenantProjectId, correlationId });
    const provenance = await createMigrationKnowledgeProvenance({
      sourceKey,
      domain: input.domain,
      sourceRecordId: input.sourceRecordId,
      companyId: input.tenantCompanyId,
      projectId: input.tenantProjectId,
      correlationId,
      dryRun,
    });
    recordMigrationProvenanceOutcome(report, { source: provenance.sourceOutcome, evidence: provenance.evidenceOutcome });
    if (!dryRun && (!provenance.source || !provenance.evidence)) throw new Error("Migration provenance was not persisted");
    return { ...provenance, evidenceKey: buildMigrationEvidenceKey({ sourceKey, domain: input.domain, sourceRecordId: input.sourceRecordId }) };
  }

  for (const row of items) {
    if (!row.description.trim() || !row.budget.projectId) { report.skipped.items++; continue; }
    report.candidates.items++;
    try {
      const provenance = await createProvenance({ domain: "item", sourceRecordId: row.id, tenantCompanyId: row.budget.project.companyId, tenantProjectId: row.budget.projectId });
      if (dryRun) continue;
      const normalizedName = row.description.trim().toLocaleLowerCase("es-PE");
      const existing = await prisma.canonicalItem.findFirst({ where: { normalizedName, companyId: row.budget.project.companyId }, select: { id: true } });
      const canonical = existing
        ? await prisma.canonicalItem.update({ where: { id: existing.id }, data: { sourceId: provenance.source.id, evidenceId: provenance.evidence.id }, select: { id: true } })
        : await prisma.canonicalItem.create({ data: { name: row.description.trim(), normalizedName, canonicalUnit: row.unit, scope: "COMPANY", companyId: row.budget.project.companyId, status: "OBSERVED", sourceId: provenance.source.id, evidenceId: provenance.evidence.id }, select: { id: true } });
      await linkMigrationKnowledgeEntity({ domain: "item", entityId: canonical.id, sourceId: provenance.source.id, evidenceId: provenance.evidence.id, idempotencyKey: provenance.evidenceKey });
      if (existing) report.skipped.items++; else report.created.items++;
    } catch (error) { report.errors.push({ domain: "item", id: row.id, message: error instanceof Error ? error.message : "unknown" }); }
  }

  for (const row of resources) {
    const plan = buildKnowledgeBackfillPlan([row], { companyId, dryRun });
    if (plan.length === 0) { report.skipped.resources++; continue; }
    const candidate = plan[0];
    if (!candidate) { report.skipped.resources++; continue; }
    report.candidates.resources++;
    if (row.priceObservedAt) report.candidates.prices++;
    try {
      const provenance = await createProvenance({ domain: "resource", sourceRecordId: row.id, tenantCompanyId: candidate.companyId });
      const priceProvenance = row.priceObservedAt ? await createProvenance({ domain: "price", sourceRecordId: row.id, tenantCompanyId: candidate.companyId }) : undefined;
      if (dryRun) continue;
      const normalizedName = normalizeKnowledgeText(candidate.name);
      const canonicalUnit = candidate.canonicalUnit ? normalizeKnowledgeUnit(candidate.canonicalUnit) : null;
      const existing = await prisma.canonicalResource.findFirst({ where: { normalizedName, canonicalUnit, companyId: candidate.companyId, scope: "COMPANY" }, select: { id: true } });
      const canonical = existing
        ? await prisma.canonicalResource.update({ where: { id: existing.id }, data: { sourceId: provenance.source.id, evidenceId: provenance.evidence.id }, select: { id: true } })
        : await prisma.canonicalResource.create({ data: { name: candidate.name, normalizedName, category: "BACKFILL", canonicalUnit: canonicalUnit ?? undefined, scope: "COMPANY", companyId: candidate.companyId, status: "OBSERVED", sourceId: provenance.source.id, evidenceId: provenance.evidence.id }, select: { id: true } });
      await linkMigrationKnowledgeEntity({ domain: "resource", entityId: canonical.id, sourceId: provenance.source.id, evidenceId: provenance.evidence.id, idempotencyKey: provenance.evidenceKey });
      if (existing) report.skipped.resources++; else report.created.resources++;
      if (row.priceObservedAt) {
        const priceKey = `backfill:price:${row.id}:${row.priceObservedAt.toISOString()}:${String(row.unitPrice)}`;
        if (!priceProvenance) throw new Error("Price provenance was not prepared");
        const existingPrice = await prisma.priceObservation.findUnique({ where: { idempotencyKey: priceKey }, select: { id: true } });
        await prisma.priceObservation.upsert({ where: { idempotencyKey: priceKey }, create: { idempotencyKey: priceKey, resourceId: canonical.id, value: row.unitPrice, currency: row.currency, unit: row.unit, companyId: row.companyId, sourceId: priceProvenance.source.id, evidenceId: priceProvenance.evidence.id, observedAt: row.priceObservedAt, scope: "COMPANY", confidence: "MEDIUM", status: "OBSERVED" }, update: { sourceId: priceProvenance.source.id, evidenceId: priceProvenance.evidence.id } });
        if (existingPrice) report.skipped.prices++; else report.created.prices++;
      }
    } catch (error) { report.errors.push({ domain: "resource", id: row.id, message: error instanceof Error ? error.message : "unknown" }); }
  }

  for (const row of apus) {
    const tenant = row.budgetItem.budget.project;
    if ((companyId && tenant.companyId !== companyId) || (projectId && row.budgetItem.budget.projectId !== projectId)) { report.skipped.apus++; continue; }
    report.candidates.apus++;
    try {
      const provenance = await createProvenance({ domain: "apu", sourceRecordId: row.id, tenantCompanyId: tenant.companyId, tenantProjectId: row.budgetItem.budget.projectId });
      const canonicalResources = await prisma.canonicalResource.findMany({
        where: { OR: [{ scope: "GLOBAL" }, { scope: "COMPANY", companyId: tenant.companyId }] },
        select: { id: true, normalizedName: true, canonicalUnit: true, scope: true, companyId: true, aliases: { select: { normalizedAlias: true } } },
      });
      const plannedCanonicalResources: CanonicalResourceLookupCandidateInput[] = resourcePlans.map((candidate) => ({
        id: candidate.idempotencyKey,
        normalizedName: normalizeKnowledgeText(candidate.name),
        canonicalUnit: candidate.canonicalUnit ? normalizeKnowledgeUnit(candidate.canonicalUnit) : null,
        scope: "COMPANY",
        companyId: candidate.companyId,
        aliases: [],
      }));
      const canonicalResourceIndex = buildCanonicalResourceLookupIndex([...canonicalResources, ...(dryRun ? deduplicateCanonicalResourceLookupCandidates(plannedCanonicalResources) : [])]);
      const resolvedResources = row.resources.map((resource, index) => {
        const description = resource.resource?.description ?? "";
        const unit = resource.resource?.unit ?? "";
        const resolution = resolveBackfillCanonicalResource({ resourceId: resource.resourceId, description, unit, companyId: tenant.companyId }, canonicalResourceIndex);
        return { sourceResourceId: resource.resourceId, canonicalResourceId: resolution.kind === "matched" ? resolution.canonicalResourceId : null, resolution, description, unit, quantity: String(resource.quantity), unitPrice: String(resource.unitPrice), resourceType: resource.resourceType, sortOrder: index };
      });
      const resolutionSummary = summarizeBackfillApuResourceResolutions(resolvedResources.map((resource) => ({ resourceId: resource.sourceResourceId, resolution: resource.resolution })));
      report.candidates.apuResources += resolvedResources.length;
      report.skipped.apuResources += resolutionSummary.skipped;
      for (const conflict of resolutionSummary.conflicts) report.resolutionConflicts.push({ domain: "apu-resource", apuId: row.id, ...conflict });
      if (dryRun) continue;
      const snapshot = { apuId: row.id, name: row.name, unit: row.unit, performance: String(row.performance), resources: resolvedResources };
      const contentHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
      const existingApu = await prisma.knowledgeApuVersion.findUnique({ where: { idempotencyKey: `backfill:apu:${row.id}` }, select: { id: true } });
      const latestApu = await prisma.knowledgeApuVersion.findFirst({ where: { apuId: row.id }, orderBy: { versionNumber: "desc" }, select: { id: true, versionNumber: true, contentHash: true } });
      const replayTarget = existingApu ?? latestApu;
      if (replayTarget) {
        if (replayTarget.contentHash !== contentHash) {
          report.resolutionConflicts.push({ domain: "apu", apuId: row.id, resourceId: null, reason: "CONTENT_CHANGED" });
          report.skipped.apus++;
          continue;
        }
        await prisma.knowledgeApuVersion.update({ where: { id: replayTarget.id }, data: { sourceId: provenance.source.id, evidenceId: provenance.evidence.id } });
        report.skipped.apus++;
        report.skipped.apuResources += resolutionSummary.matched;
        continue;
      }
      const resourceRows = resolvedResources.map((resource) => ({ ...(resource.canonicalResourceId ? { resourceId: resource.canonicalResourceId } : {}), description: resource.description, unit: resource.unit, quantity: resource.quantity, unitPrice: resource.unitPrice, resourceType: resource.resourceType, sortOrder: resource.sortOrder }));
      await prisma.knowledgeApuVersion.create({ data: { idempotencyKey: latestApu ? `backfill:apu:${row.id}:${contentHash}` : `backfill:apu:${row.id}`, apuId: row.id, versionNumber: (latestApu?.versionNumber ?? 0) + 1, name: row.name, unit: row.unit, performance: row.performance, contentHash, scope: "PROJECT", companyId: tenant.companyId, projectId: row.budgetItem.budget.projectId, sourceId: provenance.source.id, evidenceId: provenance.evidence.id, createdById: undefined, beforeSnapshot: null, afterSnapshot: snapshot, resources: { create: resourceRows } } });
      report.created.apus++;
      report.created.apuResources += resolutionSummary.matched;
    } catch (error) { report.errors.push({ domain: "apu", id: row.id, message: error instanceof Error ? error.message : "unknown" }); }
  }
  logKnowledgeOperation({ stage: "backfill", outcome: report.errors.length ? "failure" : "success", correlationId, companyId, projectId, metadata: report });
  return report;
}

function parseCliOptions(argv: readonly string[]): KnowledgeBackfillOptions {
  const args = new Set(argv);
  const companyId = argv.find((value) => value.startsWith("--company="))?.slice("--company=".length);
  const projectId = argv.find((value) => value.startsWith("--project="))?.slice("--project=".length);
  const correlationId = argv.find((value) => value.startsWith("--correlation-id="))?.slice("--correlation-id=".length);
  return { companyId, projectId, correlationId, dryRun: args.has("--dry-run") };
}

async function runCli(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const correlationId = options.correlationId ?? `knowledge-backfill:${options.companyId ?? "all"}:${options.projectId ?? "all"}`;
  try {
    const report = await runKnowledgeBackfill(options);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (error instanceof KnowledgeBackfillDisabledError) {
      console.error(JSON.stringify({ event: "knowledge_backfill", outcome: "skip", reason: "FEATURE_DISABLED", correlationId: error.correlationId }));
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  void runCli();
}
