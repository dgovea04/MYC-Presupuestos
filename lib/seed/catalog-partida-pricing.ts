import { calculateApuRows, calculateApuTotalUnitCost } from "@/lib/calculations/apu";

export type SeedCatalogResourcePrice = {
  unitPrice: number | { toString(): string };
  unit?: string | null;
  category?: string | null;
};

export type SeedCatalogPartidaApuPricingRow = {
  resourceId: string | null;
  description: string;
  unit: string;
  crew: number | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  resourceType: string | null;
  groupLabel: string | null;
  sortOrder: number;
};

export type SeedCatalogPartidaApuPricingResult = {
  rows: SeedCatalogPartidaApuPricingRow[];
  unitPrice: number;
  unresolvedRows: Array<{ description: string; unit: string }>;
};

export function priceSeedCatalogPartidaApuRows({
  rows,
  performance,
  resourcesById,
}: {
  rows: SeedCatalogPartidaApuPricingRow[];
  performance: number;
  resourcesById: Map<string, SeedCatalogResourcePrice>;
}): SeedCatalogPartidaApuPricingResult {
  const unresolvedRows: Array<{ description: string; unit: string }> = [];
  const rowsPricedFromCatalog = rows.map((row) => {
    const resource = row.resourceId ? resourcesById.get(row.resourceId) : null;

    if (!resource) {
      unresolvedRows.push({ description: row.description, unit: row.unit });
    }

    return {
      ...row,
      unitPrice: resource ? Number(resource.unitPrice.toString()) : 0,
      subtotal: 0,
      resource: resource
        ? {
            unit: resource.unit,
            category: resource.category,
          }
        : undefined,
    };
  });
  const calculatedRows = calculateApuRows(rowsPricedFromCatalog, performance).map((row) => ({
    resourceId: row.resourceId,
    description: row.description,
    unit: row.unit,
    crew: row.crew,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    subtotal: row.subtotal,
    resourceType: row.resourceType,
    groupLabel: row.groupLabel,
    sortOrder: row.sortOrder,
  }));

  return {
    rows: calculatedRows,
    unitPrice: calculateApuTotalUnitCost(calculatedRows, performance),
    unresolvedRows,
  };
}
