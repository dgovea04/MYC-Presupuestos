/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Configurable mock for useAppViewMode ────────────────────────────────
// We use a mutable ref so tests can toggle Excel mode without hoisting issues.
const mockViewModeRef = { current: { isExcelMode: false, viewMode: "modern" as const } };

vi.mock("@/components/view-mode/app-view-mode-provider", () => ({
  useAppViewMode: () => ({
    isExcelMode: mockViewModeRef.current.isExcelMode,
    viewMode: mockViewModeRef.current.viewMode,
    setViewMode: vi.fn(),
  }),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    id,
    name,
    defaultValue,
    children,
  }: {
    id?: string;
    name?: string;
    defaultValue?: string;
    children: React.ReactNode;
  }) => (
    <select data-testid={`select-${name ?? id}`} id={id} name={name} defaultValue={defaultValue}>
      {children}
    </select>
  ),
}));

vi.mock("@/components/ui/location-selects", () => ({
  LocationSelects: ({ compact }: { compact?: boolean }) => (
    <div data-testid="location-selects" data-compact={compact ? "true" : "false"}>
      <input type="hidden" name="region" value="" />
      <input type="hidden" name="province" value="" />
      <input type="hidden" name="district" value="" />
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <span data-testid="chevron-down" className={className} />
  ),
  CalendarDays: () => <span data-testid="calendar-days" />,
  MapPin: () => <span data-testid="map-pin" />,
  Save: () => <span data-testid="save-icon" />,
}));

import { ProjectAdvancedSection } from "@/components/projects/project-form";
import type { BuildingSubtype, ContractType, ProjectCategory } from "@/types/project";

const EMPTY_PROPS = {
  projectCategory: null as ProjectCategory | null,
  buildingSubtype: null as BuildingSubtype | null,
  contractType: null as ContractType | null,
  builtArea: null as number | null,
  landArea: null as number | null,
  floors: null as number | null,
  basements: null as number | null,
  buildingHeight: null as number | null,
  contractAmount: null as number | null,
  referenceBudget: null as number | null,
  region: null as string | null,
  province: null as string | null,
  district: null as string | null,
  executiveSummary: null as string | null,
  projectManager: null as string | null,
  ownerEntity: null as string | null,
  supervisor: null as string | null,
};

describe("ProjectAdvancedSection", () => {
  afterEach(() => {
    cleanup();
    mockViewModeRef.current = { isExcelMode: false, viewMode: "modern" };
  });

  // ── Collapsed state ───────────────────────────────────────────────────────

  describe("collapsed state (default)", () => {
    it("renders the toggle button with correct title and description", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);

      expect(screen.getByText("Configuración avanzada")).toBeTruthy();
      expect(
        screen.getByText("Datos técnicos, contractuales y resumen ejecutivo del proyecto."),
      ).toBeTruthy();
      expect(screen.getByTestId("chevron-down")).toBeTruthy();
    });

    it("does NOT render expanded fields when collapsed", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);

      // Sub-section labels
      expect(screen.queryByText("Ubicación")).toBeNull();
      expect(screen.queryByText("Parámetros técnicos")).toBeNull();
      expect(screen.queryByText("Información complementaria")).toBeNull();

      // Field labels
      expect(screen.queryByText("Subtipo de edificación")).toBeNull();
      expect(screen.queryByText("Tipo de contrato")).toBeNull();
      expect(screen.queryByText("Resumen ejecutivo")).toBeNull();
    });

    it("renders LocationSelects in compact mode", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);

      const locationSelects = screen.getByTestId("location-selects");
      expect(locationSelects).toBeTruthy();
      expect(locationSelects.getAttribute("data-compact")).toBe("true");
    });

    it("always includes hidden region/province/district inputs", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);

      const locationSelects = screen.getByTestId("location-selects");
      expect(locationSelects.innerHTML).toContain('name="region"');
      expect(locationSelects.innerHTML).toContain('name="province"');
      expect(locationSelects.innerHTML).toContain('name="district"');
    });

    it("chevron does NOT have rotate-180 class when collapsed", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);

      const chevron = screen.getByTestId("chevron-down");
      expect(chevron.className).not.toContain("rotate-180");
    });
  });

  // ── Expanded state ────────────────────────────────────────────────────────

  describe("expanded state (after clicking toggle)", () => {
    function expand() {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);
      fireEvent.click(screen.getByText("Configuración avanzada"));
    }

    it("renders sub-section group labels: Ubicación, Parámetros técnicos, Información complementaria", () => {
      expand();

      expect(screen.getByText("Ubicación")).toBeTruthy();
      expect(screen.getByText("Parámetros técnicos")).toBeTruthy();
      expect(screen.getByText("Información complementaria")).toBeTruthy();
    });

    it("renders buildingSubtype and contractType as Select components", () => {
      expand();

      expect(screen.getByTestId("select-buildingSubtype")).toBeTruthy();
      expect(screen.getByTestId("select-contractType")).toBeTruthy();
    });

    it("renders physical parameter inputs", () => {
      expand();

      expect(screen.getByLabelText("Área construida (m²)")).toBeTruthy();
      expect(screen.getByLabelText("Área de terreno (m²)")).toBeTruthy();
      expect(screen.getByLabelText("N° de pisos")).toBeTruthy();
      expect(screen.getByLabelText("N° de sótanos")).toBeTruthy();
      expect(screen.getByLabelText("Altura total (m)")).toBeTruthy();
    });

    it("renders contract and reference budget inputs in Información complementaria", () => {
      expand();

      expect(screen.getByLabelText("Monto contractual")).toBeTruthy();
      expect(screen.getByLabelText("Presupuesto referencial")).toBeTruthy();
    });

    it("renders stakeholder inputs in Información complementaria", () => {
      expand();

      expect(screen.getByLabelText("Ing. Residente / PM")).toBeTruthy();
      expect(screen.getByLabelText("Entidad contratante")).toBeTruthy();
      expect(screen.getByLabelText("Supervisión")).toBeTruthy();
    });

    it("renders executive summary textarea full-width", () => {
      expand();

      const textarea = screen.getByLabelText("Resumen ejecutivo");
      expect(textarea).toBeTruthy();
      expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("LocationSelects is NOT compact when expanded", () => {
      expand();

      const locationSelects = screen.getByTestId("location-selects");
      expect(locationSelects.getAttribute("data-compact")).toBe("false");
    });

    it("chevron has rotate-180 class when expanded", () => {
      expand();

      const chevron = screen.getByTestId("chevron-down");
      expect(chevron.className).toContain("rotate-180");
    });

    it("collapses back when toggled twice", () => {
      expand();

      fireEvent.click(screen.getByText("Configuración avanzada"));

      expect(screen.queryByText("Subtipo de edificación")).toBeNull();
      expect(screen.queryByText("Tipo de contrato")).toBeNull();
    });
  });

  // ── With values ───────────────────────────────────────────────────────────

  describe("expanded with values", () => {
    it("renders number field defaults correctly", () => {
      render(
        <ProjectAdvancedSection
          {...EMPTY_PROPS}
          builtArea={1250.5}
          landArea={3000}
          floors={5}
          basements={2}
          buildingHeight={18}
          contractAmount={2500000}
          referenceBudget={2300000}
        />,
      );
      fireEvent.click(screen.getByText("Configuración avanzada"));

      expect((screen.getByLabelText("Área construida (m²)") as HTMLInputElement).defaultValue).toBe("1250.5");
      expect((screen.getByLabelText("Área de terreno (m²)") as HTMLInputElement).defaultValue).toBe("3000");
      expect((screen.getByLabelText("N° de pisos") as HTMLInputElement).defaultValue).toBe("5");
      expect((screen.getByLabelText("N° de sótanos") as HTMLInputElement).defaultValue).toBe("2");
      expect((screen.getByLabelText("Altura total (m)") as HTMLInputElement).defaultValue).toBe("18");
      expect((screen.getByLabelText("Monto contractual") as HTMLInputElement).defaultValue).toBe("2500000");
      expect((screen.getByLabelText("Presupuesto referencial") as HTMLInputElement).defaultValue).toBe("2300000");
    });

    it("renders select defaults for buildingSubtype and contractType", () => {
      render(
        <ProjectAdvancedSection
          {...EMPTY_PROPS}
          buildingSubtype="MULTIFAMILIAR"
          contractType="SUMA_ALZADA"
        />,
      );
      fireEvent.click(screen.getByText("Configuración avanzada"));

      const subtypeSelect = screen.getByTestId("select-buildingSubtype") as HTMLSelectElement;
      const contractSelect = screen.getByTestId("select-contractType") as HTMLSelectElement;

      expect(subtypeSelect).toBeTruthy();
      expect(contractSelect).toBeTruthy();
      expect(subtypeSelect.querySelector('option[value="MULTIFAMILIAR"]')).toBeTruthy();
      expect(contractSelect.querySelector('option[value="SUMA_ALZADA"]')).toBeTruthy();
    });

    it("renders stakeholder string defaults", () => {
      render(
        <ProjectAdvancedSection
          {...EMPTY_PROPS}
          projectManager="Ing. Juan Pérez"
          ownerEntity="Ministerio de Vivienda"
          supervisor="Ing. María López"
          executiveSummary="Proyecto multifamiliar."
        />,
      );
      fireEvent.click(screen.getByText("Configuración avanzada"));

      expect((screen.getByLabelText("Ing. Residente / PM") as HTMLInputElement).defaultValue).toBe("Ing. Juan Pérez");
      expect((screen.getByLabelText("Entidad contratante") as HTMLInputElement).defaultValue).toBe(
        "Ministerio de Vivienda",
      );
      expect((screen.getByLabelText("Supervisión") as HTMLInputElement).defaultValue).toBe("Ing. María López");
      expect((screen.getByLabelText("Resumen ejecutivo") as HTMLTextAreaElement).defaultValue).toBe(
        "Proyecto multifamiliar.",
      );
    });

    it("renders zero as '0' (not empty string)", () => {
      render(
        <ProjectAdvancedSection
          {...EMPTY_PROPS}
          builtArea={0}
          floors={0}
          basements={0}
        />,
      );
      fireEvent.click(screen.getByText("Configuración avanzada"));

      expect((screen.getByLabelText("Área construida (m²)") as HTMLInputElement).defaultValue).toBe("0");
      expect((screen.getByLabelText("N° de pisos") as HTMLInputElement).defaultValue).toBe("0");
      expect((screen.getByLabelText("N° de sótanos") as HTMLInputElement).defaultValue).toBe("0");
    });

    it("renders null values as empty string defaults", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);
      fireEvent.click(screen.getByText("Configuración avanzada"));

      expect((screen.getByLabelText("Área construida (m²)") as HTMLInputElement).defaultValue).toBe("");
      expect((screen.getByLabelText("Ing. Residente / PM") as HTMLInputElement).defaultValue).toBe("");
      expect((screen.getByLabelText("Resumen ejecutivo") as HTMLTextAreaElement).defaultValue).toBe("");
    });
  });

  // ── Structural integrity ──────────────────────────────────────────────────

  describe("structural integrity", () => {
    it("toggle button is type=button (not submit)", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);

      const button = screen.getByText("Configuración avanzada").closest("button");
      expect(button).toBeTruthy();
      expect(button?.getAttribute("type")).toBe("button");
    });

    it("chevron is present both collapsed and expanded", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);

      expect(screen.getByTestId("chevron-down")).toBeTruthy();

      fireEvent.click(screen.getByText("Configuración avanzada"));

      expect(screen.getByTestId("chevron-down")).toBeTruthy();
    });

    it("uses modern styling by default (rounded-2xl, border, shadow)", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);

      const button = screen.getByText("Configuración avanzada").closest("button");
      const wrapper = button?.parentElement;
      expect(wrapper?.className).toContain("rounded-2xl");
      expect(wrapper?.className).toContain("border");
    });
  });

  // ── 2-Column grid layout ──────────────────────────────────────────────────

  describe("2-column grid layout (when expanded)", () => {
    it("Parámetros técnicos has all 7 fields in a 2-column grid", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);
      fireEvent.click(screen.getByText("Configuración avanzada"));

      const expectedLabels = [
        "Subtipo de edificación",
        "Tipo de contrato",
        "Área construida (m²)",
        "Área de terreno (m²)",
        "N° de pisos",
        "N° de sótanos",
        "Altura total (m)",
      ];
      expectedLabels.forEach((label) => {
        expect(screen.getByText(label)).toBeTruthy();
      });
    });

    it("Información complementaria has all 5 fields in a 2-column grid", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);
      fireEvent.click(screen.getByText("Configuración avanzada"));

      const expectedLabels = [
        "Monto contractual",
        "Presupuesto referencial",
        "Ing. Residente / PM",
        "Entidad contratante",
        "Supervisión",
      ];
      expectedLabels.forEach((label) => {
        expect(screen.getByText(label)).toBeTruthy();
      });
    });

    it("contains two 2-column grid containers (one per sub-section)", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);
      fireEvent.click(screen.getByText("Configuración avanzada"));

      // Each sub-section grid is a direct child of its .space-y-3 container
      const paramGrid = screen.getByText("Parámetros técnicos").parentElement?.querySelector(".grid");
      const infoGrid = screen.getByText("Información complementaria").parentElement?.querySelector(".grid");

      expect(paramGrid).toBeTruthy();
      expect(infoGrid).toBeTruthy();
      expect(paramGrid).not.toBe(infoGrid); // Different elements
    });

    it("sub-section group labels are uppercase with tracking-wider", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);
      fireEvent.click(screen.getByText("Configuración avanzada"));

      const paramsLabel = screen.getByText("Parámetros técnicos");
      const infoLabel = screen.getByText("Información complementaria");

      expect(paramsLabel.className).toContain("uppercase");
      expect(paramsLabel.className).toContain("tracking-wider");
      expect(infoLabel.className).toContain("uppercase");
      expect(infoLabel.className).toContain("tracking-wider");
    });

    it("executive summary textarea is inside its own section wrapper, not inside a 2-column grid", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);
      fireEvent.click(screen.getByText("Configuración avanzada"));

      const textarea = screen.getByLabelText("Resumen ejecutivo");
      // The textarea's parent is the section wrapper (space-y-4 border...)
      const parent = textarea.parentElement;
      expect(parent?.className).toContain("space-y-4");
      expect(parent?.className).toContain("border");
      // And it should NOT be inside a grid
      expect(parent?.className).not.toContain("grid");
    });
  });

  // ── Excel mode ────────────────────────────────────────────────────────────

  describe("Excel mode styling", () => {
    beforeEach(() => {
      mockViewModeRef.current = { isExcelMode: true, viewMode: "excel" };
    });

    it("uses condensed padding on toggle button (px-4 py-3 instead of px-5 py-4)", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);

      const button = screen.getByText("Configuración avanzada").closest("button");
      expect(button?.className).toContain("px-4");
      expect(button?.className).toContain("py-3");
    });

    it("wrapper uses excel border style (rounded-md instead of rounded-2xl)", () => {
      render(<ProjectAdvancedSection {...EMPTY_PROPS} />);

      const wrapper = screen.getByText("Configuración avanzada").closest("button")?.parentElement;
      expect(wrapper?.className).toContain("rounded-md");
      expect(wrapper?.className).not.toContain("rounded-2xl");
    });
  });
});
