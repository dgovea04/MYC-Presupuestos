import { NextResponse } from "next/server";

import { executeAiTask } from "@/lib/ai/gateway/execute";
import type { KhipuAiTask } from "@/lib/ai/gateway/types";
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { withAiRoute } from "@/lib/ai/route-handler";
import { aiExecuteRequestSchema } from "@/lib/ai/validation";
import { assertAiCapabilityAccess, getAiCapabilityForTask } from "@/lib/ai/route-access-matrix";
import type { AiAction } from "@/lib/ai/types";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiExecuteRequestSchema.parse(await request.json());
    const workspaceId = session.user.activeCompanyId ?? session.user.companyId;
    if (workspaceId) await assertAiCapabilityAccess({ userId: session.user.id, workspaceId, capability: getAiCapabilityForTask(data.task) });
    const result = await executeAiTask({
      provider: data.provider,
      task: data.task,
      payload: data.payload,
      projectId: data.projectId,
      userId: session.user.id,
      ...(workspaceId ? { workspaceId } : {}),
      ...(data.requestId ? { requestId: data.requestId } : {}),
    });

    return NextResponse.json(
      await attachProjectHistoryEntry({
        action: mapTaskToHistoryAction(data.task),
        context: readPayloadContext(data.payload),
        projectId: data.projectId,
        result,
        summary: summarizePayload(data.payload),
        userId: session.user.id,
      }),
    );
  });
}

function mapTaskToHistoryAction(task: KhipuAiTask): Exclude<AiAction, "json"> {
  if (task === "autocomplete") return "autocomplete";
  if (task === "generate_apu" || task === "review_apu" || task === "generate_partida" || task === "suggest_insumos") {
    return "apu";
  }
  if (task === "chat") return "chat";
  return "review";
}

function summarizePayload(payload: Record<string, unknown>) {
  const preferredKeys = ["message", "description", "budgetSummary", "formulaSummary", "quantityTakeoffSummary", "riskSummary", "input"];
  const value = preferredKeys.map((key) => payload[key]).find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  return (value ?? "Ejecucion Khipu").slice(0, 240);
}

function readPayloadContext(payload: Record<string, unknown>) {
  const context = payload.context;
  return typeof context === "object" && context !== null && !Array.isArray(context) ? context : undefined;
}
