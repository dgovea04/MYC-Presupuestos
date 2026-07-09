import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findFirst: vi.fn(),
    },
    aiProjectHistoryEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

import { getAiProjectHistory, recordAiProjectHistory } from "@/lib/ai/project-history";

describe("Khipu project history data service", () => {
  beforeEach(() => {
    prismaMock.project.findFirst.mockReset();
    prismaMock.aiProjectHistoryEntry.create.mockReset();
    prismaMock.aiProjectHistoryEntry.findMany.mockReset();
  });

  it("lists recent history only after verifying project ownership", async () => {
    const createdAt = new Date("2026-06-09T15:30:00.000Z");
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
    prismaMock.aiProjectHistoryEntry.findMany.mockResolvedValue([
      createDbEntry({ id: "history-1", projectId: "project-1", userId: "user-1", createdAt }),
    ]);

    const entries = await getAiProjectHistory("project-1", "user-1", 5);

    expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
      where: {
        id: "project-1",
        company: {
          memberships: {
            some: {
              userId: "user-1",
              status: "ACTIVE",
            },
          },
        },
      },
      select: {
        id: true,
      },
    });
    expect(prismaMock.aiProjectHistoryEntry.findMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        userId: "user-1",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });
    expect(entries).toEqual([
      expect.objectContaining({
        id: "history-1",
        projectId: "project-1",
        timestamp: "2026-06-09T15:30:00.000Z",
        result: expect.objectContaining({
          answer: "Respuesta tecnica",
          model: "llama3.1",
        }),
      }),
    ]);
  });

  it("returns an empty list for an inaccessible project", async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);

    await expect(getAiProjectHistory("project-2", "user-1")).resolves.toEqual([]);
    expect(prismaMock.aiProjectHistoryEntry.findMany).not.toHaveBeenCalled();
  });

  it("caps requested history limits between 1 and 20", async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
    prismaMock.aiProjectHistoryEntry.findMany.mockResolvedValue([]);

    await getAiProjectHistory("project-1", "user-1", 100);
    expect(prismaMock.aiProjectHistoryEntry.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 20 }));

    await getAiProjectHistory("project-1", "user-1", 0);
    expect(prismaMock.aiProjectHistoryEntry.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 1 }));
  });

  it("records a successful Khipu execution with context and result metadata", async () => {
    const createdAt = new Date("2026-06-09T15:40:00.000Z");
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
    prismaMock.aiProjectHistoryEntry.create.mockResolvedValue(
      createDbEntry({
        id: "history-created",
        projectId: "project-1",
        userId: "user-1",
        createdAt,
        action: "review",
        summary: "Revision de presupuesto",
        provider: "openai",
        task: "review_budget",
        promptHash: "prompt-hash-1",
        responseHash: "response-hash-1",
      }),
    );

    const entry = await recordAiProjectHistory({
      projectId: "project-1",
      userId: "user-1",
      action: "review",
      summary: "Revision de presupuesto",
      context: { project: "Hospital Norte", module: "Presupuesto" },
      result: {
        answer: "Respuesta tecnica",
        model: "llama3.1",
        requestedModel: "llama3.1",
        fallbackUsed: false,
        warnings: ["Validar precios"],
        latencyMs: 450,
        provider: "openai",
        task: "review_budget",
        promptHash: "prompt-hash-1",
        responseHash: "response-hash-1",
        structuredData: {
          answer: "Respuesta tecnica",
          findings: [],
          assumptions: [],
        },
      },
    });

    expect(prismaMock.aiProjectHistoryEntry.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        userId: "user-1",
        action: "review",
        summary: "Revision de presupuesto",
        context: { project: "Hospital Norte", module: "Presupuesto" },
        answer: "Respuesta tecnica",
        structuredData: {
          answer: "Respuesta tecnica",
          findings: [],
          assumptions: [],
        },
        model: "llama3.1",
        requestedModel: "llama3.1",
        fallbackUsed: false,
        warnings: ["Validar precios"],
        latencyMs: 450,
        provider: "openai",
        task: "review_budget",
        promptHash: "prompt-hash-1",
        responseHash: "response-hash-1",
      },
    });
    expect(entry).toEqual(
      expect.objectContaining({
        id: "history-created",
        action: "review",
        provider: "openai",
        task: "review_budget",
        promptHash: "prompt-hash-1",
        responseHash: "response-hash-1",
      }),
    );
  });

  it("does not record history for an inaccessible project", async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);

    await expect(
      recordAiProjectHistory({
        projectId: "project-2",
        userId: "user-1",
        action: "chat",
        summary: "Consulta tecnica",
        result: {
          answer: "Respuesta tecnica",
          model: "llama3.1",
          requestedModel: "llama3.1",
          fallbackUsed: false,
          warnings: [],
        },
      }),
    ).resolves.toBeNull();
    expect(prismaMock.aiProjectHistoryEntry.create).not.toHaveBeenCalled();
  });

  it("normalizes stored metadata when mapping history entries", async () => {
    const createdAt = new Date("2026-06-09T15:45:00.000Z");
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
    prismaMock.aiProjectHistoryEntry.findMany.mockResolvedValue([
      {
        ...createDbEntry({
          id: "history-1",
          projectId: "project-1",
          userId: "user-1",
          createdAt,
          action: "legacy",
        }),
        context: { project: "Hospital Norte", ignored: true, currentCost: 125.4 },
        structuredData: { answer: "Respuesta estructurada" },
        latencyMs: null,
      },
    ]);

    await expect(getAiProjectHistory("project-1", "user-1")).resolves.toEqual([
      {
        id: "history-1",
        projectId: "project-1",
        userId: "user-1",
        action: "chat",
        summary: "Consulta tecnica",
        context: { project: "Hospital Norte", currentCost: 125.4 },
        result: {
          answer: "Respuesta tecnica",
          model: "llama3.1",
          requestedModel: "llama3.1",
          fallbackUsed: false,
          warnings: [],
          structuredData: { answer: "Respuesta estructurada" },
        },
        provider: undefined,
        task: undefined,
        promptHash: undefined,
        responseHash: undefined,
        timestamp: "2026-06-09T15:45:00.000Z",
      },
    ]);
  });

  it("truncates summaries and stores JsonNull when structured data is absent", async () => {
    const createdAt = new Date("2026-06-09T15:50:00.000Z");
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
    prismaMock.aiProjectHistoryEntry.create.mockResolvedValue(
      createDbEntry({ id: "history-created", projectId: "project-1", userId: "user-1", createdAt }),
    );
    const longSummary = "x".repeat(260);

    await recordAiProjectHistory({
      projectId: "project-1",
      userId: "user-1",
      action: "chat",
      summary: longSummary,
      result: {
        answer: "Respuesta tecnica",
        model: "llama3.1",
        requestedModel: "llama3.1",
        fallbackUsed: false,
        warnings: [],
      },
    });

    expect(prismaMock.aiProjectHistoryEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        summary: "x".repeat(240),
        structuredData: Prisma.JsonNull,
      }),
    });
  });
});

function createDbEntry({
  action = "chat",
  createdAt,
  id,
  projectId,
  summary = "Consulta tecnica",
  userId,
  provider = null,
  task = null,
  promptHash = null,
  responseHash = null,
}: {
  action?: string;
  createdAt: Date;
  id: string;
  projectId: string;
  summary?: string;
  userId: string;
  provider?: string | null;
  task?: string | null;
  promptHash?: string | null;
  responseHash?: string | null;
}) {
  return {
    id,
    projectId,
    userId,
    action,
    summary,
    context: { project: "Hospital Norte" },
    answer: "Respuesta tecnica",
    structuredData: null,
    model: "llama3.1",
    requestedModel: "llama3.1",
    fallbackUsed: false,
    warnings: [],
    latencyMs: 350,
    provider,
    task,
    promptHash,
    responseHash,
    createdAt,
  };
}
