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
});
