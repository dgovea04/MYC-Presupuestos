import { describe, expect, it } from "vitest";

import { projectSchema } from "@/lib/validations/project";

const BASE_VALID_PROJECT = {
  companyId: "company-1",
  name: "Proyecto de prueba",
  status: "PLANNING" as const,
};

describe("projectSchema — nullable optional fields", () => {
  const nullableEnums = ["projectCategory", "buildingSubtype", "contractType"] as const;
  const nullableStrings = [
    "region",
    "province",
    "district",
    "executiveSummary",
    "projectManager",
    "ownerEntity",
    "supervisor",
  ] as const;

  describe("accepts null", () => {
    for (const field of nullableEnums) {
      it(`${field} accepts null and preserves it in output`, () => {
        const result = projectSchema.safeParse({
          ...BASE_VALID_PROJECT,
          [field]: null,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data[field]).toBeNull();
        }
      });
    }

    for (const field of nullableStrings) {
      it(`${field} accepts null and preserves it in output`, () => {
        const result = projectSchema.safeParse({
          ...BASE_VALID_PROJECT,
          [field]: null,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data[field]).toBeNull();
        }
      });
    }
  });

  describe("accepts undefined (field not present)", () => {
    it("parses successfully when all nullable fields are omitted", () => {
      const result = projectSchema.safeParse(BASE_VALID_PROJECT);
      expect(result.success).toBe(true);
    });
  });

  describe("still accepts valid values", () => {
    for (const field of nullableEnums) {
      it(`${field} accepts a valid enum value`, () => {
        const validValues: Record<string, string> = {
          projectCategory: "EDIFICACION",
          buildingSubtype: "MULTIFAMILIAR",
          contractType: "SUMA_ALZADA",
        };
        const result = projectSchema.safeParse({
          ...BASE_VALID_PROJECT,
          [field]: validValues[field],
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect((result.data as Record<string, unknown>)[field]).toBe(validValues[field]);
        }
      });
    }

    for (const field of nullableStrings) {
      it(`${field} accepts a non-empty string`, () => {
        const result = projectSchema.safeParse({
          ...BASE_VALID_PROJECT,
          [field]: "Valor de prueba",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect((result.data as Record<string, unknown>)[field]).toBe("Valor de prueba");
        }
      });

      it(`${field} accepts empty string`, () => {
        const result = projectSchema.safeParse({
          ...BASE_VALID_PROJECT,
          [field]: "",
        });
        expect(result.success).toBe(true);
      });
    }
  });

  describe("accepts empty string (converted to null) for enums", () => {
    for (const field of nullableEnums) {
      it(`${field} converts empty string to null`, () => {
        const result = projectSchema.safeParse({
          ...BASE_VALID_PROJECT,
          [field]: "",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data[field]).toBeNull();
        }
      });
    }
  });

  describe("still rejects invalid enum values", () => {
    it("rejects projectCategory with an invalid value", () => {
      const result = projectSchema.safeParse({
        ...BASE_VALID_PROJECT,
        projectCategory: "INVALID_TYPE",
      });
      expect(result.success).toBe(false);
    });

    it("rejects buildingSubtype with an invalid value", () => {
      const result = projectSchema.safeParse({
        ...BASE_VALID_PROJECT,
        buildingSubtype: "RASCACIELOS",
      });
      expect(result.success).toBe(false);
    });

    it("rejects contractType with an invalid value", () => {
      const result = projectSchema.safeParse({
        ...BASE_VALID_PROJECT,
        contractType: "LLAVE_EN_MANO",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("regression: required fields are still required", () => {
    it("rejects when companyId is missing", () => {
      const result = projectSchema.safeParse({
        name: "Obra sin empresa",
        status: "PLANNING",
      });
      expect(result.success).toBe(false);
    });

    it("rejects when name is too short", () => {
      const result = projectSchema.safeParse({
        ...BASE_VALID_PROJECT,
        name: "AB",
      });
      expect(result.success).toBe(false);
    });

    it("rejects when status is invalid", () => {
      const result = projectSchema.safeParse({
        ...BASE_VALID_PROJECT,
        status: "ARCHIVED",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("coerced number fields still work", () => {
    it("coerces string numbers for builtArea", () => {
      const result = projectSchema.safeParse({
        ...BASE_VALID_PROJECT,
        builtArea: "1250.5",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.builtArea).toBe(1250.5);
      }
    });

    it("accepts zero for floors", () => {
      const result = projectSchema.safeParse({
        ...BASE_VALID_PROJECT,
        floors: 0,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.floors).toBe(0);
      }
    });
  });
});
