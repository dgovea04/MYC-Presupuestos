import Decimal from "decimal.js";

export type ResourceCapacityLimit = {
  resourceId: string;
  periodKey: string;
  quantityCapacity: number;
};

export type ResourceOverallocation = {
  resourceId: string;
  resourceName: string;
  periodKey: string;
  demandQuantity: number;
  capacityQuantity: number;
  excessQuantity: number;
};

export type ResourceCalendarDemand = {
  resourceId: string;
  resourceName: string;
  periodKey: string;
  demandQuantity: number;
};

function toDecimal(value: number): Decimal {
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

/**
 * Detect resource overallocations where demand exceeds capacity.
 * Missing capacity for a resource/period is ignored.
 */
export function detectResourceOverallocations(args: {
  demands: ResourceCalendarDemand[];
  limits: ResourceCapacityLimit[];
}): ResourceOverallocation[] {
  const { demands, limits } = args;
  const capacityByKey = new Map<string, number>();

  for (const limit of limits) {
    const key = `${limit.resourceId}:${limit.periodKey}`;
    capacityByKey.set(key, limit.quantityCapacity);
  }

  const overallocations: ResourceOverallocation[] = [];

  for (const demand of demands) {
    const key = `${demand.resourceId}:${demand.periodKey}`;
    const capacity = capacityByKey.get(key);
    if (capacity == null) continue;

    const demandDecimal = toDecimal(demand.demandQuantity);
    const capacityDecimal = toDecimal(capacity);

    if (demandDecimal.greaterThan(capacityDecimal)) {
      overallocations.push({
        resourceId: demand.resourceId,
        resourceName: demand.resourceName,
        periodKey: demand.periodKey,
        demandQuantity: demand.demandQuantity,
        capacityQuantity: capacity,
        excessQuantity: demandDecimal.minus(capacityDecimal).toNumber(),
      });
    }
  }

  return overallocations;
}
