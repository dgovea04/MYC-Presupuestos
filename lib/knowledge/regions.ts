import { prisma } from "@/lib/db/prisma";
import { normalizeKnowledgeText } from "./normalization";

export interface KnowledgeRegionInput {
  level: string;
  name: string;
  parentId?: string;
}

export async function createKnowledgeRegion(input: KnowledgeRegionInput) {
  const level = input.level.trim();
  const name = input.name.trim();
  const normalizedName = normalizeKnowledgeText(name);
  if (!level) throw new Error("Region level is required");
  if (!normalizedName) throw new Error("Region name is required");

  if (input.parentId) {
    const parent = await prisma.knowledgeRegion.findUnique({ where: { id: input.parentId }, select: { level: true } });
    if (!parent) throw new Error("Parent region not found");
    if (parent.level === level) throw new Error("A region cannot have a parent at the same level");
  }

  return prisma.knowledgeRegion.create({ data: { level, name, normalizedName, parentId: input.parentId } });
}

export async function listKnowledgeRegions(level?: string) {
  return prisma.knowledgeRegion.findMany({
    where: level ? { level: level.trim() } : undefined,
    orderBy: [{ level: "asc" }, { normalizedName: "asc" }],
  });
}
