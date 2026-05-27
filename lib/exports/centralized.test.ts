import { describe, expect, it } from "vitest";
import { buildStoredZip, getExportDefinition, normalizeExportRequest } from "@/lib/exports/centralized";

describe("centralized export registry", () => {
  it("normalizes valid export requests and applies default options", () => {
    const request = normalizeExportRequest({
      target: "budget",
      targetId: "budget-1",
      format: "xlsx",
      preset: "presupuesto_detallado",
      options: { includeSignature: false, currencyDecimals: 3 },
    });

    expect(request).toEqual({
      target: "budget",
      targetId: "budget-1",
      format: "xlsx",
      preset: "presupuesto_detallado",
      options: expect.objectContaining({
        includeSignature: false,
        includeSubtotals: true,
        includeTotals: true,
        currencyDecimals: 3,
      }),
    });
  });

  it("rejects unsupported target, format, and preset combinations", () => {
    expect(() =>
      normalizeExportRequest({
        target: "budget",
        targetId: "budget-1",
        format: "zip",
        preset: "presupuesto_detallado",
      }),
    ).toThrow("La combinacion de modulo, formato y preset no esta disponible");
  });

  it("exposes module definitions for the export panel", () => {
    const definition = getExportDefinition("work_schedule");

    expect(definition.label).toBe("Cronograma de obra");
    expect(definition.presets.map((preset) => preset.id)).toContain("cronograma_ejecutivo");
    expect(definition.presets.find((preset) => preset.id === "cronograma_ejecutivo")?.formats).toContain("zip");
  });

  it("exposes definitions for resources, expenses, footer, formula, and schedule PDF", () => {
    expect(getExportDefinition("resources").presets[0]?.id).toBe("catalogo_insumos");
    expect(getExportDefinition("budget_resources").presets[0]?.id).toBe("lista_insumos_derivada");
    expect(getExportDefinition("general_expenses").presets[0]?.id).toBe("gastos_generales_detallado");
    expect(getExportDefinition("budget_footer").presets[0]?.id).toBe("pie_presupuesto_detallado");
    expect(getExportDefinition("polynomial_formula").presets[0]?.id).toBe("formula_polinomica_detallada");
    expect(getExportDefinition("work_schedule").presets.every((preset) => preset.formats.includes("pdf"))).toBe(true);
  });
});

describe("stored zip builder", () => {
  it("creates a zip payload with every requested file name", () => {
    const zip = buildStoredZip([
      { fileName: "resumen.csv", content: "Periodo,Total\n2026-05,100" },
      { fileName: "detalle.csv", content: "Codigo,Parcial\n01.01,80" },
    ]);
    const text = zip.toString("latin1");

    expect(zip.byteLength).toBeGreaterThan(100);
    expect(text).toContain("resumen.csv");
    expect(text).toContain("detalle.csv");
    expect(text).toContain("PK\u0005\u0006");
  });
});
