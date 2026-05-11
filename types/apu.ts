import type { ResourceRecord } from "@/types/resource";

export type ApuResourceRecord = {
  id: string;
  apuId: string;
  resourceId: string;
  resourceType: string;
  crew?: number | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  resource?: ResourceRecord;
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
