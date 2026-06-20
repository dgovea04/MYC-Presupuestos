import { useMemo } from "react";
import type { AiAssistantControllerViewModel } from "@/components/ai/use-ai-assistant-controller";

export function useDedupedHistory(controller: AiAssistantControllerViewModel) {
  return useMemo(
    () => controller.history.filter((entry) => entry.id !== controller.result?.historyEntry?.id),
    [controller.history, controller.result?.historyEntry?.id],
  );
}
