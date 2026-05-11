export type ResourceCategory = "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS";

export type ResourceRecord = {
  id: string;
  companyId?: string | null;
  code: string;
  description: string;
  category: ResourceCategory;
  iu?: string | null;
  subcategory?: string | null;
  unit: string;
  unitPrice: number;
  currency: string;
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ResourcePatchFields = Pick<
  ResourceRecord,
  "companyId" | "code" | "description" | "category" | "iu" | "subcategory" | "unit" | "unitPrice" | "currency" | "source"
>;

export type ResourceCreatePatch = {
  clientId: string;
  data: ResourcePatchFields;
};

export type ResourceUpdatePatch = {
  id: string;
  changes: Partial<ResourcePatchFields>;
};

export type ResourceStatePatch = {
  create: ResourceCreatePatch[];
  update: ResourceUpdatePatch[];
  delete: string[];
};

export type ResourcePatchResult = {
  created: Array<{ clientId: string; resource: ResourceRecord }>;
  updated: ResourceRecord[];
  deleted: string[];
  savedAt: string;
};
