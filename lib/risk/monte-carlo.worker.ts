import { runMonteCarloSimulation } from "@/lib/risk/monte-carlo-engine";
import type { RiskWorkerMessage, RiskWorkerRequestMessage } from "@/types/risk";

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<RiskWorkerRequestMessage>) => {
  const message = event.data;

  if (message.type !== "run") {
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
