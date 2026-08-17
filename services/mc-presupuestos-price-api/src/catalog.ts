import { createHash } from "node:crypto";
import type { CatalogResource, LookupQuote, ServiceResourceLookup } from "./contract";
import { CATALOG_VERSION } from "./contract";

const curatedCatalog: CatalogResource[] = [
  {
    externalResourceId: "cemento-portland-tipo-i",
    externalCode: "MAT-001",
    description: "Cemento Portland Tipo I",
    category: "MATERIAL",
    unit: "bol",
    currency: "PEN",
    price: "27.4500",
    sourceVersion: CATALOG_VERSION,
  },
  {
    externalResourceId: "arena-gruesa",
    externalCode: "MAT-002",
    description: "Arena gruesa",
    category: "MATERIAL",
    unit: "m3",
    currency: "PEN",
    price: "78.9000",
    sourceVersion: CATALOG_VERSION,
  },
  {
    externalResourceId: "acero-corrugado-3-8",
    externalCode: "MAT-003",
    description: "Acero corrugado 3/8 pulg",
    category: "MATERIAL",
    unit: "kg",
    currency: "PEN",
    price: "4.8200",
    sourceVersion: CATALOG_VERSION,
  },
];

export function getCuratedCatalog() {
  return curatedCatalog.map((entry) => ({ ...entry }));
}

export function hasCatalogVersion(version: string) {
  return version === CATALOG_VERSION;
}

export function lookupCuratedPrices(resources: ServiceResourceLookup[], observedAt: Date): LookupQuote[] {
  return resources.flatMap((resource) => {
    const match = findCatalogResource(resource);
    if (!match) return [];

    const rawPayload = JSON.stringify({
      catalogVersion: CATALOG_VERSION,
      externalResourceId: match.externalResourceId,
      price: match.price,
      observedAt: observedAt.toISOString(),
    });

    return [{
      externalResourceId: match.externalResourceId,
      externalCode: match.externalCode,
      description: match.description,
      category: match.category,
      unit: match.unit,
      currency: match.currency,
      price: match.price,
      observedAt: observedAt.toISOString(),
      sourceLabel: "MC Presupuestos Price API — dataset curado",
      sourceVersion: match.sourceVersion,
      rawHash: `sha256:${createHash("sha256").update(rawPayload).digest("hex")}`,
    } satisfies LookupQuote];
  });
}

function findCatalogResource(resource: ServiceResourceLookup) {
  const normalizedExternalId = normalize(resource.externalResourceId);
  const normalizedCode = normalize(resource.externalCode ?? resource.code);

  const byExternalId = normalizedExternalId
    ? curatedCatalog.find((entry) => normalize(entry.externalResourceId) === normalizedExternalId)
    : undefined;
  if (byExternalId) return byExternalId;

  const byCode = normalizedCode
    ? curatedCatalog.find((entry) => normalize(entry.externalCode) === normalizedCode)
    : undefined;
  if (byCode) return byCode;

  const description = normalize(resource.description);
  const unit = normalize(resource.unit);
  return curatedCatalog.find((entry) => normalize(entry.description) === description && normalize(entry.unit) === unit);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}
