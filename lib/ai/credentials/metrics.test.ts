import { getAiUsageReport } from "@/lib/ai/credentials/metrics";
import { prisma } from "@/lib/db/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    aiTokenLedger: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

const mockedPrisma = vi.mocked(prisma);

function mockGroupByChain() {
  mockedPrisma.aiTokenLedger.groupBy
    .mockReset()
    .mockResolvedValueOnce([{ workspaceId: "workspace-1", _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30 } }])
    .mockResolvedValueOnce([{ provider: "OPENAI", model: "gpt-5-mini", _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30 } }])
    .mockResolvedValueOnce([{ credentialSource: "WORKSPACE", billingScope: "WORKSPACE", _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30 } }])
    .mockResolvedValueOnce([{ action: "chat", _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30 } }])
    .mockResolvedValueOnce([{ requestId: "req-1", _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30 } }])
    .mockResolvedValueOnce([{ credentialId: "cred-1", _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30 } }])
    .mockResolvedValueOnce([{ userId: "user-1", _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30 } }])
    .mockResolvedValueOnce([{ failureCode: "TIMEOUT", fallbackUsed: true, _count: { _all: 1 } }]);
}

describe("AI usage metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates attribution and cost without exposing content", async () => {
    mockGroupByChain();
    mockedPrisma.aiTokenLedger.aggregate.mockResolvedValue({ _count: { _all: 3 }, _sum: { tokens: 1200, actualCostMinor: 45, estimatedCostMinor: 50 } });
    mockedPrisma.user.findMany.mockResolvedValue([]);

    const result = await getAiUsageReport({ workspaceId: "workspace-1" });
    expect(result.summary).toEqual({ requests: 3, tokens: 1200, actualCostMinor: 45, estimatedCostMinor: 50 });
    expect(result.bySource[0]).toMatchObject({ credentialSource: "WORKSPACE", billingScope: "WORKSPACE" });
    expect(result.failures).toEqual([{ failureCode: "TIMEOUT", fallbackUsed: true, requests: 1 }]);
    expect(mockedPrisma.aiTokenLedger.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: "workspace-1" }) }));
  });

  it("resolves user names for the per-user breakdown", async () => {
    mockGroupByChain();
    mockedPrisma.aiTokenLedger.aggregate.mockResolvedValue({ _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30, estimatedCostMinor: 30 } });
    mockedPrisma.user.findMany.mockResolvedValue([{ id: "user-1", name: "Ana", email: "ana@example.com" }]);

    const result = await getAiUsageReport();
    expect(result.byUser).toEqual([
      { userId: "user-1", name: "Ana", email: "ana@example.com", requests: 2, tokens: 900, actualCostMinor: 30 },
    ]);
    expect(mockedPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["user-1"] } } }),
    );
  });
});
