import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type ProjectAiMemoryType = "FACT" | "PREFERENCE" | "CONSTRAINT" | "ASSUMPTION";

export type ProjectAiMemoryFact = {
  id: string;
  projectId: string;
  memoryType: ProjectAiMemoryType;
  fact: string;
  confidence: string;
  source: string;
  timestamp: string;
};

export type GetProjectAiMemoryInput = {
  projectId: string;
  userId: string;
  limit?: number;
};

export type RecordProjectAiMemoryInput = {
  projectId: string;
  userId: string;
  memoryType: ProjectAiMemoryType;
  fact: string;
  confidence?: string;
  source: string;
};

type ProjectMemoryRecord = {
  id: string;
  projectId: string;
  memoryType: string;
  fact: string;
  confidence: Prisma.Decimal;
  source: string;
  createdAt: Date;
};

const DEFAULT_MEMORY_LIMIT = 12;
const MAX_MEMORY_LIMIT = 30;
const MAX_FACT_LENGTH = 500;

export async function getProjectAiMemory({
  projectId,
  userId,
  limit = DEFAULT_MEMORY_LIMIT,
}: GetProjectAiMemoryInput): Promise<ProjectAiMemoryFact[]> {
  const project = await findOwnedProject(projectId, userId);

  if (!project) {
    return [];
  }

  const entries = await prisma.aiProjectMemory.findMany({
    where: {
      projectId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: clampMemoryLimit(limit),
  });

  return entries.map(mapMemoryRecord);
}

export async function recordProjectAiMemory({
  confidence = "0.800",
  fact,
  memoryType,
  projectId,
  source,
  userId,
}: RecordProjectAiMemoryInput): Promise<ProjectAiMemoryFact | null> {
  const project = await findOwnedProject(projectId, userId);

  if (!project) {
    return null;
  }

  const entry = await prisma.aiProjectMemory.create({
    data: {
      projectId,
      memoryType,
      fact: normalizeFact(fact),
      confidence: normalizeConfidence(confidence),
      source: normalizeSource(source),
    },
  });

  return mapMemoryRecord(entry);
}

function findOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        userId,
      },
    },
    select: {
      id: true,
    },
  });
}

function mapMemoryRecord(entry: ProjectMemoryRecord): ProjectAiMemoryFact {
  return {
    id: entry.id,
    projectId: entry.projectId,
    memoryType: readMemoryType(entry.memoryType),
    fact: entry.fact,
    confidence: entry.confidence.toFixed(3),
    source: entry.source,
    timestamp: entry.createdAt.toISOString(),
  };
}

function readMemoryType(value: string): ProjectAiMemoryType {
  if (value === "PREFERENCE" || value === "CONSTRAINT" || value === "ASSUMPTION") {
    return value;
  }

  return "FACT";
}

function clampMemoryLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_MEMORY_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_MEMORY_LIMIT);
}

function normalizeFact(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_FACT_LENGTH);
}

function normalizeSource(value: string) {
  const normalized = value.trim().replace(/\s+/g, "_").slice(0, 80);
  return normalized.length > 0 ? normalized : "unknown";
}

function normalizeConfidence(value: string) {
  const decimal = new Prisma.Decimal(value);
  if (decimal.lessThan(0)) {
    return new Prisma.Decimal("0.000");
  }

  if (decimal.greaterThan(1)) {
    return new Prisma.Decimal("1.000");
  }

  return new Prisma.Decimal(decimal.toFixed(3));
}
