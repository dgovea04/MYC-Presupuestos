export type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";

export type ProjectCategory = "EDIFICACION" | "INFRAESTRUCTURA_VIAL" | "SANEAMIENTO" | "ELECTRICO" | "MINERO" | "INDUSTRIAL" | "HABILITACION_URBANA" | "OTRO";

export type BuildingSubtype = "UNIFAMILIAR" | "MULTIFAMILIAR" | "COMERCIAL" | "OFICINAS" | "EDUCACIONAL" | "HOSPITALARIO" | "HOTELERO" | "MIXTO" | "OTRO";

export type ContractType = "SUMA_ALZADA" | "PRECIOS_UNITARIOS" | "MIXTO" | "ADMINISTRACION";

export type ProjectAttachmentCategory = "PLANO" | "ESPECIFICACION" | "CONTRATO" | "MEMORIA" | "FOTO" | "OTRO";

export type ProjectRecord = {
  id: string;
  companyId: string;
  name: string;
  clientName?: string | null;
  location?: string | null;
  projectType?: string | null;
  projectCategory?: ProjectCategory | null;
  buildingSubtype?: BuildingSubtype | null;
  contractType?: ContractType | null;
  builtArea?: number | null;
  landArea?: number | null;
  floors?: number | null;
  basements?: number | null;
  buildingHeight?: number | null;
  contractAmount?: number | null;
  referenceBudget?: number | null;
  region?: string | null;
  province?: string | null;
  district?: string | null;
  executiveSummary?: string | null;
  projectManager?: string | null;
  ownerEntity?: string | null;
  supervisor?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: ProjectStatus;
  createdAt?: string;
  updatedAt?: string;
};
