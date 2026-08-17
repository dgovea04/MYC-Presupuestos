"use client";

import { useMemo, useState } from "react";

import { ResourceCreateSheet } from "@/components/resources/resource-create-sheet";
import { ResourcePriceSyncPanel } from "@/components/resources/resource-price-sync-panel";
import { ResourcesTable } from "@/components/resources/resources-table";
import type { ResourceCategory, ResourceRecord } from "@/types/resource";
import type { UnifiedIndexDictionaryRow, UnifiedIndexRelationRow } from "@/types/unified-index";

export function ResourcesPageContent({
  companyId,
  canApplyResourcePriceUpdates,
  resources,
  unifiedIndexDictionaryRows,
  unifiedIndexRows,
}: {
  companyId?: string;
  canApplyResourcePriceUpdates: boolean;
  resources: ResourceRecord[];
  unifiedIndexDictionaryRows: UnifiedIndexDictionaryRow[];
  unifiedIndexRows: UnifiedIndexRelationRow[];
}) {
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [createdResources, setCreatedResources] = useState<ResourceRecord[]>([]);

  const localResources = useMemo(() => {
    const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));

    for (const resource of createdResources) {
      resourcesById.set(resource.id, resource);
    }

    return sortResourcesForCatalog([...resourcesById.values()]);
  }, [createdResources, resources]);

  const resourcesTableKey = useMemo(
    () =>
      localResources
        .map(
          (resource) =>
            `${resource.id}:${resource.code}:${resource.description}:${resource.category}:${resource.unit}:${resource.iu ?? ""}:${resource.iuCurrent ?? ""}:${resource.iuCurrentReviewStatus ?? ""}:${resource.unitPrice}:${resource.priceSyncStatus ?? ""}:${resource.priceObservedAt ?? ""}`,
        )
        .join("|"),
    [localResources],
  );

  function handleResourceCreated(resource: ResourceRecord) {
    setCreatedResources((current) => {
      const nextResources = current.filter((entry) => entry.id !== resource.id);
      return [...nextResources, resource];
    });
    setIsCreateFormOpen(false);
  }

  return (
    <>
      <ResourceCreateSheet
        open={isCreateFormOpen}
        companyId={companyId}
        onClose={() => setIsCreateFormOpen(false)}
        onCreated={handleResourceCreated}
      />

      <ResourcePriceSyncPanel resources={localResources} canApply={canApplyResourcePriceUpdates} />

      <ResourcesTable
        key={resourcesTableKey}
        companyId={companyId}
        resources={localResources}
        unifiedIndexDictionaryRows={unifiedIndexDictionaryRows}
        unifiedIndexRows={unifiedIndexRows}
        onRequestCreate={() => setIsCreateFormOpen(true)}
      />
    </>
  );
}

function sortResourcesForCatalog(resources: ResourceRecord[]) {
  return [...resources].sort((left, right) => compareResourceForCatalog(left, right));
}

function compareResourceForCatalog(
  left: Pick<ResourceRecord, "category" | "description">,
  right: Pick<ResourceRecord, "category" | "description">,
) {
  const categoryComparison = compareResourceCategory(left.category, right.category);
  if (categoryComparison !== 0) {
    return categoryComparison;
  }

  return left.description.localeCompare(right.description);
}

function compareResourceCategory(left: ResourceCategory, right: ResourceCategory) {
  return left.localeCompare(right);
}
