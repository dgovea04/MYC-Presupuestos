import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AIPage from "@/app/ai/page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const aiWorkspaceSpy = vi.fn();
let mockAvailableFeatures = ["exports.basic", "polynomial_formula", "ai.local"];

vi.mock("@/components/ai/AIWorkspace", () => ({
  AIWorkspace: (props: unknown) => {
    aiWorkspaceSpy(props);
    return <div>AI Workspace</div>;
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: async () => ({ user: { id: "user-1", name: "Demo", email: "demo@myc.test" } }),
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: async () => ({
    defaultCurrency: "PEN",
    currencyDecimals: 2,
    dateFormat: "DD_MMM_YYYY",
    defaultViewMode: "modern",
    excelShowFieldBorders: true,
    excelRowHeight: 52,
    defaultIgvRate: 0.18,
    defaultGeneralExpensesRate: 0.1,
    defaultUtilityRate: 0.08,
    defaultSubBudgetNames: ["Estructuras"],
  }),
}));

vi.mock("@/lib/billing/entitlements", () => ({
  getEffectiveUserLicense: async () => ({
    availableFeatures: mockAvailableFeatures,
    budgetLimit: null,
    budgetUsage: 0,
    isInGracePeriod: false,
    planName: "Pro",
    planSlug: "pro",
    projectLimit: null,
    projectUsage: 0,
  }),
  hasFeatureAccess: (license: { availableFeatures: string[] }, feature: string) => license.availableFeatures.includes(feature),
}));

describe("AIPage", () => {
  beforeEach(() => {
    mockAvailableFeatures = ["exports.basic", "polynomial_formula", "ai.local"];
    aiWorkspaceSpy.mockClear();
  });

  it("renders Khipu upgrade copy when the user lacks local AI access", async () => {
    mockAvailableFeatures = ["exports.basic", "polynomial_formula"];

    const markup = renderToStaticMarkup(await AIPage({
      searchParams: Promise.resolve({}),
    }));

    expect(markup).toContain("Khipu disponible en Pro");
    expect(markup).toContain("Activa Khipu para chat tecnico");
    expect(aiWorkspaceSpy).not.toHaveBeenCalled();
  });

  it("hydrates active context from Khipu links that send selected item and APU data", async () => {
    renderToStaticMarkup(await AIPage({
      searchParams: Promise.resolve({
        action: "apu",
        selectedItem: "Partida demo",
        description: "Partida demo",
        unit: "m2",
        apuUnit: "m2",
        module: "Editor APU de sub presupuesto",
        activeTable: "APU de presupuesto",
        currentCost: "125.5",
      }),
    }));

    expect(aiWorkspaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        initialAction: "apu",
        initialApuDescription: "Partida demo",
        initialApuUnit: "m2",
        initialContext: expect.objectContaining({
          selectedItem: "Partida demo",
          unit: "m2",
          module: "Editor APU de sub presupuesto",
          activeTable: "APU de presupuesto",
          currentCost: 125.5,
        }),
      }),
    );
  });

  it("keeps compatibility with older Khipu links that only send item", async () => {
    renderToStaticMarkup(await AIPage({
      searchParams: Promise.resolve({
        action: "apu",
        item: "Partida legacy",
        unit: "m3",
      }),
    }));

    expect(aiWorkspaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        initialApuDescription: "Partida legacy",
        initialContext: expect.objectContaining({
          selectedItem: "Partida legacy",
          unit: "m3",
        }),
      }),
    );
  });
});
