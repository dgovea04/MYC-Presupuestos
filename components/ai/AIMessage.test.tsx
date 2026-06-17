/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AIMessage } from "@/components/ai/AIMessage";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

async function renderAIMessage(content: string, model?: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<AIMessage content={content} model={model} />);
  });

  return container;
}

describe("AIMessage", () => {
  // ── paragraphs ──
  describe("paragraphs", () => {
    it("renders plain text as a paragraph", async () => {
      const host = await renderAIMessage("Texto simple de prueba.");
      const p = host.querySelector("p");
      expect(p?.textContent).toBe("Texto simple de prueba.");
    });

    it("preserves line breaks with whitespace-pre-wrap", async () => {
      const host = await renderAIMessage("linea 1\nlinea 2");
      const p = host.querySelector("p");
      expect(p?.className).toContain("whitespace-pre-wrap");
      expect(p?.textContent).toContain("linea 1");
      expect(p?.textContent).toContain("linea 2");
    });

    it("splits blocks by double newlines into separate paragraphs", async () => {
      const host = await renderAIMessage("Primer parrafo.\n\nSegundo parrafo.");
      const paragraphs = host.querySelectorAll("p");
      expect(paragraphs.length).toBe(2);
      expect(paragraphs[0]?.textContent).toBe("Primer parrafo.");
      expect(paragraphs[1]?.textContent).toBe("Segundo parrafo.");
    });
  });

  // ── headings ──
  describe("headings", () => {
    it("renders ### as h4", async () => {
      const host = await renderAIMessage("### Seccion de prueba");
      const h4 = host.querySelector("h4");
      expect(h4?.textContent).toBe("Seccion de prueba");
      expect(h4?.className).toContain("font-semibold");
    });

    it("renders ## as h3", async () => {
      const host = await renderAIMessage("## Titulo principal");
      const h3 = host.querySelector("h3");
      expect(h3?.textContent).toBe("Titulo principal");
      expect(h3?.className).toContain("font-semibold");
    });

    it("renders inline formatting inside headings", async () => {
      const host = await renderAIMessage("### Texto con **negrita** y `codigo`");
      const h4 = host.querySelector("h4");
      expect(h4?.querySelector("strong")?.textContent).toBe("negrita");
      expect(h4?.querySelector("code")?.textContent).toBe("codigo");
    });
  });

  // ── blockquotes ──
  describe("blockquotes", () => {
    it("renders single-line blockquote", async () => {
      const host = await renderAIMessage("> Esto es una cita textual.");
      const blockquote = host.querySelector("blockquote");
      expect(blockquote).toBeTruthy();
      expect(blockquote?.className).toContain("border-l-4");
      expect(blockquote?.querySelector("p")?.textContent).toBe("Esto es una cita textual.");
    });

    it("renders multi-line blockquote", async () => {
      const host = await renderAIMessage("> Primera linea de cita.\n> Segunda linea.");
      const blockquote = host.querySelector("blockquote");
      const paragraphs = blockquote?.querySelectorAll("p");
      expect(paragraphs?.length).toBe(2);
      expect(paragraphs?.[0]?.textContent).toBe("Primera linea de cita.");
      expect(paragraphs?.[1]?.textContent).toBe("Segunda linea.");
    });

    it("renders inline formatting inside blockquote", async () => {
      const host = await renderAIMessage("> Texto con **negrita** y [link](https://example.com)");
      const blockquote = host.querySelector("blockquote");
      expect(blockquote?.querySelector("strong")?.textContent).toBe("negrita");
      expect(blockquote?.querySelector("a")?.textContent).toBe("link");
    });

    it("handles blockquote without space after >", async () => {
      const host = await renderAIMessage(">Cita sin espacio");
      const blockquote = host.querySelector("blockquote");
      expect(blockquote?.querySelector("p")?.textContent).toBe("Cita sin espacio");
    });
  });

  // ── bullet lists ──
  describe("bullet lists", () => {
    it("renders dash-prefixed bullet list", async () => {
      const host = await renderAIMessage("- Item 1\n- Item 2\n- Item 3");
      const ul = host.querySelector("ul");
      expect(ul?.className).toContain("list-disc");
      const items = ul?.querySelectorAll("li");
      expect(items?.length).toBe(3);
      expect(items?.[0]?.textContent).toBe("Item 1");
      expect(items?.[1]?.textContent).toBe("Item 2");
    });

    it("renders asterisk-prefixed bullet list", async () => {
      const host = await renderAIMessage("* Punto A\n* Punto B");
      const ul = host.querySelector("ul");
      const items = ul?.querySelectorAll("li");
      expect(items?.length).toBe(2);
      expect(items?.[0]?.textContent).toBe("Punto A");
    });

    it("renders inline formatting inside list items", async () => {
      const host = await renderAIMessage("- Item con **negrita**\n- Item con `codigo`");
      const ul = host.querySelector("ul");
      const items = ul?.querySelectorAll("li");
      expect(items?.[0]?.querySelector("strong")?.textContent).toBe("negrita");
      expect(items?.[1]?.querySelector("code")?.textContent).toBe("codigo");
    });
  });

  // ── ordered lists ──
  describe("ordered lists", () => {
    it("renders dot-prefixed ordered list", async () => {
      const host = await renderAIMessage("1. Primer paso\n2. Segundo paso\n3. Tercer paso");
      const ol = host.querySelector("ol");
      expect(ol?.className).toContain("list-decimal");
      const items = ol?.querySelectorAll("li");
      expect(items?.length).toBe(3);
      expect(items?.[0]?.textContent).toBe("Primer paso");
      expect(items?.[1]?.textContent).toBe("Segundo paso");
    });

    it("renders paren-prefixed ordered list", async () => {
      const host = await renderAIMessage("1) Item A\n2) Item B");
      const ol = host.querySelector("ol");
      const items = ol?.querySelectorAll("li");
      expect(items?.length).toBe(2);
      expect(items?.[0]?.textContent).toBe("Item A");
    });

    it("renders inline formatting inside ordered list items", async () => {
      const host = await renderAIMessage("1. Paso con **enfasis**\n2. Paso con ~~tachado~~");
      const ol = host.querySelector("ol");
      const items = ol?.querySelectorAll("li");
      expect(items?.[0]?.querySelector("strong")?.textContent).toBe("enfasis");
      expect(items?.[1]?.querySelector("del")?.textContent).toBe("tachado");
    });
  });

  // ── tables ──
  describe("tables", () => {
    it("renders a simple table with header and rows", async () => {
      const host = await renderAIMessage(
        "| Nombre | Unidad | Costo |\n|--------|--------|-------|\n| Concreto | m3 | 420 |\n| Acero | kg | 12 |",
      );
      const table = host.querySelector("table");
      expect(table).toBeTruthy();
      const ths = table?.querySelectorAll("th");
      expect(ths?.length).toBe(3);
      expect(ths?.[0]?.textContent).toBe("Nombre");
      expect(ths?.[1]?.textContent).toBe("Unidad");
      expect(ths?.[2]?.textContent).toBe("Costo");
      const tds = table?.querySelectorAll("tbody td");
      expect(tds?.length).toBe(6);
      expect(tds?.[0]?.textContent).toBe("Concreto");
      expect(tds?.[3]?.textContent).toBe("Acero");
    });

    it("renders inline formatting inside table cells", async () => {
      const host = await renderAIMessage(
        "| Item | Detalle |\n|------|---------|\n| A | **importante** |\n| B | [link](https://x.com) |",
      );
      const table = host.querySelector("table");
      const tds = table?.querySelectorAll("tbody td");
      expect(tds?.[1]?.querySelector("strong")?.textContent).toBe("importante");
      expect(tds?.[3]?.querySelector("a")?.textContent).toBe("link");
    });

    it("applies alignment classes from separator", async () => {
      const host = await renderAIMessage(
        "| Izq | Centro | Der |\n|:----|:------:|----:|\n| a | b | c |",
      );
      const ths = host.querySelectorAll("th");
      expect(ths[0]?.className).toContain("text-left");
      expect(ths[1]?.className).toContain("text-center");
      expect(ths[2]?.className).toContain("text-right");
    });

    it("does not detect non-table pipe content as a table", async () => {
      const host = await renderAIMessage("Esto no es | una tabla\nporque falta separador");
      expect(host.querySelector("table")).toBeNull();
      expect(host.querySelector("p")?.textContent).toContain("Esto no es | una tabla");
    });
  });

  // ── horizontal rules ──
  describe("horizontal rules", () => {
    it("renders --- as <hr>", async () => {
      const host = await renderAIMessage("---");
      expect(host.querySelector("hr")).toBeTruthy();
    });

    it("renders *** as <hr>", async () => {
      const host = await renderAIMessage("***");
      expect(host.querySelector("hr")).toBeTruthy();
    });

    it("renders ___ as <hr>", async () => {
      const host = await renderAIMessage("___");
      expect(host.querySelector("hr")).toBeTruthy();
    });

    it("renders space-separated dashes as <hr>", async () => {
      const host = await renderAIMessage("- - -");
      expect(host.querySelector("hr")).toBeTruthy();
    });

    it("renders longer dash sequences as <hr>", async () => {
      const host = await renderAIMessage("----------");
      expect(host.querySelector("hr")).toBeTruthy();
    });

    it("does not render multi-line blocks as hr", async () => {
      const host = await renderAIMessage("---\n\ntexto");
      expect(host.querySelector("hr")).toBeTruthy();
      expect(host.querySelector("p")?.textContent).toBe("texto");
    });
  });

  // ── inline formatting ──
  describe("inline formatting", () => {
    it("renders **bold** as <strong>", async () => {
      const host = await renderAIMessage("Texto con **negrita** incluida.");
      expect(host.querySelector("strong")?.textContent).toBe("negrita");
    });

    it("renders *italic* as <em>", async () => {
      const host = await renderAIMessage("Texto con *cursiva* incluida.");
      expect(host.querySelector("em")?.textContent).toBe("cursiva");
    });

    it("renders `code` as <code>", async () => {
      const host = await renderAIMessage("Usa `console.log()` para debuggear.");
      const code = host.querySelector("code");
      expect(code?.textContent).toBe("console.log()");
      expect(code?.className).toContain("font-mono");
    });

    it("renders [text](url) as <a> link", async () => {
      const host = await renderAIMessage("Visita [el sitio](https://example.com) para mas info.");
      const a = host.querySelector("a");
      expect(a?.textContent).toBe("el sitio");
      expect(a?.getAttribute("href")).toBe("https://example.com");
      expect(a?.getAttribute("target")).toBe("_blank");
      expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("renders ~~text~~ as <del>", async () => {
      const host = await renderAIMessage("Este item esta ~~obsoleto~~.");
      expect(host.querySelector("del")?.textContent).toBe("obsoleto");
    });

    it("renders multiple inline formats in one paragraph", async () => {
      const host = await renderAIMessage("Texto con **negrita**, *cursiva*, `codigo`, [link](https://x.com), y ~~tachado~~.");
      expect(host.querySelector("strong")?.textContent).toBe("negrita");
      expect(host.querySelector("em")?.textContent).toBe("cursiva");
      expect(host.querySelector("code")?.textContent).toBe("codigo");
      expect(host.querySelector("a")?.textContent).toBe("link");
      expect(host.querySelector("del")?.textContent).toBe("tachado");
    });

    it("strips HTML <br> tags via formatAiText", async () => {
      const host = await renderAIMessage("linea1<br>linea2");
      const p = host.querySelector("p");
      expect(p?.textContent).toContain("linea1");
      expect(p?.textContent).toContain("linea2");
      expect(p?.innerHTML).not.toContain("<br>");
    });

    it("strips HTML tags via formatAiText", async () => {
      const host = await renderAIMessage("<strong>bold</strong> and <span>text</span>");
      const p = host.querySelector("p");
      expect(p?.textContent).toContain("bold");
      expect(p?.textContent).toContain("text");
      expect(p?.innerHTML).not.toContain("<strong>");
      expect(p?.innerHTML).not.toContain("<span>");
    });
  });

  // ── mixed content ──
  describe("mixed content", () => {
    it("renders heading followed by paragraph", async () => {
      const host = await renderAIMessage("## Titulo\n\nParrafo de contenido.");
      expect(host.querySelector("h3")?.textContent).toBe("Titulo");
      expect(host.querySelector("p")?.textContent).toBe("Parrafo de contenido.");
    });

    it("renders blockquote followed by list", async () => {
      const host = await renderAIMessage("> Nota importante\n\n- Item A\n- Item B");
      expect(host.querySelector("blockquote")).toBeTruthy();
      expect(host.querySelector("ul")?.querySelectorAll("li").length).toBe(2);
    });

    it("renders table between paragraphs", async () => {
      const host = await renderAIMessage(
        "Antes de la tabla.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nDespues de la tabla.",
      );
      const paragraphs = host.querySelectorAll("p");
      expect(paragraphs[0]?.textContent).toBe("Antes de la tabla.");
      expect(host.querySelector("table")).toBeTruthy();
      expect(paragraphs[1]?.textContent).toBe("Despues de la tabla.");
    });

    it("renders hr between paragraphs", async () => {
      const host = await renderAIMessage("Antes.\n\n---\n\nDespues.");
      expect(host.querySelector("hr")).toBeTruthy();
      const paragraphs = host.querySelectorAll("p");
      expect(paragraphs[0]?.textContent).toBe("Antes.");
      expect(paragraphs[1]?.textContent).toBe("Despues.");
    });
  });

  // ── real-world AI output ──
  describe("real-world AI output", () => {
    it("cleans typical AI response with bold, br tags, and bullet list", async () => {
      const host = await renderAIMessage(
        "**Unidad y metrologia**<br><br>189.71 PEN/m3 en sus componentes:<br><br>- Material A<br>- Material B",
        "GPT-5",
      );
      // Bold should render as <strong>
      expect(host.querySelector("strong")?.textContent).toBe("Unidad y metrologia");
      // <br> should be stripped from rendered output
      const p = host.querySelector("p");
      expect(p?.innerHTML).not.toContain("<br>");
      // List items should render inside <ul>
      const listItems = host.querySelector("ul")?.querySelectorAll("li");
      expect(listItems?.length).toBe(2);
      expect(listItems?.[0]?.textContent).toBe("Material A");
      expect(listItems?.[1]?.textContent).toBe("Material B");
    });

    it("cleans AI response with bold inline and no list when mixed in same paragraph", async () => {
      const host = await renderAIMessage(
        "**Unidad y metrologia**<br>189.71 PEN/m3 en sus componentes:<br>- Material A<br>- Material B",
        "GPT-5",
      );
      // Bold renders correctly
      expect(host.querySelector("strong")?.textContent).toBe("Unidad y metrologia");
      // No <br> tags in output
      const p = host.querySelector("p");
      expect(p?.innerHTML).not.toContain("<br>");
      // When no double newlines, list markers stay as text inside the paragraph
      expect(p?.textContent).toContain("- Material A");
      expect(p?.textContent).toContain("- Material B");
      // No <ul> is created since it's all one paragraph block
      expect(host.querySelector("ul")).toBeNull();
    });

    it("renders model name when provided", async () => {
      const host = await renderAIMessage("Respuesta simple.", "gemma3:12b");
      expect(host.textContent).toContain("gemma3:12b");
    });
  });
});
