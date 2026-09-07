import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { normalizeKnowledgeUnit } from "./normalization";
import { validateKnowledgeScope, validateObservationValue } from "./validation";
import type { KnowledgeScopeContext } from "./types";

interface ObservationBase extends KnowledgeScopeContext {
  sourceId: string;
  evidenceId?: string;
  observedAt: Date;
  confidence: "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
}

export interface PriceObservationInput extends ObservationBase {
  resourceId: string;
  value: Decimal.Value;
  currency?: string;
  unit: string;
  regionId?: string;
  supplierId?: string;
}

export interface YieldObservationInput extends ObservationBase {
  canonicalItemId: string;
  apuVersionId?: string;
  value: Decimal.Value;
  unit: string;
  crew?: Decimal.Value;
  projectType?: string;
  regionId?: string;
}

export async function createPriceObservation(input: PriceObservationInput) {
  validateKnowledgeScope(input);
  const value = validateObservationValue(input.value);
  return prisma.priceObservation.create({ data: {
    resourceId: input.resourceId, value: value.toFixed(6), currency: input.currency ?? "PEN", unit: normalizeKnowledgeUnit(input.unit),
    regionId: input.regionId, supplierId: input.supplierId, companyId: input.companyId, projectId: input.projectId,
    sourceId: input.sourceId, evidenceId: input.evidenceId, observedAt: input.observedAt, scope: input.scope,
    confidence: input.confidence, status: "OBSERVED",
  }});
}

export async function createYieldObservation(input: YieldObservationInput) {
  validateKnowledgeScope(input);
  const value = validateObservationValue(input.value);
  return prisma.yieldObservation.create({ data: {
    canonicalItemId: input.canonicalItemId, apuVersionId: input.apuVersionId, value: value.toFixed(6), unit: normalizeKnowledgeUnit(input.unit),
    crew: input.crew === undefined ? undefined : new Decimal(input.crew).toFixed(4), projectType: input.projectType, regionId: input.regionId,
    companyId: input.companyId, projectId: input.projectId, sourceId: input.sourceId, evidenceId: input.evidenceId,
    observedAt: input.observedAt, scope: input.scope, confidence: input.confidence, status: "OBSERVED",
  }});
}

