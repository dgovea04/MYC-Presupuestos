/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

vi.mock("@/components/settings/company-profile-card", () => ({
  CompanyProfileCard: () => <div>Company Profile Card</div>,
}));

vi.mock("@/components/settings/local-ai-settings-card", () => ({
  LocalAiSettingsCard: () => <div>Local AI Settings Card</div>,
}));

vi.mock("@/components/settings/cloud-ai-settings-card", () => ({
  CloudAiSettingsCard: () => <div>Cloud AI Settings Card</div>,
}));

vi.mock("@/components/settings/floating-khipu-settings-card", () => ({
  FloatingKhipuSettingsCard: () => <div>Floating Khipu Settings Card</div>,
}));

vi.mock("@/components/settings/user-settings-form", () => ({
  UserSettingsForm: () => <div>User Settings Form</div>,
}));

import { SettingsPageContent } from "@/components/settings/settings-page-content";
import { DEFAULT_APP_THEME, DEFAULT_EXCEL_ROW_HEIGHT, DEFAULT_INITIAL_SUB_BUDGET_NAMES, DEFAULT_VIEW_MODE, FLOATING_KHIPU_DEFAULTS } from "@/types/settings";

describe("SettingsPageContent", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("shows general by default and switches between the three tabs", async () => {
    await act(async () => {
      root.render(
        <SettingsPageContent
          account={{ email: "maria@example.com", id: "user-1", jobTitle: "Ingeniera", name: "Maria Lopez", phone: "999999999" }}
          company={{ logoUrl: null, name: "MYC", ruc: "123" }}
          initialSettings={{
            aiProviderPreference: "auto",
            appTheme: DEFAULT_APP_THEME,
            currencyDecimals: 2,
            dateFormat: "DD_MMM_YYYY",
            defaultCurrency: "PEN",
            defaultGeneralExpensesRate: 0.1,
            defaultIgvRate: 0.18,
            defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
            defaultUtilityRate: 0.08,
            defaultViewMode: DEFAULT_VIEW_MODE,
            excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
            excelShowFieldBorders: true,
            floatingKhipuFontSize: FLOATING_KHIPU_DEFAULTS.fontSize,
            floatingKhipuHeight: FLOATING_KHIPU_DEFAULTS.height,
            floatingKhipuPosition: FLOATING_KHIPU_DEFAULTS.position,
            floatingKhipuProvider: FLOATING_KHIPU_DEFAULTS.provider,
            floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
            floatingKhipuWidth: FLOATING_KHIPU_DEFAULTS.width,
          }}
        />,
      );
    });

    const generalPanel = container.querySelector("#settings-tab-panel-general");
    const formatsPanel = container.querySelector("#settings-tab-panel-formats");
    const aiPanel = container.querySelector("#settings-tab-panel-ai");

    expect(generalPanel?.getAttribute("aria-hidden")).toBe("false");
    expect(formatsPanel?.getAttribute("aria-hidden")).toBe("true");
    expect(aiPanel?.getAttribute("aria-hidden")).toBe("true");
    expect(generalPanel?.textContent).toContain("Resumen rapido");
    expect(generalPanel?.textContent).toContain("Company Profile Card");
    expect(formatsPanel?.textContent).toContain("User Settings Form");
    expect(aiPanel?.textContent).toContain("Local AI Settings Card");

    const formatsTab = [...container.querySelectorAll("button")].find((element) => element.textContent?.includes("Formatos y visualizacion"));
    await act(async () => {
      formatsTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(generalPanel?.getAttribute("aria-hidden")).toBe("true");
    expect(formatsPanel?.getAttribute("aria-hidden")).toBe("false");
    expect(aiPanel?.getAttribute("aria-hidden")).toBe("true");

    const aiTab = [...container.querySelectorAll("button")].find((element) => element.textContent?.includes("IA"));
    await act(async () => {
      aiTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(generalPanel?.getAttribute("aria-hidden")).toBe("true");
    expect(formatsPanel?.getAttribute("aria-hidden")).toBe("true");
    expect(aiPanel?.getAttribute("aria-hidden")).toBe("false");
    expect(aiPanel?.textContent).toContain("Local AI Settings Card");
    expect(aiPanel?.textContent).toContain("Cloud AI Settings Card");
    expect(aiPanel?.textContent).toContain("Floating Khipu Settings Card");
  });
});
