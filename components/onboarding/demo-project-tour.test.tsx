/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoProjectTour } from "@/components/onboarding/demo-project-tour";

const mocks = vi.hoisted(() => ({
  pathname: "/budgets/budget-general",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

describe("DemoProjectTour", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.pathname = "/budgets/budget-general";
  });

  it("marks a navigation step as completed and highlights the next target", async () => {
    render(
      <>
        <button type="button" data-demo-tour-target="open-structures">
          Abrir Estructuras
        </button>
        <DemoProjectTour
          config={{
            projectId: "project-demo",
            generalBudgetId: "budget-general",
            structuresBudgetId: "budget-structures",
          }}
          showGuideCard
        />
      </>,
    );

    expect(await screen.findByText("Paso 2 de 5")).toBeTruthy();
    expect(document.querySelector(".demo-tour-click-label-modern")?.textContent).toBe("Click aquí");
    expect(screen.getByTestId("demo-tour-step-general-budget").className).toContain("border-emerald-200");

    fireEvent.click(screen.getByRole("button", { name: "Abrir Estructuras" }));

    await waitFor(() => {
      expect(screen.getByText("Paso 3 de 5")).toBeTruthy();
      expect(screen.getByTestId("demo-tour-step-structures").className).toContain("border-emerald-200");
    });
  });

  it("marks export only after the export action event", async () => {
    mocks.pathname = "/projects/project-demo";

    window.localStorage.setItem(
      "mc-demo-project-tour:project-demo",
      JSON.stringify({ completed: ["general-budget", "structures", "apu", "formula"] }),
    );

    render(
      <DemoProjectTour
        config={{
          projectId: "project-demo",
          generalBudgetId: "budget-general",
          structuresBudgetId: "budget-structures",
        }}
        showGuideCard
      />,
    );

    expect(await screen.findByText("Paso 5 de 5")).toBeTruthy();

    window.dispatchEvent(
      new CustomEvent("mc-demo-tour-action", {
        detail: { action: "export", target: "export-project" },
      }),
    );

    expect(await screen.findByText("¡Tutorial completado!")).toBeTruthy();
  });
});
