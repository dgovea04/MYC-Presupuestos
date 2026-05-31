import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProjectForm } from "@/components/projects/project-form";
import { getTemplateLibraryItem } from "@/lib/templates/template-library";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ProjectForm", () => {
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
});
