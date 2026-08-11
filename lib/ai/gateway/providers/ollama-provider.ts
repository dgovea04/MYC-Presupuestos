import { generateAiResponse } from "@/lib/ai/service";
import type { AiProviderRequest, AiProviderResult } from "@/lib/ai/gateway/types";
import type { AiAction } from "@/lib/ai/types";
import { AiRuntimeError } from "@/lib/ai/errors";
import { isLocalRuntimeEnabled } from "@/lib/runtime/local-capabilities";

export async function executeOllamaProvider(request: AiProviderRequest): Promise<AiProviderResult> {
  if (!isLocalRuntimeEnabled()) {
    throw new AiRuntimeError("local_only", "Ollama solo esta disponible en la app local.");
  }

  const result = await generateAiResponse({
    action: mapTaskToAiAction(request.task),
    messages: request.messages,
    schema: request.schema,
    userId: request.userId,
  });

  return {
    ...result,
    provider: "ollama",
  };
}

function mapTaskToAiAction(task: AiProviderRequest["task"]): AiAction {
  if (task === "autocomplete") return "autocomplete";
  if (task === "generate_apu" || task === "review_apu" || task === "generate_partida" || task === "suggest_insumos") {
    return "apu";
  }
  if (task === "chat") return "chat";
  return "review";
}
