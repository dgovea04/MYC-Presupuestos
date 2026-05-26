/// <reference lib="webworker" />

import { runMonteCarloSimulation } from "@/lib/risk/monte-carlo-engine";
import type { RiskWorkerMessage, RiskWorkerRequestMessage } from "@/types/risk";

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<unknown>) => {
  const message = event.data;

  if (!isRiskWorkerRequestMessage(message)) {
    postError("No se pudo leer la solicitud de simulacion de riesgo.");
    return;
  }

  try {
    const summary = runMonteCarloSimulation(message.input, {
      onProgress: (completedIterations, totalIterations) => {
        ctx.postMessage({
          type: "progress",
          completedIterations,
          totalIterations,
        } satisfies RiskWorkerMessage);
      },
    });

    ctx.postMessage({ type: "result", summary } satisfies RiskWorkerMessage);
  } catch (error) {
    ctx.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "No se pudo completar la simulacion de riesgo.",
    } satisfies RiskWorkerMessage);
  }
};

function isRiskWorkerRequestMessage(message: unknown): message is RiskWorkerRequestMessage {
  return isRecord(message) && message.type === "run" && isRecord(message.input);
}

function postError(message: string): void {
  ctx.postMessage({ type: "error", message } satisfies RiskWorkerMessage);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
