"use client";

import { useEffect, useState } from "react";
import { BudgetFlow } from "@/components/budget/budget-flow";
import type { BudgetTemplateCreationTraceability } from "@/lib/data/activity-events";
import type { BudgetRecord } from "@/types/budget";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

export function BudgetFlowWrapper({
  budget,
  projectName,
  templateTraceability,
  partidasCatalog,
  resourcesCatalog,
  catalogBudgetId,
}: {
  budget: BudgetRecord;
  projectName?: string;
  templateTraceability?: BudgetTemplateCreationTraceability | null;
  partidasCatalog: CatalogPartidaRecord[];
  resourcesCatalog: ResourceRecord[];
  catalogBudgetId?: string;
}) {
  const [catalogs, setCatalogs] = useState({
    partidasCatalog,
    resourcesCatalog,
  });

  useEffect(() => {
    if (!catalogBudgetId) return;

    const controller = new AbortController();

    async function loadCatalogs() {
      try {
        const response = await fetch(`/api/budgets/${catalogBudgetId}/editor-catalogs`, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = await response.json() as {
          partidasCatalog?: CatalogPartidaRecord[];
          resourcesCatalog?: ResourceRecord[];
        };

        setCatalogs({
          partidasCatalog: payload.partidasCatalog ?? [],
          resourcesCatalog: payload.resourcesCatalog ?? [],
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    void loadCatalogs();

    return () => {
      controller.abort();
    };
  }, [catalogBudgetId]);

  return (
    <BudgetFlow
      budget={budget}
      projectName={projectName}
      templateTraceability={templateTraceability}
      partidasCatalog={catalogs.partidasCatalog}
      resourcesCatalog={catalogs.resourcesCatalog}
    />
  );
}
