import { prisma } from "@/lib/db/prisma";

export interface KnowledgeSupplierInput {
  name: string;
  legalName?: string;
  ruc?: string;
  regionId?: string;
  sourceId?: string;
  website?: string;
  phone?: string;
  email?: string;
  status?: string;
}

function normalizeRuc(value: string) {
  const ruc = value.replace(/\D/g, "");
  if (ruc.length !== 11) throw new Error("RUC must contain 11 digits");
  return ruc;
}

export async function createKnowledgeSupplier(input: KnowledgeSupplierInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Supplier name is required");
  return prisma.knowledgeSupplier.create({ data: {
    name,
    legalName: input.legalName?.trim() || undefined,
    ruc: input.ruc ? normalizeRuc(input.ruc) : undefined,
    regionId: input.regionId,
    sourceId: input.sourceId,
    website: input.website?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    email: input.email?.trim().toLocaleLowerCase("es-PE") || undefined,
    status: input.status?.trim() || "ACTIVE",
  } });
}

export async function listKnowledgeSuppliers(regionId?: string) {
  return prisma.knowledgeSupplier.findMany({
    where: regionId ? { regionId } : undefined,
    orderBy: { name: "asc" },
  });
}
