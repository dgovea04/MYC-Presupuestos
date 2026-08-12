/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShellSkeleton } from "@/components/loading/app-shell-skeleton";
import { BudgetEditorPageSkeleton } from "@/components/loading/budget-editor-page-skeleton";
import { CatalogPageSkeleton } from "@/components/loading/catalog-page-skeleton";
import { DashboardPageSkeleton } from "@/components/loading/dashboard-page-skeleton";
import { PageSkeletonFrame } from "@/components/loading/page-skeleton-frame";
import { SettingsPageSkeleton } from "@/components/loading/settings-page-skeleton";

describe("loading page skeletons", () => {
  it("renders a stable app shell skeleton with busy content", () => {
    render(
      <AppShellSkeleton>
        <div>Contenido</div>
      </AppShellSkeleton>,
    );

    expect(screen.getByRole("status", { name: "Cargando aplicacion" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Contenido")).toBeDefined();
  });

  it("renders a page skeleton frame with configured action placeholders", () => {
    const { container } = render(
      <PageSkeletonFrame aria-label="Cargando catalogo" actions={2}>
        <div>Tabla</div>
      </PageSkeletonFrame>,
    );

    expect(screen.getByRole("status", { name: "Cargando catalogo" }).getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThanOrEqual(4);
  });

  it("renders budget editor skeleton as a table plus summary panel", () => {
    render(<BudgetEditorPageSkeleton />);

    expect(screen.getByRole("table", { name: "Cargando editor de presupuesto" })).toBeDefined();
    expect(screen.getByRole("status", { name: "Cargando resumen del presupuesto" })).toBeDefined();
  });

  it("renders catalog skeleton as toolbar plus table", () => {
    render(<CatalogPageSkeleton kind="resources" />);

    expect(screen.getByRole("table", { name: "Cargando catalogo de insumos" })).toBeDefined();
  });

  it("renders dashboard skeleton with chart regions", () => {
    const { container } = render(<DashboardPageSkeleton />);

    const dashboardStatus = screen.getByRole("status", { name: "Cargando dashboard" });

    expect(dashboardStatus.getAttribute("aria-busy")).toBe("true");
    expect(dashboardStatus.firstElementChild?.classList.contains("grid")).toBe(true);
    expect(dashboardStatus.firstElementChild?.querySelectorAll(".min-h-\\[164px\\]")).toHaveLength(4);
    expect(container.querySelectorAll(".min-h-\\[164px\\]")).toHaveLength(4);
    expect(container.querySelectorAll(".min-h-\\[300px\\]")).toHaveLength(2);
    expect(container.querySelectorAll(".min-h-\\[460px\\]")).toHaveLength(2);
    expect(container.querySelectorAll(".min-h-\\[280px\\]")).toHaveLength(2);
  });

  it("renders settings skeleton as forms", () => {
    render(<SettingsPageSkeleton />);

    expect(screen.getAllByRole("status", { name: "Cargando configuracion" }).length).toBeGreaterThan(0);
  });
});
