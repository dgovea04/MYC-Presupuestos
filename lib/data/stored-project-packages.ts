import { prisma } from "@/lib/db/prisma";
import { normalizePartidaText, uniqueTokens, jaccardSimilarity } from "@/lib/partida-generation/text";

// ─── Types ──────────────────────────────────────────────────────────────────

export type StoredProjectPackage = {
  id: string;
  projectName: string;
  projectType: string;
  description: string;
  createdAt: string;
  companyId: string;
  userId: string;
  sourceProjectId: string | null;
};

export type StoredPackageSearchResult = StoredProjectPackage & {
  score: number;
  matchedKeywords: string[];
};

// ─── Public API ─────────────────────────────────────────────────────────────

export async function storeProjectPackage(
  input: {
    projectName: string;
    projectType: string;
    description: string;
    content: Buffer;
    companyId: string;
    userId: string;
  },
): Promise<StoredProjectPackage> {
  const record = await prisma.storedProjectPackage.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      projectName: input.projectName,
      projectType: input.projectType,
      description: input.description,
      mcpContent: input.content.toString("base64"),
    },
    select: {
      id: true,
      companyId: true,
      userId: true,
      sourceProjectId: true,
      projectName: true,
      projectType: true,
      description: true,
      createdAt: true,
    },
  });

  return {
    id: record.id,
    projectName: record.projectName,
    projectType: record.projectType,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    companyId: record.companyId,
    userId: record.userId,
    sourceProjectId: record.sourceProjectId,
  };
}

export async function storeProjectPackageFromExport(
  projectId: string,
  userId: string,
  projectName: string,
  projectType: string,
  companyId: string,
  content: Buffer,
): Promise<StoredProjectPackage> {
  const record = await prisma.storedProjectPackage.create({
    data: {
      companyId,
      userId,
      sourceProjectId: projectId,
      projectName,
      projectType,
      description: `Proyecto exportado: ${projectName} (${projectType || "Sin tipo"})`,
      mcpContent: content.toString("base64"),
    },
    select: {
      id: true,
      companyId: true,
      userId: true,
      sourceProjectId: true,
      projectName: true,
      projectType: true,
      description: true,
      createdAt: true,
    },
  });

  return {
    id: record.id,
    projectName: record.projectName,
    projectType: record.projectType,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    companyId: record.companyId,
    userId: record.userId,
    sourceProjectId: record.sourceProjectId,
  };
}

export async function searchStoredPackages(
  query: string,
  limit = 10,
): Promise<StoredPackageSearchResult[]> {
  // Fetch all packages (scoring is done in-memory via Jaccard)
  // Take a generous batch; per-company package counts are expected to be low
  const packages = await prisma.storedProjectPackage.findMany({
    select: {
      id: true,
      companyId: true,
      userId: true,
      sourceProjectId: true,
      projectName: true,
      projectType: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (packages.length === 0) return [];

  const normalizedQuery = normalizePartidaText(query);
  const queryTokens = uniqueTokens(query);

  const scored = packages.map((pkg) => {
    const pkgText = [pkg.projectName, pkg.projectType, pkg.description]
      .filter(Boolean)
      .join(" ");
    const pkgTokens = uniqueTokens(pkgText);
    const score = jaccardSimilarity(queryTokens, pkgTokens);

    // Boost for exact name match
    const nameBoost =
      normalizePartidaText(pkg.projectName) === normalizedQuery ? 0.3 : 0;

    const matchedKeywords = queryTokens.filter((token) =>
      pkgTokens.includes(token),
    );

    return {
      id: pkg.id,
      projectName: pkg.projectName,
      projectType: pkg.projectType,
      description: pkg.description,
      createdAt: pkg.createdAt.toISOString(),
      companyId: pkg.companyId,
      userId: pkg.userId,
      sourceProjectId: pkg.sourceProjectId,
      score: Math.min(1, score + nameBoost),
      matchedKeywords,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function getStoredPackageById(
  id: string,
): Promise<StoredProjectPackage | null> {
  const record = await prisma.storedProjectPackage.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      userId: true,
      sourceProjectId: true,
      projectName: true,
      projectType: true,
      description: true,
      createdAt: true,
    },
  });

  if (!record) return null;

  return {
    id: record.id,
    projectName: record.projectName,
    projectType: record.projectType,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    companyId: record.companyId,
    userId: record.userId,
    sourceProjectId: record.sourceProjectId,
  };
}

export async function deleteStoredPackage(id: string): Promise<boolean> {
  // deleteMany doesn't throw on not-found, avoiding try/catch for missing records
  const result = await prisma.storedProjectPackage.deleteMany({ where: { id } });
  return result.count > 0;
}

export async function listStoredPackages(
  companyId?: string,
): Promise<StoredProjectPackage[]> {
  const records = await prisma.storedProjectPackage.findMany({
    where: companyId ? { companyId } : undefined,
    select: {
      id: true,
      companyId: true,
      userId: true,
      sourceProjectId: true,
      projectName: true,
      projectType: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return records.map((r) => ({
    id: r.id,
    projectName: r.projectName,
    projectType: r.projectType,
    description: r.description,
    createdAt: r.createdAt.toISOString(),
    companyId: r.companyId,
    userId: r.userId,
    sourceProjectId: r.sourceProjectId,
  }));
}
