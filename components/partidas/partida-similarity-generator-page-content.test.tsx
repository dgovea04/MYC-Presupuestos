/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PartidaSimilarityGeneratorPageContent } from "@/components/partidas/partida-similarity-generator-page-content";
import type { CatalogPartidaRecord } from "@/types/partida";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

let activeContainer: HTMLDivElement | null = null;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("PartidaSimilarityGeneratorPageContent", () => {
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
    routerMocks.push.mockReset();
    routerMocks.refresh.mockReset();
  });

  it("renders a single-step wizard from the first step", async () => {
    await renderContent();

    expect(getStepTitle("Nueva generacion")).toBeTruthy();
    expect(queryStepTitle("Partidas candidatas")).toBeNull();
    expect(queryStepTitle("Insumos sugeridos")).toBeNull();
    expect(queryStepTitle("Revision final / Vista final")).toBeNull();
    expect(queryStepTitle("Guardar")).toBeNull();
    expect(getButton("Siguiente")).toBeTruthy();
    expect(getButton("Atras").disabled).toBe(true);
  });

  it("calls onSaved without navigating when embedded", async () => {
    const onSaved = vi.fn();
    const savedPartida = createPartida("generated-1", "Partida generada");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse({
          candidates: [{ partida: createPartida(), score: 0.9, compositionSimilarity: 0.8, breakdown: {}, variables: {} }],
          sourceVariables: {},
        }))
        .mockResolvedValueOnce(createJsonResponse([
          {
            key: "insumo-1",
            resourceId: "resource-1",
            description: "Cemento",
            unit: "bol",
            resourceType: "MATERIAL",
            frequency: 1,
            confidenceLevel: "auto",
            suggestedCrew: null,
            suggestedQuantity: 1,
            unitPrice: 20,
            priceSource: "catalog",
            calculationMethod: "weighted_median",
            statistics: { average: 1, median: 1, minimum: 1, maximum: 1, standardDeviation: 0 },
            sourcePartidaIds: ["base-1"],
          },
        ]))
        .mockResolvedValueOnce(createJsonResponse({ generatedPartidaId: "generated-link-1", catalogPartida: savedPartida })),
    );

    await renderContent({
      mode: "embedded",
      onSaved,
      initialSourceText: "Concreto armado en columnas",
      initialGeneratedName: "Concreto armado en columnas",
      initialUnit: "m3",
    });

    await act(async () => {
      getButton("Siguiente").click();
    });
    await waitFor(() => expect(getStepTitle("Partidas candidatas")).toBeTruthy());
    expect(queryStepTitle("Nueva generacion")).toBeNull();
    await act(async () => {
      getButton("Siguiente").click();
    });
    await waitFor(() => expect(getStepTitle("Insumos sugeridos")).toBeTruthy());
    await act(async () => {
      getButton("Siguiente").click();
    });
    await waitFor(() => expect(getStepTitle("Revision final / Vista final")).toBeTruthy());
    expect(getButton("Guardar partida")).toBeTruthy();
    await act(async () => {
      getButton("Guardar partida").click();
    });

    expect(onSaved).toHaveBeenCalledWith({ generatedPartidaId: "generated-link-1", catalogPartida: savedPartida });
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });

  it("calculates manual tools as percentage of generated labor in review", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse({
          candidates: [{ partida: createPartida(), score: 0.9, compositionSimilarity: 0.8, breakdown: {}, variables: {} }],
          sourceVariables: {},
        }))
        .mockResolvedValueOnce(createJsonResponse([
          {
            key: "labor-1",
            resourceId: "labor-1",
            description: "PEON",
            unit: "HH",
            resourceType: "LABOR",
            frequency: 1,
            confidenceLevel: "auto",
            suggestedCrew: null,
            suggestedQuantity: 0.8,
            unitPrice: 20,
            priceSource: "catalog",
            calculationMethod: "weighted_median",
            statistics: { average: 0.8, median: 0.8, minimum: 0.8, maximum: 0.8, standardDeviation: 0 },
            sourcePartidaIds: ["base-1"],
          },
          {
            key: "tools-1",
            resourceId: "tools-1",
            description: "HERRAMIENTAS MANUALES",
            unit: "%MO",
            resourceType: "TOOLS",
            frequency: 1,
            confidenceLevel: "auto",
            suggestedCrew: null,
            suggestedQuantity: 3,
            unitPrice: 0,
            priceSource: "catalog",
            calculationMethod: "weighted_median",
            statistics: { average: 3, median: 3, minimum: 3, maximum: 3, standardDeviation: 0 },
            sourcePartidaIds: ["base-1"],
          },
        ])),
    );

    await renderContent({
      initialSourceText: "Concreto armado en columnas",
      initialGeneratedName: "Concreto armado en columnas",
      initialUnit: "m3",
    });

    await act(async () => {
      getButton("Siguiente").click();
    });
    await waitFor(() => expect(getStepTitle("Partidas candidatas")).toBeTruthy());
    await act(async () => {
      getButton("Siguiente").click();
    });
    await waitFor(() => expect(getStepTitle("Insumos sugeridos")).toBeTruthy());
    await act(async () => {
      getButton("Siguiente").click();
    });
    await waitFor(() => expect(getStepTitle("Revision final / Vista final")).toBeTruthy());

    const toolsRow = getTableRow("HERRAMIENTAS MANUALES");
    expect(toolsRow.textContent).toContain("S/ 16.00");
    expect(toolsRow.textContent).toContain("S/ 0.48");
    expect(getButton("Guardar partida")).toBeTruthy();
  });
});

async function renderContent(props: Partial<React.ComponentProps<typeof PartidaSimilarityGeneratorPageContent>> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <PartidaSimilarityGeneratorPageContent
        partidas={[createPartida()]}
        resourcesCatalog={[createResource()]}
        {...props}
      />,
    );
  });
}

function getButton(text: string) {
  const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === text);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${text}`);
  }
  return button;
}

function getText(text: string) {
  const element = queryText(text);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing text: ${text}`);
  }
  return element;
}

function getStepTitle(text: string) {
  const element = queryStepTitle(text);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing step title: ${text}`);
  }
  return element;
}

function getTableRow(text: string) {
  const row = [...document.querySelectorAll("tr")].find((candidate) => candidate.textContent?.includes(text));
  if (!(row instanceof HTMLTableRowElement)) {
    throw new Error(`Missing row: ${text}`);
  }
  return row;
}

function queryStepTitle(text: string) {
  return [...document.querySelectorAll("h3")].find((candidate) => candidate.textContent?.trim() === text) ?? null;
}

function queryText(text: string) {
  return [...document.querySelectorAll("*")].find((candidate) => candidate.textContent?.trim() === text) ?? null;
}

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  };
}

function createResource() {
  return {
    id: "resource-1",
    code: "MAT-001",
    description: "Cemento",
    unit: "bol",
    category: "MATERIAL" as const,
    unitPrice: 20,
    currency: "PEN",
    source: "Test",
  };
}

function createPartida(id = "base-1", description = "Concreto armado en columnas"): CatalogPartidaRecord {
  return {
    id,
    description,
    unit: "m3",
    unitPrice: 120,
    currency: "PEN",
    performance: 1,
    apuRows: [],
  };
}
