import type { AiContext } from "@/lib/ai/types";

export function buildContextBlock(context?: AiContext) {
  if (!context) {
    return "";
  }

  const entries = [
    ["Ruta", context.route],
    ["Proyecto", context.project],
    ["Project ID", context.projectId],
    ["Budget ID", context.budgetId],
    ["Modulo", context.module],
    ["Partida seleccionada", context.selectedItem],
    ["Tipo de seleccion", context.selectionType],
    ["Selection ID", context.selectionId],
    ["Unidad", context.unit],
    ["Costo actual", typeof context.currentCost === "number" ? String(context.currentCost) : undefined],
    ["Tabla activa", context.activeTable],
    ["Resumen visible", context.viewSummary],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0);

  if (entries.length === 0) {
    return "";
  }

  return ["Contexto operativo de MYC Presupuestos:", ...entries.map(([label, value]) => `- ${label}: ${value}`)].join("\n");
}
