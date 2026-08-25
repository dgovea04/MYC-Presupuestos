/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MetradoSheetDrawer } from "@/components/metrados/MetradoSheetDrawer";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import { AppViewModeProvider } from "@/components/view-mode/app-view-mode-provider";
import type { UserSettingsRecord } from "@/types/settings";

describe("MetradoSheetDrawer", () => {
  afterEach(() => cleanup());

  it("shows an explicit header action without closing the drawer", () => {
    const onClose = vi.fn();
    const onHeaderAction = vi.fn();

    render(
      <FormattingSettingsProvider settings={createSettings()}>
        <AppViewModeProvider initialViewMode="excel">
          <MetradoSheetDrawer
            sheet={null}
            open
            onClose={onClose}
            headerActionLabel="Enviar y volver"
            onHeaderAction={onHeaderAction}
          >
            <div>Contenido</div>
          </MetradoSheetDrawer>
        </AppViewModeProvider>
      </FormattingSettingsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar y volver" }));

    expect(onHeaderAction).toHaveBeenCalledWith();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cerrar" })).toBeNull();
    const drawer = screen.getByRole("dialog");
    expect(drawer.getAttribute("data-metrado-sheet-drawer")).toBe("true");
    expect(drawer.getAttribute("data-view-mode")).toBe("excel");
    expect(drawer.style.getPropertyValue("--excel-field-border-color")).toBe("transparent");
    expect(drawer.style.getPropertyValue("--excel-row-height")).toBe("40px");
  });
});

function createSettings(): UserSettingsRecord {
  return {
    aiProviderPreference: "auto",
    defaultCurrency: "PEN",
    currencyDecimals: 2,
    dateFormat: "DD_MMM_YYYY",
    defaultViewMode: "excel",
    excelShowFieldBorders: false,
    excelRowHeight: 40,
    defaultIgvRate: 0.18,
    defaultGeneralExpensesRate: 0.1,
    defaultUtilityRate: 0.08,
    defaultSubBudgetNames: ["Estructuras"],
    floatingKhipuProvider: "ollama",
    floatingKhipuWidth: 600,
    floatingKhipuHeight: 500,
    floatingKhipuFontSize: "normal",
    floatingKhipuPosition: "bottom-right",
    floatingKhipuTheme: "light",
  };
}
