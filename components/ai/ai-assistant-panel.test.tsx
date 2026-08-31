/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import type { AiAssistantControllerViewModel } from "@/components/ai/use-ai-assistant-controller";
import { KhipuActionRegistryProvider } from "@/components/ai/khipu-action-registry";
import type { AiAutocompletePartidaSuggestion } from "@/lib/ai/types";

vi.mock("framer-motion", () => {
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    motion: new Proxy(
      {},
      {
        get:
          (_target: unknown, prop: string) =>
          (props: Record<string, unknown>) => {
            const elementType = prop === "button" ? "button" : "div";
            return React.createElement(elementType, props);
          },
      },
    ),
  };
});

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HISTORY_STORAGE_KEY = "myc-khipu-history-collapsed";

let activeContainer: HTMLDivElement | null = null;

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

function createHistoryEntry(id: string, answer: string) {
  return {
    id,
    action: "chat" as const,
    summary: `Consulta ${id}`,
    context: {},
    result: {
      answer,
      model: "llama3.1",
      requestedModel: "llama3.1",
      fallbackUsed: false,
      warnings: [],
    },
    timestamp: new Date().toISOString(),
  };
}

function createMockController(
  overrides: Partial<AiAssistantControllerViewModel> = {},
): AiAssistantControllerViewModel {
  return {
    activeAction: "chat",
    activeFeedbackEntry: null,
    bridgeState: null,
    clearHistory: vi.fn(),
    cloudConfigured: { openai: false, gemini: false, openrouter: false },
    context: {},
    error: "",
    feedbackByHistoryId: {},
    feedbackError: "",
    feedbackSummary: { applied: 0, edited: 0, dismissed: 0 },
    health: null,
    history: [
      createHistoryEntry("e1", "Respuesta uno."),
      createHistoryEntry("e2", "Respuesta dos."),
    ],
    lastRequest: null,
    loading: false,
    pendingFeedbackByHistoryId: {},
    provider: "ollama",
    refreshHealth: vi.fn(),
    result: null,
    retryLastRequest: vi.fn(),
    selectHistoryEntry: vi.fn(),
    setActiveAction: vi.fn(),
    setContext: vi.fn(),
    setProvider: vi.fn(),
    streaming: false,
    submit: vi.fn(),
    submitFeedback: vi.fn(),
    ...overrides,
  };
}

async function renderPanel(props: Partial<React.ComponentProps<typeof AiAssistantPanel>> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(        <KhipuActionRegistryProvider>
          <AiAssistantPanel
            controller={createMockController()}
            layout="floating"
            {...props}
          />
        </KhipuActionRegistryProvider>,
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  return {
    container,
    getByText: (text: string) => {
      const element = [...container.querySelectorAll("*")].find(
        (candidate) => candidate.textContent?.trim() === text,
      );
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing text: ${text}`);
      }
      return element;
    },
    getButtonByAriaLabel: (label: string) => {
      const element = container.querySelector(`button[aria-label="${label}"]`);
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button aria-label: ${label}`);
      }
      return element;
    },
  };
}

describe("AiAssistantPanel autocomplete actions", () => {
  it("opens the partida form with the structured suggestion", async () => {
    const suggestion: AiAutocompletePartidaSuggestion = {
      description: "Acero corrugado fy = 4200 kg/cm² de Ø 1/2” para columnas",
      unit: "kg",
      matchType: "new",
      missingFields: ["Metrado"],
    };
    const onOpenPartidaForm = vi.fn();
    const controller = createMockController({
      result: {
        answer: suggestion.description,
        model: "test",
        requestedModel: "test",
        fallbackUsed: false,
        warnings: [],
        structuredData: {
          answer: suggestion.description,
          input: "fierro 1/2 columnas",
          suggestion,
          alternatives: [],
          assumptions: [],
          requiresHumanReview: true,
        },
      },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    const root = createRoot(container);
    (container as HTMLDivElement & { __root?: typeof root }).__root = root;
    await act(async () => root.render(<KhipuActionRegistryProvider onOpenPartidaForm={onOpenPartidaForm}><AiAssistantPanel controller={controller} layout="page" /></KhipuActionRegistryProvider>));
    const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes("Crear partida"));
    expect(button).toBeTruthy();
    await act(async () => (button as HTMLButtonElement).click());
    expect(onOpenPartidaForm).toHaveBeenCalledWith(suggestion);
  });
});

describe("AiAssistantPanel history collapse", () => {
  describe("floating layout", () => {
    it("does not render inline ChatHistory in floating layout (history is accessed via header button)", async () => {
      const { container } = await renderPanel({ layout: "floating" });

      // History entries should NOT appear inline — they're only in the header button overlay
      expect(container.textContent).not.toContain("Consulta e1");
      expect(container.textContent).not.toContain("Respuesta uno.");
      // The collapse toggle button "Historial" should not exist
      expect(container.textContent).not.toContain("Historial");
    });

    it("shows ChatHistory when showHistory prop is true", async () => {
      const { container } = await renderPanel({ layout: "floating", showHistory: true });

      // In history-only view, entries should appear
      expect(container.textContent).toContain("Consulta e1");
      expect(container.textContent).toContain("Respuesta uno.");
      // Clear history button should be present (trash icon, confirm text only on click)
      const clearButton = container.querySelector('button[aria-label="Limpiar historial"]');
      expect(clearButton).toBeTruthy();
    });
  });

  describe("page layout", () => {
    it("shows ChatHistory by default in page layout", async () => {
      const { container } = await renderPanel({ layout: "page" });

      expect(container.textContent).toContain("Actividad reciente de Khipu");
      expect(container.textContent).toContain("Consulta e1");
      expect(container.textContent).toContain("Respuesta uno.");
    });

    it("hides ChatHistory when chevron toggle is clicked in page layout", async () => {
      const { container, getButtonByAriaLabel } = await renderPanel({ layout: "page" });

      await act(async () => {
        getButtonByAriaLabel("Colapsar historial").click();
      });

      // ChatHistory should be hidden, heading still visible
      expect(container.textContent).toContain("Actividad reciente de Khipu");
      expect(container.textContent).not.toContain("Consulta e1");
      expect(container.textContent).not.toContain("Respuesta uno.");
    });

    it("updates aria-label when toggled", async () => {
      const { getButtonByAriaLabel } = await renderPanel({ layout: "page" });

      await act(async () => {
        getButtonByAriaLabel("Colapsar historial").click();
      });

      const collapsedButton = getButtonByAriaLabel("Expandir historial");
      expect(collapsedButton).toBeTruthy();
    });
  });

  describe("localStorage persistence", () => {
    it("starts collapsed when localStorage has collapsed=true in page layout", async () => {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, "true");

      const { container } = await renderPanel({ layout: "page" });

      // Heading visible, chat hidden
      expect(container.textContent).toContain("Actividad reciente de Khipu");
      expect(container.textContent).not.toContain("Consulta e1");
    });

    it("starts expanded when localStorage is empty or false in page layout", async () => {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, "false");

      const { container } = await renderPanel({ layout: "page" });

      expect(container.textContent).toContain("Consulta e1");
    });

    it("persists collapsed state to localStorage on toggle in page layout", async () => {
      const { getButtonByAriaLabel } = await renderPanel({ layout: "page" });

      await act(async () => {
        getButtonByAriaLabel("Colapsar historial").click();
      });

      expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toBe("true");
    });
  });

  describe("clear history confirmation", () => {
    it("shows confirmation when Trash2 button is clicked in page layout", async () => {
      const { container, getButtonByAriaLabel } = await renderPanel({ layout: "page" });

      expect(container.textContent).not.toContain("¿Limpiar historial?");

      await act(async () => {
        getButtonByAriaLabel("Limpiar historial").click();
      });

      expect(container.textContent).toContain("¿Limpiar historial?");
    });

    it("calls clearHistory when Limpiar is clicked in page layout", async () => {
      const clearHistory = vi.fn();
      const controller = createMockController({ clearHistory });
      const { getButtonByAriaLabel, getByText } = await renderPanel({
        controller,
        layout: "page",
      });

      await act(async () => {
        getButtonByAriaLabel("Limpiar historial").click();
      });

      await act(async () => {
        getByText("Limpiar").click();
      });

      expect(clearHistory).toHaveBeenCalledTimes(1);
    });

    it("hides confirmation when Cancelar is clicked in page layout", async () => {
      const { container, getButtonByAriaLabel } = await renderPanel({ layout: "page" });

      await act(async () => {
        getButtonByAriaLabel("Limpiar historial").click();
      });

      expect(container.textContent).toContain("¿Limpiar historial?");

      const cancelButton = [...container.querySelectorAll("button")].find(
        (btn) => btn.textContent?.trim() === "Cancelar",
      );
      await act(async () => {
        (cancelButton as HTMLButtonElement).click();
      });

      expect(container.textContent).not.toContain("¿Limpiar historial?");
      expect(getButtonByAriaLabel("Limpiar historial")).toBeTruthy();
    });
  });
});
