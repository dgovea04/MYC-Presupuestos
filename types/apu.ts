import type { ResourceRecord } from "@/types/resource";
import type { CatalogPartidaRecord, PartidaApuRowRecord } from "@/types/partida";

export type ApuResourceRecord = {
  id: string;
  apuId: string;
  resourceId?: string | null;
  catalogPartidaId?: string | null;
  resourceType: string;
  crew?: number | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  resource?: ResourceRecord;
  catalogPartida?: CatalogPartidaRecord | null;
  nestedApuRows?: PartidaApuRowRecord[];
};

export type ApuRecord = {
  id: string;
  budgetItemId: string;
  name: string;
  unit: string;
  performance: number;
  totalUnitCost: number;
  resources: ApuResourceRecord[];
};
