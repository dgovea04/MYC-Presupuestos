// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BudgetChangeHistorySheet } from "@/components/budget/budget-change-history-sheet";
import { BudgetCommentsSheet } from "@/components/budget/budget-comments-sheet";
import { BudgetVersionHistorySheet } from "@/components/budget/budget-version-history-sheet";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("budget collaboration sheet loading states", () => {
  it("renders a structured skeleton for the change history sheet", async () => {
    render(<BudgetChangeHistorySheet budgetId="budget-1" open onClose={vi.fn()} />);

    const loadingRegion = await screen.findByRole("status", { name: "Cargando historial de cambios" });
    expect(loadingRegion.getAttribute("aria-busy")).toBe("true");
    expect(document.body.textContent).not.toContain("Cargando historial...");
    expect(loadingRegion.querySelector(".animate-spin")).toBeFalsy();
  });

  it("renders a structured skeleton for the comments sheet", async () => {
    render(<BudgetCommentsSheet budgetId="budget-1" open onClose={vi.fn()} />);

    const loadingRegion = await screen.findByRole("status", { name: "Cargando comentarios del presupuesto" });
    expect(loadingRegion.getAttribute("aria-busy")).toBe("true");
    expect(document.body.textContent).not.toContain("Cargando comentarios...");
    expect(loadingRegion.querySelector(".animate-spin")).toBeFalsy();
  });

  it("renders a structured skeleton for the version history sheet", async () => {
    render(<BudgetVersionHistorySheet budgetId="budget-1" open onClose={vi.fn()} />);

    const loadingRegion = await screen.findByRole("status", { name: "Cargando versiones del presupuesto" });
    expect(loadingRegion.getAttribute("aria-busy")).toBe("true");
    expect(document.body.textContent).not.toContain("Cargando versiones...");
    expect(loadingRegion.querySelector(".animate-spin")).toBeFalsy();
  });
});
