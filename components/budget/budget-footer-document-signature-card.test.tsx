/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { BudgetFooterDocumentSignatureCard } from "@/components/budget/budget-footer-document-signature-card";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

describe("BudgetFooterDocumentSignatureCard", () => {
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

  it("renders the documentary signature preview with budget, project, and responsible metadata", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;
    activeContainer = container;

    await act(async () => {
      root.render(
        <BudgetFooterDocumentSignatureCard
          budgetName="Presupuesto General"
          projectName="Vivienda Multifamiliar San Miguel"
          clientName="Constructora Lima Norte"
          location="San Miguel, Lima"
          responsible={{
            name: "Maria Calderon",
            jobTitle: "Ingeniera Residente",
            companyName: "Constructora Andina SAC",
            phone: "987654321",
            email: "maria@example.com",
          }}
        />,
      );
    });

    expect(container.textContent).toContain("Firma documental");
    expect(container.textContent).toContain("Presupuesto General");
    expect(container.textContent).toContain("Vivienda Multifamiliar San Miguel");
    expect(container.textContent).toContain("Maria Calderon");
    expect(container.textContent).toContain("Ingeniera Residente");
    expect(container.textContent).toContain("Constructora Andina SAC");
    expect(container.textContent).toContain("maria@example.com");
    expect(container.textContent).toContain("Vo. Bo. / aprobacion");
  });
});
