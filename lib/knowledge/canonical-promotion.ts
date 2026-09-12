import { prisma } from "@/lib/db/prisma";
import { normalizeKnowledgeText, normalizeKnowledgeUnit } from "./normalization";

type PromotionScope = "COMPANY" | "GLOBAL";
type CatalogValue = Record<string, unknown>;

export async function promoteImportAssertionToCatalog(input: { assertionId: string; subjectType: string; value: CatalogValue; scope: PromotionScope; companyId: string; sourceId: string; evidenceId: string }) {
  const name = readString(input.value.name, "name");
  const unit = readOptionalString(input.value.unit);
  const normalizedName = normalizeKnowledgeText(name);
  const canonicalUnit = unit ? normalizeKnowledgeUnit(unit) : null;
  const companyId = input.scope === "GLOBAL" ? null : input.companyId;

  if (input.subjectType === "IMPORT_ITEM") {
    const matches = await prisma.canonicalItem.findMany({ where: { normalizedName, scope: input.scope, companyId, ...(canonicalUnit ? { canonicalUnit } : {}) }, take: 2 });
    if (matches.length > 1) throw new Error("Canonical item match is ambiguous");
    const item = matches[0] ?? await prisma.canonicalItem.create({ data: { name, normalizedName, canonicalUnit: canonicalUnit ?? undefined, classification: readOptionalString(input.value.classification), specialty: readOptionalString(input.value.specialty), scope: input.scope, companyId } });
    await prisma.knowledgeCanonicalItemProvenance.upsert({ where: { idempotencyKey: `import-catalog:${input.assertionId}:${item.id}` }, create: { canonicalItemId: item.id, sourceId: input.sourceId, evidenceId: input.evidenceId, idempotencyKey: `import-catalog:${input.assertionId}:${item.id}` }, update: {} });
    return { catalogEntityType: "CanonicalItem" as const, catalogEntityId: item.id };
  }

  if (input.subjectType === "IMPORT_RESOURCE") {
    const category = readString(input.value.category, "category");
    const matches = await prisma.canonicalResource.findMany({ where: { normalizedName, scope: input.scope, companyId, category: category.toUpperCase(), ...(canonicalUnit ? { canonicalUnit } : {}) }, take: 2 });
    if (matches.length > 1) throw new Error("Canonical resource match is ambiguous");
    const resource = matches[0] ?? await prisma.canonicalResource.create({ data: { name, normalizedName, category: category.toUpperCase(), canonicalUnit: canonicalUnit ?? undefined, scope: input.scope, companyId } });
    await prisma.knowledgeCanonicalResourceProvenance.upsert({ where: { idempotencyKey: `import-catalog:${input.assertionId}:${resource.id}` }, create: { canonicalResourceId: resource.id, sourceId: input.sourceId, evidenceId: input.evidenceId, idempotencyKey: `import-catalog:${input.assertionId}:${resource.id}` }, update: {} });
    return { catalogEntityType: "CanonicalResource" as const, catalogEntityId: resource.id };
  }

  throw new Error(`Unsupported import catalog domain: ${input.subjectType}`);
}

function readString(value: unknown, field: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`Import catalog ${field} is required`); return value.trim(); }
function readOptionalString(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
