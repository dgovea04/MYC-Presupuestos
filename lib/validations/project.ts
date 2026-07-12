import { z } from "zod";

export const projectCategoryValues = [
  "EDIFICACION",
  "INFRAESTRUCTURA_VIAL",
  "SANEAMIENTO",
  "ELECTRICO",
  "MINERO",
  "INDUSTRIAL",
  "HABILITACION_URBANA",
  "OTRO",
] as const;

export const buildingSubtypeValues = [
  "UNIFAMILIAR",
  "MULTIFAMILIAR",
  "COMERCIAL",
  "OFICINAS",
  "EDUCACIONAL",
  "HOSPITALARIO",
  "HOTELERO",
  "MIXTO",
  "OTRO",
] as const;

export const contractTypeValues = [
  "SUMA_ALZADA",
  "PRECIOS_UNITARIOS",
  "MIXTO",
  "ADMINISTRACION",
] as const;

const emptyToNull = (val: unknown) => (val === "" ? null : val);

export const projectSchema = z.object({
  companyId: z.string().min(1, "Selecciona una empresa"),
  name: z.string().min(3, "Ingresa el nombre de la obra"),
  clientName: z.string().optional(),
  location: z.string().optional(),
  projectType: z.string().optional(),
  projectCategory: z.preprocess(emptyToNull, z.enum(projectCategoryValues).nullable().optional()),
  buildingSubtype: z.preprocess(emptyToNull, z.enum(buildingSubtypeValues).nullable().optional()),
  contractType: z.preprocess(emptyToNull, z.enum(contractTypeValues).nullable().optional()),
  builtArea: z.coerce.number().min(0).optional(),
  landArea: z.coerce.number().min(0).optional(),
  floors: z.coerce.number().int().min(0).optional(),
  basements: z.coerce.number().int().min(0).optional(),
  buildingHeight: z.coerce.number().min(0).optional(),
  contractAmount: z.coerce.number().min(0).optional(),
  referenceBudget: z.coerce.number().min(0).optional(),
  region: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  executiveSummary: z.string().nullable().optional(),
  projectManager: z.string().nullable().optional(),
  ownerEntity: z.string().nullable().optional(),
  supervisor: z.string().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]),
  templateId: z.string().optional(),
  workCalendarId: z.string().nullable().optional(),
});

export type ProjectInput = z.infer<typeof projectSchema>;
