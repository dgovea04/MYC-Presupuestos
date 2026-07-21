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

  it("styles Excel spreadsheet selection (active cell + selected range)", () => {
    const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(globalsCss).toContain('[data-view-mode="excel"] [data-spreadsheet-selected="true"]');
    expect(globalsCss).toContain('[data-view-mode="excel"] [data-spreadsheet-active="true"]');
  });
});
