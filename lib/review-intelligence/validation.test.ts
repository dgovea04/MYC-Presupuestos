import { describe, expect, it } from "vitest";
import {
  assertTenantProjectOwnership,
  assertTenantScopedAssociation,
  comparisonJsonSchema,
  locationJsonSchema,
  parseReviewConfiguration,
  progressJsonSchema,
  reviewFindingFlagsSchema,
  signalsJsonSchema,
  warningsJsonSchema,
} from "./validation";
import { reviewFindingTypes } from "./types";

describe("parseReviewConfiguration", () => {
  it("acepta configuración V0 y rechaza límites excedidos", () => {
    const validConfiguration = {
      maxFiles: 10,
      maxPdfPages: 300,
      maxFileSizeMb: 50,
      maxXlsxSheets: 20,
      tolerancePercent: "1.00",
      findingTypes: ["QUANTITY_MISMATCH"],
    };

    expect(() => parseReviewConfiguration(validConfiguration)).not.toThrow();
    expect(() =>
      parseReviewConfiguration({ ...validConfiguration, maxFiles: 11 }),
    ).toThrow();
    expect(() =>
      parseReviewConfiguration({ ...validConfiguration, maxPdfPages: 301 }),
    ).toThrow();
    expect(() =>
      parseReviewConfiguration({ ...validConfiguration, maxFileSizeMb: 51 }),
    ).toThrow();
    expect(() =>
      parseReviewConfiguration({ ...validConfiguration, maxXlsxSheets: 21 }),
    ).toThrow();
  });

  it("rechaza tipos de hallazgo fuera del catálogo V0", () => {
    expect(() =>
      parseReviewConfiguration({
        maxFiles: 10,
        maxPdfPages: 300,
        maxFileSizeMb: 50,
        maxXlsxSheets: 20,
        tolerancePercent: "1.00",
        findingTypes: ["UNSUPPORTED_FINDING"],
      }),
    ).toThrow();
  });

  it("acepta todos los tipos de hallazgo V0 y aplica flags seguros por defecto", () => {
    const parsed = parseReviewConfiguration({
      maxFiles: 1,
      maxPdfPages: 1,
      maxFileSizeMb: 1,
      maxXlsxSheets: 1,
      tolerancePercent: "0",
      findingTypes: reviewFindingTypes,
    });

    expect(parsed.findingTypes).toEqual(reviewFindingTypes);
    expect(reviewFindingFlagsSchema.parse({})).toEqual({
      humanReviewRequired: true,
      automaticBudgetMutation: false,
    });
  });

  it("rechaza límites inferiores, campos faltantes y decimales inválidos", () => {
    const validConfiguration = {
      maxFiles: 1,
      maxPdfPages: 1,
      maxFileSizeMb: 1,
      maxXlsxSheets: 1,
      tolerancePercent: "1.00",
      findingTypes: ["QUANTITY_MISMATCH"],
    };

    for (const field of ["maxFiles", "maxPdfPages", "maxFileSizeMb", "maxXlsxSheets"]) {
      expect(() => parseReviewConfiguration({ ...validConfiguration, [field]: 0 })).toThrow();
    }
    expect(() => parseReviewConfiguration({ ...validConfiguration, tolerancePercent: "1,00" })).toThrow();
    expect(() => {
      const { maxFiles: _maxFiles, ...missingField } = validConfiguration;
      parseReviewConfiguration(missingField);
    }).toThrow();
  });

  it("valida las estructuras JSON que se persisten", () => {
    expect(comparisonJsonSchema.parse({
      documentValue: "12.50",
      budgetValue: "10.00",
      difference: "2.50",
      percentage: "25.00",
      potentialImpact: "100.00",
    })).toMatchObject({ documentValue: "12.50" });
    expect(signalsJsonSchema.parse({ code: 1, description: 0.8, unit: 1 })).toEqual({
      code: 1,
      description: 0.8,
      unit: 1,
    });
    expect(locationJsonSchema.parse({ page: 2, textOffsetStart: 10, textOffsetEnd: 20 })).toEqual({
      page: 2,
      textOffsetStart: 10,
      textOffsetEnd: 20,
    });
    expect(progressJsonSchema.parse({ stage: "matching", completed: 2, total: 3, percent: 66.67 })).toBeTruthy();
    expect(warningsJsonSchema.parse([{ code: "PARTIAL", message: "Sheet 2 unavailable" }])).toHaveLength(1);
    expect(() => comparisonJsonSchema.parse({ documentValue: 12.5 })).toThrow();
  });

  it("rechaza asociaciones entre empresas y proyectos distintos", () => {
    expect(() => assertTenantProjectOwnership({ companyId: "company-a", projectCompanyId: "company-b" })).toThrow();
    expect(() => assertTenantProjectOwnership({ companyId: "company-a", projectCompanyId: "company-a" })).not.toThrow();
  });

  it("rechaza decisiones y auditorías sin consistencia tenant/proyecto", () => {
    const validAssociation = {
      companyId: "company-a",
      projectId: "project-a",
      relatedCompanyId: "company-a",
      relatedProjectId: "project-a",
      actorCompanyId: "company-a",
    };

    expect(() => assertTenantScopedAssociation(validAssociation)).not.toThrow();
    expect(() => assertTenantScopedAssociation({ ...validAssociation, relatedCompanyId: "company-b" })).toThrow();
    expect(() => assertTenantScopedAssociation({ ...validAssociation, relatedProjectId: "project-b" })).toThrow();
    expect(() => assertTenantScopedAssociation({ ...validAssociation, actorCompanyId: "company-b" })).toThrow();
    expect(() => assertTenantScopedAssociation({ ...validAssociation, projectId: "" })).toThrow();
  });
});
