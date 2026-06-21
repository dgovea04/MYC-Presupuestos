/* @vitest-environment jsdom */

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiViewContextProvider, type AiViewContextValue } from "@/components/ai/ai-view-context";
import { FloatingAiAssistant } from "@/components/ai/floating-ai-assistant";
import { usePublishAiViewContext } from "@/hooks/use-ai-view-context";

vi.mock("framer-motion", () => {
  const React = require("react");

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
    useReducedMotion: () => true,
  };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;
let activeRoot: Root | null = null;

describe("FloatingAiAssistant", () => {
  afterEach(async () => {
    if (activeRoot) {
      await act(async () => {
        activeRoot?.unmount();
      });
    }

    activeRoot = null;

    if (activeContainer) {
      activeContainer.remove();
    }

    activeContainer = null;
    document.body.innerHTML = "";
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the shared compact panel when open", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }

      if (String(input) === "/api/settings") {
        return new Response(JSON.stringify(settingsApiDefaultResponse()), { status: 200 });
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    }));

    await renderFloatingAssistant();

    expect(document.body.textContent).toContain("Khipu");
    expect(document.body.textContent).toContain("Chat tecnico");
    expect(document.body.textContent).toContain("Selecciona un presupuesto, partida o APU para que Khipu pueda analizarlo con contexto.");
  });

  it("shows published active module and selection inside the compact panel", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }

      if (String(input) === "/api/settings") {
        return new Response(JSON.stringify(settingsApiDefaultResponse()), { status: 200 });
      }

      if (String(input) === "/api/projects/project-1/ai-history") {
        return new Response(JSON.stringify({ entries: [] }), { status: 200 });
      }

      if (String(input) === "/api/projects/project-1/ai-feedback/summary") {
        return new Response(JSON.stringify({ summary: { applied: 0, edited: 0, dismissed: 0 } }), { status: 200 });
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    activeContainer = container;
    activeRoot = root;

    await act(async () => {
      root.render(
        <AiViewContextProvider>
          <PublishBudgetContext />
          <FloatingAiAssistant open onOpenChange={() => undefined} />
        </AiViewContextProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Presupuesto");
    expect(container.textContent).toContain("Acero corrugado");
  });

  it("uses the active view context project id and updates visible context when the view changes", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }

      if (String(input) === "/api/settings") {
        return new Response(JSON.stringify(settingsApiDefaultResponse()), { status: 200 });
      }

      if (String(input) === "/api/projects/project-1/ai-history") {
        return new Response(JSON.stringify({ entries: [] }), { status: 200 });
      }

      if (String(input) === "/api/projects/project-1/ai-feedback/summary") {
        return new Response(JSON.stringify({ summary: { applied: 0, edited: 0, dismissed: 0 } }), { status: 200 });
      }

      if (String(input) === "/api/projects/project-2/ai-history") {
        return new Response(JSON.stringify({ entries: [] }), { status: 200 });
      }

      if (String(input) === "/api/projects/project-2/ai-feedback/summary") {
        return new Response(JSON.stringify({ summary: { applied: 0, edited: 0, dismissed: 0 } }), { status: 200 });
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const rendered = await renderFloatingAssistant({
      projectId: "project-1",
      module: "Presupuestos",
      selectedItem: "Partida 1",
    });

    expect(document.body.textContent).toContain("Presupuestos");
    expect(document.body.textContent).toContain("Partida 1");
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/ai-history");
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/ai-feedback/summary");

    await rendered.rerender({
      projectId: "project-2",
      module: "Cronograma",
      selectedItem: "Partida 2",
    });

    expect(document.body.textContent).toContain("Cronograma");
    expect(document.body.textContent).toContain("Partida 2");
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-2/ai-history");
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-2/ai-feedback/summary");
  });

  it("clears stale project result state when the active project changes", async () => {
    vi.stubGlobal("fetch", createStreamingAssistantFetchMock("Respuesta proyecto uno"));

    const rendered = await renderFloatingAssistant({
      projectId: "project-1",
      module: "Presupuestos",
      selectedItem: "Partida 1",
    });

    await act(async () => {
      getButtonByAriaLabel("Enviar consulta").click();
    });

    // Clear localStorage so stale history doesn't persist across view changes
    window.localStorage.clear();

    await rendered.rerender({
      projectId: "project-2",
      module: "Cronograma",
      selectedItem: "Partida 2",
    });

    expect(document.body.textContent).not.toContain("Respuesta proyecto uno");
    expect(document.body.textContent).toContain("Cronograma");
    expect(document.body.textContent).toContain("Partida 2");
  });

  it("clears stale result state when a session view changes without a project id", async () => {
    vi.stubGlobal("fetch", createStreamingAssistantFetchMock("Respuesta sesion"));

    const rendered = await renderFloatingAssistant({
      module: "Presupuestos",
      selectedItem: "Partida 1",
    });

    await act(async () => {
      getButtonByAriaLabel("Enviar consulta").click();
    });

    // Clear localStorage so stale history doesn't persist across view changes
    window.localStorage.clear();

    await rendered.rerender({
      module: "Cronograma",
      selectedItem: "Partida 2",
    });

    expect(document.body.textContent).not.toContain("Respuesta sesion");
    expect(document.body.textContent).toContain("Cronograma");
    expect(document.body.textContent).toContain("Partida 2");
  });

  it("clears stale result state when the context changes within the same project", async () => {
    vi.stubGlobal("fetch", createStreamingAssistantFetchMock("Respuesta mismo proyecto"));

    const rendered = await renderFloatingAssistant({
      projectId: "project-1",
      module: "Presupuestos",
      selectedItem: "Partida 1",
    });

    await act(async () => {
      getButtonByAriaLabel("Enviar consulta").click();
    });

    // Clear localStorage so stale history doesn't persist across view changes
    window.localStorage.clear();

    await rendered.rerender({
      projectId: "project-1",
      module: "Presupuestos",
      selectedItem: "Partida 2",
    });

    expect(document.body.textContent).not.toContain("Respuesta mismo proyecto");
    expect(document.body.textContent).toContain("Presupuestos");
    expect(document.body.textContent).toContain("Partida 2");
  });
});

async function renderFloatingAssistant(value: AiViewContextValue = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  activeContainer = container;
  activeRoot = root;

  await act(async () => {
    root.render(
      <AiViewContextProvider value={value}>
        <FloatingAiAssistant open onOpenChange={() => undefined} />
      </AiViewContextProvider>,
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  return {
    rerender: async (nextValue: AiViewContextValue) => {
      await act(async () => {
        root.render(
          <AiViewContextProvider value={nextValue}>
            <FloatingAiAssistant open onOpenChange={() => undefined} />
          </AiViewContextProvider>,
        );
      });

      await act(async () => {
        await Promise.resolve();
      });
    },
  };
}

function createHealthPayload() {
  return {
    status: "ok",
    ollamaReachable: true,
    availableModels: ["llama3"],
    requiredModels: [{ model: "llama3", installed: true, actions: ["chat", "apu", "review", "autocomplete"] }],
    actions: {
      chat: { model: "llama3", requestedModel: "llama3", fallbackUsed: false, warnings: [] },
      apu: { model: "llama3", requestedModel: "llama3", fallbackUsed: false, warnings: [] },
      review: { model: "llama3", requestedModel: "llama3", fallbackUsed: false, warnings: [] },
      autocomplete: { model: "llama3", requestedModel: "llama3", fallbackUsed: false, warnings: [] },
    },
    metrics: {
      chat: { latencyMs: null, lastError: null },
      apu: { latencyMs: null, lastError: null },
      review: { latencyMs: null, lastError: null },
      autocomplete: { latencyMs: null, lastError: null },
    },
    providers: {
      ollama: { configured: true, reachable: true },
      chatgpt_bridge: { configured: true, reachable: true },
      openai: { configured: false, reachable: null },
      gemini: { configured: false, reachable: null },
      openrouter: { configured: false, reachable: null },
    },
  };
}

function createStreamingAssistantFetchMock(answer: string) {
  return vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === "/api/ai/health") {
      return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
    }

    if (String(input) === "/api/settings/ai-provider") {
      return new Response(JSON.stringify({}), { status: 200 });
    }

    if (String(input) === "/api/settings") {
      return new Response(JSON.stringify(settingsApiDefaultResponse()), { status: 200 });
    }

    if (
      String(input) === "/api/projects/project-1/ai-history" ||
      String(input) === "/api/projects/project-2/ai-history"
    ) {
      return new Response(JSON.stringify({ entries: [] }), { status: 200 });
    }

    if (
      String(input) === "/api/projects/project-1/ai-feedback/summary" ||
      String(input) === "/api/projects/project-2/ai-feedback/summary"
    ) {
      return new Response(JSON.stringify({ summary: { applied: 0, edited: 0, dismissed: 0 } }), { status: 200 });
    }

    if (String(input) === "/api/ai/chat/stream") {
      return new Response(
        `event: final\ndata: {"answer":"${answer}","model":"llama3","requestedModel":"llama3","fallbackUsed":false,"warnings":[]}\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }

    throw new Error(`Unexpected fetch ${String(input)}`);
  });
}

function getButtonByAriaLabel(label: string) {
  const element = document.body.querySelector(`button[aria-label="${label}"]`);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${label}`);
  }
  return element;
}

function PublishBudgetContext() {
  usePublishAiViewContext({
    route: "/budgets/budget-1",
    projectId: "project-1",
    budgetId: "budget-1",
    module: "Presupuesto",
    activeTable: "Partidas",
    selectedItem: "Acero corrugado",
    selectionType: "partida",
    selectionId: "partida-1",
    viewSummary: "Partida activa: Acero corrugado",
  });

  return null;
}

// ─── Settings consumption mocks ──────────────────────────────────

const { formattingSettingsMock, resetFormattingSettings } = vi.hoisted(() => {
  let currentSettings = createFixedFormattingSettings();

  return {
    formattingSettingsMock: () => currentSettings,
    resetFormattingSettings: (overrides: Record<string, unknown> = {}) => {
      currentSettings = { ...createFixedFormattingSettings(), ...overrides };
    },
  };
});

vi.mock("@/components/providers/formatting-settings-provider", () => ({
  useFormattingSettings: () => formattingSettingsMock(),
  FormattingSettingsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function createFixedFormattingSettings() {
  return {
    defaultCurrency: "PEN" as const,
    currencyDecimals: 2,
    dateFormat: "DD_MMM_YYYY" as const,
    defaultViewMode: "modern" as const,
    excelShowFieldBorders: true,
    excelRowHeight: 52,
    defaultIgvRate: 0.18,
    defaultGeneralExpensesRate: 0.1,
    defaultUtilityRate: 0.08,
    defaultSubBudgetNames: ["Estructuras"],
    aiProviderPreference: "auto" as const,
    floatingKhipuProvider: "ollama" as const,
    floatingKhipuWidth: 600,
    floatingKhipuHeight: 500,
    floatingKhipuFontSize: "normal" as const,
    floatingKhipuPosition: "bottom-right" as const,
    floatingKhipuTheme: "light" as const,
  };
}

/** Default settings returned by the /api/settings GET endpoint in tests.
 *  Returns the CURRENT mock value so the fetch doesn't overwrite
 *  what resetFormattingSettings configured. */
function settingsApiDefaultResponse() {
  return formattingSettingsMock();
}

// ─── Settings consumption tests ─────────────────────────────────

describe("FloatingAiAssistant settings consumption", () => {
  beforeEach(() => {
    resetFormattingSettings();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }
      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (String(input) === "/api/settings") {
        return new Response(JSON.stringify(settingsApiDefaultResponse()), { status: 200 });
      }
      throw new Error(`Unexpected fetch ${String(input)}`);
    }));
  });

  afterEach(async () => {
    if (activeRoot) {
      await act(async () => {
        activeRoot?.unmount();
      });
    }
    activeRoot = null;
    if (activeContainer) {
      activeContainer.remove();
    }
    activeContainer = null;
    document.body.innerHTML = "";
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("applies position style from settings to the container", async () => {
    resetFormattingSettings({ floatingKhipuPosition: "top-left" });
    await renderFloatingAssistant();

    const panel = document.querySelector('[data-khipu-panel]') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.style.left).toBe("1.25rem");
    expect(panel.style.top).toBe("1.25rem");
  });

  it("uses bottom-right position from settings", async () => {
    resetFormattingSettings({ floatingKhipuPosition: "bottom-right" });
    await renderFloatingAssistant();

    const panel = document.querySelector('[data-khipu-panel]') as HTMLElement;
    expect(panel.style.right).toBe("1.25rem");
    expect(panel.style.bottom).toBe("1.25rem");
  });

  it("uses top-right position from settings", async () => {
    resetFormattingSettings({ floatingKhipuPosition: "top-right" });
    await renderFloatingAssistant();

    const panel = document.querySelector('[data-khipu-panel]') as HTMLElement;
    expect(panel.style.right).toBe("1.25rem");
    expect(panel.style.top).toBe("1.25rem");
    expect(panel.style.bottom).toBe("");
  });

  it("uses bottom-left position from settings", async () => {
    resetFormattingSettings({ floatingKhipuPosition: "bottom-left" });
    await renderFloatingAssistant();

    const panel = document.querySelector('[data-khipu-panel]') as HTMLElement;
    expect(panel.style.left).toBe("1.25rem");
    expect(panel.style.bottom).toBe("1.25rem");
  });

  it("passes floatingKhipuProvider as initialProvider to controller", async () => {
    const controllerModule = await import(
      "@/components/ai/use-ai-assistant-controller"
    );
    const controllerSpy = vi.spyOn(controllerModule, "useAiAssistantController");

    resetFormattingSettings({ floatingKhipuProvider: "openai" });
    await renderFloatingAssistant();

    const initialProviderCall = controllerSpy.mock.calls.find(
      (c) => (c[0] as Record<string, unknown>)?.initialProvider === "openai",
    );
    expect(initialProviderCall).toBeTruthy();
  });

  it("passes ollama as default initialProvider to controller", async () => {
    const controllerModule = await import(
      "@/components/ai/use-ai-assistant-controller"
    );
    const controllerSpy = vi.spyOn(controllerModule, "useAiAssistantController");

    resetFormattingSettings({ floatingKhipuProvider: "ollama" });
    await renderFloatingAssistant();

    const initialProviderCall = controllerSpy.mock.calls.find(
      (c) => (c[0] as Record<string, unknown>)?.initialProvider === "ollama",
    );
    expect(initialProviderCall).toBeTruthy();
  });

  it("applies compact fontSizeClass to KhipuChatPanel body", async () => {
    resetFormattingSettings({ floatingKhipuFontSize: "compact" });
    await renderFloatingAssistant();

    // The KhipuChatPanel applies fontSizeClass to its body div
    const bodyDiv = document.querySelector('[class*="overflow-y-auto"]');
    expect(bodyDiv).toBeTruthy();
    expect(bodyDiv!.className).toContain("text-[11px]");
  });

  it("applies large fontSizeClass to KhipuChatPanel body", async () => {
    resetFormattingSettings({ floatingKhipuFontSize: "large" });
    await renderFloatingAssistant();

    const bodyDiv = document.querySelector('[class*="overflow-y-auto"]');
    expect(bodyDiv).toBeTruthy();
    expect(bodyDiv!.className).toContain("text-base");
  });

  it("applies normal (default) fontSizeClass to KhipuChatPanel body", async () => {
    resetFormattingSettings({ floatingKhipuFontSize: "normal" });
    await renderFloatingAssistant();

    const bodyDiv = document.querySelector('[class*="overflow-y-auto"]');
    expect(bodyDiv).toBeTruthy();
    expect(bodyDiv!.className).toContain("text-sm");
  });

  it("renders with custom panel size without crashing", async () => {
    resetFormattingSettings({
      floatingKhipuWidth: 400,
      floatingKhipuHeight: 350,
    });
    await renderFloatingAssistant();

    expect(document.body.textContent).toContain("Khipu");
    expect(document.body.textContent).toContain("Chat tecnico");
  });

  it("applies light theme to KhipuChatPanel by default", async () => {
    resetFormattingSettings({ floatingKhipuTheme: "light" });
    await renderFloatingAssistant();

    // Light theme: white bg with light border
    const panel = document.querySelector('[class*="rounded-3xl"]');
    expect(panel).toBeTruthy();
    expect(panel!.className).toContain("bg-white");
    expect(panel!.className).toContain("border-slate-200");
  });

  it("applies dark theme to KhipuChatPanel when theme is dark", async () => {
    resetFormattingSettings({ floatingKhipuTheme: "dark" });
    await renderFloatingAssistant();

    // Dark theme: dark bg with dark border
    const panel = document.querySelector('[class*="rounded-3xl"]');
    expect(panel).toBeTruthy();
    expect(panel!.className).toContain("bg-slate-900");
    expect(panel!.className).toContain("border-slate-700");
  });

  it("reads theme from initial /api/settings fetch on mount, overriding context defaults", async () => {
    // Context says light (default), but API returns dark
    resetFormattingSettings({ floatingKhipuTheme: "light" });
    // Override the /api/settings mock to return dark theme
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }
      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (String(input) === "/api/settings") {
        return new Response(JSON.stringify({ ...settingsApiDefaultResponse(), floatingKhipuTheme: "dark" }), { status: 200 });
      }
      throw new Error(`Unexpected fetch ${String(input)}`);
    }));

    await renderFloatingAssistant();

    // Should show dark theme from the API response, not the context "light" default
    const panel = document.querySelector('[class*="rounded-3xl"]');
    expect(panel).toBeTruthy();
    expect(panel!.className).toContain("bg-slate-900");
    expect(panel!.className).toContain("border-slate-700");
  });

  // ─── localStorage theme persistence tests ───────────────────

  it("reads dark theme from localStorage on mount, overriding settings default", async () => {
    // Simulate a prior toggle choice persisted in localStorage
    window.localStorage.setItem("myc-khipu-theme", "dark");
    // Settings still say "light"
    resetFormattingSettings({ floatingKhipuTheme: "light" });

    await renderFloatingAssistant();

    const panel = document.querySelector('[class*="rounded-3xl"]');
    expect(panel).toBeTruthy();
    expect(panel!.className).toContain("bg-slate-900");
  });

  it("reads light theme from localStorage on mount", async () => {
    window.localStorage.setItem("myc-khipu-theme", "light");
    resetFormattingSettings({ floatingKhipuTheme: "dark" });

    await renderFloatingAssistant();

    const panel = document.querySelector('[class*="rounded-3xl"]');
    expect(panel).toBeTruthy();
    expect(panel!.className).toContain("bg-white");
  });

  it("falls back to settings when localStorage value is invalid", async () => {
    window.localStorage.setItem("myc-khipu-theme", "blue");
    resetFormattingSettings({ floatingKhipuTheme: "dark" });

    await renderFloatingAssistant();

    const panel = document.querySelector('[class*="rounded-3xl"]');
    expect(panel).toBeTruthy();
    // Invalid "blue" is ignored, settings "dark" is used
    expect(panel!.className).toContain("bg-slate-900");
  });

  it("falls back to settings when localStorage is empty", async () => {
    // No localStorage preset
    resetFormattingSettings({ floatingKhipuTheme: "light" });

    await renderFloatingAssistant();

    const panel = document.querySelector('[class*="rounded-3xl"]');
    expect(panel).toBeTruthy();
    expect(panel!.className).toContain("bg-white");
  });

  it("writes to localStorage when theme toggle is clicked", async () => {
    resetFormattingSettings({ floatingKhipuTheme: "light" });

    await renderFloatingAssistant();

    // Click the theme toggle button (light → dark)
    const toggle = document.querySelector('[aria-label="Cambiar a tema oscuro"]') as HTMLButtonElement;
    expect(toggle).toBeTruthy();

    await act(async () => toggle.click());

    expect(window.localStorage.getItem("myc-khipu-theme")).toBe("dark");
  });

  it("clears localStorage and updates panel when settings change via CustomEvent after mount", async () => {
    // localStorage says dark, settings say light — mount uses localStorage (dark)
    window.localStorage.setItem("myc-khipu-theme", "dark");
    resetFormattingSettings({ floatingKhipuTheme: "light" });

    await renderFloatingAssistant();

    // Panel is dark from localStorage
    let panel = document.querySelector('[class*="rounded-3xl"]');
    expect(panel!.className).toContain("bg-slate-900");
    expect(window.localStorage.getItem("myc-khipu-theme")).toBe("dark");

    // Simulate settings page saving dark theme → dispatches CustomEvent
    // (this mirrors what SettingsPageContent does after saving via PATCH /api/settings)
    await act(async () => {
      window.dispatchEvent(new CustomEvent("khipu-settings-changed", { detail: { floatingKhipuTheme: "dark" } }));
      await Promise.resolve();
    });

    // Panel stays dark (was already dark from localStorage, now settings confirm dark)
    // but localStorage was cleared — settings now own the theme
    panel = document.querySelector('[class*="rounded-3xl"]');
    expect(panel!.className).toContain("bg-slate-900");
    expect(window.localStorage.getItem("myc-khipu-theme")).toBeNull();
  });

  // ─── CustomEvent updates non-theme Khipu props ──────────────

  it("applies fontSize from CustomEvent after mount", async () => {
    resetFormattingSettings({ floatingKhipuFontSize: "normal" });
    await renderFloatingAssistant();

    // Default: normal → text-sm
    let bodyDiv = document.querySelector('[class*="overflow-y-auto"]');
    expect(bodyDiv!.className).toContain("text-sm");

    // Dispatch CustomEvent changing font size to compact
    await act(async () => {
      window.dispatchEvent(new CustomEvent("khipu-settings-changed", { detail: { floatingKhipuFontSize: "compact" } }));
      await Promise.resolve();
    });

    bodyDiv = document.querySelector('[class*="overflow-y-auto"]');
    expect(bodyDiv!.className).toContain("text-[11px]");
  });

  it("applies position from CustomEvent after mount", async () => {
    resetFormattingSettings({ floatingKhipuPosition: "bottom-right" });
    await renderFloatingAssistant();

    // Default: bottom-right
    let panel = document.querySelector('[data-khipu-panel]') as HTMLElement;
    expect(panel.style.right).toBe("1.25rem");
    expect(panel.style.bottom).toBe("1.25rem");

    // Dispatch CustomEvent changing position to top-left
    await act(async () => {
      window.dispatchEvent(new CustomEvent("khipu-settings-changed", { detail: { floatingKhipuPosition: "top-left" } }));
      await Promise.resolve();
    });

    panel = document.querySelector('[data-khipu-panel]') as HTMLElement;
    expect(panel.style.left).toBe("1.25rem");
    expect(panel.style.top).toBe("1.25rem");
    expect(panel.style.right).toBe("");
    expect(panel.style.bottom).toBe("");
  });

  it("passes updated provider from CustomEvent to controller after mount", async () => {
    resetFormattingSettings({ floatingKhipuProvider: "ollama" });

    const controllerModule = await import(
      "@/components/ai/use-ai-assistant-controller"
    );
    const controllerSpy = vi.spyOn(controllerModule, "useAiAssistantController");

    await renderFloatingAssistant();

    // Mounted with ollama
    expect(controllerSpy).toHaveBeenCalled();
    const lastCallBefore = controllerSpy.mock.calls[controllerSpy.mock.calls.length - 1];
    expect((lastCallBefore[0] as Record<string, unknown>).initialProvider).toBe("ollama");

    // Dispatch CustomEvent changing provider to openai
    await act(async () => {
      window.dispatchEvent(new CustomEvent("khipu-settings-changed", { detail: { floatingKhipuProvider: "openai" } }));
      await Promise.resolve();
    });

    // The controller should have been called again with the updated provider
    const lastCall = controllerSpy.mock.calls[controllerSpy.mock.calls.length - 1];
    expect((lastCall[0] as Record<string, unknown>).initialProvider).toBe("openai");
  });

  it("ignores non-Khipu fields in CustomEvent, keeping existing Khipu values intact", async () => {
    resetFormattingSettings({
      floatingKhipuPosition: "bottom-right",
      floatingKhipuFontSize: "normal",
    });
    await renderFloatingAssistant();

    // Baseline: bottom-right position and normal font size
    let panel = document.querySelector('[data-khipu-panel]') as HTMLElement;
    expect(panel.style.right).toBe("1.25rem");
    expect(panel.style.bottom).toBe("1.25rem");
    let bodyDiv = document.querySelector('[class*="overflow-y-auto"]');
    expect(bodyDiv!.className).toContain("text-sm");

    // Dispatch a CustomEvent with ONLY general (non-Khipu) fields —
    // the same payload that UserSettingsForm would send after saving.
    await act(async () => {
      window.dispatchEvent(new CustomEvent("khipu-settings-changed", {
        detail: {
          defaultCurrency: "USD",
          currencyDecimals: 3,
          dateFormat: "DD_MM_YYYY",
          defaultViewMode: "excel",
          excelShowFieldBorders: false,
          excelRowHeight: 40,
          defaultIgvRate: 0.16,
          defaultGeneralExpensesRate: 0.12,
          defaultUtilityRate: 0.05,
          defaultSubBudgetNames: ["Otro"],
          aiProviderPreference: "gemini",
        },
      }));
      await Promise.resolve();
    });

    // Position and fontSize must remain unchanged — mergeKhipuFields
    // should have ignored all non-Khipu fields.
    panel = document.querySelector('[data-khipu-panel]') as HTMLElement;
    expect(panel.style.right).toBe("1.25rem");
    expect(panel.style.bottom).toBe("1.25rem");
    bodyDiv = document.querySelector('[class*="overflow-y-auto"]');
    expect(bodyDiv!.className).toContain("text-sm");
  });

  // ─── CSS transition tests ───────────────────────────────────

  it("FloatingContextSummary container has transition-colors and duration-300", async () => {
    await renderFloatingAssistant();

    // The container is the first element with rounded-2xl (the overlay also has it, but comes after)
    const summaryDiv = document.querySelector('[class*="rounded-2xl"]');
    expect(summaryDiv).toBeTruthy();
    expect(summaryDiv!.className).toContain("transition-colors");
    expect(summaryDiv!.className).toContain("duration-300");
  });

  it("dark overlay has opacity-0 when theme is light", async () => {
    resetFormattingSettings({ floatingKhipuTheme: "light" });
    await renderFloatingAssistant();

    const overlay = document.querySelector('[class*="rounded-2xl"][class*="absolute"]');
    expect(overlay).toBeTruthy();
    expect(overlay!.className).toContain("opacity-0");
  });

  it("dark overlay has opacity-100 when theme is dark", async () => {
    resetFormattingSettings({ floatingKhipuTheme: "dark" });
    await renderFloatingAssistant();

    const overlay = document.querySelector('[class*="rounded-2xl"][class*="absolute"]');
    expect(overlay).toBeTruthy();
    expect(overlay!.className).toContain("opacity-100");
  });

  it("FloatingContextSummary dark overlay has transition-opacity", async () => {
    await renderFloatingAssistant();

    // The overlay is uniquely identifiable by the combination of rounded-2xl + absolute positioning
    const overlay = document.querySelector('[class*="rounded-2xl"][class*="absolute"]');
    expect(overlay).toBeTruthy();
    expect(overlay!.className).toContain("transition-opacity");
    expect(overlay!.className).toContain("duration-300");
  });

  it("FloatingContextSummary paragraphs have transition-colors and duration-300", async () => {
    await renderFloatingAssistant();

    // Find the summary container, then its <p> children
    const summaryDiv = document.querySelector('[class*="rounded-2xl"]');
    expect(summaryDiv).toBeTruthy();

    const paragraphs = summaryDiv!.querySelectorAll("p");
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);

    for (const p of paragraphs) {
      expect(p.className).toContain("transition-colors");
      expect(p.className).toContain("duration-300");
    }
  });
});
