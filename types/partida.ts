export type PartidaApuRowRecord = {
  id: string;
  catalogPartidaId: string;
  resourceId?: string | null;
  catalogSubpartidaId?: string | null;
  catalogSubpartida?: CatalogPartidaRecord | null;
  description: string;
  unit: string;
  crew?: number | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  resourceType?: string | null;
  groupLabel?: string | null;
  sortOrder: number;
};

export type CatalogPartidaRecord = {
  id: string;
  description: string;
  unit: string;
  unitPrice: number;
  currency: string;
  source?: string | null;
  performance: number;
  performanceUnit?: string | null;
  performanceRate?: string | null;
  apuRows: PartidaApuRowRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export type PartidaApuRowInput = Omit<PartidaApuRowRecord, "id" | "catalogPartidaId"> & {
  id?: string;
};

export type CatalogPartidaPatchFields = Pick<
  CatalogPartidaRecord,
  "description" | "unit" | "unitPrice" | "currency" | "source" | "performance" | "performanceUnit" | "performanceRate"
> & {
  apuRows: PartidaApuRowInput[];
};

export type CatalogPartidaCreatePatch = {
  clientId: string;
  data: CatalogPartidaPatchFields;
};

export type CatalogPartidaUpdatePatch = {
  id: string;
  changes: Partial<CatalogPartidaPatchFields>;
};

export type CatalogPartidaStatePatch = {
  create: CatalogPartidaCreatePatch[];
  update: CatalogPartidaUpdatePatch[];
  delete: string[];
};

export type CatalogPartidaPatchResult = {
  created: Array<{ clientId: string; partida: CatalogPartidaRecord }>;
  updated: CatalogPartidaRecord[];
  deleted: string[];
  savedAt: string;
};
