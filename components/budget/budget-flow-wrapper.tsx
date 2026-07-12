"use client";

import { useEffect, useState } from "react";
import { BudgetFlow } from "@/components/budget/budget-flow";
import type { BudgetTemplateCreationTraceability } from "@/lib/data/activity-events";
import type { BudgetRecord } from "@/types/budget";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

type EditorCatalogsPayload = {
  partidasCatalog: CatalogPartidaRecord[];
  resourcesCatalog: ResourceRecord[];
};

const editorCatalogsCache = new Map<string, Promise<EditorCatalogsPayload>>();
const templateTraceabilityCache = new Map<string, Promise<BudgetTemplateCreationTraceability | null>>();

async function fetchEditorCatalogs(budgetId: string): Promise<EditorCatalogsPayload> {
  const cached = editorCatalogsCache.get(budgetId);
  if (cached) return cached;

  const request = fetch(`/api/budgets/${budgetId}/editor-catalogs`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("No se pudieron cargar los catalogos del editor");
      }

      const payload = await response.json() as {
        partidasCatalog?: CatalogPartidaRecord[];
        resourcesCatalog?: ResourceRecord[];
      };

      return {
        partidasCatalog: payload.partidasCatalog ?? [],
        resourcesCatalog: payload.resourcesCatalog ?? [],
      };
    })
    .catch((error: unknown) => {
      editorCatalogsCache.delete(budgetId);
      throw error;
    });

  editorCatalogsCache.set(budgetId, request);
  return request;
}

async function fetchTemplateTraceability(budgetId: string): Promise<BudgetTemplateCreationTraceability | null> {
  const cached = templateTraceabilityCache.get(budgetId);
  if (cached) return cached;

  const request = fetch(`/api/budgets/${budgetId}/template-traceability`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("No se pudo cargar la trazabilidad de plantilla");
      }

      const payload = await response.json() as {
        traceability?: BudgetTemplateCreationTraceability | null;
      };

      return payload.traceability ?? null;
    })
    .catch((error: unknown) => {
      templateTraceabilityCache.delete(budgetId);
      throw error;
    });

  templateTraceabilityCache.set(budgetId, request);
  return request;
}

export function BudgetFlowWrapper({
  budget,
  projectName,
  templateTraceability,
  templateTraceabilityBudgetId,
  partidasCatalog,
  resourcesCatalog,
  catalogBudgetId,
}: {
  budget: BudgetRecord;
  projectName?: string;
  templateTraceability?: BudgetTemplateCreationTraceability | null;
  templateTraceabilityBudgetId?: string;
  partidasCatalog: CatalogPartidaRecord[];
  resourcesCatalog: ResourceRecord[];
  catalogBudgetId?: string;
}) {
  const [catalogs, setCatalogs] = useState({
    partidasCatalog,
    resourcesCatalog,
  });
  const [resolvedTemplateTraceability, setResolvedTemplateTraceability] = useState<BudgetTemplateCreationTraceability | null>(null);

  useEffect(() => {
    if (!catalogBudgetId) return;

    let active = true;

    async function loadCatalogs() {
      try {
        const payload = await fetchEditorCatalogs(catalogBudgetId);
        if (active) {
          setCatalogs(payload);
        }
      } catch {
        // Keep the editor usable with empty catalogs; actions that need catalog
        // data will simply show no suggestions until the next navigation/retry.
      }
    }

    void loadCatalogs();

    return () => {
      active = false;
    };
  }, [catalogBudgetId]);

  useEffect(() => {
    if (!templateTraceabilityBudgetId || templateTraceability) return;

    let active = true;

    async function loadTemplateTraceability() {
      try {
        const payload = await fetchTemplateTraceability(templateTraceabilityBudgetId);
        if (active) {
          setResolvedTemplateTraceability(payload);
        }
      } catch {
        // The banner is informational; keep the editor path fast if it fails.
      }
    }

    void loadTemplateTraceability();

    return () => {
      active = false;
    };
  }, [templateTraceability, templateTraceabilityBudgetId]);

  return (
    <BudgetFlow
      budget={budget}
      projectName={projectName}
      templateTraceability={templateTraceability ?? resolvedTemplateTraceability}
      partidasCatalog={catalogs.partidasCatalog}
      resourcesCatalog={catalogs.resourcesCatalog}
    />
  );
}
