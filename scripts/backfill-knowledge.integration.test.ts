import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { runKnowledgeBackfill } from "./backfill-knowledge";

type Fixture = {
  userId: string;
  companyId: string;
  projectId: string;
  budgetId: string;
  correlationId: string;
  normalApuId: string;
  conflictingApuId: string;
  primaryItemId: string;
  matchedResourceId: string;
  noMatchResourceId: string;
  ambiguousResourceId: string;
};

type KnowledgeCounts = {
  sources: number;
  evidence: number;
  items: number;
  resources: number;
  apus: number;
  apuResources: number;
  prices: number;
  itemProvenance: number;
  resourceProvenance: number;
  apusWithSource: number;
  apusWithEvidence: number;
};

const databaseDescribe = describe.skipIf(!process.env.DATABASE_URL);
const featureFlag = "MC_KNOWLEDGE_BACKFILL";
let previousFeatureFlag: string | undefined;
let fixture: Fixture | undefined;

function uniqueName(prefix: string, token: string): string {
  return `${prefix} ${token}`;
}

async function createFixture(): Promise<Fixture> {
  const token = randomUUID();
  const correlationId = `knowledge-backfill-integration:${token}`;
  const user = await prisma.user.create({
    data: {
      name: uniqueName("Knowledge Backfill Integration", token),
      email: `knowledge-backfill-${token}@example.test`,
    },
  });
  const company = await prisma.company.create({
    data: { userId: user.id, name: uniqueName("Knowledge Backfill Company", token) },
  });
  const project = await prisma.project.create({
    data: { companyId: company.id, name: uniqueName("Knowledge Backfill Project", token) },
  });
  const budget = await prisma.budget.create({
    data: { projectId: project.id, name: uniqueName("Knowledge Backfill Budget", token) },
  });
  const matchedResource = await prisma.resource.create({
    data: {
      companyId: company.id,
      code: `KB-MATCH-${token}`,
      description: uniqueName("Cemento backfill", token),
      category: "MATERIAL",
      unit: "bolsa",
      unitPrice: "32.50",
      priceObservedAt: new Date("2026-09-09T00:00:00.000Z"),
    },
  });
  const noMatchResource = await prisma.resource.create({
    data: {
      code: `KB-NOMATCH-${token}`,
      description: uniqueName("Recurso sin canonico", token),
      category: "MATERIAL",
      unit: "und",
      unitPrice: "4.00",
    },
  });
  const ambiguousResource = await prisma.resource.create({
    data: {
      code: `KB-AMBIGUOUS-${token}`,
      description: uniqueName("Recurso ambiguo", token),
      category: "MATERIAL",
      unit: "und",
      unitPrice: "5.00",
    },
  });
  const ambiguousNormalizedName = ambiguousResource.description.toLocaleLowerCase("es-PE");
  await prisma.canonicalResource.createMany({
    data: [
      {
        name: uniqueName("Canonico ambiguo uno", token),
        normalizedName: ambiguousNormalizedName,
        category: "FIXTURE",
        canonicalUnit: "und",
        scope: "COMPANY",
        companyId: company.id,
        status: "OBSERVED",
      },
      {
        name: uniqueName("Canonico ambiguo dos", token),
        normalizedName: ambiguousNormalizedName,
        category: "FIXTURE",
        canonicalUnit: "und",
        scope: "COMPANY",
        companyId: company.id,
        status: "OBSERVED",
      },
    ],
  });

  const primaryItem = await prisma.budgetItem.create({
    data: {
      budgetId: budget.id,
      code: "KB-001",
      description: uniqueName("Partida principal", token),
      unit: "m2",
      quantity: "1",
      unitPrice: "100",
      partial: "100",
    },
  });
  const noMatchItem = await prisma.budgetItem.create({
    data: {
      budgetId: budget.id,
      code: "KB-002",
      description: uniqueName("Partida sin coincidencia", token),
      unit: "m2",
      quantity: "1",
      unitPrice: "100",
      partial: "100",
    },
  });
  const ambiguousItem = await prisma.budgetItem.create({
    data: {
      budgetId: budget.id,
      code: "KB-003",
      description: uniqueName("Partida ambigua", token),
      unit: "m2",
      quantity: "1",
      unitPrice: "100",
      partial: "100",
    },
  });
  const conflictingItem = await prisma.budgetItem.create({
    data: {
      budgetId: budget.id,
      code: "KB-004",
      description: uniqueName("Partida conflicto", token),
      unit: "m2",
      quantity: "1",
      unitPrice: "100",
      partial: "100",
    },
  });
  const normalApu = await prisma.apu.create({
    data: {
      budgetItemId: primaryItem.id,
      name: uniqueName("APU normal", token),
      unit: "m2",
      performance: "1.5",
      resources: {
        create: { resourceId: matchedResource.id, resourceType: "MATERIAL", quantity: "2", unitPrice: "32.50" },
      },
    },
  });
  await prisma.apu.create({
    data: {
      budgetItemId: noMatchItem.id,
      name: uniqueName("APU sin coincidencia", token),
      unit: "m2",
      performance: "1",
      resources: {
        create: { resourceId: noMatchResource.id, resourceType: "MATERIAL", quantity: "1", unitPrice: "4" },
      },
    },
  });
  await prisma.apu.create({
    data: {
      budgetItemId: ambiguousItem.id,
      name: uniqueName("APU ambiguo", token),
      unit: "m2",
      performance: "1",
      resources: {
        create: { resourceId: ambiguousResource.id, resourceType: "MATERIAL", quantity: "1", unitPrice: "5" },
      },
    },
  });
  const conflictingApu = await prisma.apu.create({
    data: {
      budgetItemId: conflictingItem.id,
      name: uniqueName("APU conflicto", token),
      unit: "m2",
      performance: "1",
      resources: {
        create: { resourceId: matchedResource.id, resourceType: "MATERIAL", quantity: "1", unitPrice: "32.50" },
      },
    },
  });
  await prisma.knowledgeApuVersion.create({
    data: {
      idempotencyKey: `fixture:version-conflict:${token}`,
      apuId: conflictingApu.id,
      versionNumber: 1,
      name: "Fixture version conflict",
      unit: "m2",
      performance: "1",
      contentHash: token,
      scope: "PROJECT",
      companyId: company.id,
      projectId: project.id,
    },
  });

  return {
    userId: user.id,
    companyId: company.id,
    projectId: project.id,
    budgetId: budget.id,
    correlationId,
    normalApuId: normalApu.id,
    conflictingApuId: conflictingApu.id,
    primaryItemId: primaryItem.id,
    matchedResourceId: matchedResource.id,
    noMatchResourceId: noMatchResource.id,
    ambiguousResourceId: ambiguousResource.id,
  };
}

async function knowledgeCounts(input: Fixture): Promise<KnowledgeCounts> {
  const [sources, evidence, items, resources, apus, apuResources, prices, itemProvenance, resourceProvenance, apusWithSource, apusWithEvidence] = await Promise.all([
    prisma.knowledgeSource.count({ where: { companyId: input.companyId } }),
    prisma.knowledgeEvidence.count({ where: { companyId: input.companyId } }),
    prisma.canonicalItem.count({ where: { companyId: input.companyId } }),
    prisma.canonicalResource.count({ where: { companyId: input.companyId } }),
    prisma.knowledgeApuVersion.count({ where: { companyId: input.companyId } }),
    prisma.knowledgeApuResource.count({ where: { apuVersion: { companyId: input.companyId } } }),
    prisma.priceObservation.count({ where: { companyId: input.companyId } }),
    prisma.knowledgeCanonicalItemProvenance.count({ where: { canonicalItem: { companyId: input.companyId } } }),
    prisma.knowledgeCanonicalResourceProvenance.count({ where: { canonicalResource: { companyId: input.companyId } } }),
    prisma.knowledgeApuVersion.count({ where: { companyId: input.companyId, sourceId: { not: null } } }),
    prisma.knowledgeApuVersion.count({ where: { companyId: input.companyId, evidenceId: { not: null } } }),
  ]);
  return { sources, evidence, items, resources, apus, apuResources, prices, itemProvenance, resourceProvenance, apusWithSource, apusWithEvidence };
}

async function cleanupFixture(input: Fixture): Promise<void> {
  await prisma.knowledgeApuVersion.deleteMany({ where: { companyId: input.companyId } });
  await prisma.priceObservation.deleteMany({ where: { companyId: input.companyId } });
  await prisma.canonicalItem.deleteMany({ where: { companyId: input.companyId } });
  await prisma.canonicalResource.deleteMany({ where: { companyId: input.companyId } });
  await prisma.knowledgeSource.deleteMany({ where: { companyId: input.companyId } });
  await prisma.resource.deleteMany({ where: { code: { startsWith: "KB-" }, description: { contains: input.correlationId.slice(-36) } } });
  await prisma.user.delete({ where: { id: input.userId } });
}

databaseDescribe("runKnowledgeBackfill PostgreSQL integration", () => {
  beforeAll(() => {
    previousFeatureFlag = process.env[featureFlag];
    process.env[featureFlag] = "true";
  });

  afterEach(async () => {
    if (fixture) {
      await cleanupFixture(fixture);
      fixture = undefined;
    }
  });

  afterAll(() => {
    if (previousFeatureFlag === undefined) {
      delete process.env[featureFlag];
      return;
    }
    process.env[featureFlag] = previousFeatureFlag;
  });

  it("keeps PostgreSQL unchanged during dry-run while reporting unresolved APU resources", async () => {
    fixture = await createFixture();
    const before = await knowledgeCounts(fixture);

    const report = await runKnowledgeBackfill({
      companyId: fixture.companyId,
      projectId: fixture.projectId,
      correlationId: fixture.correlationId,
      dryRun: true,
    });

    expect(await knowledgeCounts(fixture)).toEqual(before);
    expect(report.dryRun).toBe(true);
    expect(report.candidates.items).toBe(4);
    expect(report.skipped.apuResources).toBe(4);
    expect(report.created).toMatchObject({ items: 0, resources: 0, apus: 0, prices: 0, sources: 0, evidence: 0 });
    expect(report.resolutionConflicts).toEqual(expect.arrayContaining([
      { domain: "apu-resource", apuId: expect.any(String), resourceId: fixture.noMatchResourceId, reason: "NO_MATCH" },
      { domain: "apu-resource", apuId: expect.any(String), resourceId: fixture.ambiguousResourceId, reason: "AMBIGUOUS" },
    ]));
  });

  it("persists OBSERVED knowledge, exposes provenance, and replays without duplicates", async () => {
    fixture = await createFixture();

    const firstReport = await runKnowledgeBackfill({
      companyId: fixture.companyId,
      projectId: fixture.projectId,
      correlationId: fixture.correlationId,
    });

    expect(firstReport.created).toMatchObject({ items: 4, resources: 1, apus: 3, apuResources: 1, prices: 1, sources: 2, evidence: 10 });
    expect(firstReport.skipped.apuResources).toBe(2);
    expect(firstReport.errors).toEqual(expect.arrayContaining([
      { domain: "apu", id: fixture.conflictingApuId, message: expect.any(String) },
    ]));
    expect((await prisma.knowledgeApuVersion.findUnique({ where: { idempotencyKey: `backfill:apu:${fixture.normalApuId}` } }))?.scope).toBe("PROJECT");
    expect(await prisma.canonicalItem.findFirst({ where: { companyId: fixture.companyId } })).toMatchObject({ status: "OBSERVED" });
    expect(await prisma.canonicalResource.findFirst({ where: { companyId: fixture.companyId, category: "BACKFILL" } })).toMatchObject({ status: "OBSERVED" });
    expect(await prisma.priceObservation.findFirst({ where: { companyId: fixture.companyId } })).toMatchObject({ status: "OBSERVED" });

    const projectSourceKey = `migration:${fixture.companyId}:${fixture.projectId}:${fixture.correlationId}`;
    const companySourceKey = `migration:${fixture.companyId}:company:${fixture.correlationId}`;
    const itemEvidenceKey = `${projectSourceKey}:evidence:item:${fixture.primaryItemId}`;
    const resourceEvidenceKey = `${companySourceKey}:evidence:resource:${fixture.matchedResourceId}`;
    const apuEvidenceKey = `${projectSourceKey}:evidence:apu:${fixture.normalApuId}`;
    const projectSource = await prisma.knowledgeSource.findUnique({ where: { idempotencyKey: projectSourceKey } });
    const companySource = await prisma.knowledgeSource.findUnique({ where: { idempotencyKey: companySourceKey } });
    expect(projectSource).toMatchObject({ idempotencyKey: projectSourceKey, sourceType: "MIGRATION", companyId: fixture.companyId, projectId: fixture.projectId });
    expect(companySource).toMatchObject({ idempotencyKey: companySourceKey, sourceType: "MIGRATION", companyId: fixture.companyId, projectId: null });

    const itemEvidence = await prisma.knowledgeEvidence.findUnique({
      where: { idempotencyKey: itemEvidenceKey },
      include: { source: true },
    });
    expect(itemEvidence).toMatchObject({ idempotencyKey: itemEvidenceKey, sourceId: projectSource?.id, companyId: fixture.companyId, projectId: fixture.projectId });
    expect(itemEvidence?.source.id).toBe(projectSource?.id);
    const canonicalItem = await prisma.canonicalItem.findFirst({ where: { companyId: fixture.companyId, name: { startsWith: "Partida principal" } } });
    const itemProvenance = await prisma.knowledgeCanonicalItemProvenance.findUnique({ where: { idempotencyKey: itemEvidenceKey } });
    expect(itemProvenance).toMatchObject({ canonicalItemId: canonicalItem?.id, sourceId: projectSource?.id, evidenceId: itemEvidence?.id, idempotencyKey: itemEvidenceKey });

    const resourceEvidence = await prisma.knowledgeEvidence.findUnique({ where: { idempotencyKey: resourceEvidenceKey } });
    const canonicalResource = await prisma.canonicalResource.findFirst({ where: { companyId: fixture.companyId, category: "BACKFILL" } });
    const resourceProvenance = await prisma.knowledgeCanonicalResourceProvenance.findUnique({ where: { idempotencyKey: resourceEvidenceKey } });
    expect(resourceEvidence).toMatchObject({ idempotencyKey: resourceEvidenceKey, sourceId: companySource?.id, companyId: fixture.companyId, projectId: null });
    expect(resourceProvenance).toMatchObject({ canonicalResourceId: canonicalResource?.id, sourceId: companySource?.id, evidenceId: resourceEvidence?.id, idempotencyKey: resourceEvidenceKey });

    const normalApu = await prisma.knowledgeApuVersion.findUnique({ where: { idempotencyKey: `backfill:apu:${fixture.normalApuId}` } });
    const apuEvidence = await prisma.knowledgeEvidence.findUnique({ where: { idempotencyKey: apuEvidenceKey } });
    expect(apuEvidence).toMatchObject({ idempotencyKey: apuEvidenceKey, sourceId: projectSource?.id, companyId: fixture.companyId, projectId: fixture.projectId });
    expect(normalApu).toMatchObject({ apuId: fixture.normalApuId, sourceId: projectSource?.id, evidenceId: apuEvidence?.id });
    const apuResources = normalApu ? await prisma.knowledgeApuResource.findMany({ where: { apuVersionId: normalApu.id } }) : [];
    expect(apuResources).toHaveLength(1);
    expect(apuResources[0]?.resourceId).toBe(canonicalResource?.id);

    const countsAfterFirstRun = await knowledgeCounts(fixture);
    const replayReport = await runKnowledgeBackfill({
      companyId: fixture.companyId,
      projectId: fixture.projectId,
      correlationId: fixture.correlationId,
    });

    expect(await knowledgeCounts(fixture)).toEqual(countsAfterFirstRun);
    expect(replayReport.created).toMatchObject({ items: 0, resources: 0, apus: 0, apuResources: 0, prices: 0, sources: 0, evidence: 0 });
    expect(replayReport.skipped.apuResources).toBe(3);
    expect(replayReport.errors).toEqual(expect.arrayContaining([
      { domain: "apu", id: fixture.conflictingApuId, message: expect.any(String) },
    ]));
  });
});
