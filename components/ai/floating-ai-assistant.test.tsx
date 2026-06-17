/* @vitest-environment jsdom */

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiViewContextProvider } from "@/components/ai/ai-view-context";
import { FloatingAiAssistant } from "@/components/ai/floating-ai-assistant";

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
});

async function renderFloatingAssistant() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  activeContainer = container;
  activeRoot = root;

  await act(async () => {
    root.render(
      <AiViewContextProvider>
        <FloatingAiAssistant open onOpenChange={() => undefined} />
      </AiViewContextProvider>,
    );
  });
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
