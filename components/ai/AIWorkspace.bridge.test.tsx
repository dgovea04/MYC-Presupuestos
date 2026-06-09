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
    expect(getButtonByText("ChatGPT Bridge")).toBeTruthy();
    expect(getButtonByText("Ollama local").getAttribute("aria-pressed")).toBe("true");
    expect(getButtonByText("ChatGPT Bridge").getAttribute("aria-pressed")).toBe("false");
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
    expect(getTextContaining("Recomendado")).toBeTruthy();

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
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
      getButtonByText("ChatGPT Bridge").click();
    });

    expect(getButtonByText("Ollama local").getAttribute("aria-pressed")).toBe("false");
    expect(getButtonByText("ChatGPT Bridge").getAttribute("aria-pressed")).toBe("true");
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
      getButtonByText("ChatGPT Bridge").click();
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
          accion: "chat",
          payload: expect.objectContaining({
            message: "Consulta inicial",
          }),
        }),
        metadata: expect.objectContaining({
          source: "myc-presupuestos",
          provider: "chatgpt-bridge",
          action: "chat",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/health");

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

    const { getButtonByText, getByText } = await renderWorkspace();
    await act(async () => {
      getButtonByText("ChatGPT Bridge").click();
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

    const { getButtonByText, getByText } = await renderWorkspace();

    expect(getByText("Actividad reciente de Khipu")).toBeTruthy();

    await act(async () => {
      getButtonByText("Ver detalle").click();
    });

    expect(getByText("Resumen historico")).toBeTruthy();
    expect(getByText("Detalle guardado en JSON")).toBeTruthy();
    expect(getByText("Dato historico completo")).toBeTruthy();
    expect(getByText("Ver respuesta completa")).toBeTruthy();
  });
});

async function renderWorkspace() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<AIWorkspace initialChatMessage="Consulta inicial" />);
  });

  await act(async () => {
    await Promise.resolve();
  });

  return {
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
    queryTextContaining: (text: string) =>
      [...document.body.querySelectorAll("*")].find((candidate) => {
        if (!(candidate instanceof HTMLElement)) return false;
        if (!candidate.textContent?.includes(text)) return false;

        return [...candidate.children].every((child) => !child.textContent?.includes(text));
      }) ?? null,
  };
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
