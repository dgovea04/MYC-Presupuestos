// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportPanel } from "@/components/exports/export-panel";
import { getExportDefinition } from "@/lib/exports/definitions";

describe("ExportPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob(["xlsx"]), { status: 200, headers: { "Content-Disposition": 'attachment; filename="presupuesto.xlsx"' } })),
    );
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:export"),
      revokeObjectURL: vi.fn(),
    });
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    container?.remove();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("opens a sheet, changes presets, and posts the selected export request", async () => {
    await act(async () => {
      root.render(
        <ExportPanel
          defaultPreset="presupuesto_detallado"
          definition={getExportDefinition("budget")}
          targetId="budget-1"
        />,
      );
    });

    clickByText("Exportar");
    expect(getText("Preparar exportacion")).toBeTruthy();
    expect(getText("Presupuesto detallado")).toBeTruthy();

    await act(async () => {
      clickByText("Descargar");
    });

    expect(fetch).toHaveBeenCalledWith("/api/exports", expect.objectContaining({ method: "POST" }));
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      target: "budget",
      targetId: "budget-1",
      format: "xlsx",
      preset: "presupuesto_detallado",
      options: expect.objectContaining({
        includeSignature: true,
        includeSubtotals: true,
        includeTotals: true,
      }),
    });
  });

  it("shows a PDF preview before downloading", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Blob(["pdf"], { type: "application/pdf" }), {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="presupuesto.pdf"' },
      }),
    );

    await act(async () => {
      root.render(
        <ExportPanel
          defaultPreset="presupuesto_detallado"
          definition={getExportDefinition("budget")}
          targetId="budget-1"
        />,
      );
    });

    clickByText("Exportar");
    clickByText("PDF");

    await act(async () => {
      clickByText("Previsualizar");
    });

    expect(fetch).toHaveBeenCalledWith("/api/exports", expect.objectContaining({ method: "POST" }));
    expect(document.querySelector('iframe[title="Previsualizacion PDF"]')).toBeTruthy();
  });
});

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function clickByText(text: string) {
  const element = getText(text);
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function getText(text: string) {
  const matches = [...document.querySelectorAll("button, h2, span, p, label")].filter((element) => element.textContent?.includes(text));
  const element = matches[0];
  if (!element) {
    throw new Error(`Unable to find text: ${text}`);
  }

  return element as HTMLElement;
}
