import type { Resource } from "@prisma/client";
import type { ResourcePriceQuote } from "@/types/resource-pricing";
import { normalizeMatchKey } from "@/lib/resource-pricing/normalization";

export type ResourcePriceMatch = {
  resource: Resource | null;
  quote: ResourcePriceQuote | null;
  status: "MATCHED" | "UNMATCHED" | "UNIT_MISMATCH" | "CURRENCY_MISMATCH";
  confidence: string | null;
  reason: string | null;
};

type Binding = { resourceId: string; provider: string; externalResourceId: string; active: boolean };

export function matchQuoteToResource(
  resources: Resource[],
  quotes: ResourcePriceQuote[],
  bindings: Binding[],
  provider: string,
): ResourcePriceMatch[] {
  const byBinding = new Map(bindings.filter((binding) => binding.active && binding.provider === provider).map((binding) => [`${binding.provider}:${binding.externalResourceId}`, binding.resourceId]));
  const usedResources = new Set<string>();

  return quotes.map((quote) => {
    const boundId = quote.externalResourceId ? byBinding.get(`${provider}:${quote.externalResourceId}`) : undefined;
    const exactResource = boundId ? resources.find((resource) => resource.id === boundId) : undefined;
    const resource = exactResource ?? resources.find((candidate) => {
      if (usedResources.has(candidate.id)) return false;
      const identifiers = [candidate.iu, candidate.code].map(normalizeMatchKey).filter(Boolean);
      const quoteIdentifiers = [quote.externalResourceId, quote.externalCode].map(normalizeMatchKey).filter(Boolean);
      return quoteIdentifiers.some((identifier) => identifiers.includes(identifier));
    }) ?? resources.find((candidate) => {
      if (usedResources.has(candidate.id)) return false;
      return normalizeMatchKey(candidate.description) === normalizeMatchKey(quote.description)
        && normalizeMatchKey(candidate.unit) === normalizeMatchKey(quote.unit);
    });

    if (!resource) {
      return { resource: null, quote, status: "UNMATCHED", confidence: null, reason: "No existe un match determinista." } satisfies ResourcePriceMatch;
    }

    usedResources.add(resource.id);
    if (normalizeMatchKey(resource.unit) !== normalizeMatchKey(quote.unit)) {
      return { resource, quote, status: "UNIT_MISMATCH", confidence: boundId ? "1.0000" : "0.8000", reason: "La unidad externa no coincide con la unidad del catálogo." } satisfies ResourcePriceMatch;
    }
    if (resource.currency.toUpperCase() !== quote.currency.toUpperCase()) {
      return { resource, quote, status: "CURRENCY_MISMATCH", confidence: boundId ? "1.0000" : "0.8000", reason: "La moneda externa no coincide con la moneda del catálogo." } satisfies ResourcePriceMatch;
    }

    return {
      resource,
      quote,
      status: "MATCHED",
      confidence: boundId ? "1.0000" : "0.9000",
      reason: boundId ? "Binding externo confirmado." : "Match determinista por identificador o descripción/unidad.",
    } satisfies ResourcePriceMatch;
  });
}
