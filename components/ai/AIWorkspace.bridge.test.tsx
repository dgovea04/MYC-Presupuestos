/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AIWorkspace } from "@/components/ai/AIWorkspace";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AIWorkspace ChatGPT bridge provider", () => {
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
    vi.useRealTimers();
  });

  it("renders Khipu as an operational workspace with command actions and runtime status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByAriaLabel, getButtonByText, getByText, getTextContaining } = await renderWorkspace();

    expect(getByText("Khipu")).toBeTruthy();
    expect(getByText("Asistente tecnico de obra")).toBeTruthy();
    expect(getTextContaining("Criterio tecnico para presupuestos de obra.")).toBeTruthy();
    expect(
      getTextContaining("Revisa APU, genera partidas y responde con contexto del presupuesto activo."),
    ).toBeTruthy();
    expect(getByText("Trabajo activo")).toBeTruthy();
    expect(getTextContaining("Proyecto")).toBeTruthy();
    expect(getTextContaining("Edificio Multifamiliar")).toBeTruthy();
    expect(getTextContaining("Modulo")).toBeTruthy();
    expect(getTextContaining("APU")).toBeTruthy();
    expect(getTextContaining("Partida seleccionada")).toBeTruthy();
    expect(getTextContaining("Concreto f'c=210")).toBeTruthy();
    expect(getTextContaining("Unidad")).toBeTruthy();
    expect(getTextContaining("m3")).toBeTruthy();
    expect(getTextContaining("Costo actual")).toBeTruthy();
    expect(getTextContaining("420")).toBeTruthy();
    expect(getTextContaining("Tabla activa")).toBeTruthy();
    expect(getTextContaining("Analisis de precios unitarios")).toBeTruthy();
    expect(getTextContaining("Preparacion")).toBeTruthy();
    expect(getTextContaining("Proveedor, modelos y latencia para ejecutar la accion activa.")).toBeTruthy();
    expect(getTextContaining("Recomendado")).toBeTruthy();
    expect(getTextContaining("Ejecucion")).toBeTruthy();
    expect(getTextContaining("Consulta criterios tecnicos con el contexto activo.")).toBeTruthy();
    expect(getTextContaining("Siguientes acciones")).toBeTruthy();
    expect(getButtonByAriaLabel("Explicar contexto")).toBeTruthy();
    expect(getButtonByAriaLabel("Autocompletar texto")).toBeTruthy();
    expect(getTextContaining("Proveedor activo")).toBeTruthy();
    expect(getTextContaining("Ollama listo")).toBeTruthy();
    expect(getByText("Contexto de trabajo")).toBeTruthy();
    expect(getTextContaining("Estos datos guian la respuesta de Khipu")).toBeTruthy();
    expect(getButtonByText("Actualizar estado")).toBeTruthy();
    expect(getButtonByText("Ollama local")).toBeTruthy();
    expect(getButtonByText("Bridge")).toBeTruthy();
    expect(getButtonByText("Ollama local").getAttribute("aria-pressed")).toBe("true");
    expect(getButtonByText("Bridge").getAttribute("aria-pressed")).toBe("false");
    expect(getTextContaining("Chat tecnico")).toBeTruthy();
    expect(getTextContaining("Generar APU")).toBeTruthy();
    expect(getTextContaining("Revisar presupuesto")).toBeTruthy();
    expect(getTextContaining("Autocompletar")).toBeTruthy();
    expect(getTextContaining("Modelo resuelto")).toBeTruthy();
    expect(getTextContaining("Ultima latencia")).toBeTruthy();
  });

  it("switches commands from next-action shortcuts without submitting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByAriaLabel, getTextContaining, getTextareaByLabel } = await renderWorkspace();

    expect(getTextContaining("Consulta criterios tecnicos con el contexto activo.")).toBeTruthy();

    await act(async () => {
      getButtonByAriaLabel("Generar APU").click();
    });

    expect(getTextContaining("Genera una propuesta editable de recursos y rendimiento.")).toBeTruthy();

    await act(async () => {
      getButtonByAriaLabel("Revisar presupuesto").click();
    });

    expect(getTextContaining("Revisa unidades, duplicados y costos sospechosos.")).toBeTruthy();

    await act(async () => {
      getButtonByAriaLabel("Autocompletar texto").click();
    });

    expect(getTextContaining("Completa descripciones tecnicas sin perder el contexto.")).toBeTruthy();

    await act(async () => {
      getButtonByAriaLabel("Explicar contexto").click();
    });

    expect(getTextareaByLabel("Consulta tecnica").value).toBe("Consulta inicial");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/health");
  });

  it("summarizes ChatGPT Bridge state instead of Ollama health when the bridge provider is selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload("down"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getTextContaining, queryTextContaining } = await renderWorkspace();

    expect(getTextContaining("Ollama no disponible")).toBeTruthy();

    await act(async () => {
      getButtonByText("Bridge").click();
    });

    expect(getButtonByText("Ollama local").getAttribute("aria-pressed")).toBe("false");
    expect(getButtonByText("Bridge").getAttribute("aria-pressed")).toBe("true");
    expect(getTextContaining("Bridge esperando")).toBeTruthy();
    expect(queryTextContaining("Ollama no disponible")).toBeNull();
  });

  it("sends the active AI request through the browser bridge when ChatGPT Bridge is selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);
    const bridgeListener = vi.fn<(event: Event) => void>();
    window.addEventListener("MYCBridgeSendPrompt", bridgeListener);

    const { getButtonByText, getTextareaByLabel } = await renderWorkspace();
    await act(async () => {
      getButtonByText("Bridge").click();
    });
    expect(getTextareaByLabel("Consulta tecnica").value).toBe("Consulta inicial");
    await act(async () => {
      getButtonByText("Enviar a ChatGPT").click();
    });

    expect(bridgeListener).toHaveBeenCalledTimes(1);
    const event = bridgeListener.mock.calls[0]?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect((event as CustomEvent).detail).toEqual(
      expect.objectContaining({
        requestId: expect.stringMatching(/^myc-\d+-[a-z0-9]+$/),
        jsonPrompt: expect.objectContaining({
          task: "technical_chat",
          role: "construction_cost_assistant_peru",
          output: {
            format: "json_only",
            schema: "technical_chat_v1",
          },
          input: {
            message: "Consulta inicial",
          },
          guardrails: {
            humanReviewRequired: true,
            noAutomaticBudgetMutation: true,
            noExactPriceFabrication: true,
          },
        }),
        metadata: expect.objectContaining({
          source: "myc-presupuestos",
          provider: "chatgpt-bridge",
          action: "chat",
        }),
      }),
    );
    expect((event as CustomEvent).detail.jsonPrompt).not.toHaveProperty("accion");
    expect((event as CustomEvent).detail.jsonPrompt).not.toHaveProperty("instrucciones");
    expect((event as CustomEvent).detail.jsonPrompt).not.toHaveProperty("formatoSalida");
    // Health + cloud status fetches on mount
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/health");

    window.removeEventListener("MYCBridgeSendPrompt", bridgeListener);
  });

  it("omits project id from ChatGPT Bridge prompt payload when project-aware", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary") {
        return Promise.resolve({ ok: true, json: async () => createFeedbackSummaryPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({ ok: true, json: async () => ({ entries: [] }) });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const bridgeListener = vi.fn<(event: Event) => void>();
    window.addEventListener("MYCBridgeSendPrompt", bridgeListener);

    const { getButtonByText } = await renderWorkspace({ projectId: "project-1" });

    await act(async () => {
      getButtonByText("Bridge").click();
    });
    await act(async () => {
      getButtonByText("Enviar a ChatGPT").click();
    });

    expect(bridgeListener).toHaveBeenCalledTimes(1);
    const event = bridgeListener.mock.calls[0]?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect((event as CustomEvent).detail.jsonPrompt.input).toEqual(
      expect.not.objectContaining({ projectId: "project-1" }),
    );
    expect(JSON.stringify((event as CustomEvent).detail.jsonPrompt)).not.toContain("project-1");

    window.removeEventListener("MYCBridgeSendPrompt", bridgeListener);
  });

  it("renders generic structured JSON fields from a copied ChatGPT bridge response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);
    const bridgeListener = vi.fn<(event: Event) => void>();
    window.addEventListener("MYCBridgeSendPrompt", bridgeListener);

    const { getByText } = await renderWorkspace();
    await act(async () => {
      getButtonByText("Bridge").click();
    });
    await act(async () => {
      getButtonByText("Enviar a ChatGPT").click();
    });

    const sentEvent = bridgeListener.mock.calls[0]?.[0] as CustomEvent;
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("MYCBridgeResponse", {
          detail: {
            requestId: sentEvent.detail.requestId,
            raw: "{\"answer\":\"Resumen tecnico\"}",
            jsonValid: true,
            json: {
              answer: "Resumen tecnico",
              partida: "MOVILIZACION Y DESMOVILIZACION DE EQUIPOS",
              criterio_de_apu: "Descomponer transporte, mano de obra de apoyo y permisos.",
              alcance_tipico: ["Carga de equipos", "Transporte hacia obra"],
              observaciones_tecnicas: ["Sustentar con cotizaciones"],
            },
          },
        }),
      );
    });

    expect(getByText("Criterio De Apu")).toBeTruthy();
    expect(getByText("Descomponer transporte, mano de obra de apoyo y permisos.")).toBeTruthy();
    expect(getByText("Carga de equipos")).toBeTruthy();
    expect(getByText("Ver respuesta completa")).toBeTruthy();

    window.removeEventListener("MYCBridgeSendPrompt", bridgeListener);
  });

  it("restores a saved history result so the full structured response can be viewed later", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem(
      "myc-ai-session-history",
      JSON.stringify([
        {
          id: "history-1",
          action: "chat",
          summary: "Consulta guardada",
          context: {
            project: "Edificio Multifamiliar",
            module: "APU",
          },
          result: {
            answer: "Resumen historico",
            model: "ChatGPT Bridge",
            requestedModel: "ChatGPT web",
            fallbackUsed: false,
            warnings: [],
            structuredData: {
              answer: "Resumen historico",
              criterio_de_apu: "Detalle guardado en JSON",
              alcance_tipico: ["Dato historico completo"],
            },
          },
          timestamp: "2026-06-04T18:56:14.849Z",
        },
      ]),
    );

    const { getByText } = await renderWorkspace();

    expect(getByText("Actividad reciente de Khipu")).toBeTruthy();

    const entryButton = findButtonContainingText("Consulta guardada");
    await act(async () => {
      entryButton.click();
    });

    expect(getByText("Resumen historico")).toBeTruthy();
    expect(getByText("Detalle guardado en JSON")).toBeTruthy();
    expect(getByText("Dato historico completo")).toBeTruthy();
    expect(getByText("Ver respuesta completa")).toBeTruthy();
  });

  it("loads project history when a project id is provided", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary") {
        return Promise.resolve({ ok: true, json: async () => createFeedbackSummaryPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            entries: [
              {
                id: "history-malformed",
                projectId: "project-1",
                userId: "user-1",
                action: "chat",
                summary: "Consulta corrupta",
                context: { project: "Hospital Norte", module: "APU" },
                result: {
                  model: "llama3.1",
                  requestedModel: "llama3.1",
                  fallbackUsed: false,
                  warnings: [],
                },
                timestamp: "2026-06-09T16:19:00.000Z",
              },
              {
                id: "history-project-1",
                projectId: "project-1",
                userId: "user-1",
                action: "chat",
                summary: "Consulta persistida",
                context: { project: "Hospital Norte", module: "APU" },
                result: {
                  answer: "Respuesta persistida",
                  model: "llama3.1",
                  requestedModel: "llama3.1",
                  fallbackUsed: false,
                  warnings: [],
                },
                timestamp: "2026-06-09T16:20:00.000Z",
              },
            ],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, getTextContaining, queryByText } = await renderWorkspace({ projectId: "project-1" });

    expect(getByText("Consulta persistida")).toBeTruthy();
    expect(queryByText("Consulta corrupta")).toBeNull();
    expect(
      getTextContaining("Historial del proyecto; las respuestas de ChatGPT Bridge quedan solo en esta sesion."),
    ).toBeTruthy();

    const entryButton1 = findButtonContainingText("Consulta persistida");
    await act(async () => {
      entryButton1.click();
    });

    expect(getByText("Respuesta persistida")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/ai-history");
    expect(window.localStorage.getItem("myc-ai-session-history")).toBeNull();
  });

  it("selects persisted latest feedback when opening a project history entry", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary") {
        return Promise.resolve({ ok: true, json: async () => createFeedbackSummaryPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            entries: [
              {
                id: "history-applied",
                projectId: "project-1",
                userId: "user-1",
                action: "chat",
                summary: "Consulta aplicada",
                context: { project: "Hospital Norte", module: "APU" },
                result: {
                  answer: "Respuesta aplicada",
                  model: "llama3.1",
                  requestedModel: "llama3.1",
                  fallbackUsed: false,
                  warnings: [],
                },
                timestamp: "2026-06-09T16:20:00.000Z",
              },
            ],
          }),
        });
      }

      if (url === "/api/projects/project-1/ai-feedback/latest?historyEntryId=history-applied") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ feedbackByHistoryId: { "history-applied": "APPLIED" } }),
        });
      }

      if (url === "/api/projects/project-1/ai-feedback/latest?historyEntryId=history-project-1") {
        return Promise.resolve({ ok: true, json: async () => ({ feedbackByHistoryId: {} }) });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText } = await renderWorkspace({ projectId: "project-1" });

    expect(getByText("Consulta aplicada")).toBeTruthy();

    const entryButton2 = findButtonContainingText("Consulta aplicada");
    await act(async () => {
      entryButton2.click();
    });

    expect(getByText("Respuesta aplicada")).toBeTruthy();
    expect(getButtonByText("Aplicada").getAttribute("aria-pressed")).toBe("true");
    expect(getButtonByText("Editada").getAttribute("aria-pressed")).toBe("false");
    expect(getButtonByText("Descartada").getAttribute("aria-pressed")).toBe("false");
  });

  it("restores browser history when project id is removed without persisting project history", async () => {
    window.localStorage.setItem(
      "myc-ai-session-history",
      JSON.stringify([
        {
          id: "history-session",
          action: "chat",
          summary: "Consulta de navegador",
          context: { project: "Edificio Multifamiliar", module: "APU" },
          result: {
            answer: "Respuesta local",
            model: "ChatGPT Bridge",
            requestedModel: "ChatGPT web",
            fallbackUsed: false,
            warnings: [],
          },
          timestamp: "2026-06-09T16:18:00.000Z",
        },
      ]),
    );
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary") {
        return Promise.resolve({ ok: true, json: async () => createFeedbackSummaryPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            entries: [
              {
                id: "history-project-1",
                projectId: "project-1",
                userId: "user-1",
                action: "chat",
                summary: "Consulta persistida",
                context: { project: "Hospital Norte", module: "APU" },
                result: {
                  answer: "Respuesta persistida",
                  model: "llama3.1",
                  requestedModel: "llama3.1",
                  fallbackUsed: false,
                  warnings: [],
                },
                timestamp: "2026-06-09T16:20:00.000Z",
              },
            ],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, queryByText, rerender } = await renderWorkspace({ projectId: "project-1" });

    expect(getByText("Consulta persistida")).toBeTruthy();

    await rerender({});

    expect(getByText("Consulta de navegador")).toBeTruthy();
    expect(queryByText("Consulta persistida")).toBeNull();
    expect(window.localStorage.getItem("myc-ai-session-history")).not.toContain("Consulta persistida");
  });

  it("clears stale project history while the next project history is loading", async () => {
    let resolveProjectTwoHistory: (value: { ok: boolean; json: () => Promise<unknown> }) => void = () => undefined;
    const projectTwoHistory = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolveProjectTwoHistory = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary" || url === "/api/projects/project-2/ai-feedback/summary") {
        return Promise.resolve({ ok: true, json: async () => createFeedbackSummaryPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            entries: [
              {
                id: "history-project-1",
                projectId: "project-1",
                userId: "user-1",
                action: "chat",
                summary: "Consulta proyecto uno",
                context: { project: "Hospital Norte", module: "APU" },
                result: {
                  answer: "Respuesta proyecto uno",
                  model: "llama3.1",
                  requestedModel: "llama3.1",
                  fallbackUsed: false,
                  warnings: [],
                },
                timestamp: "2026-06-09T16:20:00.000Z",
              },
            ],
          }),
        });
      }

      if (url === "/api/projects/project-1/ai-feedback/latest?historyEntryId=history-project-1") {
        return Promise.resolve({ ok: true, json: async () => ({ feedbackByHistoryId: {} }) });
      }

      if (url === "/api/projects/project-2/ai-history") {
        return projectTwoHistory;
      }

      if (url === "/api/projects/project-2/ai-feedback/latest?historyEntryId=history-project-2") {
        return Promise.resolve({ ok: true, json: async () => ({ feedbackByHistoryId: {} }) });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, queryByText, rerender } = await renderWorkspace({ projectId: "project-1" });

    expect(getByText("Consulta proyecto uno")).toBeTruthy();

    await rerender({ projectId: "project-2" });

    expect(queryByText("Consulta proyecto uno")).toBeNull();

    await act(async () => {
      resolveProjectTwoHistory({
        ok: true,
        json: async () => ({
          entries: [
            {
              id: "history-project-2",
              projectId: "project-2",
              userId: "user-1",
              action: "chat",
              summary: "Consulta proyecto dos",
              context: { project: "Colegio Sur", module: "APU" },
              result: {
                answer: "Respuesta proyecto dos",
                model: "llama3.1",
                requestedModel: "llama3.1",
                fallbackUsed: false,
                warnings: [],
              },
              timestamp: "2026-06-09T16:30:00.000Z",
            },
          ],
        }),
      });
      await projectTwoHistory;
      await Promise.resolve();
    });

    expect(getByText("Consulta proyecto dos")).toBeTruthy();
  });

  it("renders partial streamed chat text and commits history after final event", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary") {
        return Promise.resolve({ ok: true, json: async () => createFeedbackSummaryPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({ ok: true, json: async () => ({ entries: [] }) });
      }

      if (url === "/api/ai/chat/stream") {
        return Promise.resolve({
          ok: true,
          body: createSseStream([
            { event: "delta", data: { text: "Hola " } },
            { event: "delta", data: { text: "obra" } },
            {
              event: "final",
              data: {
                answer: "Hola obra",
                model: "llama3.1",
                requestedModel: "llama3.1",
                fallbackUsed: false,
                warnings: [],
                historyEntry: {
                  id: "history-new",
                  projectId: "project-1",
                  userId: "user-1",
                  action: "chat",
                  summary: "Consulta inicial",
                  context: { project: "Edificio Multifamiliar", module: "APU" },
                  result: {
                    answer: "Hola obra",
                    model: "llama3.1",
                    requestedModel: "llama3.1",
                    fallbackUsed: false,
                    warnings: [],
                  },
                  timestamp: "2026-06-09T16:25:00.000Z",
                },
              },
            },
          ]),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url} ${JSON.stringify(init)}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText } = await renderWorkspace({ projectId: "project-1" });

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });

    expect(getByText("Consulta inicial")).toBeTruthy();
    expect(getByText("Hola obra")).toBeTruthy();
    const chatRequest = fetchMock.mock.calls.find(([url]) => url === "/api/ai/chat/stream");
    expect(JSON.parse(String(chatRequest?.[1]?.body))).toEqual(expect.objectContaining({ projectId: "project-1" }));
    expect(window.localStorage.getItem("myc-ai-session-history")).toBeNull();
  });

  it("renders streamed chat text before the final event arrives", async () => {
    let enqueueStreamEvent: (event: { event: string; data: unknown }) => void = () => undefined;
    let closeStream: () => void = () => undefined;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/ai/chat/stream") {
        return Promise.resolve({
          ok: true,
          body: createControlledSseStream((enqueue, close) => {
            enqueueStreamEvent = enqueue;
            closeStream = close;
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText } = await renderWorkspace();

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });

    expect(getButtonByText("Khipu respondiendo")).toBeTruthy();

    await act(async () => {
      enqueueStreamEvent({ event: "delta", data: { text: "Primer avance" } });
      await Promise.resolve();
    });
    // Poll: flush one typewriter character per tick (18ms each × 14 chars ≈ 252ms, 30 ticks = 600ms)
    for (let i = 0; i < 30; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
    }
    expect(getByText("Primer avance")).toBeTruthy();

    await act(async () => {
      enqueueStreamEvent({
        event: "final",
        data: {
          answer: "Primer avance completo",
          model: "llama3.1",
          requestedModel: "llama3.1",
          fallbackUsed: false,
          warnings: [],
        },
      });
      closeStream();
      await Promise.resolve();
    });

    expect(getByText("Primer avance completo")).toBeTruthy();
  });

  it("falls back to the non-streaming chat endpoint when the stream request is unavailable", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/ai/chat/stream") {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "Streaming no disponible" }),
        });
      }

      if (url === "/api/ai/chat") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            answer: "Respuesta sin streaming",
            model: "llama3.1",
            requestedModel: "llama3.1",
            fallbackUsed: false,
            warnings: [],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText } = await renderWorkspace();

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });

    expect(getByText("Respuesta sin streaming")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/ai/chat/stream")).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/ai/chat")).toBe(true);
  });

  it("records local session feedback and updates quality counters", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/ai/chat/stream") {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "Streaming no disponible" }),
        });
      }

      if (url === "/api/ai/chat") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            answer: "Respuesta para medir",
            model: "llama3.1",
            requestedModel: "llama3.1",
            fallbackUsed: false,
            warnings: [],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText } = await renderWorkspace();

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });
    await act(async () => {
      getButtonByText("Aplicada").click();
    });

    expect(getByText("Aplicadas")).toBeTruthy();
    expect(getByText("1")).toBeTruthy();
    expect(window.localStorage.getItem("myc-ai-session-feedback")).toContain("APPLIED");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/feedback"))).toBe(false);
  });

  it("records project feedback through the API and updates counters", async () => {
    let summaryRequestCount = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({ ok: true, json: async () => ({ entries: [] }) });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary") {
        summaryRequestCount += 1;
        return Promise.resolve({
          ok: true,
          json: async () =>
            summaryRequestCount === 1
              ? createFeedbackSummaryPayload()
              : { summary: { applied: 0, edited: 1, dismissed: 0 } },
        });
      }

      if (url === "/api/ai/chat/stream") {
        return Promise.resolve({
          ok: true,
          body: createSseStream([
            {
              event: "final",
              data: {
                answer: "Respuesta proyecto",
                model: "llama3.1",
                requestedModel: "llama3.1",
                fallbackUsed: false,
                warnings: [],
                historyEntry: {
                  id: "history-1",
                  projectId: "project-1",
                  userId: "user-1",
                  action: "chat",
                  summary: "Consulta inicial",
                  context: { project: "Edificio Multifamiliar" },
                  result: {
                    answer: "Respuesta proyecto",
                    model: "llama3.1",
                    requestedModel: "llama3.1",
                    fallbackUsed: false,
                    warnings: [],
                  },
                  timestamp: "2026-06-11T16:10:00.000Z",
                },
              },
            },
          ]),
        });
      }

      if (url === "/api/projects/project-1/ai-history/history-1/feedback") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            feedback: {
              id: "feedback-1",
              historyEntryId: "history-1",
              projectId: "project-1",
              userId: "user-1",
              feedbackType: "EDITED",
              timestamp: "2026-06-11T16:11:00.000Z",
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url} ${JSON.stringify(init)}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText, getMetricValue } = await renderWorkspace({ projectId: "project-1" });

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });
    await act(async () => {
      getButtonByText("Editada").click();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/ai-feedback/summary");
    expect(getByText("Editadas")).toBeTruthy();
    expect(summaryRequestCount).toBe(2);
    expect(getMetricValue("Editadas")).toBe("1");
    const feedbackRequest = fetchMock.mock.calls.find(([url]) => url === "/api/projects/project-1/ai-history/history-1/feedback");
    expect(JSON.parse(String(feedbackRequest?.[1]?.body))).toEqual({ feedbackType: "EDITED" });
  });

  it("keeps optimistic project feedback counters when summary reconciliation fails after a successful POST", async () => {
    let summaryRequestCount = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({ ok: true, json: async () => ({ entries: [] }) });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary") {
        summaryRequestCount += 1;
        if (summaryRequestCount === 1) {
          return Promise.resolve({ ok: true, json: async () => createFeedbackSummaryPayload() });
        }

        return Promise.reject(new Error("Summary reload failed"));
      }

      if (url === "/api/ai/chat/stream") {
        return Promise.resolve({
          ok: true,
          body: createSseStream([
            {
              event: "final",
              data: {
                answer: "Respuesta proyecto",
                model: "llama3.1",
                requestedModel: "llama3.1",
                fallbackUsed: false,
                warnings: [],
                historyEntry: {
                  id: "history-1",
                  projectId: "project-1",
                  userId: "user-1",
                  action: "chat",
                  summary: "Consulta inicial",
                  context: { project: "Edificio Multifamiliar" },
                  result: {
                    answer: "Respuesta proyecto",
                    model: "llama3.1",
                    requestedModel: "llama3.1",
                    fallbackUsed: false,
                    warnings: [],
                  },
                  timestamp: "2026-06-11T16:10:00.000Z",
                },
              },
            },
          ]),
        });
      }

      if (url === "/api/projects/project-1/ai-history/history-1/feedback") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            feedback: {
              id: "feedback-1",
              historyEntryId: "history-1",
              projectId: "project-1",
              userId: "user-1",
              feedbackType: "EDITED",
              timestamp: "2026-06-11T16:11:00.000Z",
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url} ${JSON.stringify(init)}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getMetricValue } = await renderWorkspace({ projectId: "project-1" });

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });
    await act(async () => {
      getButtonByText("Editada").click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(summaryRequestCount).toBe(2);
    expect(getMetricValue("Editadas")).toBe("1");
  });

  it("reconciles project feedback counters after editing historical feedback", async () => {
    let summaryRequestCount = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            entries: [
              {
                id: "history-1",
                projectId: "project-1",
                userId: "user-1",
                action: "chat",
                summary: "Consulta persistida",
                context: { project: "Hospital Norte", module: "APU" },
                result: {
                  answer: "Respuesta persistida",
                  model: "llama3.1",
                  requestedModel: "llama3.1",
                  fallbackUsed: false,
                  warnings: [],
                },
                timestamp: "2026-06-09T16:20:00.000Z",
              },
            ],
          }),
        });
      }

      if (url === "/api/projects/project-1/ai-feedback/latest?historyEntryId=history-1") {
        return Promise.resolve({ ok: true, json: async () => ({ feedbackByHistoryId: { "history-1": "APPLIED" } }) });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary") {
        summaryRequestCount += 1;
        return Promise.resolve({
          ok: true,
          json: async () =>
            summaryRequestCount === 1
              ? { summary: { applied: 1, edited: 0, dismissed: 0 } }
              : { summary: { applied: 0, edited: 1, dismissed: 0 } },
        });
      }

      if (url === "/api/projects/project-1/ai-history/history-1/feedback") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            feedback: {
              id: "feedback-1",
              historyEntryId: "history-1",
              projectId: "project-1",
              userId: "user-1",
              feedbackType: "EDITED",
              timestamp: "2026-06-11T16:11:00.000Z",
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url} ${JSON.stringify(init)}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getMetricValue } = await renderWorkspace({ projectId: "project-1" });

    expect(getMetricValue("Aplicadas")).toBe("1");
    expect(getMetricValue("Editadas")).toBe("0");

    const entryButton3 = findButtonContainingText("Consulta persistida");
    await act(async () => {
      entryButton3.click();
    });
    await act(async () => {
      getButtonByText("Editada").click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/ai-feedback/summary");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/ai-history/history-1/feedback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ feedbackType: "EDITED" }),
      }),
    );
    expect(summaryRequestCount).toBe(2);
    expect(getMetricValue("Aplicadas")).toBe("0");
    expect(getMetricValue("Editadas")).toBe("1");
  });

  it("does not create local fallback history for project-aware Ollama responses without a history entry", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary") {
        return Promise.resolve({ ok: true, json: async () => createFeedbackSummaryPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({ ok: true, json: async () => ({ entries: [] }) });
      }

      if (url === "/api/ai/chat/stream") {
        return Promise.resolve({
          ok: true,
          body: createSseStream([
            {
              event: "final",
              data: {
                answer: "Respuesta sin historial persistido",
                model: "llama3.1",
                requestedModel: "llama3.1",
                fallbackUsed: false,
                warnings: [],
              },
            },
          ]),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url} ${JSON.stringify(init)}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText, queryByText } = await renderWorkspace({ projectId: "project-1" });

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });

    expect(getByText("Respuesta sin historial persistido")).toBeTruthy();
    expect(queryByText("Actividad reciente de Khipu")).toBeNull();
    expect(window.localStorage.getItem("myc-ai-session-history")).toBeNull();
  });

  it("does not add stale project Ollama history when the project changes before the response resolves", async () => {
    let resolveChat: (value: { ok: boolean; body: ReadableStream<Uint8Array> }) => void = () => undefined;
    const chatResponse = new Promise<{ ok: boolean; body: ReadableStream<Uint8Array> }>((resolve) => {
      resolveChat = resolve;
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary" || url === "/api/projects/project-2/ai-feedback/summary") {
        return Promise.resolve({ ok: true, json: async () => createFeedbackSummaryPayload() });
      }

      if (url === "/api/projects/project-1/ai-history" || url === "/api/projects/project-2/ai-history") {
        return Promise.resolve({ ok: true, json: async () => ({ entries: [] }) });
      }

      if (url === "/api/ai/chat/stream") {
        return chatResponse;
      }

      return Promise.reject(new Error(`Unexpected fetch ${url} ${JSON.stringify(init)}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, queryByText, rerender } = await renderWorkspace({ projectId: "project-1" });

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });

    await rerender({ projectId: "project-2" });

    await act(async () => {
      resolveChat({
        ok: true,
        body: createSseStream([
          {
            event: "final",
            data: {
              answer: "Respuesta tardia proyecto uno",
              model: "llama3.1",
              requestedModel: "llama3.1",
              fallbackUsed: false,
              warnings: [],
              historyEntry: {
                id: "history-project-1-late",
                projectId: "project-1",
                userId: "user-1",
                action: "chat",
                summary: "Historial tardio proyecto uno",
                context: { project: "Hospital Norte", module: "APU" },
                result: {
                  answer: "Respuesta tardia proyecto uno",
                  model: "llama3.1",
                  requestedModel: "llama3.1",
                  fallbackUsed: false,
                  warnings: [],
                },
                timestamp: "2026-06-09T16:45:00.000Z",
              },
            },
          },
        ]),
      });
      await chatResponse;
      await Promise.resolve();
    });

    expect(queryByText("Historial tardio proyecto uno")).toBeNull();
    expect(window.localStorage.getItem("myc-ai-session-history")).toBeNull();
  });

  it("does not add stale ChatGPT Bridge history after leaving the request scope", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-feedback/summary") {
        return Promise.resolve({ ok: true, json: async () => createFeedbackSummaryPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({ ok: true, json: async () => ({ entries: [] }) });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const bridgeListener = vi.fn<(event: Event) => void>();
    window.addEventListener("MYCBridgeSendPrompt", bridgeListener);

    const { getButtonByText, getByText, queryByText, rerender } = await renderWorkspace({ projectId: "project-1" });

    await act(async () => {
      getButtonByText("Bridge").click();
    });
    await act(async () => {
      getButtonByText("Enviar a ChatGPT").click();
    });

    const sentEvent = bridgeListener.mock.calls[0]?.[0] as CustomEvent;

    await rerender({});

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("MYCBridgeResponse", {
          detail: {
            requestId: sentEvent.detail.requestId,
            raw: "{\"answer\":\"Respuesta tardia de Bridge\"}",
            jsonValid: true,
            json: {
              answer: "Respuesta tardia de Bridge",
            },
          },
        }),
      );
    });

    expect(getByText("Respuesta tardia de Bridge")).toBeTruthy();
    expect(queryByText("Actividad reciente de Khipu")).toBeNull();
    expect(window.localStorage.getItem("myc-ai-session-history") ?? "").not.toContain("Consulta inicial");

    window.removeEventListener("MYCBridgeSendPrompt", bridgeListener);
  });
});

async function renderWorkspace(props: Partial<React.ComponentProps<typeof AIWorkspace>> = {}) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<AIWorkspace initialChatMessage="Consulta inicial" {...props} />);
  });

  await act(async () => {
    await Promise.resolve();
  });

  return {
    rerender: async (props: Partial<React.ComponentProps<typeof AIWorkspace>> = {}) => {
      await act(async () => {
        root.render(<AIWorkspace initialChatMessage="Consulta inicial" {...props} />);
      });

      await act(async () => {
        await Promise.resolve();
      });
    },
    getButtonByText: (text: string) => {
      const element = [...document.body.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === text);
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${text}`);
      }

      return element;
    },
    getButtonByAriaLabel: (label: string) => {
      const element = document.body.querySelector(`button[aria-label="${label}"]`);
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button aria-label: ${label}`);
      }

      return element;
    },
    getTextareaByLabel: (label: string) => {
      const labelElement = [...document.body.querySelectorAll("label")].find((candidate) =>
        candidate.textContent?.includes(label),
      );
      const textarea = labelElement?.querySelector("textarea");
      if (!(textarea instanceof HTMLTextAreaElement)) {
        throw new Error(`Missing textarea label: ${label}`);
      }

      return textarea;
    },
    getByText: (text: string) => {
      const element = [...document.body.querySelectorAll("*")].find((candidate) => candidate.textContent?.trim() === text);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing text: ${text}`);
      }

      return element;
    },
    queryByText: (text: string) =>
      [...document.body.querySelectorAll("*")].find((candidate) => candidate.textContent?.trim() === text) ?? null,
    getTextContaining: (text: string) => {
      const element = [...document.body.querySelectorAll("*")].find((candidate) => {
        if (!(candidate instanceof HTMLElement)) return false;
        if (!candidate.textContent?.includes(text)) return false;

        return [...candidate.children].every((child) => !child.textContent?.includes(text));
      });
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing text containing: ${text}`);
      }

      return element;
    },
    getMetricValue: (label: string) => {
      const labelElement = [...document.body.querySelectorAll("p")].find((candidate) => candidate.textContent?.trim() === label);
      const valueElement = labelElement?.parentElement?.querySelector("p:last-child");
      if (!(valueElement instanceof HTMLElement)) {
        throw new Error(`Missing metric: ${label}`);
      }

      return valueElement.textContent?.trim() ?? "";
    },
    queryTextContaining: (text: string) =>
      [...document.body.querySelectorAll("*")].find((candidate) => {
        if (!(candidate instanceof HTMLElement)) return false;
        if (!candidate.textContent?.includes(text)) return false;

        return [...candidate.children].every((child) => !child.textContent?.includes(text));
      }) ?? null,
  };
}

function findButtonContainingText(text: string): HTMLElement {
  const element = [...document.body.querySelectorAll("button, [role='button']")].find(
    (b) => b.textContent?.includes(text),
  );
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing button containing: ${text}`);
  }
  return element;
}

function createHealthPayload(status: "ok" | "degraded" | "down" = "ok") {
  return {
    status,
    ollamaReachable: status !== "down",
    availableModels: ["llama3.1"],
    requiredModels: [{ model: "llama3.1", installed: true, actions: ["chat", "review"] }],
    actions: {
      chat: { model: "llama3.1", requestedModel: "llama3.1", fallbackUsed: false, warnings: [] },
      apu: { model: "llama3.1", requestedModel: "mistral", fallbackUsed: true, warnings: [] },
      review: { model: "llama3.1", requestedModel: "llama3.1", fallbackUsed: false, warnings: [] },
      autocomplete: { model: "llama3.1", requestedModel: "mistral", fallbackUsed: true, warnings: [] },
    },
    metrics: {
      chat: { latencyMs: null, lastError: null },
      apu: { latencyMs: null, lastError: null },
      review: { latencyMs: null, lastError: null },
      autocomplete: { latencyMs: null, lastError: null },
    },
  };
}

function createFeedbackSummaryPayload() {
  return { summary: { applied: 0, edited: 0, dismissed: 0 } };
}

function createSseStream(events: Array<{ event: string; data: unknown }>) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`));
      }

      controller.close();
    },
  });
}

function createControlledSseStream(
  setup: (enqueue: (event: { event: string; data: unknown }) => void, close: () => void) => void,
) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      setup(
        (event) => {
          controller.enqueue(encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`));
        },
        () => controller.close(),
      );
    },
  });
}
