/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectForm } from "@/components/projects/project-form";
import { getTemplateLibraryItem } from "@/lib/templates/template-library";

// ── Configurable mock for useAppViewMode ────────────────────────────────
const mockViewModeRef = { current: { isExcelMode: false } };

vi.mock("@/components/view-mode/app-view-mode-provider", () => ({
  useAppViewMode: () => ({
    isExcelMode: mockViewModeRef.current.isExcelMode,
    viewMode: mockViewModeRef.current.isExcelMode ? "excel" : "modern",
    setViewMode: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ProjectForm", () => {
  afterEach(() => {
    cleanup();
    mockViewModeRef.current = { isExcelMode: false };
  });

  // ── Template test ───────────────────────────────────────────────────────

  it("renders the selected project template as a hidden creation input", () => {
    const selectedTemplate = getTemplateLibraryItem("budget-edificacion-base");
    if (!selectedTemplate) {
      throw new Error("Missing budget template");
    }

    const markup = renderToStaticMarkup(
      <ProjectForm companies={[{ id: "company-1", name: "MYC Ingenieria" }]} selectedTemplate={selectedTemplate} />,
    );

    expect(markup).toContain("Plantilla seleccionada: Presupuesto de edificacion base");
    expect(markup).toContain('name="templateId"');
    expect(markup).toContain('value="budget-edificacion-base"');
  });

  // ── Single-company read-only div ───────────────────────────────────────

  describe("single company read-only div", () => {
    it("renders the company name in a styled div (not a Select) when only one company", () => {
      render(<ProjectForm companies={[{ id: "c1", name: "MYC Ingenieria" }]} />);

      const companyDiv = screen.getByText("MYC Ingenieria");
      expect(companyDiv).toBeTruthy();
      // It's a div, not a select
      expect(companyDiv.tagName).toBe("DIV");
      // Modern styling by default
      expect(companyDiv.className).toContain("rounded-xl");
      expect(companyDiv.className).toContain("px-3");
      expect(companyDiv.className).toContain("py-2");
    });

    it("renders with condensed Excel mode styling when isExcelMode is true", () => {
      mockViewModeRef.current = { isExcelMode: true };
      render(<ProjectForm companies={[{ id: "c1", name: "MYC Ingenieria" }]} />);

      const companyDiv = screen.getByText("MYC Ingenieria");
      expect(companyDiv.className).toContain("rounded-md");
      expect(companyDiv.className).toContain("h-8");
      expect(companyDiv.className).toContain("text-xs");
      // Should NOT have modern classes
      expect(companyDiv.className).not.toContain("rounded-xl");
      expect(companyDiv.className).not.toContain("h-10");
    });

    it("renders a hidden input with the company id for form submission", () => {
      render(<ProjectForm companies={[{ id: "c1", name: "MYC Ingenieria" }]} />);

      const hiddenInput = document.querySelector<HTMLInputElement>('input[type="hidden"][name="companyId"]');
      expect(hiddenInput).toBeTruthy();
      expect(hiddenInput?.value).toBe("c1");
    });

    it("renders the Select variant when there are multiple companies", () => {
      render(
        <ProjectForm
          companies={[
            { id: "c1", name: "MYC Ingenieria" },
            { id: "c2", name: "Otra Empresa" },
          ]}
        />,
      );

      // The text MYC Ingenieria should exist (inside the Select trigger or hidden native select)
      const texts = screen.getAllByText("MYC Ingenieria");
      expect(texts.length).toBeGreaterThan(0);
      // The hidden companyId input should NOT exist (Select handles it via its own form control)
      const hiddenInput = document.querySelector<HTMLInputElement>('input[type="hidden"][name="companyId"]');
      expect(hiddenInput).toBeNull();
    });
  });
});
