"use client";

import { useEffect, useRef, useState } from "react";
import { usePublishAiViewContext } from "@/components/ai/ai-view-context";
import type { AiContext } from "@/lib/ai/types";
import type { BudgetDisplayRow } from "@/lib/budget/structure";
import type { BudgetItemRecord, BudgetLevelRecord, BudgetRecord } from "@/types/budget";

function buildKhipuContextFromSelection({
  activeRowId,
  rows,
  items,
  budget,
  projectName,
  apuItemDescription,
}: {
  activeRowId: string | null;
  rows: BudgetDisplayRow[];
  items: BudgetItemRecord[];
  budget: Pick<BudgetRecord, "id" | "name" | "projectId">;
  projectName?: string;
  apuItemDescription?: string | null;
}): AiContext {
  // Base context always present
  const base: AiContext = {
    route: `/budgets/${budget.id}`,
    project: projectName,
    projectId: budget.projectId,
    budgetId: budget.id,
    module: apuItemDescription ? "APU" : "Editor de presupuesto",
    activeTable: apuItemDescription ? "Analisis de precios unitarios" : "Partidas",
  };

  // No selection — just return base
  if (!activeRowId) {
    return {
      ...base,
      viewSummary: `Sub presupuesto ${budget.name} sin partida seleccionada.`,
    };
  }

  // Find the active row
  const activeRow = rows.find((row) => row.kind === "level" ? row.level.id === activeRowId : row.item.id === activeRowId);

  if (!activeRow) {
    // Row ID might reference an item not yet in rows (e.g. newly added)
    const fallbackItem = items.find((item) => item.id === activeRowId);
    if (fallbackItem) {
      return {
        ...base,
        selectedItem: fallbackItem.description,
        selectionType: "partida",
        selectionId: fallbackItem.id,
        unit: fallbackItem.unit,
        currentCost: fallbackItem.unitPrice,
        viewSummary: `Partida ${fallbackItem.code} ${fallbackItem.description} — S/ ${fallbackItem.unitPrice}/${fallbackItem.unit}.`,
      };
    }
    return {
      ...base,
      viewSummary: `Sub presupuesto ${budget.name}.`,
    };
  }

  if (activeRow.kind === "item") {
    const item = activeRow.item;

    // When APU sheet is open for this item, enrich with APU context
    if (apuItemDescription && item.id === activeRowId) {
      return {
        ...base,
        selectedItem: item.description,
        selectionType: "partida",
        selectionId: item.id,
        unit: item.unit,
        currentCost: item.unitPrice,
        viewSummary: `APU de ${item.code} ${item.description} — S/ ${item.unitPrice}/${item.unit}.`,
      };
    }

    return {
      ...base,
      selectedItem: item.description,
      selectionType: "partida",
      selectionId: item.id,
      unit: item.unit,
      currentCost: item.unitPrice,
      viewSummary: `Partida ${item.code} ${item.description} — S/ ${item.unitPrice}/${item.unit}.`,
    };
  }

  // Level row
  const level = activeRow.level;
  const levelItems = items.filter((item) => item.levelId === level.id);
  const levelLabel = levelTypeLabelForContext(level.type);

  return {
    ...base,
    selectedItem: level.name,
    selectionType: "budget",
    selectionId: level.id,
    viewSummary: `${levelLabel} ${level.code} ${level.name} — ${levelItems.length} partida${levelItems.length === 1 ? "" : "s"}.`,
  };
}

function levelTypeLabelForContext(type: BudgetLevelRecord["type"]) {
  switch (type) {
    case "TITLE": return "Titulo";
    case "SUBTITLE": return "Subtitulo";
    case "ITEM_GROUP": return "Subpartida";
    case "SUBITEM": return "Subitem";
    default: return type;
  }
}

/**
 * Publishes granular selection context to Khipu whenever the user
 * focuses a different row in the BudgetEditor or opens the APU sheet.
 *
 * Use this inside BudgetEditor to keep Khipu aware of the currently
 * selected partida/level in real time.
 */
export function usePublishBudgetSelection({
  activeRowId,
  apuItemDescription,
  budget,
  items,
  projectName,
  rows,
}: {
  activeRowId: string | null;
  apuItemDescription?: string | null;
  budget: Pick<BudgetRecord, "id" | "name" | "projectId">;
  items: BudgetItemRecord[];
  projectName?: string;
  rows: BudgetDisplayRow[];
}) {
  const [context, setContext] = useState<AiContext>(initialContext(budget, projectName));

  // Debounce publishing to avoid excessive updates during rapid navigation
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPublishedRef = useRef<string>("");

  useEffect(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const nextContext = buildKhipuContextFromSelection({
        activeRowId,
        rows,
        items,
        budget,
        projectName,
        apuItemDescription,
      });

      // Avoid publishing identical context repeatedly
      const nextSnapshot = JSON.stringify(nextContext);
      if (nextSnapshot === lastPublishedRef.current) return;
      lastPublishedRef.current = nextSnapshot;

      setContext(nextContext);
    }, 80); // 80ms debounce — fast enough for real-time feel, slow enough to batch keystroke navigation

    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [activeRowId, apuItemDescription, budget, items, projectName, rows]);

  // Reset stale snapshot on unmount so remount doesn't skip first publish
  useEffect(() => {
    return () => {
      lastPublishedRef.current = "";
    };
  }, []);

  // Call the hook during render — it publishes context to the AiViewContext provider
  usePublishAiViewContext(context);
}

function initialContext(
  budget: Pick<BudgetRecord, "id" | "name" | "projectId">,
  projectName?: string,
): AiContext {
  return {
    route: `/budgets/${budget.id}`,
    project: projectName,
    projectId: budget.projectId,
    budgetId: budget.id,
    module: "Editor de presupuesto",
    activeTable: "Partidas",
    viewSummary: `Sub presupuesto ${budget.name} del proyecto ${projectName ?? ""}.`,
  };
}
