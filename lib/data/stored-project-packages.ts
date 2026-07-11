import { prisma } from "@/lib/db/prisma";

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

// ─── Shared select for all queries ──────────────────────────────────────────

const PACKAGE_SELECT = {
  id: true,
  companyId: true,
  userId: true,
  sourceProjectId: true,
  projectName: true,
  projectType: true,
  description: true,
  createdAt: true,
} as const;

function toStoredPackage(
  record: {
    id: string;
    companyId: string;
    userId: string;
    sourceProjectId: string | null;
    projectName: string;
    projectType: string;
    description: string;
    createdAt: Date;
  },
): StoredProjectPackage {
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

// ─── Public API ─────────────────────────────────────────────────────────────

export async function findExistingPackage(
  companyId: string,
  projectName: string,
): Promise<{ id: string; projectName: string; projectType: string; createdAt: string } | null> {
  const existing = await prisma.storedProjectPackage.findFirst({
    where: { companyId, projectName },
    select: { id: true, projectName: true, projectType: true, createdAt: true },
  });

  if (!existing) return null;

  return {
    id: existing.id,
    projectName: existing.projectName,
    projectType: existing.projectType,
    createdAt: existing.createdAt.toISOString(),
  };
}

/**
 * Stores or updates a .mcp package in the database.
 * Deduplicates by (companyId, projectName): if a package with the same name
 * already exists in the same company, it updates the content instead of
 * creating a duplicate.
 */
export async function storeProjectPackage(
  input: {
    projectName: string;
    projectType: string;
    description: string;
    content: Buffer;
    companyId: string;
    userId: string;
  },
): Promise<StoredProjectPackage & { updated: boolean }> {
  const existing = await findExistingPackage(input.companyId, input.projectName);

  if (existing) {
    const record = await prisma.storedProjectPackage.update({
      where: { id: existing.id },
      data: {
        projectType: input.projectType,
        description: input.description,
        mcpContent: input.content.toString("base64"),
        userId: input.userId,
      },
      select: PACKAGE_SELECT,
    });

    return { ...toStoredPackage(record), updated: true };
  }

  const record = await prisma.storedProjectPackage.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      projectName: input.projectName,
      projectType: input.projectType,
      description: input.description,
      mcpContent: input.content.toString("base64"),
    },
    select: PACKAGE_SELECT,
  });

  return { ...toStoredPackage(record), updated: false };
}

export async function storeProjectPackageFromExport(
  projectId: string,
  userId: string,
  projectName: string,
  projectType: string,
  companyId: string,
  content: Buffer,
): Promise<StoredProjectPackage & { updated: boolean }> {
  const existing = await findExistingPackage(companyId, projectName);

  if (existing) {
    const record = await prisma.storedProjectPackage.update({
      where: { id: existing.id },
      data: {
        sourceProjectId: projectId,
        projectType,
        description: `Proyecto exportado: ${projectName} (${projectType || "Sin tipo"})`,
        mcpContent: content.toString("base64"),
        userId,
      },
      select: PACKAGE_SELECT,
    });

    return { ...toStoredPackage(record), updated: true };
  }

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
    select: PACKAGE_SELECT,
  });

  return { ...toStoredPackage(record), updated: false };
}

/**
 * Returns the most recently stored packages that belong to companies
 * where the given user is an active member.
 * Filtering and scoring are done by the caller (project-similarity.ts)
 * using the same weighted formula applied to internal projects.
 * The `_query` parameter is kept for caller compatibility.
 */
export async function searchStoredPackages(
  _query: string,
  userId: string,
  limit = 10,
): Promise<StoredProjectPackage[]> {
  const records = await prisma.storedProjectPackage.findMany({
    where: {
      company: {
        memberships: {
          some: { userId, status: "ACTIVE" },
        },
      },
    },
    select: PACKAGE_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return records.map(toStoredPackage);
}

export async function getStoredPackageById(
  id: string,
  userId: string,
): Promise<StoredProjectPackage | null> {
  // Use findFirst with compound where for multi-tenant isolation.
  // findUnique only accepts the unique field(s), so we can't add a tenant filter.
  const record = await prisma.storedProjectPackage.findFirst({
    where: {
      id,
      company: {
        memberships: {
          some: { userId, status: "ACTIVE" },
        },
      },
    },
    select: PACKAGE_SELECT,
  });

  if (!record) return null;

  return toStoredPackage(record);
}

export async function deleteStoredPackage(
  id: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.storedProjectPackage.deleteMany({
    where: {
      id,
      company: {
        memberships: {
          some: { userId, status: "ACTIVE" },
        },
      },
    },
  });
  return result.count > 0;
}

export async function getStoredPackageContent(
  packageId: string,
  userId: string,
): Promise<Buffer> {
  const record = await prisma.storedProjectPackage.findFirst({
    where: {
      id: packageId,
      company: {
        memberships: {
          some: { userId, status: "ACTIVE" },
        },
      },
    },
    select: { mcpContent: true },
  });

  if (!record) {
    throw new Error(`Paquete "${packageId}" no encontrado o no tienes acceso.`);
  }

  return Buffer.from(record.mcpContent, "base64");
}

export async function listStoredPackages(
  userId: string,
  companyId?: string,
): Promise<StoredProjectPackage[]> {
  const records = await prisma.storedProjectPackage.findMany({
    where: {
      company: {
        memberships: {
          some: { userId, status: "ACTIVE" },
        },
        ...(companyId ? { id: companyId } : {}),
      },
    },
    select: PACKAGE_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return records.map(toStoredPackage);
}
