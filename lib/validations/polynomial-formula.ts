import Decimal from "decimal.js";
import { z } from "zod";

import { POLYNOMIAL_FORMULA_DEFAULT_MAX_MONOMIALS } from "@/lib/polynomial-formula/smart-monomial-types";

const polynomialCostGroupKeySchema = z.enum([
  "LABOR",
  "MATERIALS",
  "EQUIPMENT",
  "OTHERS",
  "GENERAL_EXPENSES_PROFIT",
  "STEEL",
  "CEMENT",
  "MASONRY",
  "INSTALLATIONS",
]);

const polynomialFormulaStatusSchema = z.enum(["DRAFT", "VALID", "ARCHIVED"]);

const monthSchema = z.coerce.number().int().min(1).max(12);
const yearSchema = z.coerce.number().int().min(1979);
const nonEmptyStringSchema = z.string().trim().min(1);

function createDecimalStringSchema(options: {
  allowZero: boolean;
  fieldName: string;
}) {
  return z.string().trim().refine((value) => {
    try {
      const decimal = new Decimal(value);
      return options.allowZero ? decimal.greaterThanOrEqualTo(0) : decimal.greaterThan(0);
    } catch {
      return false;
    }
  }, `${options.fieldName} debe ser un decimal valido${options.allowZero ? "" : " mayor que cero"}`);
}

const positiveDecimalStringSchema = (fieldName: string) =>
  createDecimalStringSchema({ allowZero: false, fieldName });

export const polynomialMonomialInputSchema = z.object({
  id: nonEmptyStringSchema,
  code: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  costGroupKey: polynomialCostGroupKeySchema,
  amount: positiveDecimalStringSchema("El monto"),
  coefficient: positiveDecimalStringSchema("El coeficiente"),
  baseIndexCode: nonEmptyStringSchema,
  baseIndexName: nonEmptyStringSchema,
  baseIndexValue: positiveDecimalStringSchema("El indice base"),
  adjustmentIndexCode: z.string().trim().nullable().optional(),
  adjustmentIndexName: z.string().trim().nullable().optional(),
  adjustmentIndexValue: positiveDecimalStringSchema("El indice de reajuste")
    .nullable()
    .optional(),
  sortOrder: z.coerce.number().int().min(0),
});

export const polynomialFormulaSaveSchema = z.object({
  name: nonEmptyStringSchema,
  baseMonth: monthSchema,
  baseYear: yearSchema,
  status: polynomialFormulaStatusSchema.optional(),
  monomials: z
    .array(polynomialMonomialInputSchema)
    .min(1)
    .max(POLYNOMIAL_FORMULA_DEFAULT_MAX_MONOMIALS),
});

const polynomialKCalculationMonomialSchema = z.object({
  coefficient: positiveDecimalStringSchema("El coeficiente"),
  baseIndexValue: positiveDecimalStringSchema("El indice base"),
  adjustmentIndexValue: positiveDecimalStringSchema("El indice de reajuste"),
  name: nonEmptyStringSchema,
});

export const polynomialKCalculationSchema = z.object({
  monomials: z
    .array(polynomialKCalculationMonomialSchema)
    .min(1)
    .max(POLYNOMIAL_FORMULA_DEFAULT_MAX_MONOMIALS),
});

export const valuationInputSchema = z.object({
  month: monthSchema,
  year: yearSchema,
  amount: positiveDecimalStringSchema("El monto de valorizacion"),
});

export const polynomialAdjustmentCreateSchema = z
  .object({
    month: monthSchema,
    year: yearSchema,
    originalAmount: positiveDecimalStringSchema("El monto original").optional(),
    valuationId: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) => Boolean(value.valuationId || value.originalAmount),
    "Debes enviar una valorizacion existente o un monto original",
  );

export type PolynomialMonomialInputSchema = z.infer<
  typeof polynomialMonomialInputSchema
>;
export type PolynomialFormulaSaveInput = z.infer<
  typeof polynomialFormulaSaveSchema
>;
export type PolynomialKCalculationInput = z.infer<
  typeof polynomialKCalculationSchema
>;
export type ValuationInput = z.infer<typeof valuationInputSchema>;
export type PolynomialAdjustmentCreateInput = z.infer<
  typeof polynomialAdjustmentCreateSchema
>;
