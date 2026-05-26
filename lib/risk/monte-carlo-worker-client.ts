import type { RiskSimulationInput, RiskSimulationSummary, RiskWorkerMessage, RiskWorkerRequestMessage } from "@/types/risk";

export type RiskWorkerController = {
  cancel: () => void;
};

export type RunRiskSimulationWorkerOptions = {
  input: RiskSimulationInput;
  onProgress: (completedIterations: number, totalIterations: number) => void;
  onResult: (summary: RiskSimulationSummary) => void;
  onError: (message: string) => void;
};

export function runRiskSimulationWorker({
  input,
  onError,
  onProgress,
  onResult,
}: RunRiskSimulationWorkerOptions): RiskWorkerController {
  const worker = new Worker(new URL("./monte-carlo.worker.ts", import.meta.url), { type: "module" });

  const terminateWithError = (message: string) => {
    onError(message);
    worker.terminate();
  };

  worker.onmessage = (event: MessageEvent<RiskWorkerMessage>) => {
    const message = event.data;

    if (message.type === "progress") {
      onProgress(message.completedIterations, message.totalIterations);
      return;
    }

    if (message.type === "result") {
      onResult(message.summary);
      worker.terminate();
      return;
    }

    terminateWithError(message.message);
  };

  worker.onerror = () => {
    terminateWithError("No se pudo iniciar el worker de simulacion.");
  };

  worker.postMessage({ type: "run", input } satisfies RiskWorkerRequestMessage);

  return {
    cancel: () => worker.terminate(),
  };
}
