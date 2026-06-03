import type { BudgetItemRecord } from "@/types/budget";
import type { ApuResourceRecord } from "@/types/apu";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";
import { clonePartidaApuRowsForBudget, isSubpartidaResourceType, SUBPARTIDA_RESOURCE_TYPE } from "@/lib/apu/subpartidas";

type ApplyCatalogPartidaToDraftItemOptions = {
  item: BudgetItemRecord;
  partida: CatalogPartidaRecord;
  resourcesById: Map<string, ResourceRecord>;
  resourcesByDescriptionUnit: Map<string, ResourceRecord>;
};

export function applyCatalogPartidaToDraftItem({
  item,
  partida,
  resourcesById,
  resourcesByDescriptionUnit,
}: ApplyCatalogPartidaToDraftItemOptions): BudgetItemRecord {
  return {
    ...item,
    description: partida.description,
    unit: partida.unit,
    unitPrice: partida.unitPrice,
    apu: {
      id: item.apu?.id ?? crypto.randomUUID(),
      budgetItemId: item.apu?.budgetItemId ?? "",
      name: partida.description,
      unit: partida.unit,
      performance: partida.performance,
      totalUnitCost: partida.unitPrice,
      resources: partida.apuRows.flatMap<ApuResourceRecord>((row) => {
        if (isSubpartidaResourceType(row.resourceType ?? row.groupLabel)) {
          const linkedPartida = row.catalogSubpartida ?? null;
          return [
            {
              id: crypto.randomUUID(),
              apuId: item.apu?.id ?? "",
              resourceId: null,
              catalogPartidaId: row.catalogSubpartidaId ?? linkedPartida?.id ?? null,
              resourceType: SUBPARTIDA_RESOURCE_TYPE,
              crew: row.crew ?? null,
              quantity: row.quantity,
              unitPrice: row.unitPrice,
              subtotal: row.subtotal,
              catalogPartida: linkedPartida,
              nestedApuRows: linkedPartida ? clonePartidaApuRowsForBudget(linkedPartida.apuRows, linkedPartida.id) : [],
            },
          ];
        }

        const resolvedResource = resolveCatalogResource(row, resourcesById, resourcesByDescriptionUnit);
        if (!resolvedResource) return [];

        return [
          {
            id: crypto.randomUUID(),
            apuId: item.apu?.id ?? "",
            resourceId: resolvedResource.id,
            resourceType: row.resourceType ?? resolvedResource.category,
            crew: row.crew ?? null,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            subtotal: row.subtotal,
            resource: resolvedResource,
          },
        ];
      }),
    },
  };
}

export function resolveCatalogResource(
  row: CatalogPartidaRecord["apuRows"][number],
  resourcesById: Map<string, ResourceRecord>,
  resourcesByDescriptionUnit: Map<string, ResourceRecord>,
) {
  if (isSubpartidaResourceType(row.resourceType ?? row.groupLabel)) {
    return null;
  }

  if (row.resourceId) {
    const byId = resourcesById.get(row.resourceId);
    if (byId) return byId;
  }

  return resourcesByDescriptionUnit.get(`${normalizeBudgetLookupText(row.description)}|${normalizeBudgetLookupText(row.unit)}`) ?? null;
}

function normalizeBudgetLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
