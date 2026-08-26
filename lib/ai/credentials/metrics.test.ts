import { getAiUsageReport } from "@/lib/ai/credentials/metrics";
import { prisma } from "@/lib/db/prisma";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    aiTokenLedger: {
      aggregate: vi.fn().mockResolvedValue({ _count: { _all: 3 }, _sum: { tokens: 1200, actualCostMinor: 45, estimatedCostMinor: 50 } }),
      groupBy: vi.fn()
        .mockResolvedValueOnce([{ workspaceId: "workspace-1", _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30 } }])
        .mockResolvedValueOnce([{ provider: "OPENAI", model: "gpt-5-mini", _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30 } }])
        .mockResolvedValueOnce([{ credentialSource: "WORKSPACE", billingScope: "WORKSPACE", _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30 } }])
        .mockResolvedValueOnce([{ action: "chat", _count: { _all: 2 }, _sum: { tokens: 900, actualCostMinor: 30 } }])
        .mockResolvedValueOnce([{ failureCode: "TIMEOUT", fallbackUsed: true, _count: { _all: 1 } }]),
    },
  },
}));

const mockedPrisma = vi.mocked(prisma);

describe("AI usage metrics", () => {
  it("aggregates attribution and cost without exposing content", async () => {
    const result = await getAiUsageReport({ workspaceId: "workspace-1" });
    expect(result.summary).toEqual({ requests: 3, tokens: 1200, actualCostMinor: 45, estimatedCostMinor: 50 });
    expect(result.bySource[0]).toMatchObject({ credentialSource: "WORKSPACE", billingScope: "WORKSPACE" });
    expect(result.failures).toEqual([{ failureCode: "TIMEOUT", fallbackUsed: true, requests: 1 }]);
    expect(mockedPrisma.aiTokenLedger.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: "workspace-1" }) }));
  });
});
