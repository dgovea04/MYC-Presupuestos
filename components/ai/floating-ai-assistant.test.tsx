/* @vitest-environment jsdom */

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiViewContextProvider, type AiViewContextValue } from "@/components/ai/ai-view-context";
import { FloatingAiAssistant } from "@/components/ai/floating-ai-assistant";
import { usePublishAiViewContext } from "@/hooks/use-ai-view-context";

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

      throw new Error(`Unexpected fetch ${String(input)}`);
    }));

    await renderFloatingAssistant();

    expect(document.body.textContent).toContain("Khipu");
    expect(document.body.textContent).toContain("Chat tecnico");
    expect(document.body.textContent).toContain("Sin contexto activo");
  });

  it("shows published active module and selection inside the compact panel", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
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
      getButtonByText("Enviar a Ollama").click();
    });

    expect(document.body.textContent).toContain("Respuesta proyecto uno");

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
      getButtonByText("Enviar a Ollama").click();
    });

    expect(document.body.textContent).toContain("Respuesta sesion");

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
      getButtonByText("Enviar a Ollama").click();
    });

    expect(document.body.textContent).toContain("Respuesta mismo proyecto");

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

function getButtonByText(text: string) {
  const element = [...document.body.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === text);

  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${text}`);
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
