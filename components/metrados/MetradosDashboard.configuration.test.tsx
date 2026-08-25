/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MetradosDashboard } from "@/components/metrados/MetradosDashboard";
import type { MetradoTemplateRecord } from "@/types/metrado";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const template: MetradoTemplateRecord = {
  id: "template-1",
  type: "CONCRETE",
  name: "Concreto",
  description: "Metrado de concreto",
  defaultUnit: "m3",
  formulaKeys: ["volume"],
  formulas: [{ key: "volume", label: "Volumen", expression: "largo * ancho * alto", requiredInputs: ["largo", "ancho", "alto"], resultUnit: "m3" }],
};

const rebarTemplate: MetradoTemplateRecord = {
  id: "template-2",
  type: "REBAR",
  name: "Acero de refuerzo",
  description: "Peso de acero",
  defaultUnit: "kg",
  formulaKeys: ["rebarWeight"],
  formulas: [{ key: "rebarWeight", label: "Peso de acero", expression: "cantidad * longitud * pesoUnitario", requiredInputs: ["cantidad", "longitud", "pesoUnitario"], resultUnit: "kg" }],
};

const areaTemplates: MetradoTemplateRecord[] = [
  { id: "template-3", type: "MASONRY", name: "Albanileria", description: "Muros", defaultUnit: "m2", formulaKeys: ["area"], formulas: [{ key: "area", label: "Area", expression: "largo * ancho", requiredInputs: ["largo", "ancho"], resultUnit: "m2" }] },
  { id: "template-4", type: "FORMWORK", name: "Encofrado", description: "Encofrados", defaultUnit: "m2", formulaKeys: ["formworkArea"], formulas: [{ key: "formworkArea", label: "Area de encofrado", expression: "perimetro * altura", requiredInputs: ["perimetro", "altura"], resultUnit: "m2" }] },
];

const commonProps = {
  initialSheets: [],
  projects: [{ id: "project-1", name: "Proyecto" }],
  budgets: [{ id: "budget-1", projectId: "project-1", name: "Estructuras" }],
  partidas: [
    { id: "item-1", projectId: "project-1", budgetId: "budget-1", code: "01.01", description: "Acero de refuerzo", unit: "kg", quantity: 10 },
    { id: "item-2", projectId: "project-1", budgetId: "budget-1", code: "01.02", description: "Encofrado y desencofrado", unit: "m2", quantity: 20 },
  ],
  customFormulas: [],
  templates: [template, rebarTemplate, ...areaTemplates],
};

describe("MetradosDashboard configuration flow", () => {
  afterEach(() => {
    cleanup();
    document.body.removeAttribute("data-scroll-locked");
    document.body.style.pointerEvents = "";
  });

  it("shows context selectors and the partida overview for sidebar entry", () => {
    render(<MetradosDashboard {...commonProps} />);

    expect(screen.getByRole("region", { name: "Contexto de metrados" })).toBeTruthy();
    expect(screen.getByLabelText("Proyecto")).toBeTruthy();
    expect(screen.getByLabelText("Subpresupuesto")).toBeTruthy();
    expect(screen.getByText("Partidas del subpresupuesto")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Configuración de hoja" })).toBeNull();
  });

  it("opens configuration in an offcanvas for a focused partida without a sheet", async () => {
    render(<MetradosDashboard {...commonProps} initialContext={{ projectId: "project-1", budgetId: "budget-1", itemId: "item-1" }} />);

    expect(await screen.findByRole("dialog", { name: "Configuración de hoja" })).toBeTruthy();
    expect(document.querySelector("#metrado-partida-select")).toBeTruthy();
    expect(document.querySelector("#metrado-unit-select")?.textContent).toContain("kg");
    expect(screen.getByRole("button", { name: /Acero de refuerzo/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Partidas del subpresupuesto")).toBeNull();
  });

  it("matches the formula by partida name before using another template with the same unit", async () => {
    render(<MetradosDashboard {...commonProps} initialContext={{ projectId: "project-1", budgetId: "budget-1", itemId: "item-2" }} />);

    expect(await screen.findByRole("dialog", { name: "Configuración de hoja" })).toBeTruthy();
    expect(document.querySelector("#metrado-unit-select")?.textContent).toContain("m2");
    expect(screen.getByRole("button", { name: /Encofrado/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Albanileria/ }).getAttribute("aria-pressed")).toBe("false");
  });
});
