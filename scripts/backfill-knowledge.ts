import "dotenv/config";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { buildKnowledgeBackfillPlan, buildMigrationEvidenceKey, buildMigrationSourceKey, recordMigrationProvenanceOutcome } from "@/lib/knowledge/backfill";
import { isKnowledgeFeatureEnabled } from "@/lib/knowledge/feature-flags";
import { logKnowledgeOperation } from "@/lib/knowledge/observability";
import { createMigrationKnowledgeProvenance, linkMigrationKnowledgeEntity } from "@/lib/knowledge/provenance-bridge";

const args = new Set(process.argv.slice(2));
const companyId = process.argv.slice(2).find((value) => value.startsWith("--company="))?.slice("--company=".length);
const projectId = process.argv.slice(2).find((value) => value.startsWith("--project="))?.slice("--project=".length);
const dryRun = args.has("--dry-run");
const correlationId = process.argv.slice(2).find((value) => value.startsWith("--correlation-id="))?.slice("--correlation-id=".length) ?? `knowledge-backfill:${companyId ?? "all"}:${projectId ?? "all"}`;

if (!dryRun && !isKnowledgeFeatureEnabled("backfill")) {
  console.error(JSON.stringify({ event: "knowledge_backfill", outcome: "skip", reason: "FEATURE_DISABLED", correlationId }));
  process.exitCode = 1;
} else {
const budgetFilter = projectId ? { projectId } : companyId ? { project: { companyId } } : undefined;
  const [resources, items, apus] = await Promise.all([
    prisma.resource.findMany({ where: companyId ? { companyId } : undefined, select: { id: true, description: true, unit: true, companyId: true, currency: true, unitPrice: true, priceObservedAt: true }, take: 10_000 }),
    prisma.budgetItem.findMany({ where: budgetFilter ? { budget: budgetFilter } : undefined, select: { id: true, description: true, unit: true, budget: { select: { projectId: true, project: { select: { companyId: true } } } } }, take: 10_000 }),
    prisma.apu.findMany({ where: budgetFilter ? { budgetItem: { budget: budgetFilter } } : undefined, select: { id: true, name: true, unit: true, performance: true, budgetItem: { select: { budget: { select: { projectId: true, project: { select: { companyId: true } } } } } }, resources: { select: { resourceId: true, description: true, quantity: true, unitPrice: true, resourceType: true, resource: { select: { description: true, unit: true } } } } }, take: 10_000 }),
  ]);
  const report = { dryRun, companyId: companyId ?? null, projectId: projectId ?? null, correlationId, candidates: { items: 0, resources: 0, apus: 0, prices: 0, sources: 0, evidence: 0 }, created: { items: 0, resources: 0, apus: 0, prices: 0, sources: 0, evidence: 0 }, skipped: { items: 0, resources: 0, apus: 0, prices: 0, sources: 0, evidence: 0 }, errors: [] as Array<{ domain: string; id: string; message: string }> };

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
    if (!row.description.trim() || !row.budget.project.projectId) { report.skipped.items++; continue; }
    report.candidates.items++;
    try {
      const provenance = await createProvenance({ domain: "item", sourceRecordId: row.id, tenantCompanyId: row.budget.project.companyId, tenantProjectId: row.budget.project.projectId });
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
      const normalizedName = candidate.name.toLocaleLowerCase("es-PE");
      const existing = await prisma.canonicalResource.findFirst({ where: { normalizedName, companyId: candidate.companyId, scope: "COMPANY" }, select: { id: true } });
      const canonical = existing
        ? await prisma.canonicalResource.update({ where: { id: existing.id }, data: { sourceId: provenance.source.id, evidenceId: provenance.evidence.id }, select: { id: true } })
        : await prisma.canonicalResource.create({ data: { name: candidate.name, normalizedName, category: "BACKFILL", canonicalUnit: candidate.canonicalUnit, scope: "COMPANY", companyId: candidate.companyId, status: "OBSERVED", sourceId: provenance.source.id, evidenceId: provenance.evidence.id }, select: { id: true } });
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
      if (dryRun) continue;
      const snapshot = { apuId: row.id, name: row.name, unit: row.unit, performance: String(row.performance), resources: row.resources.map((resource, index) => ({ resourceId: resource.resourceId, description: resource.resource?.description ?? resource.description, unit: resource.resource?.unit ?? "", quantity: String(resource.quantity), unitPrice: String(resource.unitPrice), resourceType: resource.resourceType, sortOrder: index })) };
      const contentHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
      const existingApu = await prisma.knowledgeApuVersion.findUnique({ where: { idempotencyKey: `backfill:apu:${row.id}` }, select: { id: true } });
      await prisma.knowledgeApuVersion.upsert({ where: { idempotencyKey: `backfill:apu:${row.id}` }, create: { idempotencyKey: `backfill:apu:${row.id}`, apuId: row.id, versionNumber: 1, name: row.name, unit: row.unit, performance: row.performance, contentHash, scope: "PROJECT", companyId: tenant.companyId, projectId: row.budgetItem.budget.projectId, sourceId: provenance.source.id, evidenceId: provenance.evidence.id, createdById: undefined, beforeSnapshot: null, afterSnapshot: snapshot, resources: { create: snapshot.resources.map((resource) => ({ resourceId: resource.resourceId, description: resource.description, unit: resource.unit, quantity: resource.quantity, unitPrice: resource.unitPrice, resourceType: resource.resourceType, sortOrder: resource.sortOrder })) } }, update: { sourceId: provenance.source.id, evidenceId: provenance.evidence.id } });
      if (existingApu) report.skipped.apus++; else report.created.apus++;
    } catch (error) { report.errors.push({ domain: "apu", id: row.id, message: error instanceof Error ? error.message : "unknown" }); }
  }
  logKnowledgeOperation({ stage: "backfill", outcome: report.errors.length ? "failure" : "success", correlationId, companyId, projectId, metadata: report });
  console.log(JSON.stringify(report, null, 2));
}
