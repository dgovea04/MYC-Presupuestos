/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { broadcastAppDataChange } from "@/lib/client/live-updates";

vi.mock("@/lib/client/live-updates", () => ({
  broadcastAppDataChange: vi.fn(),
  getAppDataChangeEventName: () => "app-data-change",
  getAppDataChangeStorageKey: () => "app-data-change-key",
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
  }) => <input value={value ?? ""} onChange={onChange} placeholder={placeholder} />,
}));

vi.mock("@/components/ui/action-button", () => ({
  ActionButton: ({
    label,
    onClick,
    "data-budget-action": dataAction,
    "data-budget-id": dataId,
  }: {
    label: string;
    onClick?: () => void;
    "data-budget-action"?: string;
    "data-budget-id"?: string;
  }) => (
    <button onClick={onClick} data-budget-action={dataAction} data-budget-id={dataId}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  THead: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TR: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TH: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TD: ({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) => <td colSpan={colSpan}>{children}</td>,
}));

vi.mock("@/components/ui/virtualized-table-frame", () => ({
  StaticTableFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/operational-surfaces", () => ({
  OperationalPanel: ({ controls }: { controls: React.ReactNode }) => <div>{controls}</div>,
  OperationalFilterSummary: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  OperationalMetricBadge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/providers/formatting-settings-provider", () => ({
  useFormattingSettings: () => ({ currencyDecimals: 2, dateFormat: "dd/MM/yyyy" }),
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    formatCurrency: (amount: number, _currency: string, _decimals: number) => amount.toFixed(2),
    formatDate: (date: string | Date | undefined) => (date ? "30/05/2026" : ""),
  };
});

import { BudgetsTable } from "@/components/budget/budgets-table";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

const sampleBudgets = [
  {
    id: "budget-1",
    name: "Presupuesto General",
    currency: "PEN",
    totalAmount: 1200,
    updatedAt: "2026-05-30T12:00:00.000Z",
    projectName: "Hospital Norte",
  },
  {
    id: "budget-2",
    name: "Subpresupuesto Arquitectura",
    currency: "PEN",
    totalAmount: 800,
    updatedAt: "2026-05-29T10:00:00.000Z",
    projectName: "Edificio Central",
  },
];

afterEach(async () => {
  vi.restoreAllMocks();

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

async function renderTable() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<BudgetsTable budgets={sampleBudgets} />);
  });

  return {
    container,
    clickDeleteAction: (budgetId: string) => {
      const button = container.querySelector(`button[data-budget-action="delete"][data-budget-id="${budgetId}"]`);
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing delete action for ${budgetId}`);
      }
      button.click();
    },
    clickDialogButton: (label: string) => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (element) => element.textContent?.trim() === label,
      );
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing dialog button: ${label}`);
      }
      button.click();
    },
    getBudgetNames: () =>
      Array.from(container.querySelectorAll("tbody tr td:first-child")).map((cell) => cell.textContent?.trim() ?? ""),
  };
}

describe("BudgetsTable", () => {
  it("renders a contextual general expenses template action", async () => {
    const { container } = await renderTable();

    expect(container.textContent).toContain("Presupuesto General");
    expect(container.textContent).toContain("Hospital Norte");
  });

  // ─── Delete confirmation dialog ──────────────────────────────────────────

  it("opens the delete confirmation dialog when clicking Eliminar", async () => {
    const { clickDeleteAction } = await renderTable();

    expect(document.body.textContent).not.toContain("Eliminar presupuesto");

    await act(async () => {
      clickDeleteAction("budget-1");
    });

    expect(document.body.textContent).toContain("Eliminar presupuesto");
    expect(document.body.textContent).toContain("Presupuesto General");
    expect(document.body.textContent).toContain("Esta accion no se puede deshacer");
    expect(document.body.textContent).toContain("Cancelar");
  });

  it("closes the delete dialog when clicking Cancelar", async () => {
    const { clickDeleteAction, clickDialogButton } = await renderTable();

    await act(async () => {
      clickDeleteAction("budget-1");
    });

    expect(document.body.textContent).toContain("Eliminar presupuesto");

    await act(async () => {
      clickDialogButton("Cancelar");
    });

    expect(document.body.textContent).not.toContain("Eliminar presupuesto");
  });

  it("closes the delete dialog when clicking the X close button", async () => {
    const { clickDeleteAction } = await renderTable();

    await act(async () => {
      clickDeleteAction("budget-1");
    });

    expect(document.body.textContent).toContain("Eliminar presupuesto");

    await act(async () => {
      const xButton = document.querySelector('button[aria-label="Cerrar"]') as HTMLButtonElement | null;
      if (!xButton) throw new Error("Missing X close button");
      xButton.click();
    });

    expect(document.body.textContent).not.toContain("Eliminar presupuesto");
  });

  it("sends DELETE request and removes the budget row on confirm", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton, getBudgetNames } = await renderTable();

    await act(async () => {
      clickDeleteAction("budget-1");
    });

    expect(document.body.textContent).toContain("Eliminar presupuesto");

    await act(async () => {
      clickDialogButton("Eliminar presupuesto");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/budget-1", { method: "DELETE" });
    expect(getBudgetNames()).toEqual(["Subpresupuesto Arquitectura"]);
    expect(broadcastAppDataChange).toHaveBeenCalledWith(
      ["/dashboard", "/projects", "/budgets"],
      undefined,
      { locallyHandledPaths: ["/budgets"] },
    );
  });

  it("shows inline error in the delete dialog when the API fails and keeps the dialog open", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton } = await renderTable();

    await act(async () => {
      clickDeleteAction("budget-1");
    });

    await act(async () => {
      clickDialogButton("Eliminar presupuesto");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/budget-1", { method: "DELETE" });
    expect(document.body.textContent).toContain("Eliminar presupuesto");
    expect(document.body.textContent).toContain("No se pudo eliminar el presupuesto");
  });

  it("shows a permission error in the delete dialog on 403 and keeps the dialog open", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "No tienes permisos para eliminar este presupuesto" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton } = await renderTable();

    await act(async () => {
      clickDeleteAction("budget-1");
    });

    await act(async () => {
      clickDialogButton("Eliminar presupuesto");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/budget-1", { method: "DELETE" });
    expect(document.body.textContent).toContain("Eliminar presupuesto");
    expect(document.body.textContent).toContain("No tienes permisos para eliminar este presupuesto");
  });
});
