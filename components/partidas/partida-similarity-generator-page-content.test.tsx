/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PartidaSimilarityGeneratorPageContent } from "@/components/partidas/partida-similarity-generator-page-content";
import type { CatalogPartidaRecord } from "@/types/partida";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
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
  });

  it("renders the progressive step-by-step UX from the first step", async () => {
    await renderContent();

    expect(getText("Nueva generacion")).toBeTruthy();
    expect(queryText("Partidas candidatas")).toBeNull();
    expect(queryText("Insumos sugeridos")).toBeNull();
    expect(queryText("Revision final / Vista final")).toBeNull();
    expect(queryText("Guardar")).toBeNull();
  });
});

async function renderContent() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <PartidaSimilarityGeneratorPageContent
        partidas={[createPartida()]}
        resourcesCatalog={[]}
      />,
    );
  });
}

function getText(text: string) {
  const element = queryText(text);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing text: ${text}`);
  }
  return element;
}

function queryText(text: string) {
  return [...document.querySelectorAll("*")].find((candidate) => candidate.textContent?.trim() === text) ?? null;
}

function createPartida(): CatalogPartidaRecord {
  return {
    id: "base-1",
    description: "Concreto armado en columnas",
    unit: "m3",
    unitPrice: 120,
    currency: "PEN",
    performance: 1,
    apuRows: [],
  };
}
