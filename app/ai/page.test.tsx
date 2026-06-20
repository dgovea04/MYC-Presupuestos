/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AIWorkspace } from "@/components/ai/AIWorkspace";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AIWorkspace integration", () => {
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

  it("renders Khipu branding header with KhipuLogo, workspace heading, and description", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, getTextContaining } = await renderWorkspace();

    expect(getByText("Khipu")).toBeTruthy();
    expect(getByText("Asistente tecnico de obra")).toBeTruthy();
    expect(getTextContaining("Criterio tecnico para presupuestos de obra.")).toBeTruthy();
    expect(
      getTextContaining("Revisa APU, genera partidas y responde con contexto del presupuesto activo."),
    ).toBeTruthy();
  });

  it("renders the execution card with action helper text and active action icon", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, getTextContaining } = await renderWorkspace();

    // Execution card with active action
    expect(getByText("Ejecucion")).toBeTruthy();
    expect(getByText("Chat tecnico")).toBeTruthy();
    expect(getTextContaining("Consulta criterios tecnicos con el contexto activo.")).toBeTruthy();

    // Action cards grid
    expect(getByText("Generar APU")).toBeTruthy();
    expect(getTextContaining("Crear una propuesta revisable de recursos y rendimiento.")).toBeTruthy();
    expect(getByText("Revisar presupuesto")).toBeTruthy();
    expect(getByText("Autocompletar")).toBeTruthy();

    // Provider section
    expect(getByText("Preparacion")).toBeTruthy();
    expect(getTextContaining("Proveedor, modelos y latencia para ejecutar la accion activa.")).toBeTruthy();
  });

  it("switches active action when clicking an action card", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, getTextContaining } = await renderWorkspace();

    expect(getTextContaining("Consulta criterios tecnicos con el contexto activo.")).toBeTruthy();

    await act(async () => {
      getByText("Generar APU").click();
    });

    expect(getTextContaining("Genera una propuesta editable de recursos y rendimiento.")).toBeTruthy();

    await act(async () => {
      getByText("Revisar presupuesto").click();
    });

    expect(getTextContaining("Revisa unidades, duplicados y costos sospechosos.")).toBeTruthy();
  });

  it("starts with the initialAction passed as a prop", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    await renderWorkspace({ initialAction: "review" });

    // The page-level heading stays the same, but the execution card changes
    expect(
      document.body.textContent,
    ).toContain("Revisa unidades, duplicados y costos sospechosos.");
  });

  it("renders provider selector buttons for all 5 providers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText } = await renderWorkspace();

    expect(getButtonByText("Ollama local").getAttribute("aria-pressed")).toBe("true");
    expect(getButtonByText("Bridge")).toBeTruthy();
    expect(getButtonByText("ChatGPT")).toBeTruthy();
    expect(getButtonByText("Gemini")).toBeTruthy();
    expect(getButtonByText("OpenRouter")).toBeTruthy();
  });

  it("switches provider without submitting when clicking provider buttons", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getTextContaining } = await renderWorkspace();

    expect(getTextContaining("Ollama listo")).toBeTruthy();

    await act(async () => {
      getButtonByText("Bridge").click();
    });

    expect(getButtonByText("Ollama local").getAttribute("aria-pressed")).toBe("false");
    expect(getButtonByText("Bridge").getAttribute("aria-pressed")).toBe("true");
    expect(getTextContaining("Bridge esperando")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2); // health + cloud status on mount
  });

  it("shows cloud provider auth prompt when unconfigured cloud provider selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getTextContaining } = await renderWorkspace();

    await act(async () => {
      getButtonByText("ChatGPT").click();
    });

    expect(getTextContaining("ChatGPT no configurado")).toBeTruthy();
  });

  it("renders context rows from the active context with all 6 fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getTextContaining } = await renderWorkspace();

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
  });

  it("renders all 4 action cards (chat, apu, review, autocomplete) in the action grid", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, getTextContaining } = await renderWorkspace();

    expect(getByText("Chat tecnico")).toBeTruthy();
    expect(getTextContaining("Resolver dudas tecnicas con contexto de obra.")).toBeTruthy();
    expect(getByText("Generar APU")).toBeTruthy();
    expect(getTextContaining("Crear una propuesta revisable de recursos y rendimiento.")).toBeTruthy();
    expect(getByText("Revisar presupuesto")).toBeTruthy();
    expect(getTextContaining("Detectar unidades, duplicados y costos sospechosos.")).toBeTruthy();
    expect(getByText("Autocompletar")).toBeTruthy();
    expect(getTextContaining("Completar descripciones y especificaciones tecnicas.")).toBeTruthy();
  });

  it("renders the context sidebar with 'Contexto de trabajo' heading and 4 next-action shortcuts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, getButtonByAriaLabel } = await renderWorkspace();

    expect(getByText("Contexto de trabajo")).toBeTruthy();
    expect(getByText("Siguientes acciones")).toBeTruthy();
    expect(getButtonByAriaLabel("Explicar contexto")).toBeTruthy();
    expect(getButtonByAriaLabel("Generar APU")).toBeTruthy();
    expect(getButtonByAriaLabel("Revisar presupuesto")).toBeTruthy();
    expect(getButtonByAriaLabel("Autocompletar texto")).toBeTruthy();
  });

  it("renders the preparation panel with required models when health is available", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, getTextContaining } = await renderWorkspace();

    expect(getByText("Preparacion")).toBeTruthy();
    expect(getTextContaining("Proveedor, modelos y latencia para ejecutar la accion activa.")).toBeTruthy();
    expect(getByText("llama3.1")).toBeTruthy();
    expect(getByText("Instalado")).toBeTruthy();
    expect(getByText("Accion activa")).toBeTruthy();
    expect(getTextContaining("Modelo solicitado")).toBeTruthy();
    expect(getTextContaining("Modelo resuelto")).toBeTruthy();
    expect(getTextContaining("Ultima latencia")).toBeTruthy();
  });

  it("shows Khipu empty state message when context has no data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    await renderWorkspace({ initialContext: {} });

    expect(
      document.body.textContent,
    ).toContain("Selecciona un presupuesto, partida o APU para que Khipu pueda analizarlo con contexto.");
  });

  it("shows 'Pendiente' for health status when model is not installed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "degraded",
        ollamaReachable: true,
        availableModels: [],
        requiredModels: [
          { model: "llama3.2", installed: false, actions: ["chat"] },
        ],
        actions: {
          chat: { model: "llama3.1", requestedModel: "llama3.2", fallbackUsed: true, warnings: [] },
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
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText } = await renderWorkspace();

    expect(getByText("Pendiente")).toBeTruthy();
    expect(getByText("Ollama con fallback")).toBeTruthy();
  });

  it("renders feedback quality metrics with initial zero values", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, getMetricValue } = await renderWorkspace();

    expect(getByText("Aplicadas")).toBeTruthy();
    expect(getByText("Editadas")).toBeTruthy();
    expect(getByText("Descartadas")).toBeTruthy();
    expect(getMetricValue("Aplicadas")).toBe("0");
    expect(getMetricValue("Editadas")).toBe("0");
    expect(getMetricValue("Descartadas")).toBe("0");
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
      const element = [...document.body.querySelectorAll("button")].find(
        (candidate) => candidate.textContent?.trim() === text,
      );
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
      const element = [...document.body.querySelectorAll("*")].find(
        (candidate) => candidate.textContent?.trim() === text,
      );
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
    queryTextContaining: (text: string) =>
      [...document.body.querySelectorAll("*")].find((candidate) => {
        if (!(candidate instanceof HTMLElement)) return false;
        if (!candidate.textContent?.includes(text)) return false;

        return [...candidate.children].every((child) => !child.textContent?.includes(text));
      }) ?? null,
    getMetricValue: (label: string) => {
      const labelElement = [...document.body.querySelectorAll("p")].find(
        (candidate) => candidate.textContent?.trim() === label,
      );
      const valueElement = labelElement?.parentElement?.querySelector("p:last-child");
      if (!(valueElement instanceof HTMLElement)) {
        throw new Error(`Missing metric: ${label}`);
      }

      return valueElement.textContent?.trim() ?? "";
    },
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
