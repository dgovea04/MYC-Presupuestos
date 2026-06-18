/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;
let activeRoot: Root | null = null;

describe("useAiAssistantController", () => {
  afterEach(async () => {
    if (activeRoot) {
      await act(async () => {
        activeRoot?.unmount();
      });
    }
    activeRoot = null;
    activeContainer?.remove();
    activeContainer = null;
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("commits streamed chat text before the final event", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }

      if (String(input) === "/api/ai/chat/stream") {
        return new Response(
          "event: delta\ndata: {\"text\":\"Hola\"}\n\n" +
            "event: final\ndata: {\"answer\":\"Hola mundo\",\"model\":\"llama3\",\"requestedModel\":\"llama3\",\"fallbackUsed\":false,\"warnings\":[]}\n\n",
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }

      return new Response(JSON.stringify({ status: "ok", providers: {} }), { status: 200 });
    }));

    const result = await renderController({
      projectId: undefined,
      initialAction: "chat",
      initialContext: { module: "Presupuestos" },
    });

    await act(async () => {
      await result.current?.submit({
        action: "chat",
        payload: { message: "Explica la vista", context: { module: "Presupuestos" } },
      });
    });

    expect(result.current?.result?.answer).toContain("Hola mundo");
    expect(result.current?.history).toHaveLength(1);
  });

  it("routes cloud requests through /api/ai/execute", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(
          JSON.stringify({ openaiConfigured: true, geminiConfigured: true, openrouterConfigured: false }),
          { status: 200 },
        );
      }

      if (String(input) === "/api/ai/execute") {
        return new Response(
          JSON.stringify({
            answer: "Respuesta nube",
            model: "gpt-4.1-mini",
            requestedModel: "gpt-4.1-mini",
            fallbackUsed: false,
            warnings: [],
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected fetch ${String(input)} ${JSON.stringify(init)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await renderController({
      projectId: undefined,
      initialAction: "chat",
      initialContext: { module: "Presupuestos" },
    });

    await act(async () => {
      result.current?.setProvider("openai");
    });

    await act(async () => {
      await result.current?.submit({
        action: "chat",
        payload: { message: "Explica la vista", context: { module: "Presupuestos" } },
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/execute",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          provider: "openai",
          task: "chat",
          payload: { message: "Explica la vista", context: { module: "Presupuestos" } },
        }),
      }),
    );
    expect(result.current?.result?.answer).toBe("Respuesta nube");
  });

  it("routes openrouter requests through /api/ai/execute", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(
          JSON.stringify({ openaiConfigured: false, geminiConfigured: false, openrouterConfigured: true }),
          { status: 200 },
        );
      }

      if (String(input) === "/api/ai/execute") {
        return new Response(
          JSON.stringify({
            answer: "Respuesta openrouter",
            model: "openrouter/model",
            requestedModel: "openrouter/model",
            fallbackUsed: false,
            warnings: [],
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected fetch ${String(input)} ${JSON.stringify(init)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await renderController({
      projectId: undefined,
      initialAction: "chat",
      initialContext: { module: "Presupuestos" },
    });

    await act(async () => {
      result.current?.setProvider("openrouter");
    });

    await act(async () => {
      await result.current?.submit({
        action: "chat",
        payload: { message: "Explica la vista", context: { module: "Presupuestos" } },
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/execute",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          provider: "openrouter",
          task: "chat",
          payload: { message: "Explica la vista", context: { module: "Presupuestos" } },
        }),
      }),
    );
    expect(result.current?.result?.answer).toBe("Respuesta openrouter");
  });

  it("adds history entries for session mode responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }

      if (String(input) === "/api/ai/apu") {
        return new Response(
          JSON.stringify({
            answer: "APU sugerido",
            model: "llama3",
            requestedModel: "llama3",
            fallbackUsed: false,
            warnings: [],
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    }));

    const result = await renderController({
      projectId: undefined,
      initialAction: "apu",
      initialContext: { module: "APU", selectedItem: "Partida demo" },
    });

    await act(async () => {
      await result.current?.submit({
        action: "apu",
        payload: {
          description: "Partida demo",
          unit: "m2",
          context: { module: "APU", selectedItem: "Partida demo" },
        },
      });
    });

    expect(result.current?.history).toHaveLength(1);
    expect(result.current?.history[0]).toEqual(
      expect.objectContaining({
        action: "apu",
        summary: "Partida demo",
        context: { module: "APU", selectedItem: "Partida demo" },
      }),
    );
  });

  it("syncs context when the incoming initial context changes and the local context is still prop-driven", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await renderController({
      projectId: undefined,
      initialAction: "chat",
      initialContext: { module: "Presupuestos", selectedItem: "Partida 1" },
    });

    expect(result.current?.context).toEqual({ module: "Presupuestos", selectedItem: "Partida 1" });

    await result.rerender({
      projectId: undefined,
      initialAction: "chat",
      initialContext: { module: "APU", selectedItem: "Partida 2" },
    });

    expect(result.current?.context).toEqual({ module: "APU", selectedItem: "Partida 2" });
  });

});

async function renderController(
  props: React.ComponentProps<typeof TestHarness>["props"],
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let current: ReturnType<typeof useAiAssistantController> | null = null;

  activeContainer = container;
  activeRoot = root;

  await act(async () => {
    root.render(<TestHarness props={props} onChange={(value) => { current = value; }} />);
  });

  await act(async () => {
    await Promise.resolve();
  });

  return {
    get current() {
      return current;
    },
    rerender: async (nextProps: React.ComponentProps<typeof TestHarness>["props"]) => {
      await act(async () => {
        root.render(<TestHarness props={nextProps} onChange={(value) => { current = value; }} />);
      });

      await act(async () => {
        await Promise.resolve();
      });
    },
  };
}

function TestHarness({
  onChange,
  props,
}: {
  onChange: (value: ReturnType<typeof useAiAssistantController>) => void;
  props: {
    projectId?: string;
    initialAction: "chat" | "apu" | "review" | "autocomplete";
    initialContext: { module?: string; selectedItem?: string };
  };
}) {
  const controller = useAiAssistantController(props);
  onChange(controller);
  return null;
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
