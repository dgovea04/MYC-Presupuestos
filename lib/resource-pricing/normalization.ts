import Decimal from "decimal.js";
import { createHash } from "node:crypto";
import type { ResourcePriceQuote } from "@/types/resource-pricing";
import { ResourcePriceProviderError } from "@/lib/resource-pricing/provider";

export function normalizePriceQuote(input: ResourcePriceQuote): ResourcePriceQuote {
  const price = parsePrice(input.price);
  const observedAt = new Date(input.observedAt);

  if (!input.unit.trim() || !input.currency.trim() || Number.isNaN(observedAt.getTime())) {
    throw new ResourcePriceProviderError("INVALID_RESPONSE", "La cotización no tiene unidad, moneda o fecha válida.");
  }

  return {
    ...input,
    description: input.description.trim(),
    externalResourceId: normalizeText(input.externalResourceId),
    externalCode: normalizeText(input.externalCode),
    category: normalizeText(input.category),
    unit: input.unit.trim(),
    currency: input.currency.trim().toUpperCase(),
    price: price.toFixed(4),
    observedAt: observedAt.toISOString(),
    sourceLabel: input.sourceLabel.trim(),
    sourceVersion: normalizeText(input.sourceVersion),
    rawHash: input.rawHash.trim() || createHash("sha256").update(JSON.stringify(input)).digest("hex"),
  };
}

export function parsePrice(value: string) {
  try {
    const price = new Decimal(value);
    if (!price.isFinite() || price.isNegative()) {
      throw new Error("invalid");
    }
    return price;
  } catch {
    throw new ResourcePriceProviderError("INVALID_RESPONSE", "El proveedor devolvió un precio inválido.");
  }
}

export function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeMatchKey(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}
