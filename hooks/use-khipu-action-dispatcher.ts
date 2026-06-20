"use client";

import { useCallback, useState } from "react";
import type { KhipuAction, KhipuNavigateAction, KhipuOpenApuEditorAction, KhipuSelectPartidaAction, KhipuFillFormAction, KhipuRunAiActionAction } from "@/lib/ai/actions";
import type { AiAssistantControllerViewModel } from "@/components/ai/use-ai-assistant-controller";

export type ActionDispatcherResult = {
  /** Ejecuta una acción de Khipu y devuelve true si se completó sin errores */
  executeAction: (action: KhipuAction) => Promise<boolean>;
  /** ID de la acción actualmente en ejecución (para deshabilitar otros botones) */
  executingActionId: string | null;
};

/**
 * Hook que provee un dispatcher para ejecutar acciones de Khipu
 * (navegar, abrir APU, seleccionar partida, rellenar formulario, ejecutar acción IA).
 *
 * Úsalo en el panel del asistente para conectar los botones de acción
 * con los efectos reales en la UI.
 */
export function useKhipuActionDispatcher({
  controller,
  onNavigate,
  onOpenApuEditor,
  onFillForm,
}: {
  controller: Pick<
    AiAssistantControllerViewModel,
    "context" | "setActiveAction" | "setContext" | "submit"
  >;
  /** Callback para navegación (usa useRouter de next/navigation, o undefined en tests) */
  onNavigate?: (href: string) => void;
  /**
   * Callback opcional que permite al BudgetEditor abrir el APU sheet.
   * Si no se provee, open_apu_editor navega a la ruta del presupuesto
   * y selecciona la partida en el contexto (mejor esfuerzo).
   */
  onOpenApuEditor?: (partidaId: string, budgetId: string) => void;
  /**
   * Callback opcional para rellenar campos del formulario del asistente.
   */
  onFillForm?: (field: string, value: string) => void;
}): ActionDispatcherResult {
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  const executeNavigate = useCallback(
    async (action: KhipuNavigateAction) => {
      if (!onNavigate) return false;
      onNavigate(action.href);
      return true;
    },
    [onNavigate],
  );

  const executeOpenApuEditor = useCallback(
    async (action: KhipuOpenApuEditorAction) => {
      if (onOpenApuEditor) {
        onOpenApuEditor(action.partidaId, action.budgetId);
        return true;
      }

      // Fallback: navigate to the budget page and set context to the partida
      if (onNavigate) {
        onNavigate(`/budgets/${action.budgetId}`);
      }

      // Publish selection context so Khipu knows which partida is active
      controller.setContext((current) => ({
        ...current,
        selectedItem: action.partidaDescription ?? action.partidaId,
        selectionType: "partida",
        selectionId: action.partidaId,
        budgetId: action.budgetId,
        module: "Presupuesto",
        activeTable: "Partidas",
        viewSummary: `Navegando a partida ${action.partidaDescription ?? action.partidaId}.`,
      }));

      return true;
    },
    [controller, onNavigate, onOpenApuEditor],
  );

  const executeSelectPartida = useCallback(
    async (action: KhipuSelectPartidaAction) => {
      controller.setContext((current) => ({
        ...current,
        selectedItem: action.description,
        selectionType: "partida",
        unit: action.unit ?? current.unit,
        currentCost: action.currentCost ?? current.currentCost,
        viewSummary: `Partida ${action.description}${action.unit ? ` (${action.unit})` : ""}.`,
      }));
      return true;
    },
    [controller],
  );

  const executeFillForm = useCallback(
    async (action: KhipuFillFormAction) => {
      if (onFillForm) {
        onFillForm(action.field, action.value);
        return true;
      }
      return false;
    },
    [onFillForm],
  );

  const executeRunAiAction = useCallback(
    async (action: KhipuRunAiActionAction) => {
      try {
        controller.setActiveAction(action.action);

        const payload: Record<string, unknown> = { context: controller.context };

        // Only set the field relevant to the action type
        switch (action.action) {
          case "chat":
            payload.message = action.prompt;
            break;
          case "apu":
            payload.description = action.prompt;
            break;
          case "review":
            payload.budgetSummary = action.prompt;
            break;
          case "autocomplete":
            payload.input = action.prompt;
            break;
        }

        await controller.submit({ action: action.action, payload });
        return true;
      } catch {
        return false;
      }
    },
    [controller],
  );

  const executeAction = useCallback(
    async (action: KhipuAction) => {
      const actionId = `${action.type}-${Date.now()}`;
      setExecutingActionId(actionId);

      try {
        switch (action.type) {
          case "navigate":
            return await executeNavigate(action);
          case "open_apu_editor":
            return await executeOpenApuEditor(action);
          case "select_partida":
            return await executeSelectPartida(action);
          case "fill_form":
            return await executeFillForm(action);
          case "run_ai_action":
            return await executeRunAiAction(action);
        }
      } finally {
        setExecutingActionId(null);
      }
    },
    [executeNavigate, executeOpenApuEditor, executeSelectPartida, executeFillForm, executeRunAiAction],
  );

  return { executeAction, executingActionId };
}
