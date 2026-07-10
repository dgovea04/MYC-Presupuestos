/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { McpImporterPageContent } from "./mcp-importer-page-content";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;
const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.fetch = fetchMock;
  fetchMock.mockReset();
});

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

/**
 * Sets a File on an HTMLInputElement[type=file] in jsdom using Object.defineProperty.
 * Avoids DataTransfer which may not be available in all jsdom versions.
 */
function setFileOnInput(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", {
    value: {
      0: file,
      length: 1,
      item: (_index: number) => file,
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as FileList,
    writable: false,
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function makeCompanies() {
  return [
    { id: "company-1", name: "MC SAC" },
    { id: "company-2", name: "Constructora Norte" },
  ];
}

function makeAnalyzeResponse(): Response {
  return new Response(
    JSON.stringify({
      compatibility: "supported",
      projectName: "Proyecto de prueba",
      formatVersion: "1.0.0",
      sourceApp: "MC Presupuestos",
      sourceAppVersion: "0.1.0",
      modules: [
        { id: "project", present: true, required: true },
        { id: "budgets", present: true, required: true },
        { id: "budget_items", present: true, required: true },
        { id: "apus", present: true, required: true },
        { id: "general_expenses", present: true, required: false },
        { id: "polynomial_formula", present: false, required: false },
      ],
      warnings: [],
      errors: [],
      fileEntries: {},
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function makeImportResponse(): Response {
  return new Response(
    JSON.stringify({
      projectId: "project-imported-1",
      projectName: "Proyecto de prueba",
      generalBudgetId: "budget-g-1",
      subBudgetIds: ["budget-sub-1"],
      budgetCount: 2,
      itemCount: 10,
      apuCount: 5,
      resourceCount: 15,
      warnings: [],
    }),
    { status: 201, headers: { "Content-Type": "application/json" } },
  );
}

async function renderNode(node: React.ReactNode): Promise<HTMLDivElement> {
  activeContainer = document.createElement("div");
  document.body.appendChild(activeContainer);

  const root = createRoot(activeContainer);
  (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(node);
  });

  return activeContainer;
}

/** Finds a button in the container whose textContent includes the given string. */
function findButton(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((btn) =>
    btn.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
}

describe("McpImporterPageContent", () => {
  it("renders the file input and company selector", async () => {
    const container = await renderNode(<McpImporterPageContent companies={makeCompanies()} />);

    // Header text visible
    expect(container.textContent).toContain("Archivo .mcp");
    expect(container.textContent).toContain("Selecciona un paquete .mcp");

    // File input present
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    // Company selector with options
    const select = container.querySelector("select");
    expect(select).not.toBeNull();
    expect(container.textContent).toContain("MC SAC");
    expect(container.textContent).toContain("Constructora Norte");

    // Analyze button present
    expect(container.textContent).toContain("Analizar");

    // Status badge shows "Pendiente"
    expect(container.textContent).toContain("Pendiente");
  });

  it("shows a warning when no companies are provided", async () => {
    const container = await renderNode(<McpImporterPageContent companies={[]} />);

    expect(container.textContent).toContain("Crea una empresa antes de importar proyectos .mcp.");
    expect(container.textContent).toContain("Sin empresas");

    // Select should be disabled
    const select = container.querySelector("select");
    expect(select?.hasAttribute("disabled")).toBe(true);
  });

  it("disables the analyze button when no file is selected", async () => {
    const container = await renderNode(<McpImporterPageContent companies={makeCompanies()} />);

    const analyzeButton = findButton(container, "Analizar");
    expect(analyzeButton).not.toBeNull();
    expect(analyzeButton?.hasAttribute("disabled")).toBe(true);
  });

  it("shows the preview after a successful analyze", async () => {
    fetchMock.mockResolvedValueOnce(makeAnalyzeResponse());
    const container = await renderNode(<McpImporterPageContent companies={makeCompanies()} />);

    // Select a file
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(100)], "proyecto.mcp");
    await act(async () => {
      setFileOnInput(fileInput, file);
    });

    // Button should now be enabled
    const analyzeButton = findButton(container, "Analizar");
    expect(analyzeButton?.hasAttribute("disabled")).toBe(false);

    // Click analyze
    await act(async () => {
      analyzeButton?.click();
    });

    // Wait for fetch to resolve and state to update
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Should show project name in preview section
    expect(container.textContent).toContain("Proyecto de prueba");
    expect(container.textContent).toContain("Formato 1.0.0");
    expect(container.textContent).toContain("Exportado desde MC Presupuestos");

    // Should show module count
    expect(container.textContent).toContain("modulos");

    // Should show import button
    expect(container.textContent).toContain("Importar a MC");

    // Module table rows
    expect(container.textContent).toContain("project");
    expect(container.textContent).toContain("budgets");
  });

  it("shows the import result after a successful import", async () => {
    // First fetch is analyze, second is import
    fetchMock
      .mockResolvedValueOnce(makeAnalyzeResponse())
      .mockResolvedValueOnce(makeImportResponse());

    const container = await renderNode(<McpImporterPageContent companies={makeCompanies()} />);

    // Select a file
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      setFileOnInput(fileInput, new File([new Uint8Array(100)], "proyecto.mcp"));
    });

    // Click analyze
    await act(async () => {
      findButton(container, "Analizar")?.click();
    });

    // Wait for analyze to resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Click import button
    await act(async () => {
      findButton(container, "Importar a MC")?.click();
    });

    // Wait for import to resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Should show import result
    expect(container.textContent).toContain("Proyecto de prueba");
    expect(container.textContent).toContain("presupuestos");
    expect(container.textContent).toContain("partidas");
    expect(container.textContent).toContain("5 APUs");

    // Should have project and budget links
    const links = container.querySelectorAll("a");
    const projectLink = Array.from(links).find((link) => link.textContent?.includes("Proyecto"));
    const budgetLink = Array.from(links).find((link) => link.textContent?.includes("Presupuesto"));
    expect(projectLink).not.toBeNull();
    expect(budgetLink).not.toBeNull();
    expect(projectLink?.getAttribute("href")).toBe("/projects/project-imported-1");
    expect(budgetLink?.getAttribute("href")).toBe("/budgets/budget-g-1");
  });

  it("shows error when analyze fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("No se pudo analizar el archivo .mcp."));
    const container = await renderNode(<McpImporterPageContent companies={makeCompanies()} />);

    // Select a file
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      setFileOnInput(fileInput, new File([new Uint8Array(100)], "proyecto.mcp"));
    });

    // Click analyze
    await act(async () => {
      findButton(container, "Analizar")?.click();
    });

    // Wait for fetch to reject
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Should show error
    expect(container.textContent).toContain("No se pudo analizar el archivo .mcp.");
  });

  it("shows the unsupported package warning when compatibility is unsupported", async () => {
    const response = new Response(
      JSON.stringify({
        compatibility: "unsupported",
        projectName: "Proyecto incompatible",
        formatVersion: "2.0.0",
        sourceApp: "MC Presupuestos",
        sourceAppVersion: "0.2.0",
        modules: [],
        warnings: [],
        errors: ["Falta el modulo obligatorio project.json."],
        fileEntries: {},
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
    fetchMock.mockResolvedValueOnce(response);

    const container = await renderNode(<McpImporterPageContent companies={makeCompanies()} />);

    // Select a file and analyze
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      setFileOnInput(fileInput, new File([new Uint8Array(100)], "incompatible.mcp"));
    });
    await act(async () => {
      findButton(container, "Analizar")?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Should show unsupported message
    expect(container.textContent).toContain("El paquete .mcp no es compatible");
    expect(container.textContent).toContain("Falta el modulo obligatorio project.json.");
    // Should NOT show the import button
    expect(container.textContent).not.toContain("Importar a MC");
  });

  it("shows warnings in the preview when supported_with_warnings", async () => {
    const response = new Response(
      JSON.stringify({
        compatibility: "supported_with_warnings",
        projectName: "Proyecto con warnings",
        formatVersion: "1.0.0",
        sourceApp: "MC Presupuestos",
        sourceAppVersion: "0.1.0",
        modules: [
          { id: "project", present: true, required: true },
          { id: "budgets", present: true, required: true },
        ],
        warnings: ["Modulo opcional polynomial-formula/formula.json no incluido."],
        errors: [],
        fileEntries: {},
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
    fetchMock.mockResolvedValueOnce(response);

    const container = await renderNode(<McpImporterPageContent companies={makeCompanies()} />);

    // Select a file and analyze
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      setFileOnInput(fileInput, new File([new Uint8Array(100)], "project.mcp"));
    });
    await act(async () => {
      findButton(container, "Analizar")?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Should show warnings section
    expect(container.textContent).toContain("Advertencias");
    expect(container.textContent).toContain("Modulo opcional polynomial-formula/formula.json no incluido.");
  });

  it("shows import warnings in the import result", async () => {
    fetchMock.mockResolvedValueOnce(makeAnalyzeResponse());
    const importResponse = new Response(
      JSON.stringify({
        projectId: "project-warn-1",
        projectName: "Proyecto con warnings",
        generalBudgetId: "budget-g-1",
        subBudgetIds: [],
        budgetCount: 1,
        itemCount: 0,
        apuCount: 0,
        resourceCount: 0,
        warnings: ["No se pudo restaurar la formula polinomica."],
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
    fetchMock.mockResolvedValueOnce(importResponse);

    const container = await renderNode(<McpImporterPageContent companies={makeCompanies()} />);

    // Select file, analyze, import
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      setFileOnInput(fileInput, new File([new Uint8Array(100)], "proyecto.mcp"));
    });
    await act(async () => { findButton(container, "Analizar")?.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    await act(async () => { findButton(container, "Importar a MC")?.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });

    // Should show import warnings
    expect(container.textContent).toContain("advertencias durante la importacion");
  });

  it("preselects the first company by default", async () => {
    const container = await renderNode(<McpImporterPageContent companies={makeCompanies()} />);

    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe("company-1");
  });

  it("disables the import button when no company is selected", async () => {
    // Render with a single company but no default (empty string ID)
    fetchMock.mockResolvedValueOnce(makeAnalyzeResponse());
    const container = await renderNode(
      <McpImporterPageContent companies={[{ id: "", name: "Sin empresa" }]} />,
    );

    // Select a file and analyze
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      setFileOnInput(fileInput, new File([new Uint8Array(100)], "proyecto.mcp"));
    });
    await act(async () => {
      findButton(container, "Analizar")?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Import button should be disabled since companyId is empty
    const importButton = findButton(container, "Importar a MC");
    expect(importButton).not.toBeNull();
    expect(importButton?.hasAttribute("disabled")).toBe(true);
  });
});
