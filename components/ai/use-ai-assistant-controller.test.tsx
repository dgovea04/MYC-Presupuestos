/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";
import type { AiHistoryEntry } from "@/components/ai/use-ai-assistant-controller";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

describe("useAiAssistantController", () => {
  afterEach(async () => {
    for (const entry of [...activeRoots].reverse()) {
      await act(async () => {
        entry.root.unmount();
      });
      entry.container.remove();
    }
    activeRoots = [];
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

  it("streams agent request with modelPreference in body", async () => {
    let capturedBody: Record<string, unknown> | null = null;

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }

      if (String(input) === "/api/ai/chat/stream") {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          "event: delta\ndata: {\"text\":\"Iniciando...\"}\n\n" +
            "event: final\ndata: {\"answer\":\"Analisis completo\",\"model\":\"gpt-4o\",\"requestedModel\":\"gpt-4o\",\"fallbackUsed\":false,\"warnings\":[]}\n\n",
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

    // Set agent provider and model
    await act(async () => {
      result.current?.setProvider("agent");
      result.current?.setAgentModel("openai/gpt-4o");
    });

    await act(async () => {
      await result.current?.submit({
        action: "chat",
        payload: { message: "Analiza este presupuesto", context: { module: "Presupuestos" } },
      });
    });

    // Verify the streaming body includes modelPreference
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.provider).toBe("agent");
    expect(capturedBody!.modelPreference).toBe("openai/gpt-4o");
    expect(capturedBody!.message).toBe("Analiza este presupuesto");

    // Verify the result is streamed back
    expect(result.current?.result?.answer).toBe("Analisis completo");
    expect(result.current?.result?.model).toBe("gpt-4o");
  });

  it("does not include modelPreference when streaming with non-agent provider", async () => {
    let capturedBody: Record<string, unknown> | null = null;

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }

      if (String(input) === "/api/ai/chat/stream") {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          "event: final\ndata: {\"answer\":\"Ok\",\"model\":\"llama3\",\"requestedModel\":\"llama3\",\"fallbackUsed\":false,\"warnings\":[]}\n\n",
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

    // Ollama (default) — agentModel should not be sent
    await act(async () => {
      result.current?.setAgentModel("openai/gpt-4o");
    });

    expect(result.current?.agentModel).toBe("openai/gpt-4o");

    await act(async () => {
      await result.current?.submit({
        action: "chat",
        payload: { message: "Hola", context: { module: "Presupuestos" } },
      });
    });

    expect(capturedBody!.provider).toBe("ollama");
    expect(capturedBody!.modelPreference).toBeUndefined();
  });

  it("persists agent model per project in localStorage", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }
      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }));

    // Render with project A and set agent model
    const resultA = await renderController({
      projectId: "project-a",
      initialAction: "chat",
      initialContext: { module: "Test" },
    });

    await act(async () => {
      resultA.current?.setAgentModel("anthropic/claude-3.5-sonnet");
    });

    expect(resultA.current?.agentModel).toBe("anthropic/claude-3.5-sonnet");

    // Verify it's stored under the project-scoped key
    expect(window.localStorage.getItem("myc-khipu-agent-model-project-a")).toBe("anthropic/claude-3.5-sonnet");

    // Render with project B — should get a different (default) model
    window.localStorage.setItem("myc-khipu-agent-model-project-b", "openai/gpt-4o");

    const resultB = await renderController({
      projectId: "project-b",
      initialAction: "chat",
      initialContext: { module: "Test" },
    });

    expect(resultB.current?.agentModel).toBe("openai/gpt-4o");

    // Project A still has its model
    expect(resultA.current?.agentModel).toBe("anthropic/claude-3.5-sonnet");
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

  it("syncs context when Task 3-only fields change and the local context is still prop-driven", async () => {
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
      initialContext: {
        route: "/projects/project-1/budgets/budget-1",
        projectId: "project-1",
        budgetId: "budget-1",
        module: "Presupuestos",
        selectedItem: "Partida 1",
        selectionType: "partida",
        selectionId: "partida-1",
        unit: "m3",
        currentCost: 420,
        activeTable: "presupuesto",
        viewSummary: "Partida 1 visible",
      },
    });

    expect(result.current?.context).toEqual({
      route: "/projects/project-1/budgets/budget-1",
      projectId: "project-1",
      budgetId: "budget-1",
      module: "Presupuestos",
      selectedItem: "Partida 1",
      selectionType: "partida",
      selectionId: "partida-1",
      unit: "m3",
      currentCost: 420,
      activeTable: "presupuesto",
      viewSummary: "Partida 1 visible",
    });

    await result.rerender({
      projectId: undefined,
      initialAction: "chat",
      initialContext: {
        route: "/projects/project-1/budgets/budget-1",
        projectId: "project-1",
        budgetId: "budget-1",
        module: "Presupuestos",
        selectedItem: "Partida 1",
        selectionType: "partida",
        selectionId: "partida-2",
        unit: "m3",
        currentCost: 420,
        activeTable: "presupuesto",
        viewSummary: "Partida 1 actualizada",
      },
    });

    expect(result.current?.context).toEqual({
      route: "/projects/project-1/budgets/budget-1",
      projectId: "project-1",
      budgetId: "budget-1",
      module: "Presupuestos",
      selectedItem: "Partida 1",
      selectionType: "partida",
      selectionId: "partida-2",
      unit: "m3",
      currentCost: 420,
      activeTable: "presupuesto",
      viewSummary: "Partida 1 actualizada",
    });
  });

  describe("cross-controller history sync (floating ↔ page)", () => {
    function createSyncFetchMock(calls: Array<{ answer: string; model: string }>) {
      let callIndex = 0;
      return vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/ai/health") {
          return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
        }

        if (String(input) === "/api/settings/ai-provider") {
          return new Response(JSON.stringify({}), { status: 200 });
        }

        if (String(input) === "/api/ai/chat/stream") {
          const entry = calls[callIndex];
          callIndex += 1;
          return new Response(
            `event: delta\ndata: {\"text\":\"${entry.answer.slice(0, 4)}\"}\n\n` +
              `event: final\ndata: {\"answer\":\"${entry.answer}\",\"model\":\"${entry.model}\",\"requestedModel\":\"${entry.model}\",\"fallbackUsed\":false,\"warnings\":[]}\n\n`,
            { headers: { "Content-Type": "text/event-stream" } },
          );
        }

        throw new Error(`Unexpected fetch ${String(input)}`);
      });
    }

    it("syncs new history entries from floating to page", async () => {
      vi.stubGlobal("fetch", createSyncFetchMock([
        { answer: "Respuesta desde flotante", model: "llama3" },
      ]));

      const floating = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Flotante" },
      });

      const page = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Pagina AI" },
      });

      await act(async () => {
        await floating.current?.submit({
          action: "chat",
          payload: { message: "Consulta desde el flotante", context: { module: "Flotante" } },
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(floating.current?.history).toHaveLength(1);
      expect(page.current?.history).toHaveLength(1);
      expect(page.current?.history[0]?.summary).toBe("Consulta desde el flotante");
      expect(page.current?.history[0]?.result.answer).toBe("Respuesta desde flotante");
    });

    it("syncs new history entries from page to floating", async () => {
      vi.stubGlobal("fetch", createSyncFetchMock([
        { answer: "Respuesta desde pagina", model: "llama3" },
      ]));

      const floating = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Flotante" },
      });

      const page = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Pagina AI" },
      });

      await act(async () => {
        await page.current?.submit({
          action: "chat",
          payload: { message: "Consulta desde la pagina", context: { module: "Pagina AI" } },
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(page.current?.history).toHaveLength(1);
      expect(floating.current?.history).toHaveLength(1);
      expect(floating.current?.history[0]?.summary).toBe("Consulta desde la pagina");
      expect(floating.current?.history[0]?.result.answer).toBe("Respuesta desde pagina");
    });

    it("syncs clearHistory across controllers", async () => {
      vi.stubGlobal("fetch", createSyncFetchMock([
        { answer: "Respuesta antes de limpiar", model: "llama3" },
      ]));

      const floating = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Flotante" },
      });

      const page = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Pagina AI" },
      });

      // Submit from floating to populate history
      await act(async () => {
        await floating.current?.submit({
          action: "chat",
          payload: { message: "Mensaje antes de limpiar", context: { module: "Flotante" } },
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(floating.current?.history).toHaveLength(1);
      expect(page.current?.history).toHaveLength(1);

      // Clear from the page controller
      await act(async () => {
        page.current?.clearHistory();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(page.current?.history).toHaveLength(0);
      expect(floating.current?.history).toHaveLength(0);
    });

    it("syncs multiple entries bidirectionally", async () => {
      vi.stubGlobal("fetch", createSyncFetchMock([
        { answer: "Primera desde flotante", model: "llama3" },
        { answer: "Segunda desde pagina", model: "llama3" },
        { answer: "Tercera desde flotante", model: "llama3" },
      ]));

      const floating = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Flotante" },
      });

      const page = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Pagina AI" },
      });

      // 1. Floating submits
      await act(async () => {
        await floating.current?.submit({
          action: "chat",
          payload: { message: "Mensaje 1", context: { module: "Flotante" } },
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(floating.current?.history).toHaveLength(1);
      expect(page.current?.history).toHaveLength(1);
      expect(page.current?.history[0]?.summary).toBe("Mensaje 1");

      // 2. Page submits
      await act(async () => {
        await page.current?.submit({
          action: "chat",
          payload: { message: "Mensaje 2", context: { module: "Pagina AI" } },
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(page.current?.history).toHaveLength(2);
      expect(floating.current?.history).toHaveLength(2);
      expect(floating.current?.history[0]?.summary).toBe("Mensaje 2");
      expect(floating.current?.history[1]?.summary).toBe("Mensaje 1");

      // 3. Floating submits again
      await act(async () => {
        await floating.current?.submit({
          action: "chat",
          payload: { message: "Mensaje 3", context: { module: "Flotante" } },
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(floating.current?.history).toHaveLength(3);
      expect(page.current?.history).toHaveLength(3);
      expect(page.current?.history[0]?.summary).toBe("Mensaje 3");
    });

    it("does not sync session-scoped history into project-scoped controllers", async () => {
      vi.stubGlobal("fetch", createSyncFetchMock([
        { answer: "Respuesta de sesion", model: "llama3" },
      ]));

      const projectController = await renderController({
        projectId: "project-1",
        initialAction: "chat",
        initialContext: { module: "Presupuesto", projectId: "project-1" },
      });

      const sessionController = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Sesion" },
      });

      // Submit from session controller
      await act(async () => {
        await sessionController.current?.submit({
          action: "chat",
          payload: { message: "Mensaje de sesion", context: { module: "Sesion" } },
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Session controller receives its own entry
      expect(sessionController.current?.history).toHaveLength(1);

      // Project-scoped controller should NOT receive the session entry via sync
      expect(projectController.current?.history).toHaveLength(0);
    });
  });

  describe("cross-controller feedback sync (floating ↔ page)", () => {
    function createSyncHistoryEntry(overrides: Partial<AiHistoryEntry> = {}): AiHistoryEntry {
      return {
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: "chat",
        summary: "Consulta de prueba",
        context: { module: "Test" },
        result: {
          answer: "Respuesta de prueba",
          model: "llama3",
          requestedModel: "llama3",
          fallbackUsed: false,
          warnings: [],
        },
        timestamp: new Date().toISOString(),
        ...overrides,
      };
    }

    it("syncs feedback from floating to page", async () => {
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/ai/health") {
          return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
        }
        if (String(input) === "/api/settings/ai-provider") {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        throw new Error(`Unexpected fetch ${String(input)}`);
      }));

      const floating = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Flotante" },
      });

      const page = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Pagina AI" },
      });

      const entry = createSyncHistoryEntry();

      // Submit feedback from floating
      await act(async () => {
        await floating.current?.submitFeedback(entry, "APPLIED");
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Both controllers should reflect the feedback
      expect(floating.current?.feedbackByHistoryId[entry.id]).toBe("APPLIED");
      expect(page.current?.feedbackByHistoryId[entry.id]).toBe("APPLIED");
      expect(page.current?.feedbackSummary.applied).toBe(1);
      expect(floating.current?.feedbackSummary.applied).toBe(1);
    });

    it("syncs feedback from page to floating", async () => {
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/ai/health") {
          return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
        }
        if (String(input) === "/api/settings/ai-provider") {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        throw new Error(`Unexpected fetch ${String(input)}`);
      }));

      const floating = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Flotante" },
      });

      const page = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Pagina AI" },
      });

      const entry = createSyncHistoryEntry();

      // Submit feedback from page
      await act(async () => {
        await page.current?.submitFeedback(entry, "EDITED");
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Both controllers should reflect the feedback
      expect(page.current?.feedbackByHistoryId[entry.id]).toBe("EDITED");
      expect(floating.current?.feedbackByHistoryId[entry.id]).toBe("EDITED");
      expect(floating.current?.feedbackSummary.edited).toBe(1);
      expect(page.current?.feedbackSummary.edited).toBe(1);
    });

    it("syncs multiple feedback entries bidirectionally", async () => {
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/ai/health") {
          return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
        }
        if (String(input) === "/api/settings/ai-provider") {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        throw new Error(`Unexpected fetch ${String(input)}`);
      }));

      const floating = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Flotante" },
      });

      const page = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Pagina AI" },
      });

      const entry1 = createSyncHistoryEntry();
      const entry2 = createSyncHistoryEntry();
      const entry3 = createSyncHistoryEntry();

      // 1. Floating applies entry1
      await act(async () => {
        await floating.current?.submitFeedback(entry1, "APPLIED");
      });
      await act(async () => { await Promise.resolve(); });

      expect(floating.current?.feedbackByHistoryId[entry1.id]).toBe("APPLIED");
      expect(page.current?.feedbackByHistoryId[entry1.id]).toBe("APPLIED");

      // 2. Page dismisses entry2
      await act(async () => {
        await page.current?.submitFeedback(entry2, "DISMISSED");
      });
      await act(async () => { await Promise.resolve(); });

      expect(page.current?.feedbackByHistoryId[entry2.id]).toBe("DISMISSED");
      expect(floating.current?.feedbackByHistoryId[entry2.id]).toBe("DISMISSED");

      // 3. Floating edits entry3
      await act(async () => {
        await floating.current?.submitFeedback(entry3, "EDITED");
      });
      await act(async () => { await Promise.resolve(); });

      expect(floating.current?.feedbackByHistoryId[entry3.id]).toBe("EDITED");
      expect(page.current?.feedbackByHistoryId[entry3.id]).toBe("EDITED");

      // Both controllers should have all 3 entries
      expect(Object.keys(floating.current?.feedbackByHistoryId ?? {})).toHaveLength(3);
      expect(Object.keys(page.current?.feedbackByHistoryId ?? {})).toHaveLength(3);

      // Verify feedback summary on both
      expect(floating.current?.feedbackSummary).toEqual(
        expect.objectContaining({ applied: 1, edited: 1, dismissed: 1 }),
      );
      expect(page.current?.feedbackSummary).toEqual(
        expect.objectContaining({ applied: 1, edited: 1, dismissed: 1 }),
      );
    });

    it("does not sync session feedback into project-scoped controllers", async () => {
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/ai/health") {
          return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
        }
        if (String(input) === "/api/settings/ai-provider") {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        throw new Error(`Unexpected fetch ${String(input)}`);
      }));

      const projectController = await renderController({
        projectId: "project-1",
        initialAction: "chat",
        initialContext: { module: "Presupuesto", projectId: "project-1" },
      });

      const sessionController = await renderController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Sesion" },
      });

      const entry = createSyncHistoryEntry();

      // Submit feedback from session controller
      await act(async () => {
        await sessionController.current?.submitFeedback(entry, "APPLIED");
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Session controller has the feedback
      expect(sessionController.current?.feedbackByHistoryId[entry.id]).toBe("APPLIED");

      // Project-scoped controller should NOT receive it
      expect(projectController.current?.feedbackByHistoryId[entry.id]).toBeUndefined();
    });
  });

  it("preserves Task 3 context fields when reading session history entries", async () => {
    window.localStorage.setItem(
      "myc-ai-session-history",
      JSON.stringify([
        {
          id: "history-1",
          action: "chat",
          summary: "Consulta previa",
          timestamp: "2026-06-18T10:00:00.000Z",
          context: {
            route: "/projects/project-1/budgets/budget-1",
            projectId: "project-1",
            budgetId: "budget-1",
            project: "Hospital Norte",
            module: "Presupuestos",
            selectedItem: "Partida de concreto",
            selectionType: "partida",
            selectionId: "partida-1",
            unit: "m3",
            currentCost: 420,
            activeTable: "presupuesto",
            viewSummary: "Partida de concreto en el presupuesto activo",
          },
          result: {
            answer: "Revision previa",
            model: "llama3",
            requestedModel: "llama3",
            fallbackUsed: false,
            warnings: [],
          },
        },
      ]),
    );

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/health") {
        return new Response(JSON.stringify(createHealthPayload()), { status: 200 });
      }

      if (String(input) === "/api/settings/ai-provider") {
        return new Response(JSON.stringify({}), { status: 200 });
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    }));

    const result = await renderController({
      projectId: undefined,
      initialAction: "chat",
      initialContext: {},
    });

    expect(result.current?.history[0]?.context).toEqual({
      route: "/projects/project-1/budgets/budget-1",
      projectId: "project-1",
      budgetId: "budget-1",
      project: "Hospital Norte",
      module: "Presupuestos",
      selectedItem: "Partida de concreto",
      selectionType: "partida",
      selectionId: "partida-1",
      unit: "m3",
      currentCost: 420,
      activeTable: "presupuesto",
      viewSummary: "Partida de concreto en el presupuesto activo",
    });
  });

});

async function renderController(
  props: React.ComponentProps<typeof TestHarness>["props"],
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let current: ReturnType<typeof useAiAssistantController> | null = null;

  activeRoots.push({ root, container });

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
    initialContext: {
      route?: string;
      projectId?: string;
      budgetId?: string;
      project?: string;
      module?: string;
      selectedItem?: string;
      selectionType?: "project" | "budget" | "partida" | "resource" | "metrado";
      selectionId?: string;
      unit?: string;
      currentCost?: number;
      activeTable?: string;
      viewSummary?: string;
    };
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
