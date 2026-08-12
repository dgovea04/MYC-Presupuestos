/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShellSkeleton } from "@/components/loading/app-shell-skeleton";
import {
  BudgetDetailPageSkeleton,
  BudgetLoadingResolverSkeleton,
  BudgetSubBudgetPageSkeleton,
} from "@/components/loading/budget-detail-page-skeleton";
import { CatalogPageSkeleton } from "@/components/loading/catalog-page-skeleton";
import { DashboardPageSkeleton } from "@/components/loading/dashboard-page-skeleton";
import { PageSkeletonFrame } from "@/components/loading/page-skeleton-frame";
import { ProjectDetailPageSkeleton } from "@/components/loading/project-detail-page-skeleton";
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

  it("renders general budget skeleton with overview sections and consolidated tables", () => {
    const { container } = render(<BudgetDetailPageSkeleton />);

    const budgetStatus = screen.getByRole("status", { name: "Cargando presupuesto" });

    expect(budgetStatus.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll(".ui-card")).toHaveLength(6);
    expect(
      Array.from(container.querySelectorAll("[data-skeleton-section]"), (element) => element.getAttribute("data-skeleton-section")),
    ).toEqual([
      "collaboration",
      "overview",
      "subbudgets-and-actions",
      "overview-summary",
      "consolidated-table",
      "connected-detail",
    ]);
    const collaborationSection = container.querySelector('[data-skeleton-section="collaboration"]');
    expect(collaborationSection?.classList.contains("justify-end")).toBe(true);
    expect(collaborationSection?.querySelectorAll(".animate-pulse")).toHaveLength(5);
    expect(screen.getByRole("table", { name: "Cargando tabla consolidada" })).toBeDefined();
    expect(screen.getByRole("table", { name: "Cargando detalle del presupuesto" })).toBeDefined();
    expect(container.querySelectorAll(".min-h-\\[112px\\]")).toHaveLength(0);
  });

  it("renders sub budget skeleton as collaboration plus editor and summary", () => {
    const { container } = render(<BudgetSubBudgetPageSkeleton />);

    const subBudgetStatus = screen.getByRole("status", { name: "Cargando sub presupuesto" });
    const sections = Array.from(
      container.querySelectorAll("[data-skeleton-section]"),
      (element) => element.getAttribute("data-skeleton-section"),
    );

    expect(subBudgetStatus.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll(".ui-card")).toHaveLength(2);
    expect(sections).toEqual(["collaboration", "editor-flow"]);
    expect(container.querySelectorAll("[data-skeleton-section='collaboration']")[0]?.classList.contains("justify-end")).toBe(true);
    expect(screen.getByRole("table", { name: "Cargando partidas del sub presupuesto" })).toBeDefined();
    expect(container.querySelectorAll("[data-skeleton-section='overview']")).toHaveLength(0);
    expect(container.querySelectorAll("[data-skeleton-section='consolidated-table']")).toHaveLength(0);
  });

  it("renders a neutral resolver skeleton without an extra top section", () => {
    const { container } = render(<BudgetLoadingResolverSkeleton />);

    expect(container.firstElementChild?.getAttribute("aria-label")).toBe("Cargando presupuesto");
    expect(container.querySelectorAll("[data-skeleton-section]")).toHaveLength(2);
    expect(container.querySelector("[data-skeleton-section='collaboration']")?.nextElementSibling?.getAttribute("data-skeleton-section")).toBe("resolving-content");
  });

  it("renders project detail skeleton as the same sections as the real view", () => {
    const { container } = render(<ProjectDetailPageSkeleton />);

    const projectStatus = screen.getByRole("status", { name: "Cargando proyecto" });

    expect(projectStatus.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll(".ui-card")).toHaveLength(6);
    expect(container.querySelectorAll(".min-h-\\[112px\\]")).toHaveLength(0);
    expect(container.querySelectorAll("table")).toHaveLength(0);
  });

  it("renders catalog skeleton with the real page card, header, toolbar and table", () => {
    const { container } = render(<CatalogPageSkeleton kind="resources" />);

    const catalogStatus = screen.getByRole("status", { name: "Cargando catalogo de insumos" });

    expect(catalogStatus.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll(".ui-card")).toHaveLength(1);
    expect(container.querySelector('[data-skeleton-section="catalog-header"]')).toBeDefined();
    expect(container.querySelector('[data-skeleton-section="catalog-toolbar"]')).toBeDefined();
    expect(container.querySelector('[data-skeleton-section="catalog-table"]')).toBeDefined();
    expect(screen.getByRole("table", { name: "Cargando catalogo de insumos" })).toBeDefined();
  });

  it("renders templates and metrados skeletons without a false catalog table", () => {
    const templates = render(<CatalogPageSkeleton kind="templates" />);
    expect(screen.getByRole("status", { name: "Cargando plantillas" })).toBeDefined();
    expect(templates.container.querySelector('[data-skeleton-section="template-library"]')).toBeDefined();
    expect(templates.container.querySelectorAll("table")).toHaveLength(0);

    templates.unmount();
    const metrados = render(<CatalogPageSkeleton kind="metrados" />);
    expect(screen.getByRole("status", { name: "Cargando metrados" })).toBeDefined();
    expect(metrados.container.querySelector('[data-skeleton-section="metrados-editor"]')).toBeDefined();
    expect(screen.getByRole("table", { name: "Cargando tabla de metrados" })).toBeDefined();
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

  it("renders settings skeleton with tabs, main content and summary columns", () => {
    const { container } = render(<SettingsPageSkeleton />);

    const settingsStatus = screen.getByRole("status", { name: "Cargando configuracion" });

    expect(settingsStatus.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll(".ui-card")).toHaveLength(4);
    expect(container.querySelectorAll("[data-skeleton-section]")).toHaveLength(0);
    expect(container.querySelectorAll(".grid").length).toBeGreaterThan(2);
  });

  it("renders account skeleton with profile forms and side summaries", () => {
    const { container } = render(<SettingsPageSkeleton kind="account" />);

    expect(screen.getByRole("status", { name: "Cargando cuenta" })).toBeDefined();
    expect(container.querySelectorAll(".ui-card")).toHaveLength(3);
    expect(container.querySelectorAll(".min-h-\\[190px\\]")).toHaveLength(0);
  });
});
