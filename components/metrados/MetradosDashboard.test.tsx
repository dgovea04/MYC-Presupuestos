/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetradosDashboard } from "@/components/metrados/MetradosDashboard";
import type { MetradoSheetRecord, MetradoTemplateRecord } from "@/types/metrado";

const navigationMocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigationMocks,
}));

const template: MetradoTemplateRecord = {
  id: "template-1",
  type: "CONCRETE",
  name: "Concreto",
  description: "Metrado de concreto",
  defaultUnit: "m3",
  formulaKeys: ["volume"],
  formulas: [
    {
      key: "volume",
      label: "Largo x ancho x alto",
      expression: "largo * ancho * alto",
      requiredInputs: ["largo", "ancho", "alto"],
      resultUnit: "m3",
    },
  ],
};

const activeSheet: MetradoSheetRecord = {
  id: "sheet-1",
  userId: "user-1",
  projectId: "project-1",
  projectName: "Proyecto",
  budgetId: "budget-1",
  budgetName: "Estructuras",
  templateId: "template-1",
  templateType: "CONCRETE",
  name: "Metrado 01.01",
  status: "DRAFT",
  isActive: true,
  unit: "m3",
  totalQuantity: 10,
  rows: [
    {
      id: "row-1",
      sheetId: "sheet-1",
      sector: "Sector A",
      eje: "Eje 1",
      nivel: "Nivel 1",
      description: "Excavacion manual",
      unit: "m3",
      formulaKey: "volume",
      inputs: { largo: 2, ancho: 1, alto: 5 },
      partial: 10,
      sortOrder: 1,
    },
  ],
  partidaLink: {
    id: "link-1",
    sheetId: "sheet-1",
    budgetItemId: "item-1",
    budgetItemCode: "01.01",
    budgetItemDescription: "Excavacion manual",
    budgetItemUnit: "m3",
    lastSentQuantity: 10,
  },
};

describe("MetradosDashboard initial partida context", () => {
  afterEach(() => {
    cleanup();
    document.body.removeAttribute("data-scroll-locked");
    document.body.style.pointerEvents = "";
    navigationMocks.push.mockReset();
    vi.unstubAllGlobals();
  });

  it("reopens the selected sheet after closing its drawer", async () => {
    render(
      <MetradosDashboard
        initialSheets={[activeSheet]}
        projects={[{ id: "project-1", name: "Proyecto" }]}
        budgets={[{ id: "budget-1", projectId: "project-1", name: "Estructuras" }]}
        partidas={[
          {
            id: "item-1",
            projectId: "project-1",
            budgetId: "budget-1",
            code: "01.01",
            description: "Excavacion manual",
            unit: "m3",
            quantity: 10,
          },
        ]}
        customFormulas={[]}
        templates={[template]}
        initialContext={{ projectId: "project-1", budgetId: "budget-1", itemId: "item-1" }}
      />,
    );

    await screen.findAllByRole("button", { name: "Enviar y volver" });
    fireEvent.keyDown(document, { key: "Escape" });

    const reopenButton = await screen.findByRole("button", { name: "Abrir hoja" });
    fireEvent.click(reopenButton);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Enviar y volver" }).length).toBeGreaterThan(0);
    });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Hoja de metrados" })).toBeNull());
  });

  it("sends the sheet and returns to the originating subbudget", async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/collaboration/edit-sessions")) {
        return Promise.resolve(new Response(JSON.stringify({ editSession: { id: "session-1" } }), { status: 200 }));
      }
      if (url.endsWith("/send-to-partida")) {
        return Promise.resolve(new Response(JSON.stringify({ quantity: 10 }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ sheet: activeSheet }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MetradosDashboard
        initialSheets={[activeSheet]}
        projects={[{ id: "project-1", name: "Proyecto" }]}
        budgets={[{ id: "budget-1", projectId: "project-1", name: "Estructuras" }]}
        partidas={[
          {
            id: "item-1",
            projectId: "project-1",
            budgetId: "budget-1",
            code: "01.01",
            description: "Excavacion manual",
            unit: "m3",
            quantity: 10,
          },
        ]}
        customFormulas={[]}
        templates={[template]}
        initialContext={{ projectId: "project-1", budgetId: "budget-1", itemId: "item-1" }}
      />,
    );

    const sendButtons = await screen.findAllByRole("button", { name: "Enviar y volver" });
    fireEvent.click(sendButtons.at(-1)!);

    await waitFor(() => {
      const metradoRequests = fetchMock.mock.calls.filter(([input]) => String(input).startsWith("/api/metrados-avanzados/"));
      expect(metradoRequests).toHaveLength(4);
      expect(navigationMocks.push).toHaveBeenCalledWith("/budgets/budget-1");
    });
  });
});
