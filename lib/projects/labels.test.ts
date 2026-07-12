import { describe, expect, it } from "vitest";
import { buildingSubtypeLabel, contractTypeLabel, projectCategoryLabel } from "@/lib/projects/labels";

describe("projectCategoryLabel", () => {
  it("returns the display label for each known category", () => {
    expect(projectCategoryLabel("EDIFICACION")).toBe("Edificación");
    expect(projectCategoryLabel("INFRAESTRUCTURA_VIAL")).toBe("Infraestructura Vial");
    expect(projectCategoryLabel("SANEAMIENTO")).toBe("Saneamiento");
    expect(projectCategoryLabel("ELECTRICO")).toBe("Eléctrico / Electromecánico");
    expect(projectCategoryLabel("MINERO")).toBe("Minería");
    expect(projectCategoryLabel("INDUSTRIAL")).toBe("Industrial");
    expect(projectCategoryLabel("HABILITACION_URBANA")).toBe("Habilitación Urbana");
    expect(projectCategoryLabel("OTRO")).toBe("Otro");
  });

  it("falls back to the raw value for unknown categories", () => {
    expect(projectCategoryLabel("CUSTOM_TYPE")).toBe("CUSTOM_TYPE");
  });

  it("returns null for empty string (falsy)", () => {
    expect(projectCategoryLabel("")).toBeNull();
  });

  it("returns null for null or undefined", () => {
    expect(projectCategoryLabel(null)).toBeNull();
    expect(projectCategoryLabel(undefined)).toBeNull();
  });
});

describe("buildingSubtypeLabel", () => {
  it("returns the display label for each known subtype", () => {
    expect(buildingSubtypeLabel("UNIFAMILIAR")).toBe("Unifamiliar");
    expect(buildingSubtypeLabel("MULTIFAMILIAR")).toBe("Multifamiliar");
    expect(buildingSubtypeLabel("COMERCIAL")).toBe("Comercial");
    expect(buildingSubtypeLabel("OFICINAS")).toBe("Oficinas");
    expect(buildingSubtypeLabel("EDUCACIONAL")).toBe("Educacional");
    expect(buildingSubtypeLabel("HOSPITALARIO")).toBe("Hospitalario");
    expect(buildingSubtypeLabel("HOTELERO")).toBe("Hotelero");
    expect(buildingSubtypeLabel("MIXTO")).toBe("Mixto");
    expect(buildingSubtypeLabel("OTRO")).toBe("Otro");
  });

  it("falls back to the raw value for unknown subtypes", () => {
    expect(buildingSubtypeLabel("INDUSTRIAL_LIGERO")).toBe("INDUSTRIAL_LIGERO");
  });

  it("returns null for empty string (falsy)", () => {
    expect(buildingSubtypeLabel("")).toBeNull();
  });

  it("returns null for null or undefined", () => {
    expect(buildingSubtypeLabel(null)).toBeNull();
    expect(buildingSubtypeLabel(undefined)).toBeNull();
  });
});

describe("contractTypeLabel", () => {
  it("returns the display label for each known contract type", () => {
    expect(contractTypeLabel("SUMA_ALZADA")).toBe("Suma Alzada");
    expect(contractTypeLabel("PRECIOS_UNITARIOS")).toBe("Precios Unitarios");
    expect(contractTypeLabel("MIXTO")).toBe("Mixto");
    expect(contractTypeLabel("ADMINISTRACION")).toBe("Administración");
  });

  it("falls back to the raw value for unknown contract types", () => {
    expect(contractTypeLabel("LLAVE_EN_MANO")).toBe("LLAVE_EN_MANO");
  });

  it("returns null for empty string (falsy)", () => {
    expect(contractTypeLabel("")).toBeNull();
  });

  it("returns null for null or undefined", () => {
    expect(contractTypeLabel(null)).toBeNull();
    expect(contractTypeLabel(undefined)).toBeNull();
  });
});
