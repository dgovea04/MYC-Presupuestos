/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TemplateLibraryPageContent } from "@/components/templates/template-library-page-content";
import { getTemplateLibrarySummary, listTemplateLibraryItems } from "@/lib/templates/template-library";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

const navigationMocks = vi.hoisted(() => ({
  pathname: "/templates",
  queryString: "",
  replace: vi.fn(),
  writeText: vi.fn(),
}));

beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMocks.pathname,
  useRouter: () => ({ replace: navigationMocks.replace }),
  useSearchParams: () => new URLSearchParams(navigationMocks.queryString),
}));

beforeEach(() => {
  navigationMocks.pathname = "/templates";
  navigationMocks.queryString = "";
  navigationMocks.replace.mockReset();
  navigationMocks.writeText.mockReset();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: navigationMocks.writeText,
    },
  });
});

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

describe("TemplateLibraryPageContent", () => {
  it("renders summary metrics and grouped template cards", () => {
    const items = listTemplateLibraryItems();
    const markup = renderToStaticMarkup(
      <TemplateLibraryPageContent items={items} summary={getTemplateLibrarySummary(items)} />,
    );

    expect(markup).toContain("Plantillas");
    expect(markup).toContain("Actividad de plantillas");
    expect(markup).toContain("Presupuesto de edificacion base");
    expect(markup).toContain("Gastos generales fijos");
    expect(markup).toContain("Gastos generales variables");
    expect(markup).toContain("Concreto");
    expect(markup).toContain("1 plantilla");
    expect(markup).toContain("10 plantillas");
    expect(markup).toContain('href="/projects/new?template=budget-edificacion-base"');
    expect(markup).toContain('href="/metrados-avanzados?template=metrado-concrete"');
  });

  it("renders recent template activity links", () => {
    const items = listTemplateLibraryItems();
    const markup = renderToStaticMarkup(
      <TemplateLibraryPageContent
        items={items}
        summary={getTemplateLibrarySummary(items)}
        activityEvents={[
          {
            id: "activity-template-1",
            type: "BUDGET_UPDATED",
            title: "Plantilla actualizada",
            detail: "Arquitectura costa",
            href: "/templates/budget/template-1",
            createdAt: new Date("2026-05-30T12:00:00.000Z"),
          },
          {
            id: "activity-template-2",
            type: "BUDGET_CREATED",
            title: "Presupuesto creado desde plantilla",
            detail: "Presupuesto general desde Arquitectura",
            href: "/budgets/budget-1",
            createdAt: new Date("2026-05-29T12:00:00.000Z"),
          },
        ]}
      />,
    );

    expect(markup).toContain("2 recientes");
    expect(markup).toContain("Plantilla actualizada");
    expect(markup).toContain("Arquitectura costa");
    expect(markup).toContain('href="/templates/budget/template-1"');
    expect(markup).toContain("Presupuesto creado desde plantilla");
    expect(markup).toContain('href="/budgets/budget-1"');
  });

  it("renders user templates with a dedicated source badge", () => {
    const items = listTemplateLibraryItems([
      {
        id: "budget-snapshot-budget-1",
        module: "BUDGET",
        name: "Arquitectura reusable",
        description: "Plantilla capturada desde Arquitectura.",
        tags: ["Subpresupuesto", "PEN", "12 partidas"],
        status: "AVAILABLE",
        source: "USER",
        actionLabel: "Aplicar plantilla",
        updatedAt: "2026-05-30T10:00:00.000Z",
      },
    ]);
    const markup = renderToStaticMarkup(
      <TemplateLibraryPageContent items={items} summary={getTemplateLibrarySummary(items)} />,
    );

    expect(markup).toContain("Arquitectura reusable");
    expect(markup).toContain("Usuario");
    expect(markup).toContain("12 partidas");
    expect(markup).toContain("Actualizada");
    expect(markup).toContain("2026");
    expect(markup).toContain("Sistema 1");
    expect(markup).toContain("Usuario 1");
  });

  it("summarizes hidden template tags when a card has more than four tags", () => {
    const items = listTemplateLibraryItems([
      {
        id: "budget-snapshot-budget-1",
        module: "BUDGET",
        name: "Arquitectura reusable",
        description: "Plantilla capturada desde Arquitectura.",
        tags: ["Subpresupuesto", "PEN", "12 partidas", "Arquitectura", "Costa", "Control"],
        status: "AVAILABLE",
        source: "USER",
        actionLabel: "Aplicar plantilla",
      },
    ]);
    const markup = renderToStaticMarkup(
      <TemplateLibraryPageContent items={items} summary={getTemplateLibrarySummary(items)} />,
    );

    expect(markup).toContain("Arquitectura reusable");
    expect(markup).toContain("Arquitectura");
    expect(markup).toContain("+2 etiquetas");
    expect(markup).toContain('aria-label="2 etiquetas adicionales"');
    expect(markup).toContain('title="2 etiquetas adicionales"');
    expect(markup).not.toContain("Costa");
    expect(markup).not.toContain("Control");
  });

  it("filters template cards by search text", async () => {
    const items = listTemplateLibraryItems([
      {
        id: "budget-snapshot-budget-1",
        module: "BUDGET",
        name: "Arquitectura reusable",
        description: "Plantilla capturada desde Arquitectura.",
        tags: ["Subpresupuesto", "PEN", "12 partidas"],
        status: "AVAILABLE",
        source: "USER",
        actionLabel: "Aplicar plantilla",
      },
    ]);
    const container = await renderNode(
      <TemplateLibraryPageContent items={items} summary={getTemplateLibrarySummary(items)} />,
    );

    expect(container.textContent).toContain("Arquitectura reusable");
    expect(container.textContent).toContain("Presupuesto de edificacion base");

    const input = container.querySelector('input[aria-label="Buscar plantillas"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Search input was not rendered");
    }

    await act(async () => {
      setInputValue(input, "arquitectura");
      await Promise.resolve();
    });

    expect(navigationMocks.replace).toHaveBeenLastCalledWith("/templates?q=arquitectura", { scroll: false });
    expect(container.textContent).toContain("1 de 16 visibles");
    expect(container.textContent).toContain("Arquitectura reusable");
    expect(container.textContent).not.toContain("Presupuesto de edificacion base");

    const clearSearchButton = container.querySelector('button[aria-label="Limpiar busqueda de plantillas"]');
    if (!(clearSearchButton instanceof HTMLButtonElement)) {
      throw new Error("Inline clear search button was not rendered");
    }

    await act(async () => {
      clearSearchButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(navigationMocks.replace).toHaveBeenLastCalledWith("/templates", { scroll: false });
    expect(input.value).toBe("");
    expect(container.textContent).toContain("16 de 16 visibles");
    expect(container.textContent).toContain("Presupuesto de edificacion base");
  });

  it("uses initial filters from the route query", () => {
    const items = listTemplateLibraryItems();
    const markup = renderToStaticMarkup(
      <TemplateLibraryPageContent
        items={items}
        summary={getTemplateLibrarySummary(items)}
        initialFilters={{ module: "GENERAL_EXPENSES", source: "WORKBOOK", query: "variables" }}
      />,
    );

    expect(markup).toContain("1 de 15 visibles");
    expect(markup).toContain("1 visible");
    expect(markup).toContain("Gastos generales variables");
    expect(markup).not.toContain("Gastos generales fijos");
    expect(markup).not.toContain("Presupuesto de edificacion base");
    expect(markup).toContain('value="variables"');
    expect(markup).toContain('<option value="GENERAL_EXPENSES" selected="">Gastos generales</option>');
    expect(markup).toContain('<option value="WORKBOOK" selected="">Workbook</option>');
    expect(markup).toContain("Busqueda: variables");
    expect(markup).toContain("Modulo: Gastos generales");
    expect(markup).toContain("Origen: Workbook");
    expect(markup).toContain("3 activos");
  });

  it("clears active filter chips individually", async () => {
    const items = listTemplateLibraryItems();
    navigationMocks.queryString = "module=GENERAL_EXPENSES&source=WORKBOOK&q=variables";
    const container = await renderNode(
      <TemplateLibraryPageContent
        items={items}
        summary={getTemplateLibrarySummary(items)}
        initialFilters={{ module: "GENERAL_EXPENSES", source: "WORKBOOK", query: "variables" }}
      />,
    );

    expect(container.textContent).toContain("Busqueda: variables");
    expect(container.textContent).toContain("1 de 15 visibles");
    expect(container.textContent).toContain("Gastos generales variables");
    expect(container.textContent).not.toContain("Gastos generales fijos");

    const clearSearchButton = container.querySelector('button[aria-label="Quitar busqueda"]');
    if (!(clearSearchButton instanceof HTMLButtonElement)) {
      throw new Error("Search filter chip clear button was not rendered");
    }

    await act(async () => {
      clearSearchButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(navigationMocks.replace).toHaveBeenLastCalledWith("/templates?module=GENERAL_EXPENSES&source=WORKBOOK", {
      scroll: false,
    });
    expect(container.textContent).not.toContain("Busqueda: variables");
    expect(container.textContent).toContain("2 de 15 visibles");
    expect(container.textContent).toContain("Gastos generales fijos");
    expect(container.textContent).toContain("Gastos generales variables");
  });

  it("clears all filters from the empty state", async () => {
    const items = listTemplateLibraryItems();
    navigationMocks.queryString = "module=GENERAL_EXPENSES&source=USER&q=inexistente&sort=UPDATED_DESC";
    const container = await renderNode(
      <TemplateLibraryPageContent
        items={items}
        summary={getTemplateLibrarySummary(items)}
        initialFilters={{ module: "GENERAL_EXPENSES", source: "USER", query: "inexistente", sort: "UPDATED_DESC" }}
      />,
    );

    expect(container.textContent).toContain("0 de 15 visibles");
    expect(container.textContent).toContain("No hay plantillas que coincidan con los filtros actuales.");

    const clearFiltersButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Limpiar filtros",
    );
    if (!(clearFiltersButton instanceof HTMLButtonElement)) {
      throw new Error("Empty state clear filters button was not rendered");
    }

    await act(async () => {
      clearFiltersButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(navigationMocks.replace).toHaveBeenLastCalledWith("/templates", { scroll: false });
    expect(container.textContent).toContain("15 de 15 visibles");
    expect(container.textContent).toContain("Presupuesto de edificacion base");
    expect(container.textContent).not.toContain("No hay plantillas que coincidan con los filtros actuales.");
  });

  it("copies the current filtered library link", async () => {
    const items = listTemplateLibraryItems();
    const container = await renderNode(
      <TemplateLibraryPageContent
        items={items}
        summary={getTemplateLibrarySummary(items)}
        initialFilters={{ module: "GENERAL_EXPENSES", source: "WORKBOOK", query: "variables", sort: "UPDATED_DESC" }}
      />,
    );

    const copyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Copiar enlace",
    );
    if (!(copyButton instanceof HTMLButtonElement)) {
      throw new Error("Copy link button was not rendered");
    }

    await act(async () => {
      copyButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(navigationMocks.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/templates?q=variables&module=GENERAL_EXPENSES&source=WORKBOOK&sort=UPDATED_DESC"),
    );
    expect(container.textContent).toContain("Copiado");
  });

  it("filters by module from the module summary cards", async () => {
    const items = listTemplateLibraryItems();
    const container = await renderNode(
      <TemplateLibraryPageContent items={items} summary={getTemplateLibrarySummary(items)} />,
    );

    expect(container.textContent).toContain("Presupuesto de edificacion base");
    expect(container.textContent).toContain("Concreto");

    const moduleButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Ver 2 plantillas",
    );
    if (!(moduleButton instanceof HTMLButtonElement)) {
      throw new Error("General expenses module button was not rendered");
    }

    await act(async () => {
      moduleButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(moduleButton.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("2 de 15 visibles");
    expect(container.textContent).toContain("Gastos generales fijos");
    expect(container.textContent).toContain("Gastos generales variables");
    expect(container.textContent).not.toContain("Presupuesto de edificacion base");
    expect(container.textContent).not.toContain("Concreto");

    await act(async () => {
      moduleButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(navigationMocks.replace).toHaveBeenLastCalledWith("/templates", { scroll: false });
    expect(container.textContent).toContain("15 de 15 visibles");
    expect(container.textContent).toContain("Presupuesto de edificacion base");
    expect(container.textContent).toContain("Concreto");
  });

  it("filters by source from quick source shortcuts", async () => {
    const items = listTemplateLibraryItems([
      {
        id: "budget-snapshot-budget-1",
        module: "BUDGET",
        name: "Arquitectura reusable",
        description: "Plantilla capturada desde Arquitectura.",
        tags: ["Subpresupuesto", "PEN", "12 partidas"],
        status: "AVAILABLE",
        source: "USER",
        actionLabel: "Aplicar plantilla",
      },
    ]);
    const container = await renderNode(
      <TemplateLibraryPageContent items={items} summary={getTemplateLibrarySummary(items)} />,
    );

    expect(container.textContent).toContain("Presupuesto de edificacion base");
    expect(container.textContent).toContain("Gastos generales fijos");
    expect(container.textContent).toContain("Arquitectura reusable");

    const sourceButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Usuario (1)",
    );
    if (!(sourceButton instanceof HTMLButtonElement)) {
      throw new Error("User source shortcut was not rendered");
    }

    await act(async () => {
      sourceButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(sourceButton.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("1 de 16 visibles");
    expect(container.textContent).toContain("1 activo");
    expect(container.textContent).toContain("Arquitectura reusable");
    expect(container.textContent).not.toContain("Presupuesto de edificacion base");
    expect(container.textContent).not.toContain("Gastos generales fijos");

    await act(async () => {
      sourceButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(navigationMocks.replace).toHaveBeenLastCalledWith("/templates", { scroll: false });
    expect(container.textContent).toContain("16 de 16 visibles");
    expect(container.textContent).not.toContain("1 activo");
    expect(container.textContent).toContain("Arquitectura reusable");
    expect(container.textContent).toContain("Presupuesto de edificacion base");
  });

  it("scopes source shortcut counts to the active module filter", async () => {
    const items = listTemplateLibraryItems([
      {
        id: "budget-snapshot-budget-1",
        module: "BUDGET",
        name: "Arquitectura reusable",
        description: "Plantilla capturada desde Arquitectura.",
        tags: ["Subpresupuesto", "PEN", "12 partidas"],
        status: "AVAILABLE",
        source: "USER",
        actionLabel: "Aplicar plantilla",
      },
      {
        id: "expenses-snapshot-1",
        module: "GENERAL_EXPENSES",
        name: "Gastos propios",
        description: "Plantilla propia de gastos generales.",
        tags: ["Indirectos", "PEN"],
        status: "AVAILABLE",
        source: "USER",
        actionLabel: "Aplicar plantilla",
      },
    ]);
    const container = await renderNode(
      <TemplateLibraryPageContent items={items} summary={getTemplateLibrarySummary(items)} />,
    );

    const moduleButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Ver 3 plantillas",
    );
    if (!(moduleButton instanceof HTMLButtonElement)) {
      throw new Error("General expenses module button was not rendered");
    }

    await act(async () => {
      moduleButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Todos (3)");
    expect(container.textContent).toContain("Sistema (0)");
    expect(container.textContent).toContain("Workbook (2)");
    expect(container.textContent).toContain("Usuario (1)");
  });

  it("filters by module and source from module source badges", async () => {
    const items = listTemplateLibraryItems([
      {
        id: "budget-snapshot-budget-1",
        module: "BUDGET",
        name: "Arquitectura reusable",
        description: "Plantilla capturada desde Arquitectura.",
        tags: ["Subpresupuesto", "PEN", "12 partidas"],
        status: "AVAILABLE",
        source: "USER",
        actionLabel: "Aplicar plantilla",
      },
      {
        id: "expenses-snapshot-1",
        module: "GENERAL_EXPENSES",
        name: "Gastos propios",
        description: "Plantilla propia de gastos generales.",
        tags: ["Indirectos", "PEN"],
        status: "AVAILABLE",
        source: "USER",
        actionLabel: "Aplicar plantilla",
      },
    ]);
    const container = await renderNode(
      <TemplateLibraryPageContent items={items} summary={getTemplateLibrarySummary(items)} />,
    );

    const budgetUserBadge = container.querySelector('button[aria-label="Ver Usuario en Presupuestos"]');
    if (!(budgetUserBadge instanceof HTMLButtonElement)) {
      throw new Error("Budget user source badge was not rendered");
    }

    await act(async () => {
      budgetUserBadge.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(navigationMocks.replace).toHaveBeenLastCalledWith("/templates?module=BUDGET&source=USER", { scroll: false });
    expect(container.textContent).toContain("1 de 17 visibles");
    expect(container.textContent).toContain("Arquitectura reusable");
    expect(container.textContent).not.toContain("Gastos propios");
    expect(container.textContent).not.toContain("Presupuesto de edificacion base");
  });

  it("sorts visible templates by last update", async () => {
    const items = listTemplateLibraryItems([
      {
        id: "budget-template-old",
        module: "BUDGET",
        name: "Plantilla antigua",
        description: "Plantilla capturada desde Arquitectura.",
        tags: ["Subpresupuesto", "PEN", "4 partidas"],
        status: "AVAILABLE",
        source: "USER",
        actionLabel: "Ver plantilla",
        updatedAt: "2026-05-28T10:00:00.000Z",
      },
      {
        id: "budget-template-new",
        module: "BUDGET",
        name: "Plantilla reciente",
        description: "Plantilla capturada desde Estructuras.",
        tags: ["Subpresupuesto", "PEN", "8 partidas"],
        status: "AVAILABLE",
        source: "USER",
        actionLabel: "Ver plantilla",
        updatedAt: "2026-05-30T10:00:00.000Z",
      },
    ]);
    const container = await renderNode(
      <TemplateLibraryPageContent items={items} summary={getTemplateLibrarySummary(items)} />,
    );

    const sortTrigger = container.querySelector('button[aria-label="Ordenar plantillas"]');
    if (!(sortTrigger instanceof HTMLButtonElement)) {
      throw new Error("Sort trigger was not rendered");
    }

    await act(async () => {
      sortTrigger.click();
    });

    const updatedOption = Array.from(document.body.querySelectorAll('[role="option"]')).find(
      (option) => option.textContent === "Actualizadas",
    );
    if (!(updatedOption instanceof HTMLElement)) {
      throw new Error("Updated sort option was not rendered");
    }

    await act(async () => {
      updatedOption.click();
      await Promise.resolve();
    });

    expect(navigationMocks.replace).toHaveBeenLastCalledWith("/templates?sort=UPDATED_DESC", { scroll: false });
    const content = container.textContent ?? "";
    expect(content.indexOf("Plantilla reciente")).toBeLessThan(content.indexOf("Plantilla antigua"));
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
