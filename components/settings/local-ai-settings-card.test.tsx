/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalAiSettingsCard } from "@/components/settings/local-ai-settings-card";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("LocalAiSettingsCard", () => {
  afterEach(async () => {
    if (activeContainer) {
      const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;

      if (root) {
        await act(async () => {
          root.unmount();
        });
      }

      activeContainer.remove();
      activeContainer = null;
    }

    document.body.innerHTML = "";
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads local AI health and shows model routing with fallback warnings", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText } = await renderCard();

    expect(fetchMock).toHaveBeenCalledWith("/api/ai/health");
    expect(getByText("Integracion de IA Local")).toBeTruthy();
    expect(getByText("Con fallback")).toBeTruthy();
    expect(getByText("llama3.1")).toBeTruthy();
    expect(getByText("ollama pull mistral")).toBeTruthy();
    expect(getByText("qwen2.5-coder:7b")).toBeTruthy();
    expect(getByText("deepseek-coder")).toBeTruthy();
    expect(getByText("JSON estructurado")).toBeTruthy();
    expect(getByText("Generar APU")).toBeTruthy();
    expect(getByText("OpenAI")).toBeTruthy();
    expect(getByText("Gemini")).toBeTruthy();
    expect(getByText("Revision de presupuesto")).toBeTruthy();
    expect(getByText("openai -> gemini -> ollama")).toBeTruthy();
    expect(getByText("La IA nunca modifica presupuestos automaticamente.")).toBeTruthy();
  });

  it("clears local AI history from the browser", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem("myc-ai-session-history", "[{\"id\":\"1\"}]");

    const { getButtonByText, getByText } = await renderCard();

    await act(async () => {
      getButtonByText("Limpiar historial IA").click();
    });

    expect(window.localStorage.getItem("myc-ai-session-history")).toBeNull();
    expect(getByText("Historial local eliminado.")).toBeTruthy();
  });

  it("shows a friendly error when the health endpoint returns HTML instead of JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "<!DOCTYPE html><html><body>Error</body></html>",
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText } = await renderCard();

    expect(getByText("No se pudo consultar el estado de IA local. Respuesta no valida del servidor.")).toBeTruthy();
  });

  it("explains when the health endpoint is missing from the running dev server", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "<!DOCTYPE html><html><body>Not found</body></html>",
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText } = await renderCard();

    expect(getByText("No se encontro /api/ai/health en el servidor activo. Reinicia npm.cmd run dev para cargar las rutas de IA local.")).toBeTruthy();
  });
});

async function renderCard() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<LocalAiSettingsCard />);
  });

  await act(async () => {
    await Promise.resolve();
  });

  return {
    getByText: (text: string) => {
      const element = [...document.body.querySelectorAll("*")].find((candidate) => candidate.textContent?.trim() === text);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing text: ${text}`);
      }

      return element;
    },
    getButtonByText: (text: string) => {
      const element = [...document.body.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === text);
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${text}`);
      }

      return element;
    },
  };
}

function createHealthPayload() {
  return {
    status: "degraded",
    ollamaReachable: true,
    availableModels: ["llama3.1"],
    requiredModels: [
      { model: "llama3.1", installed: true, actions: ["chat", "review", "apu", "autocomplete"] },
      { model: "mistral", installed: false, actions: ["apu", "autocomplete"] },
      { model: "qwen2.5-coder:7b", installed: false, actions: ["json"] },
      { model: "deepseek-coder", installed: false, actions: ["json"] },
    ],
    actions: {
      chat: { model: "llama3.1", requestedModel: "llama3.1", fallbackUsed: false, warnings: [] },
      apu: {
        model: "llama3.1",
        requestedModel: "mistral",
        fallbackUsed: true,
        warnings: ["Falta instalar mistral en Ollama para apu."],
      },
      review: { model: "llama3.1", requestedModel: "llama3.1", fallbackUsed: false, warnings: [] },
      autocomplete: {
        model: "llama3.1",
        requestedModel: "mistral",
        fallbackUsed: true,
        warnings: ["Falta instalar mistral en Ollama para autocomplete."],
      },
      json: {
        model: "deepseek-coder",
        requestedModel: "qwen2.5-coder:7b",
        fallbackUsed: true,
        warnings: ["Falta instalar qwen2.5-coder:7b en Ollama para json."],
      },
    },
    metrics: {
      chat: { latencyMs: 120, lastError: null },
      apu: { latencyMs: null, lastError: "Falta instalar mistral" },
      review: { latencyMs: null, lastError: null },
      autocomplete: { latencyMs: null, lastError: null },
      json: { latencyMs: null, lastError: null },
    },
    providers: {
      ollama: { configured: true, reachable: true },
      openai: { configured: true, reachable: null },
      gemini: { configured: false, reachable: null },
      chatgpt_bridge: { configured: true, reachable: null },
    },
    routing: {
      review_apu: ["openai", "gemini", "ollama"],
      generate_apu: ["openai", "gemini", "ollama"],
      suggest_insumos: ["ollama"],
      review_budget: ["openai", "gemini", "ollama"],
      generate_partida: ["openai", "gemini", "ollama"],
      review_formula_polinomica: ["openai", "gemini", "ollama"],
      review_quantity_takeoff: ["openai", "gemini", "ollama"],
      montecarlo_risk_analysis: ["gemini", "ollama"],
      chat: ["chatgpt_bridge"],
      autocomplete: ["ollama"],
    },
  };
}
