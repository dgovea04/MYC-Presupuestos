"use client";

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
  if (typeof Worker === "undefined") {
    onError("No se pudo iniciar el worker de simulacion.");

    return {
      cancel: () => undefined,
    };
  }

  const worker = new Worker(new URL("./monte-carlo.worker.ts", import.meta.url), { type: "module" });

  const terminateWithError = (message: string) => {
    worker.terminate();
    onError(message);
  };

  worker.onmessage = (event: MessageEvent<unknown>) => {
    const message = event.data;

    if (!isRiskWorkerMessage(message)) {
      terminateWithError("No se pudo leer la respuesta del worker de simulacion.");
      return;
    }

    if (message.type === "progress") {
      try {
        onProgress(message.completedIterations, message.totalIterations);
      } catch (error) {
        worker.terminate();
        throw error;
      }

      return;
    }

    if (message.type === "result") {
      worker.terminate();
      onResult(message.summary);
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

function isRiskWorkerMessage(message: unknown): message is RiskWorkerMessage {
  if (!isRecord(message) || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "progress") {
    return Number.isFinite(message.completedIterations) && Number.isFinite(message.totalIterations);
  }

  if (message.type === "result") {
    return isRecord(message.summary);
  }

  if (message.type === "error") {
    return typeof message.message === "string";
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
