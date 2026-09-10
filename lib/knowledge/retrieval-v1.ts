import { prisma } from "@/lib/db/prisma";
import { getVisibleScopes } from "./scope";
import { normalizeKnowledgeText } from "./normalization";

export type RetrievalV1Input = { companyId: string; projectId?: string; query: string; limit?: number; status?: "OBSERVED" | "CONFIRMED" | "VERIFIED" | "CANONICAL" | "REJECTED" | "DEPRECATED"; confidence?: "LOW" | "MEDIUM" | "HIGH"; regionId?: string; correlationId?: string };
export type RetrievalV1Result = { items: Array<Record<string, unknown>>; resources: Array<Record<string, unknown>>; prices: Array<Record<string, unknown>>; yields: Array<Record<string, unknown>>; apuVersions: Array<Record<string, unknown>>; assertions: Array<Record<string, unknown>> };

const scopeRank = (scope: string): number => scope === "PROJECT" ? 0 : scope === "COMPANY" ? 1 : 2;
const order = <T extends { scope?: string; _retrievalScore?: number; id?: string }>(rows: T[]): T[] => [...rows].sort((a, b) => (b._retrievalScore ?? 0) - (a._retrievalScore ?? 0) || scopeRank(a.scope ?? "GLOBAL") - scopeRank(b.scope ?? "GLOBAL") || (a.id ?? "").localeCompare(b.id ?? ""));

function score(value: string, query: string, scope: string, aliases: string[] = []): number {
  const normalized = normalizeKnowledgeText(value);
  const aliasMatch = aliases.some((alias) => normalizeKnowledgeText(alias) === query);
  const textScore = normalized === query ? 100 : aliasMatch ? 90 : normalized.startsWith(query) ? 70 : normalized.includes(query) ? 50 : 0;
  return textScore + (scope === "PROJECT" ? 30 : scope === "COMPANY" ? 20 : 10);
}

function enrich<T extends Record<string, unknown>>(row: T, query: string, aliases: string[] = []): T & { _retrievalScore: number; provenance: Record<string, unknown> } {
  const aliasMatch = aliases.some((alias) => normalizeKnowledgeText(alias) === query);
  return { ...row, _retrievalScore: score(String(row.name ?? row.normalizedName ?? ""), query, String(row.scope ?? "GLOBAL"), aliases), provenance: { sourceId: row.sourceId ?? null, evidenceId: row.evidenceId ?? null, scope: row.scope ?? "GLOBAL", companyId: row.companyId ?? null, projectId: row.projectId ?? null, matchedBy: aliasMatch ? "ALIAS_EXACT" : normalizeKnowledgeText(String(row.name ?? row.normalizedName ?? "")) === query ? "NAME_EXACT" : "NAME_PARTIAL" } };
}

export async function retrieveKnowledgeV1(input: RetrievalV1Input): Promise<RetrievalV1Result> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const query = normalizeKnowledgeText(input.query);
  if (!query) return { items: [], resources: [], prices: [], yields: [], apuVersions: [], assertions: [] };
  const scopes = getVisibleScopes(input);
  const [items, resources] = await Promise.all([
    Promise.all(scopes.map((scope) => prisma.canonicalItem.findMany({ where: { scope: scope.scope, companyId: scope.companyId, ...(input.status ? { status: input.status } : {}), OR: [{ normalizedName: { contains: query } }, { aliases: { some: { normalizedAlias: query } } }] }, include: { aliases: true }, orderBy: { updatedAt: "desc" }, take: limit }))),
    Promise.all(scopes.map((scope) => prisma.canonicalResource.findMany({ where: { scope: scope.scope, companyId: scope.companyId, ...(input.status ? { status: input.status } : {}), OR: [{ normalizedName: { contains: query } }, { aliases: { some: { normalizedAlias: query } } }] }, include: { aliases: true }, orderBy: { updatedAt: "desc" }, take: limit }))),
  ]);
  const itemRows = items.flat().map((row) => enrich(row as Record<string, unknown>, query, Array.isArray(row.aliases) ? row.aliases.map((alias) => alias.normalizedAlias) : []));
  const resourceRows = resources.flat().map((row) => enrich(row as Record<string, unknown>, query, Array.isArray(row.aliases) ? row.aliases.map((alias) => alias.normalizedAlias) : []));
  const itemIds = itemRows.map((row) => String(row.id));
  const resourceIds = resourceRows.map((row) => String(row.id));
  const [prices, yields, apuVersions, assertions] = await Promise.all([
    Promise.all(scopes.map((scope) => prisma.priceObservation.findMany({ where: { scope: scope.scope, companyId: scope.companyId, resourceId: { in: resourceIds }, ...(input.status ? { status: input.status } : {}), ...(input.confidence ? { confidence: input.confidence } : {}), ...(input.regionId ? { regionId: input.regionId } : {}) }, include: { source: true, evidence: true }, orderBy: { observedAt: "desc" }, take: limit }))),
    Promise.all(scopes.map((scope) => prisma.yieldObservation.findMany({ where: { scope: scope.scope, companyId: scope.companyId, canonicalItemId: { in: itemIds }, ...(input.status ? { status: input.status } : {}), ...(input.confidence ? { confidence: input.confidence } : {}), ...(input.regionId ? { regionId: input.regionId } : {}) }, include: { source: true, evidence: true }, orderBy: { observedAt: "desc" }, take: limit }))),
    Promise.all(scopes.map((scope) => prisma.knowledgeApuVersion.findMany({ where: { scope: scope.scope, companyId: scope.companyId, name: { contains: query, mode: "insensitive" } }, orderBy: { createdAt: "desc" }, take: limit }))),
    Promise.all(scopes.map((scope) => prisma.knowledgeAssertion.findMany({ where: { scope: scope.scope, companyId: scope.companyId, ...(input.status ? { status: input.status } : {}), ...(input.confidence ? { confidence: input.confidence } : {}), OR: [{ subjectId: { in: [...itemIds, ...resourceIds] } }, { predicate: { contains: query, mode: "insensitive" } }] }, orderBy: { updatedAt: "desc" }, take: limit }))),
  ]);
  const observation = (row: Record<string, unknown>) => ({ ...row, _retrievalScore: 40 + (row.scope === "PROJECT" ? 30 : row.scope === "COMPANY" ? 20 : 10), provenance: { sourceId: row.sourceId ?? null, evidenceId: row.evidenceId ?? null, source: row.source ?? null, evidence: row.evidence ?? null, scope: row.scope ?? "GLOBAL", companyId: row.companyId ?? null, projectId: row.projectId ?? null, observedAt: row.observedAt ?? null, regionId: row.regionId ?? null, supplierId: row.supplierId ?? null } });
  return { items: order(itemRows).slice(0, limit), resources: order(resourceRows).slice(0, limit), prices: order(prices.flat().map((row) => observation(row as Record<string, unknown>))).slice(0, limit), yields: order(yields.flat().map((row) => observation(row as Record<string, unknown>))).slice(0, limit), apuVersions: order(apuVersions.flat().map((row) => enrich(row as Record<string, unknown>, query))).slice(0, limit), assertions: order(assertions.flat().map((row) => enrich(row as Record<string, unknown>, query))).slice(0, limit) };
}
