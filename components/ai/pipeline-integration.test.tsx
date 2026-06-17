/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";


declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The AiBudgetActionDialog is not exported individually from budget-editor.tsx.
// We import the component via the full module and access it through render.
// Since the dialog is a private function, we render the BudgetEditor itself
// with the aiPanel state pre-set, or we can import and render it via a dynamic
// approach. However the simplest integration test is to test the pipeline
// directly: formatAiText → renderMarkdownLite, which is what the dialog uses.
// We also test that AIMessage applies the same pipeline.
import { AIMessage, renderMarkdownLite } from "@/components/ai/AIMessage";
import { formatAiText } from "@/lib/ai/formatting";

let activeContainer: HTMLDivElement | null = null;

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
});

async function renderPipeline(rawText: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  // Apply the same pipeline as AiBudgetActionDialog
  const formatted = formatAiText(rawText);

  await act(async () => {
    root.render(<>{renderMarkdownLite(formatted)}</>);
  });

  return container;
}

describe("AI markdown pipeline integration", () => {
  // ── Pipeline: raw AI text → formatAiText → renderMarkdownLite ──

  it("strips HTML <br> tags and renders paragraphs", async () => {
    const host = await renderPipeline("Linea 1<br>Linea 2<br><br>Linea 3");
    // <br> → \n, <br><br> → \n\n, so we get two paragraphs
    const paragraphs = host.querySelectorAll("p");
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0]?.textContent).toContain("Linea 1");
    expect(paragraphs[0]?.textContent).toContain("Linea 2");
    expect(paragraphs[1]?.textContent).toBe("Linea 3");
  });

  it("strips HTML bold tags while preserving markdown bold rendering", async () => {
    const host = await renderPipeline("<strong>HTML bold</strong> y **markdown bold**");
    // Markdown **bold** renders as <strong> — that's correct
    expect(host.querySelector("strong")?.textContent).toBe("markdown bold");
    // HTML <strong> is stripped — "HTML bold" appears as plain text
    expect(host.querySelector("p")?.textContent).toContain("HTML bold");
    // The raw HTML <strong> tag is gone (only markdown-generated <strong> remains)
    expect(host.querySelectorAll("strong").length).toBe(1);
  });

  it("renders headings from raw AI output with HTML artifacts and paragraph separation", async () => {
    // Use <br><br> to create paragraph separation between heading and paragraph
    const host = await renderPipeline("<strong>## Titulo principal</strong><br><br>Contenido del parrafo.");
    // <strong> stripped, ## heading preserved in its own block
    const h3 = host.querySelector("h3");
    expect(h3?.textContent).toBe("Titulo principal");
    // Paragraph rendered in separate block
    const p = host.querySelector("p");
    expect(p?.textContent).toBe("Contenido del parrafo.");
  });

  it("renders markdown table from raw AI output", async () => {
    const host = await renderPipeline(
      "| Insumo | Cantidad |<br>|--------|----------|<br>| Cemento | 10 |<br>| Arena | 5 |",
    );
    // <br> tags become \n, resulting in a 4-line table block
    const table = host.querySelector("table");
    expect(table).toBeTruthy();
    const ths = table?.querySelectorAll("th");
    expect(ths?.length).toBe(2);
    expect(ths?.[0]?.textContent).toBe("Insumo");
    const tds = table?.querySelectorAll("tbody td");
    expect(tds?.length).toBe(4);
  });

  it("renders bullet list with consecutive br paragraph separation", async () => {
    const host = await renderPipeline(
      "Materiales necesarios:<br><br>- Cemento<br>- Arena<br>- Agua",
    );
    const ul = host.querySelector("ul");
    expect(ul).toBeTruthy();
    const items = ul?.querySelectorAll("li");
    expect(items?.length).toBe(3);
    expect(items?.[0]?.textContent).toBe("Cemento");
  });

  it("renders blockquote from AI output", async () => {
    const host = await renderPipeline("> **Nota importante:** Esto es una cita.");
    const blockquote = host.querySelector("blockquote");
    expect(blockquote).toBeTruthy();
    expect(blockquote?.querySelector("strong")?.textContent).toBe("Nota importante:");
  });

  it("renders horizontal rule from AI output", async () => {
    const host = await renderPipeline("Seccion 1<br><br>---<br><br>Seccion 2");
    expect(host.querySelector("hr")).toBeTruthy();
    const paragraphs = host.querySelectorAll("p");
    expect(paragraphs[0]?.textContent).toBe("Seccion 1");
    expect(paragraphs[1]?.textContent).toBe("Seccion 2");
  });

  it("renders ordered list from AI output", async () => {
    const host = await renderPipeline("Pasos:<br><br>1. Preparar<br>2. Mezclar<br>3. Verter");
    const ol = host.querySelector("ol");
    expect(ol?.className).toContain("list-decimal");
    const items = ol?.querySelectorAll("li");
    expect(items?.length).toBe(3);
    expect(items?.[1]?.textContent).toBe("Mezclar");
  });

  it("handles complex real-world AI output with mixed formatting", async () => {
    // Use <br><br> between all sections to create proper block separation
    const rawAnswer =
      "**Resumen de costos**<br><br>| Material | Costo |<br>|----------|-------|<br>| Concreto | 420 |<br><br>Observaciones:<br><br>- Verificar precios<br>- Actualizar catalogo<br><br>> **Nota:** Los precios son referenciales.";
    const host = await renderPipeline(rawAnswer);
    // Bold heading in its own paragraph
    expect(host.querySelector("strong")?.textContent).toBe("Resumen de costos");
    // Table
    expect(host.querySelector("table")).toBeTruthy();
    // Bullet list (separated by double br from "Observaciones:")
    const ul = host.querySelector("ul");
    expect(ul?.querySelectorAll("li").length).toBe(2);
    expect(ul?.querySelectorAll("li")[0]?.textContent).toBe("Verificar precios");
    // Blockquote
    expect(host.querySelector("blockquote")).toBeTruthy();
  });

  it("renders all inline formatting types in a single paragraph", async () => {
    const host = await renderPipeline(
      "**bold** *italic* `code` [link](https://example.com) ~~tachado~~",
    );
    expect(host.querySelector("strong")?.textContent).toBe("bold");
    expect(host.querySelector("em")?.textContent).toBe("italic");
    expect(host.querySelector("code")?.textContent).toBe("code");
    expect(host.querySelector("a")?.textContent).toBe("link");
    expect(host.querySelector("del")?.textContent).toBe("tachado");
  });

  it("strips unknown HTML tags and preserves inner text", async () => {
    const host = await renderPipeline("<div>Contenido en div</div> y <span>con span</span>.");
    expect(host.innerHTML).not.toContain("<div>");
    expect(host.innerHTML).not.toContain("<span>");
    expect(host.textContent).toContain("Contenido en div");
    expect(host.textContent).toContain("con span");
  });

  // ── AIMessage component also uses the full pipeline ──

  it("AIMessage component uses the same pipeline", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;

    const root = createRoot(container);
    (container as HTMLDivElement & { __root?: typeof root }).__root = root;

    await act(async () => {
      root.render(
        <AIMessage
          content="**bold** y `code` y [link](https://x.com) y ~~tachado~~"
          model="gemma3:12b"
        />,
      );
    });

    // Verify pipeline: formatAiText + renderMarkdownLite applied
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("code")?.textContent).toBe("code");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://x.com");
    expect(container.querySelector("del")?.textContent).toBe("tachado");
    // Model name displayed
    expect(container.textContent).toContain("gemma3:12b");
  });

  // ── Edge cases ──

  it("handles empty input", async () => {
    const host = await renderPipeline("");
    expect(host.textContent).toBe("");
  });

  it("handles whitespace-only input", async () => {
    const host = await renderPipeline("   \n  \n  ");
    expect(host.textContent).toBe("");
  });

  it("handles input with only HTML tags", async () => {
    const host = await renderPipeline("<br><br><div></div><span></span>");
    expect(host.textContent).toBe("");
  });

  it("does not treat text with inline pipes as a table", async () => {
    const host = await renderPipeline("Esto no es | una tabla");
    expect(host.querySelector("table")).toBeNull();
    expect(host.querySelector("p")?.textContent).toContain("Esto no es | una tabla");
  });
});
