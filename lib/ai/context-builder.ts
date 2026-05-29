import type { AiContext } from "@/lib/ai/types";

export function buildContextBlock(context?: AiContext) {
  if (!context) {
    return "";
  }

  const entries = [
    ["Proyecto", context.project],
    ["Módulo", context.module],
    ["Partida seleccionada", context.selectedItem],
    ["Unidad", context.unit],
    ["Costo actual", typeof context.currentCost === "number" ? String(context.currentCost) : undefined],
    ["Tabla activa", context.activeTable],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0);

  if (entries.length === 0) {
    return "";
  }

  return ["Contexto operativo de MYC Presupuestos:", ...entries.map(([label, value]) => `- ${label}: ${value}`)].join("\n");
}
