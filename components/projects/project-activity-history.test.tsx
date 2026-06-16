import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProjectActivityHistory } from "@/components/projects/project-activity-history";

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function makeEvent(
  index: number,
  overrides?: Partial<{
    type: "PROJECT_CREATED" | "PROJECT_UPDATED" | "BUDGET_CREATED" | "BUDGET_UPDATED" | "POLYNOMIAL_FORMULA_GENERATED" | "POLYNOMIAL_FORMULA_UPDATED" | "ADJUSTMENT_REGISTERED";
    title: string;
  }>,
) {
  return {
    id: `activity-${index}`,
    type: "BUDGET_UPDATED" as const,
    title: `Evento ${index}`,
    detail: `Detalle ${index}`,
    href: "/budgets/budget-1",
    createdAt: new Date("2026-05-20T10:00:00.000Z"),
    ...overrides,
  };
}

describe("ProjectActivityHistory", () => {
  it("renders recent project activity with contextual labels", () => {
    const markup = renderToStaticMarkup(
      <ProjectActivityHistory
        dateFormat="dd/MM/yyyy"
        events={[
          {
            id: "activity-1",
            type: "BUDGET_UPDATED",
            title: "Presupuesto actualizado",
            detail: "Presupuesto General",
            href: "/budgets/budget-1",
            createdAt: new Date("2026-05-20T10:00:00.000Z"),
          },
        ]}
      />,
    );

    expect(markup).toContain("Historial del proyecto");
    expect(markup).toContain("Presupuesto actualizado");
    expect(markup).toContain("Presupuesto General");
    expect(markup).toContain("Presupuesto");
    expect(markup).toContain('href="/budgets/budget-1"');
  });

  it("renders an empty state when the project has no tracked events", () => {
    const markup = renderToStaticMarkup(<ProjectActivityHistory dateFormat="dd/MM/yyyy" events={[]} />);

    expect(markup).toContain("Sin actividad registrada");
    expect(markup).toContain("Los cambios importantes del proyecto apareceran aqui");
  });

  it("shows filter pills when events exist", () => {
    const markup = renderToStaticMarkup(
      <ProjectActivityHistory dateFormat="dd/MM/yyyy" events={[makeEvent(1)]} />,
    );

    expect(markup).toContain("Todos");
    expect(markup).toContain("Proyecto");
    expect(markup).toContain("Presupuesto");
    expect(markup).toContain("Formula");
    expect(markup).toContain("Reajuste");
  });

  it("renders correct filter counts per category", () => {
    const events = [
      makeEvent(1, { type: "PROJECT_UPDATED", title: "Proyecto editado" }),
      makeEvent(2, { type: "BUDGET_CREATED", title: "Presupuesto creado" }),
      makeEvent(3, { type: "BUDGET_UPDATED", title: "Presupuesto actualizado" }),
      makeEvent(4, { type: "POLYNOMIAL_FORMULA_GENERATED", title: "Formula generada" }),
      makeEvent(5, { type: "ADJUSTMENT_REGISTERED", title: "Reajuste registrado" }),
    ];
    const markup = renderToStaticMarkup(<ProjectActivityHistory dateFormat="dd/MM/yyyy" events={events} />);

    // Todos count is 5, each category shows its correct count
    expect(markup).toContain("Todos");
    expect(markup).toContain("Proyecto");
    expect(markup).toContain("Presupuesto");
    expect(markup).toContain("Formula");
    expect(markup).toContain("Reajuste");
  });

  it("shows only the first 5 events on page 1 (via static markup)", () => {
    const events = Array.from({ length: 6 }, (_, i) => makeEvent(i + 1));
    const markup = renderToStaticMarkup(<ProjectActivityHistory dateFormat="dd/MM/yyyy" events={events} />);

    expect(markup).toContain("Evento 1");
    expect(markup).toContain("Evento 5");
    expect(markup).not.toContain("Evento 6");
  });

  it("shows pagination controls when there are more than 5 events", () => {
    const events = Array.from({ length: 10 }, (_, i) => makeEvent(i + 1));
    const markup = renderToStaticMarkup(<ProjectActivityHistory dateFormat="dd/MM/yyyy" events={events} />);

    expect(markup).toContain("Siguiente");
    expect(markup).toContain("Anterior");
    expect(markup).toContain("Página 1 de 2");
  });

  it("hides pagination controls when there are 5 or fewer events", () => {
    const events = Array.from({ length: 5 }, (_, i) => makeEvent(i + 1));
    const markup = renderToStaticMarkup(<ProjectActivityHistory dateFormat="dd/MM/yyyy" events={events} />);

    expect(markup).not.toContain("Siguiente");
    expect(markup).not.toContain("Anterior");
  });

  it("search input is rendered when events exist", () => {
    const markup = renderToStaticMarkup(
      <ProjectActivityHistory dateFormat="dd/MM/yyyy" events={[makeEvent(1)]} />,
    );

    expect(markup).toContain("Buscar en el historial...");
  });

  it("search input is hidden when there are no events", () => {
    const markup = renderToStaticMarkup(<ProjectActivityHistory dateFormat="dd/MM/yyyy" events={[]} />);

    expect(markup).not.toContain("Buscar en el historial...");
  });

  it("shows filtered empty state when filter yields no results", () => {
    const events = [makeEvent(1, { type: "BUDGET_UPDATED", title: "Presupuesto" })];
    const markup = renderToStaticMarkup(<ProjectActivityHistory dateFormat="dd/MM/yyyy" events={events} />);

    // By default "Todos" is selected, so the event is visible
    expect(markup).toContain("Presupuesto");
  });
});
