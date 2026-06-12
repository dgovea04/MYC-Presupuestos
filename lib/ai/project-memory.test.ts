import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findFirst: vi.fn(),
    },
    aiProjectMemory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

import { getProjectAiMemory, recordProjectAiMemory } from "@/lib/ai/context/project-memory";

describe("Khipu project memory data service", () => {
  beforeEach(() => {
    prismaMock.project.findFirst.mockReset();
    prismaMock.aiProjectMemory.create.mockReset();
    prismaMock.aiProjectMemory.findMany.mockReset();
  });

  it("lists project memory only after verifying project ownership", async () => {
    const createdAt = new Date("2026-06-11T12:30:00.000Z");
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
    prismaMock.aiProjectMemory.findMany.mockResolvedValue([
      createMemoryRecord({
        id: "memory-1",
        projectId: "project-1",
        createdAt,
        fact: "Proyecto utiliza excavadora CAT 320",
      }),
    ]);

    const memory = await getProjectAiMemory({ projectId: "project-1", userId: "user-1", limit: 6 });

    expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
      where: {
        id: "project-1",
        company: {
          userId: "user-1",
        },
      },
      select: {
        id: true,
      },
    });
    expect(prismaMock.aiProjectMemory.findMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
    });
    expect(memory).toEqual([
      {
        id: "memory-1",
        projectId: "project-1",
        memoryType: "FACT",
        fact: "Proyecto utiliza excavadora CAT 320",
        confidence: "0.850",
        source: "user",
        timestamp: "2026-06-11T12:30:00.000Z",
      },
    ]);
  });

  it("returns an empty list for inaccessible projects", async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);

    await expect(getProjectAiMemory({ projectId: "project-2", userId: "user-1" })).resolves.toEqual([]);
    expect(prismaMock.aiProjectMemory.findMany).not.toHaveBeenCalled();
  });

  it("records normalized facts with 3-decimal confidence and trimmed text", async () => {
    const createdAt = new Date("2026-06-11T13:00:00.000Z");
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
    prismaMock.aiProjectMemory.create.mockResolvedValue(
      createMemoryRecord({
        id: "memory-created",
        projectId: "project-1",
        createdAt,
        fact: "x".repeat(500),
        confidence: "0.735",
        memoryType: "CONSTRAINT",
        source: "ai_inference",
      }),
    );

    const result = await recordProjectAiMemory({
      projectId: "project-1",
      userId: "user-1",
      memoryType: "CONSTRAINT",
      fact: ` ${"x".repeat(540)} `,
      confidence: "0.7346",
      source: "ai_inference",
    });

    expect(prismaMock.aiProjectMemory.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        memoryType: "CONSTRAINT",
        fact: "x".repeat(500),
        confidence: new Prisma.Decimal("0.735"),
        source: "ai_inference",
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: "memory-created",
        confidence: "0.735",
        fact: "x".repeat(500),
      }),
    );
  });

  it("does not record memory for inaccessible projects", async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);

    await expect(
      recordProjectAiMemory({
        projectId: "project-2",
        userId: "user-1",
        memoryType: "FACT",
        fact: "Proyecto usa concreto premezclado",
        source: "user",
      }),
    ).resolves.toBeNull();
    expect(prismaMock.aiProjectMemory.create).not.toHaveBeenCalled();
  });
});

function createMemoryRecord({
  confidence = "0.850",
  createdAt,
  fact,
  id,
  memoryType = "FACT",
  projectId,
  source = "user",
}: {
  confidence?: string;
  createdAt: Date;
  fact: string;
  id: string;
  memoryType?: "FACT" | "PREFERENCE" | "CONSTRAINT" | "ASSUMPTION";
  projectId: string;
  source?: string;
}) {
  return {
    id,
    projectId,
    memoryType,
    fact,
    confidence: new Prisma.Decimal(confidence),
    source,
    createdAt,
    updatedAt: createdAt,
  };
}
