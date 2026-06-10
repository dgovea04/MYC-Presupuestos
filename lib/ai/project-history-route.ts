import { recordAiProjectHistory, type AiProjectHistoryEntry } from "@/lib/ai/project-history";
import type { AiAction, AiContext, AiEndpointResult } from "@/lib/ai/types";

const PROJECT_HISTORY_WARNING = "Khipu respondio, pero no se pudo guardar el historial del proyecto.";

export type AiEndpointResultWithHistory = AiEndpointResult & {
  historyEntry?: AiProjectHistoryEntry;
};

export async function attachProjectHistoryEntry({
  action,
  context,
  projectId,
  result,
  summary,
  userId,
}: {
  action: Exclude<AiAction, "json">;
  context?: AiContext;
  projectId?: string;
  result: AiEndpointResult;
  summary: string;
  userId: string;
}): Promise<AiEndpointResultWithHistory> {
  if (!projectId) {
    return result;
  }

  try {
    const historyEntry = await recordAiProjectHistory({
      action,
      context,
      projectId,
      result,
      summary,
      userId,
    });

    return historyEntry ? { ...result, historyEntry } : result;
  } catch {
    return {
      ...result,
      warnings: [...result.warnings, PROJECT_HISTORY_WARNING],
    };
  }
}
