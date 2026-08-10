/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KhipuAgentSettingsCard } from "@/components/settings/khipu-agent-settings-card";
import { AGENT_MODELS, DEFAULT_AGENT_MODEL } from "@/lib/ai/agent/models";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mockFetch(response: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }),
  );
}

async function renderCard() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(<KhipuAgentSettingsCard />);
  });

  await act(async () => {
    await Promise.resolve();
  });

  return {
    container,
    getByText: (text: string | RegExp) => {
      const element = [...document.body.querySelectorAll("*")].find((candidate) => {
        if (typeof text === "string") {
          return candidate.textContent?.trim() === text;
        }
        return text.test(candidate.textContent ?? "");
      });
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing text: ${text}`);
      }
      return element;
    },
    queryByText: (text: string | RegExp) => {
      const element = [...document.body.querySelectorAll("*")].find((candidate) => {
        if (typeof text === "string") {
          return candidate.textContent?.trim() === text;
        }
        return text.test(candidate.textContent ?? "");
      });
      return element instanceof HTMLElement ? element : null;
    },
  };
}

describe("KhipuAgentSettingsCard", () => {
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
    vi.restoreAllMocks();
  });

  it("renders the card title and description", async () => {
    mockFetch({
      agentModel: DEFAULT_AGENT_MODEL,
      openrouterConfigured: true,
      geminiConfigured: false,
      aiProviderPreference: "auto",
    });

    const { getByText } = await renderCard();

    expect(getByText("Khipu Agente")).toBeTruthy();
    expect(getByText(/Configura el modelo de IA que usa el Khipu Agente/)).toBeTruthy();
  });

  it("shows an agent settings form skeleton while loading", async () => {
    const fetchPromise = new Promise(() => {});
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(fetchPromise));

    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    const root = createRoot(container);
    (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

    await act(async () => {
      root.render(<KhipuAgentSettingsCard />);
    });

    const loadingRegion = container.querySelector('[role="status"][aria-label="Cargando configuracion de Khipu Agente"]');
    expect(loadingRegion?.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(".animate-spin")).toBeFalsy();
  });

  it("shows OpenRouter configured badge by default", async () => {
    mockFetch({
      agentModel: DEFAULT_AGENT_MODEL,
      openrouterConfigured: true,
      geminiConfigured: false,
      aiProviderPreference: "auto",
    });

    const { getByText } = await renderCard();

    expect(getByText("API key de OpenRouter configurada")).toBeTruthy();
    expect(getByText("El Khipu Agente usará tu API key de OpenRouter para ejecutar tareas.")).toBeTruthy();
  });

  it("shows Gemini configured badge when a Google model is selected", async () => {
    const geminiModel = AGENT_MODELS.find((model) => model.provider === "google")?.id ?? DEFAULT_AGENT_MODEL;
    mockFetch({
      agentModel: geminiModel,
      openrouterConfigured: false,
      geminiConfigured: true,
      aiProviderPreference: "auto",
    });

    const { getByText } = await renderCard();

    expect(getByText("API key de Google Gemini API configurada")).toBeTruthy();
    expect(getByText("El Khipu Agente usará tu API key de Google Gemini API para ejecutar tareas.")).toBeTruthy();
  });

  it("collapses model list and shows selected model plus two alternatives by default", async () => {
    mockFetch({
      agentModel: DEFAULT_AGENT_MODEL,
      openrouterConfigured: true,
      geminiConfigured: false,
      aiProviderPreference: "auto",
    });

    const { container, queryByText } = await renderCard();

    const selectedModelLabel = AGENT_MODELS.find((model) => model.id === DEFAULT_AGENT_MODEL)?.label;
    expect(selectedModelLabel).toBeDefined();
    expect(queryByText(selectedModelLabel!)).toBeTruthy();

    const modelButtons = [...container.querySelectorAll("button")].filter((button) =>
      AGENT_MODELS.some((model) => button.textContent?.includes(model.label)),
    );
    expect(modelButtons.length).toBe(3);

    const collapsedCount = AGENT_MODELS.length - 3;
    expect(queryByText(`Ver ${collapsedCount} modelos más`)).toBeTruthy();
  });

  it("expands model list when clicking the toggle", async () => {
    mockFetch({
      agentModel: DEFAULT_AGENT_MODEL,
      openrouterConfigured: true,
      geminiConfigured: false,
      aiProviderPreference: "auto",
    });

    const { container, queryByText } = await renderCard();

    const toggle = [...container.querySelectorAll("button")].find((button) =>
      /Ver \d+ modelos m\u00e1s/.test(button.textContent ?? ""),
    );
    expect(toggle).toBeTruthy();

    await act(async () => {
      toggle!.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    const modelButtons = [...container.querySelectorAll("button")].filter((button) =>
      AGENT_MODELS.some((model) => button.textContent?.includes(model.label)),
    );
    expect(modelButtons.length).toBe(AGENT_MODELS.length);
    expect(queryByText("Ver menos modelos")).toBeTruthy();
  });

  it("selects a different model when clicked", async () => {
    mockFetch({
      agentModel: DEFAULT_AGENT_MODEL,
      openrouterConfigured: true,
      geminiConfigured: false,
      aiProviderPreference: "auto",
    });

    const { container } = await renderCard();

    // Expand the list so any model can be selected
    const toggle = [...container.querySelectorAll("button")].find((button) =>
      /Ver \d+ modelos m\u00e1s/.test(button.textContent ?? ""),
    );
    expect(toggle).toBeTruthy();

    await act(async () => {
      toggle!.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    const targetModel = AGENT_MODELS.find((model) => model.id !== DEFAULT_AGENT_MODEL);
    expect(targetModel).toBeDefined();

    const targetButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes(targetModel!.label),
    );
    expect(targetButton).toBeTruthy();

    await act(async () => {
      targetButton!.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    const selectedButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes(targetModel!.label),
    );
    expect(selectedButton?.getAttribute("aria-pressed")).toBe("true");
  });
});
