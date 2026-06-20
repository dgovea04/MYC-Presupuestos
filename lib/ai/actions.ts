import type { AssistantAction } from "@/components/ai/use-ai-assistant-controller";

/**
 * Acciones ejecutables que Khipu puede devolver en sus respuestas
 * estructuradas para que el usuario las dispare con un clic.
 *
 * El LLM devuelve estas acciones dentro de `structuredData.actions`
 * y el panel del asistente las renderiza como botones.
 */
export type KhipuAction =
  | KhipuNavigateAction
  | KhipuOpenApuEditorAction
  | KhipuSelectPartidaAction
  | KhipuFillFormAction
  | KhipuRunAiActionAction;

/** Navega a una ruta interna de la app (ej. /budgets/xyz, /projects/abc). */
export type KhipuNavigateAction = {
  type: "navigate";
  /** Ruta relativa dentro de la app, ej. "/budgets/budget-123" */
  href: string;
  /** Etiqueta visible en el botón (default: "Abrir") */
  label?: string;
};

/** Abre el editor APU para una partida específica dentro del presupuesto. */
export type KhipuOpenApuEditorAction = {
  type: "open_apu_editor";
  /** ID de la partida a abrir en el editor APU */
  partidaId: string;
  /** ID del presupuesto que contiene la partida (necesario para navegar) */
  budgetId: string;
  /** Descripción de la partida para el contexto */
  partidaDescription?: string;
  /** Etiqueta visible en el botón (default: "Abrir APU") */
  label?: string;
};

/** Selecciona una partida en el contexto activo sin navegar. */
export type KhipuSelectPartidaAction = {
  type: "select_partida";
  /** Descripción de la partida a seleccionar */
  description: string;
  /** Unidad de la partida */
  unit?: string;
  /** Costo unitario de referencia */
  currentCost?: number;
  /** Etiqueta visible en el botón (default: "Seleccionar") */
  label?: string;
};

/** Pre-llena un campo del formulario del asistente. */
export type KhipuFillFormAction = {
  type: "fill_form";
  /** Campo a rellenar (chatMessage, apuDescription, apuUnit, reviewSummary, autocompleteInput) */
  field: string;
  /** Valor a establecer en el campo */
  value: string;
  /** Etiqueta visible en el botón (default: "Rellenar") */
  label?: string;
};

/** Dispara una nueva acción de Khipu con un payload predefinido. */
export type KhipuRunAiActionAction = {
  type: "run_ai_action";
  /** Tipo de acción a ejecutar */
  action: AssistantAction;
  /** Prompt o consulta predefinida */
  prompt: string;
  /** Etiqueta visible en el botón (default: "Ejecutar") */
  label?: string;
};

/** Valida si un valor desconocido es un array de KhipuAction válido y no vacío. */
export function isKhipuActionArray(value: unknown): value is KhipuAction[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  return value.every(isKhipuAction);
}

function isKhipuAction(value: unknown): value is KhipuAction {
  if (!isRecord(value)) return false;
  const type = value.type;

  switch (type) {
    case "navigate":
      return typeof value.href === "string";
    case "open_apu_editor":
      return typeof value.partidaId === "string" && typeof value.budgetId === "string";
    case "select_partida":
      return typeof value.description === "string";
    case "fill_form":
      return typeof value.field === "string" && typeof value.value === "string";
    case "run_ai_action":
      return typeof value.action === "string" && typeof value.prompt === "string";
    default:
      return false;
  }
}

export function getActionLabel(action: KhipuAction): string {
  if (action.label) return action.label;

  switch (action.type) {
    case "navigate":
      return "Abrir";
    case "open_apu_editor":
      return "Abrir APU";
    case "select_partida":
      return "Seleccionar";
    case "fill_form":
      return "Rellenar";
    case "run_ai_action":
      return "Ejecutar";
  }
}

export function getActionDescription(action: KhipuAction): string {
  switch (action.type) {
    case "navigate":
      return `Navegar a ${action.href}`;
    case "open_apu_editor":
      return `Abrir editor APU para ${action.partidaDescription ?? action.partidaId}`;
    case "select_partida":
      return `Seleccionar "${action.description}"`;
    case "fill_form":
      return `Rellenar "${action.field}" con "${action.value.slice(0, 60)}"`;
    case "run_ai_action":
      return `${action.action}: ${action.prompt.slice(0, 80)}`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
