/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { UnifiedIndexRelationsPageContent } from "@/components/unified-indices/unified-index-relations-page-content";
import type { UnifiedIndexRelationRow } from "@/types/unified-index";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

afterEach(async () => {
  if (!activeContainer) {
    return;
  }

  const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;
  if (root) {
    await act(async () => {
      root.unmount();
    });
  }

  activeContainer.remove();
  activeContainer = null;
});

describe("UnifiedIndexRelationsPageContent", () => {
  it("filters by codigo or nombre and keeps the table read-only", async () => {
    const rows: UnifiedIndexRelationRow[] = [
      { code: "03", name: "Acero corrugado", resourceCount: 5 },
      { code: "47", name: "Mano de obra", resourceCount: 2 },
      { code: "92", name: "Flete fluvial", resourceCount: 0 },
    ];

    const container = await renderNode(<UnifiedIndexRelationsPageContent rows={rows} />);

    expect(container.textContent).toContain("3 IU visibles");
    expect(container.textContent).toContain("7 insumos asociados");
    expect(container.textContent).toContain("Acero corrugado");
    expect(container.textContent).toContain("Mano de obra");
    expect(container.textContent).not.toContain("Editar");
    expect(container.textContent).not.toContain("Crear");

    const input = container.querySelector("input");
    if (!input) {
      throw new Error("Search input was not rendered");
    }

    await act(async () => {
      setInputValue(input, "mano");
      await Promise.resolve();
    });

    expect(container.textContent).toContain("1 IU visible");
    expect(container.textContent).toContain("Mano de obra");
    expect(container.textContent).not.toContain("Acero corrugado");
  });
});

async function renderNode(node: React.ReactNode) {
  activeContainer = document.createElement("div");
  document.body.appendChild(activeContainer);

  const root = createRoot(activeContainer);
  (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(node);
  });

  return activeContainer;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
