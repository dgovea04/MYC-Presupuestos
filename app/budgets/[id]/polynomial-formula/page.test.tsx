import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  editorSpy: vi.fn(),
  tabsSpy: vi.fn(),
  getGeneralBudgetSectionContext: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  getEffectiveWorkspaceLicense: vi.fn(),
  hasFeatureAccess: vi.fn(),
  getBudgetPolynomialFormulaSectionsData: vi.fn(),
  getPolynomialFormulaReadOptionsForEnvironment: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/budget/general-budget-section-shell", () => ({
  GeneralBudgetSectionShell: ({ children }: { children: ReactNode }) => <div data-testid="shell">{children}</div>,
}));

vi.mock("@/components/budget/polynomial-formula-editor", () => ({
  PolynomialFormulaEditor: (props: {
    section: { title: string };
    canUsePolynomialAdjustments: boolean;
    showCompositionDetail: boolean;
  }) => {
    mocks.editorSpy(props);

    return <div data-testid="editor">{props.section.title}</div>;
  },
}));

vi.mock("@/components/budget/polynomial-formula-section-tabs", () => ({
  PolynomialFormulaSectionTabs: (props: {
    budgetId: string;
    activeSection: { budgetId?: string; title: string } | null;
    sections: Array<{ title: string; budgetId?: string }>;
  }) => {
    mocks.tabsSpy(props);

    return (
      <div data-testid="section-tabs">
        <span>Sub Presupuestos</span>
        {props.sections.map((section) => (
          <span key={section.budgetId ?? section.title}>{section.title}</span>
        ))}
      </div>
    );
  },
}));

vi.mock("@/app/budgets/[id]/section-context", () => ({
  getGeneralBudgetSectionContext: mocks.getGeneralBudgetSectionContext,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
}));

vi.mock("@/lib/workspace/entitlements", () => ({
  getEffectiveWorkspaceLicense: mocks.getEffectiveWorkspaceLicense,
  hasFeatureAccess: mocks.hasFeatureAccess,
}));

vi.mock("@/lib/data/polynomial-formulas", () => ({
  getBudgetPolynomialFormulaSectionsData: mocks.getBudgetPolynomialFormulaSectionsData,
  getPolynomialFormulaReadOptionsForEnvironment: mocks.getPolynomialFormulaReadOptionsForEnvironment,
}));

import GeneralBudgetPolynomialFormulaPage from "@/app/budgets/[id]/polynomial-formula/page";

describe("GeneralBudgetPolynomialFormulaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getGeneralBudgetSectionContext.mockResolvedValue({
      budget: { id: "general-1", name: "General" },
      currentUser: { id: "user-1" },
      project: { id: "project-1", name: "Proyecto Uno" },
      session: { user: { id: "user-1" } },
      settings: { defaultCurrency: "PEN" },
    });
    mocks.getActiveWorkspaceId.mockResolvedValue("ws-1");
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue({
      planSlug: "pro",
      planName: "Pro",
      role: "OWNER",
      availableFeatures: ["polynomial_formula.adjustments", "polynomial_formula"],
    });
    mocks.hasFeatureAccess.mockReturnValue(true);
    mocks.getPolynomialFormulaReadOptionsForEnvironment.mockReturnValue({
      includeCompositionDetail: false,
    });
    mocks.getBudgetPolynomialFormulaSectionsData.mockResolvedValue({
      title: "Formula polinomica por subpresupuesto",
      notes: ["Cada subpresupuesto tiene una formula independiente."],
      hasSubBudgetSections: true,
      sections: [
        {
          title: "Formula polinomica - Estructuras",
          budgetId: "sub-1",
          currency: "PEN",
          summary: { hasFormula: true, monomialCount: 6, totalBaseAmount: "1000.0000", status: "DRAFT" },
        },
        {
          title: "Formula polinomica - Arquitectura",
          budgetId: "sub-2",
          currency: "PEN",
          summary: { hasFormula: true, monomialCount: 5, totalBaseAmount: "800.0000", status: "VALID" },
        },
      ],
      activeSection: {
        title: "Formula polinomica - Arquitectura",
        budgetId: "sub-2",
        currency: "PEN",
        coefficients: [],
        notes: [],
        formula: { id: "formula-2" },
        summary: { hasFormula: true, monomialCount: 5, totalBaseAmount: "800.0000", status: "VALID" },
      },
    });
  });

  it("renders only the active subbudget editor from the selected tab", async () => {
    const tree = await GeneralBudgetPolynomialFormulaPage({
      params: Promise.resolve({ id: "general-1" }),
      searchParams: Promise.resolve({ section: "sub-2" }),
    });

    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("Sub Presupuestos");
    expect(markup).toContain("Estructuras");
    expect(markup).toContain("Arquitectura");
    expect(markup).toContain("data-testid=\"section-tabs\"");
    expect(markup).toContain("data-testid=\"editor\"");
    expect(markup).toContain("Formula polinomica - Arquitectura");
    expect(markup).not.toContain("Formula polinomica - Estructuras</div><div data-testid=\"editor\"");
    expect(mocks.editorSpy).toHaveBeenCalledTimes(1);
    expect(mocks.tabsSpy).toHaveBeenCalledTimes(1);
    expect(mocks.getBudgetPolynomialFormulaSectionsData).toHaveBeenCalledWith(
      "general-1",
      "user-1",
      { includeCompositionDetail: true },
      "sub-2",
    );
    expect(mocks.editorSpy.mock.calls[0]?.[0]).toMatchObject({
      section: expect.objectContaining({ budgetId: "sub-2" }),
      canUsePolynomialAdjustments: true,
    });
    expect(mocks.tabsSpy.mock.calls[0]?.[0]).toMatchObject({
      budgetId: "general-1",
      activeSection: expect.objectContaining({ budgetId: "sub-2" }),
      sections: expect.arrayContaining([
        expect.objectContaining({ budgetId: "sub-1" }),
        expect.objectContaining({ budgetId: "sub-2" }),
      ]),
    });
  });

  it("calls getActiveWorkspaceId and getEffectiveWorkspaceLicense", async () => {
    await GeneralBudgetPolynomialFormulaPage({
      params: Promise.resolve({ id: "general-1" }),
    });

    expect(mocks.getActiveWorkspaceId).toHaveBeenCalledWith("user-1");
    expect(mocks.getEffectiveWorkspaceLicense).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "ws-1",
    });
    expect(mocks.hasFeatureAccess).toHaveBeenCalledWith(
      expect.objectContaining({ planSlug: "pro" }),
      "polynomial_formula.adjustments",
    );
  });

  it("disables adjustments when license lacks polynomial_formula.adjustments", async () => {
    mocks.hasFeatureAccess.mockReturnValue(false);

    const tree = await GeneralBudgetPolynomialFormulaPage({
      params: Promise.resolve({ id: "general-1" }),
    });

    const markup = renderToStaticMarkup(tree);
    expect(markup).toContain("data-testid=\"shell\"");
    expect(mocks.editorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ canUsePolynomialAdjustments: false }),
    );
  });

  it("handles null workspace (no active workspace selected)", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue(null);
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue(null);
    mocks.hasFeatureAccess.mockReturnValue(false);

    const tree = await GeneralBudgetPolynomialFormulaPage({
      params: Promise.resolve({ id: "general-1" }),
    });

    const markup = renderToStaticMarkup(tree);
    expect(markup).toContain("data-testid=\"shell\"");
    expect(mocks.hasFeatureAccess).toHaveBeenCalledWith(null, "polynomial_formula.adjustments");
  });
});
