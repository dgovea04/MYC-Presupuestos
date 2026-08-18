import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("excel field border styles", () => {
  it("scopes excel field borders to table cells and headers only", () => {
    const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(globalsCss).toContain('[data-view-mode="excel"] .ui-table-cell :is(.ui-input, .ui-select-trigger, [data-excel-field-trigger="true"])');
    expect(globalsCss).toContain('[data-excel-field-trigger="true"]');
    expect(globalsCss).toContain('[data-view-mode="excel"] .ui-table-head-cell :is(.ui-input, .ui-select-trigger, [data-excel-field-trigger="true"])');
    expect(globalsCss).toContain('[data-view-mode="excel"] [data-excel-field-border-scope="apu-editor"] :is(.ui-input, .ui-select-trigger, [data-excel-field-trigger="true"]):not([data-excel-field-border-opt-out="true"])');
    expect(globalsCss).toContain('[data-view-mode="excel"] [data-excel-field-border-opt-out="true"]');
    expect(globalsCss).not.toContain('[data-view-mode="excel"] .ui-input,');
  });

  it("keeps control icons at a consistent size in excel mode", () => {
    const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(globalsCss).toContain('[data-view-mode="excel"] :is(.ui-button, .ui-select-trigger, .ui-select-item, [data-excel-field-trigger="true"]) svg');
    expect(globalsCss).toContain("width: 1rem;");
    expect(globalsCss).toContain("height: 1rem;");
  });

  it("keeps the mini sidebar expand button compact in excel mode", () => {
    const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(globalsCss).toContain('[data-view-mode="excel"] .ui-button[aria-label="Expandir sidebar"]');
    expect(globalsCss).toContain("width: 40px;");
    expect(globalsCss).toContain("height: 20px;");
    expect(globalsCss).toContain("padding: 0;");
  });

  it("styles Excel spreadsheet selection (active cell + selected range)", () => {
    const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(globalsCss).toContain('[data-view-mode="excel"] [data-spreadsheet-selected="true"]');
    expect(globalsCss).toContain('[data-view-mode="excel"] [data-spreadsheet-active="true"]');
  });

  it("keeps pending dashboard onboarding cards on the dark surface", () => {
    const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8").replaceAll("\r\n", "\n");

    expect(globalsCss).toContain(
      '[data-theme="dark"] .dashboard-onboarding-card-pending {\n  border-color: var(--app-border);\n  background: var(--app-surface);\n}',
    );
    expect(globalsCss).toContain('[data-theme="dark"] .dashboard-onboarding-card:hover {');
    expect(globalsCss).toContain('[data-theme="dark"] .dashboard-onboarding-card-completed {');
  });

  it("does not include temporary app theme transition selectors", () => {
    const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const removedSelector = ["data", "theme", "transitioning"].join("-");

    expect(globalsCss).not.toContain(removedSelector);
  });

  it("resolves structural section borders from shared theme tokens", () => {
    const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8").replaceAll("\r\n", "\n");
    const dashboardPage = readFileSync(resolve(process.cwd(), "app/dashboard/page.tsx"), "utf8");

    expect(globalsCss).toContain("--app-section-border: #e2e8f0;");
    expect(globalsCss).toContain("--app-section-border: var(--khipu-dark-hairline);");
    expect(globalsCss).toContain(".theme-surface-card {");
    expect(globalsCss).toContain(".theme-muted-panel {");
    expect(globalsCss).toContain("border-color: var(--app-section-border-soft) !important;");
    expect(globalsCss).toContain(".dashboard-surface-card-primary {");
    expect(globalsCss).toContain(".dashboard-surface-card-soft {");
    expect(globalsCss).toContain("border-color: var(--app-section-border-soft) !important;");
    expect(globalsCss).toContain("[data-theme=\"dark\"] .dashboard-surface-card-soft");
    expect(globalsCss).not.toContain(".theme-app :where(");
    expect(globalsCss).not.toContain(".ui-card {\n  border-color: var(--app-border-soft);\n}");
    expect(globalsCss).toContain(".dashboard-section-surface {\n  border-color: var(--app-section-border-soft);\n}");
    expect(dashboardPage).toContain("dashboard-section-surface dashboard-surface-card dashboard-surface-card-primary");
    expect(dashboardPage).toContain("dashboard-section-surface dashboard-surface-card dashboard-surface-card-soft");
    expect(dashboardPage).not.toContain("dashboard-surface-card-primary border-sky-100");
    expect(dashboardPage).not.toContain("dashboard-surface-card-soft h-full border-slate-200");
  });

});
