import { describe, expect, it } from "vitest";
import { normalizeSubBudgetName, isSameSubBudgetName, mapMcpSubBudgetToExisting } from "./sub-budget-names";

describe("normalizeSubBudgetName", () => {
  it("lowercases and removes accents", () => {
    expect(normalizeSubBudgetName("Arquitectura")).toBe("arquitectura");
    expect(normalizeSubBudgetName("Instalación Eléctrica")).toBe("instalacion electrica");
  });

  it("expands inst. electricas to instalaciones electricas", () => {
    expect(normalizeSubBudgetName("inst. electricas")).toBe("instalaciones electricas");
  });

  it("expands inst electricas to instalaciones electricas", () => {
    expect(normalizeSubBudgetName("inst electricas")).toBe("instalaciones electricas");
  });

  it("expands inst. sanitarias", () => {
    expect(normalizeSubBudgetName("inst. sanitarias")).toBe("instalaciones sanitarias");
  });

  it("maps arquitectonico to arquitectura", () => {
    expect(normalizeSubBudgetName("arquitectonico")).toBe("arquitectura");
  });

  it("maps estruct to estructuras", () => {
    expect(normalizeSubBudgetName("estruct")).toBe("estructuras");
  });

  it("maps elec to instalaciones electricas", () => {
    expect(normalizeSubBudgetName("elec")).toBe("instalaciones electricas");
  });

  it("trims whitespace", () => {
    expect(normalizeSubBudgetName("  Arquitectura  ")).toBe("arquitectura");
  });
});

describe("isSameSubBudgetName", () => {
  it("matches identical names", () => {
    expect(isSameSubBudgetName("Estructuras", "Estructuras")).toBe(true);
  });

  it("matches case-insensitive", () => {
    expect(isSameSubBudgetName("estructuras", "ESTRUCTURAS")).toBe(true);
  });

  it("matches accent-insensitive", () => {
    expect(isSameSubBudgetName("Instalación Eléctrica", "Instalacion Electrica")).toBe(true);
  });

  it("matches abbreviation expansion", () => {
    expect(isSameSubBudgetName("inst. electricas", "Instalaciones Electricas")).toBe(true);
  });

  it("matches arquitectonico with arquitectura", () => {
    expect(isSameSubBudgetName("arquitectonico", "Arquitectura")).toBe(true);
  });

  it("does not match different names", () => {
    expect(isSameSubBudgetName("Estructuras", "Arquitectura")).toBe(false);
  });

  it("matches with extra words (partial token overlap)", () => {
    // "instalaciones electricas" vs "instalaciones electricas y comunicaciones"
    // Jaccard: {instalaciones, electricas} ∩ {instalaciones, electricas, comunicaciones} = 2/3 ≈ 0.67 >= 0.6
    expect(isSameSubBudgetName("Instalaciones Electricas", "Instalaciones Electricas y Comunicaciones")).toBe(true);
  });

  it("does not match completely unrelated names", () => {
    expect(isSameSubBudgetName("Estructuras", "Instalaciones Sanitarias")).toBe(false);
  });
});

describe("mapMcpSubBudgetToExisting", () => {
  const existingNames = ["Estructuras", "Arquitectura", "Instalaciones Eléctricas", "Instalaciones Sanitarias"];

  it("finds exact match", () => {
    const result = mapMcpSubBudgetToExisting({
      mcpName: "Estructuras",
      existingNames,
    });
    expect(result).toBe("Estructuras");
  });

  it("finds match via normalization", () => {
    const result = mapMcpSubBudgetToExisting({
      mcpName: "inst. electricas",
      existingNames,
    });
    expect(result).toBe("Instalaciones Eléctricas");
  });

  it("finds match for arquitectonico", () => {
    const result = mapMcpSubBudgetToExisting({
      mcpName: "arquitectonico",
      existingNames,
    });
    expect(result).toBe("Arquitectura");
  });

  it("returns null when no match", () => {
    const result = mapMcpSubBudgetToExisting({
      mcpName: "Obra Civil",
      existingNames,
    });
    expect(result).toBeNull();
  });

  it("returns null for empty existing names", () => {
    const result = mapMcpSubBudgetToExisting({
      mcpName: "Estructuras",
      existingNames: [],
    });
    expect(result).toBeNull();
  });
});
