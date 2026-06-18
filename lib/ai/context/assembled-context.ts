import type { KhipuAiTask } from "@/lib/ai/gateway/types";
import { buildContextBlock } from "@/lib/ai/context-builder";
import { getAiProjectHistory, type AiProjectHistoryEntry } from "@/lib/ai/project-history";
import { buildAiRetrievalEvidence, formatEvidenceBlock, type AiEvidence } from "@/lib/ai/retrieval-context";
import { getProjectAiMemory, type ProjectAiMemoryFact } from "@/lib/ai/context/project-memory";
import { getProjectContextSummary } from "@/lib/ai/context/project-context";
import type { AiAction, AiContext } from "@/lib/ai/types";

type ProjectHistorySummary = Pick<AiProjectHistoryEntry, "id" | "summary" | "result" | "timestamp">;

export type KhipuAssembledContext = {
  projectContext: string;
  projectHistory: ProjectHistorySummary[];
  projectMemory: ProjectAiMemoryFact[];
  retrievalEvidence: AiEvidence[];
  userRequest: {
    task: KhipuAiTask;
    payload: Record<string, unknown>;
  };
};

export type BuildKhipuAssembledContextInput = {
  projectId?: string;
  userId: string;
  task: KhipuAiTask;
  payload: Record<string, unknown>;
  deps?: Partial<KhipuAssembledContextDeps>;
};

export type KhipuAssembledContextDeps = {
  getProjectContextSummary: typeof getProjectContextSummary;
  getAiProjectHistory: typeof getAiProjectHistory;
  getProjectAiMemory: typeof getProjectAiMemory;
  buildAiRetrievalEvidence: typeof buildAiRetrievalEvidence;
};

const DEFAULT_HISTORY_LIMIT = 6;
const DEFAULT_MEMORY_LIMIT = 12;

export async function buildKhipuAssembledContext({
  deps,
  payload,
  projectId,
  task,
  userId,
}: BuildKhipuAssembledContextInput): Promise<KhipuAssembledContext> {
  const resolvedDeps = resolveDeps(deps);
  const query = buildQueryText(payload);
  const action = mapTaskToRetrievalAction(task);

  if (!projectId) {
    return {
      projectContext: "",
      projectHistory: [],
      projectMemory: [],
      retrievalEvidence: resolvedDeps.buildAiRetrievalEvidence({
        query,
        action,
        context: readPayloadContext(payload),
      }),
      userRequest: { task, payload },
    };
  }

  const [projectContext, projectHistory, projectMemory, retrievalEvidence] = await Promise.all([
    resolvedDeps.getProjectContextSummary({ projectId, userId }),
    resolvedDeps.getAiProjectHistory(projectId, userId, DEFAULT_HISTORY_LIMIT),
    resolvedDeps.getProjectAiMemory({ projectId, userId, limit: DEFAULT_MEMORY_LIMIT }),
    Promise.resolve(
      resolvedDeps.buildAiRetrievalEvidence({
        query,
        action,
        context: readPayloadContext(payload),
      }),
    ),
  ]);

  return {
    projectContext,
    projectHistory: projectHistory.map((entry) => ({
      id: entry.id,
      summary: entry.summary,
      result: entry.result,
      timestamp: entry.timestamp,
    })),
    projectMemory,
    retrievalEvidence,
    userRequest: { task, payload },
  };
}

export function formatAssembledContextBlock(context: KhipuAssembledContext): string {
  const userViewContextBlock = buildContextBlock(readPayloadContext(context.userRequest.payload));

  return [
    "Contexto del proyecto",
    context.projectContext || "Sin contexto de proyecto disponible.",
    "",
    "Contexto visible del usuario",
    userViewContextBlock || "Sin contexto visible del usuario.",
    "",
    "Historial reciente",
    formatHistory(context.projectHistory),
    "",
    "Memoria del proyecto",
    formatMemory(context.projectMemory),
    "",
    "Fuentes consultadas",
    formatEvidenceBlock(context.retrievalEvidence) || "Sin fuentes relevantes encontradas.",
    "",
    "Solicitud del usuario",
    JSON.stringify(context.userRequest, null, 2),
  ].join("\n");
}

function resolveDeps(deps: Partial<KhipuAssembledContextDeps> | undefined): KhipuAssembledContextDeps {
  return {
    getProjectContextSummary,
    getAiProjectHistory,
    getProjectAiMemory,
    buildAiRetrievalEvidence,
    ...deps,
  };
}

function formatHistory(history: ProjectHistorySummary[]) {
  if (history.length === 0) {
    return "Sin historial reciente.";
  }

  return history
    .map((entry, index) => `${index + 1}. ${entry.summary} -> ${entry.result.answer}`)
    .join("\n");
}

function formatMemory(memory: ProjectAiMemoryFact[]) {
  if (memory.length === 0) {
    return "Sin memoria registrada.";
  }

  return memory
    .map((entry, index) => `${index + 1}. [${entry.memoryType} ${entry.confidence}] ${entry.fact} (${entry.source})`)
    .join("\n");
}

function buildQueryText(payload: Record<string, unknown>) {
  const values = [
    ...Object.values(payload)
      .flatMap((value) => (typeof value === "string" ? [value] : []))
      .filter((value) => value.trim().length > 0),
    ...Object.values(readPayloadContext(payload) ?? {})
    .flatMap((value) => (typeof value === "string" ? [value] : []))
      .filter((value) => value.trim().length > 0),
  ];

  return values.join(" ");
}

function mapTaskToRetrievalAction(task: KhipuAiTask): Exclude<AiAction, "json"> {
  if (task === "autocomplete") return "autocomplete";
  if (task === "generate_apu" || task === "review_apu" || task === "generate_partida" || task === "suggest_insumos") {
    return "apu";
  }
  if (task === "chat") return "chat";
  return "review";
}

function readPayloadContext(payload: Record<string, unknown>): AiContext | undefined {
  const context = payload.context;
  return typeof context === "object" && context !== null && !Array.isArray(context) ? context as AiContext : undefined;
}
