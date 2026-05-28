import Decimal from "decimal.js";
import { normalizePartidaText, normalizeUnit } from "@/lib/partida-generation/text";
import type { CatalogPartidaRecord, PartidaApuRowRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";
import type { SelectedPartidaForAggregation, SuggestedInsumo, SuggestedInsumoConfidenceLevel } from "@/types/partida-generation";

type AggregateSuggestedInsumosInput = {
  selectedPartidas: SelectedPartidaForAggregation[];
  resources: ResourceRecord[];
};

type QuantitySample = {
  quantity: Decimal;
  crew: Decimal | null;
  weight: Decimal;
  partidaId: string;
};

type InsumoGroup = {
  key: string;
  resourceId: string | null;
  description: string;
  unit: string;
  resourceType: string | null;
  rows: Array<{ row: PartidaApuRowRecord; partida: CatalogPartidaRecord; score: number }>;
  samples: QuantitySample[];
};

export function aggregateSuggestedInsumos(input: AggregateSuggestedInsumosInput): SuggestedInsumo[] {
  const groups = groupInsumos(input.selectedPartidas);
  const resourcesById = new Map(input.resources.map((resource) => [resource.id, resource]));
  const resourcesByNaturalKey = new Map(input.resources.map((resource) => [buildNaturalResourceKey(resource.description, resource.unit, resource.category), resource]));
  const selectedCount = input.selectedPartidas.length;

  return [...groups.values()]
    .map((group) => {
      const matchedResource = findCatalogResource(group, resourcesById, resourcesByNaturalKey);
      const frequency = selectedCount === 0 ? new Decimal(0) : new Decimal(uniqueSourcePartidaIds(group).length).div(selectedCount);
      const statistics = calculateStatistics(group.samples.map((sample) => sample.quantity));
      const crewSamples = group.samples
        .filter((sample) => sample.crew !== null)
        .map((sample) => ({
          ...sample,
          quantity: sample.crew ?? new Decimal(0),
        }));

      return {
        key: group.key,
        resourceId: matchedResource?.id ?? group.resourceId,
        description: matchedResource?.description ?? group.description,
        unit: matchedResource?.unit ?? group.unit,
        resourceType: matchedResource?.category ?? group.resourceType,
        frequency: toRoundedNumber(frequency, 4),
        confidenceLevel: resolveConfidenceLevel(frequency),
        suggestedCrew: crewSamples.length ? weightedMedian(crewSamples) : null,
        suggestedQuantity: weightedMedian(group.samples),
        unitPrice: matchedResource ? toRoundedNumber(new Decimal(matchedResource.unitPrice), 4) : null,
        priceSource: matchedResource ? "catalog" : "unmatched",
        calculationMethod: "weighted_median",
        statistics,
        sourcePartidaIds: uniqueSourcePartidaIds(group),
      } satisfies SuggestedInsumo;
    })
    .sort((left, right) => {
      const frequencyComparison = right.frequency - left.frequency;
      if (frequencyComparison !== 0) return frequencyComparison;
      return left.description.localeCompare(right.description);
    });
}

function groupInsumos(selectedPartidas: SelectedPartidaForAggregation[]) {
  const groups = new Map<string, InsumoGroup>();

  for (const selected of selectedPartidas) {
    for (const row of selected.partida.apuRows) {
      const key = row.resourceId ?? buildNaturalResourceKey(row.description, row.unit, row.resourceType ?? "");
      const existing = groups.get(key);
      const sample = {
        quantity: new Decimal(row.quantity),
        crew: row.crew == null ? null : new Decimal(row.crew),
        weight: new Decimal(selected.score),
        partidaId: selected.partida.id,
      };

      if (existing) {
        existing.rows.push({ row, partida: selected.partida, score: selected.score });
        existing.samples.push(sample);
        continue;
      }

      groups.set(key, {
        key,
        resourceId: row.resourceId ?? null,
        description: row.description,
        unit: row.unit,
        resourceType: row.resourceType ?? null,
        rows: [{ row, partida: selected.partida, score: selected.score }],
        samples: [sample],
      });
    }
  }

  return groups;
}

function findCatalogResource(
  group: InsumoGroup,
  resourcesById: Map<string, ResourceRecord>,
  resourcesByNaturalKey: Map<string, ResourceRecord>,
) {
  if (group.resourceId) {
    const resource = resourcesById.get(group.resourceId);
    if (resource) return resource;
  }

  return resourcesByNaturalKey.get(buildNaturalResourceKey(group.description, group.unit, group.resourceType ?? ""));
}

function buildNaturalResourceKey(description: string, unit: string, resourceType: string) {
  return [normalizePartidaText(description), normalizeUnit(unit), normalizePartidaText(resourceType)].join("|");
}

function uniqueSourcePartidaIds(group: InsumoGroup) {
  return [...new Set(group.rows.map((entry) => entry.partida.id))];
}

function resolveConfidenceLevel(frequency: Decimal): SuggestedInsumoConfidenceLevel {
  if (frequency.greaterThanOrEqualTo(0.8)) return "auto";
  if (frequency.greaterThanOrEqualTo(0.5)) return "review";
  return "optional";
}

function calculateStatistics(values: Decimal[]) {
  if (values.length === 0) {
    return {
      average: 0,
      median: 0,
      minimum: 0,
      maximum: 0,
      standardDeviation: 0,
    };
  }

  const sorted = [...values].sort((left, right) => left.comparedTo(right));
  const sum = values.reduce((current, value) => current.plus(value), new Decimal(0));
  const average = sum.div(values.length);
  const variance = values
    .reduce((current, value) => current.plus(value.minus(average).pow(2)), new Decimal(0))
    .div(values.length);

  return {
    average: toRoundedNumber(average, 4),
    median: toRoundedNumber(median(sorted), 4),
    minimum: toRoundedNumber(sorted[0] ?? new Decimal(0), 4),
    maximum: toRoundedNumber(sorted[sorted.length - 1] ?? new Decimal(0), 4),
    standardDeviation: toRoundedNumber(variance.sqrt(), 3),
  };
}

function median(sortedValues: Decimal[]) {
  const middle = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middle] ?? new Decimal(0);
  }

  return (sortedValues[middle - 1] ?? new Decimal(0)).plus(sortedValues[middle] ?? 0).div(2);
}

function weightedMedian(samples: QuantitySample[]) {
  const sorted = [...samples].sort((left, right) => left.quantity.comparedTo(right.quantity));
  const totalWeight = sorted.reduce((current, sample) => current.plus(sample.weight), new Decimal(0));
  const midpoint = totalWeight.div(2);
  let cumulative = new Decimal(0);

  for (const sample of sorted) {
    cumulative = cumulative.plus(sample.weight);
    if (cumulative.greaterThanOrEqualTo(midpoint)) {
      return toRoundedNumber(sample.quantity, 4);
    }
  }

  return toRoundedNumber(sorted[sorted.length - 1]?.quantity ?? new Decimal(0), 4);
}

function toRoundedNumber(value: Decimal, decimalPlaces: number) {
  return Number(value.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toString());
}
