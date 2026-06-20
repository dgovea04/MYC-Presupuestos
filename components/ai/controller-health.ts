import type { AiHealth } from "@/components/ai/use-ai-assistant-controller";
import { isRecord, readErrorMessage } from "@/components/ai/controller-parsers";

function readAiHealth(payload: unknown): AiHealth {
  if (!isRecord(payload) || !Array.isArray(payload.requiredModels) || !isRecord(payload.actions) || !isRecord(payload.metrics)) {
    throw new Error("La respuesta de salud de IA no tiene el formato esperado.");
  }
  return payload as AiHealth;
}

export async function loadHealth(
  setHealth: (value: AiHealth | null) => void,
  setCloudConfigured: (value: (current: { openai: boolean; gemini: boolean; openrouter: boolean }) => {
    openai: boolean;
    gemini: boolean;
    openrouter: boolean;
  }) => void,
) {
  try {
    const response = await fetch("/api/ai/health");
    const payload: unknown = await response.json();

    if (!response.ok) {
      throw new Error(readErrorMessage(payload));
    }

    const nextHealth = readAiHealth(payload);
    setHealth(nextHealth);
    setCloudConfigured((current) => ({
      ...current,
      openrouter: nextHealth.providers?.openrouter?.configured === true,
    }));
  } catch {
    setHealth(null);
  }
}

export async function loadCloudStatus(
  setCloudConfigured: (value: (current: { openai: boolean; gemini: boolean; openrouter: boolean }) => {
    openai: boolean;
    gemini: boolean;
    openrouter: boolean;
  }) => void,
) {
  try {
    const response = await fetch("/api/settings/ai-provider");
    if (!response.ok) return;
    const payload: unknown = await response.json();
    if (isRecord(payload)) {
      setCloudConfigured((current) => ({
        openai: payload.openaiConfigured === true,
        gemini: payload.geminiConfigured === true,
        openrouter: payload.openrouterConfigured === true || current.openrouter,
      }));
    }
  } catch {
    // Best effort only
  }
}
