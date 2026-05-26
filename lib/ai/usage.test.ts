import { describe, expect, it, vi } from "vitest";

import {
  AiTokenLimitExceededError,
  assertCanUseAi,
  calculateAiTokenAllowance,
  recordAiAdjustment,
  recordAiUsage,
} from "@/lib/ai/usage";

describe("AI token usage", () => {
  it("adds the membership monthly limit and user extra tokens into the allowance", () => {
    expect(calculateAiTokenAllowance({ monthlyTokenLimit: 1_000, extraTokens: 250 })).toBe(1_250);
  });

  it("blocks a request when the estimated tokens exceed the available monthly allowance", async () => {
    const prisma = createUsagePrismaMock({
      monthlyTokenLimit: 1_000,
      extraTokens: 100,
      consumedTokens: 900,
      reservedTokens: 50,
    });

    await expect(
      assertCanUseAi({
        userId: "user-1",
        estimatedTokens: 200,
        prisma,
      }),
    ).rejects.toBeInstanceOf(AiTokenLimitExceededError);
  });

  it("records actual AI usage in the monthly period and ledger", async () => {
    const prisma = createUsagePrismaMock({
      monthlyTokenLimit: 1_000,
      extraTokens: 0,
      consumedTokens: 100,
      reservedTokens: 0,
    });

    await recordAiUsage({
      userId: "user-1",
      action: "chat",
      provider: "cloud",
      model: "abstract-model",
      estimatedTokens: 120,
      actualTokens: 96,
      prisma,
    });

    expect(prisma.aiTokenLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        action: "chat",
        provider: "cloud",
        model: "abstract-model",
        estimatedTokens: 120,
        actualTokens: 96,
        tokens: 96,
        type: "CONSUME",
      }),
    });
    expect(prisma.aiUsagePeriod.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          consumedTokens: { increment: 96 },
        },
      }),
    );
  });

  it("records positive and negative manual token adjustments", async () => {
    const prisma = createUsagePrismaMock({
      monthlyTokenLimit: 1_000,
      extraTokens: 0,
      consumedTokens: 300,
      reservedTokens: 0,
    });

    await recordAiAdjustment({
      userId: "user-1",
      adminUserId: "admin-1",
      tokens: -50,
      reason: "Correccion manual",
      prisma,
    });

    expect(prisma.aiTokenLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        adminUserId: "admin-1",
        tokens: -50,
        type: "ADJUSTMENT",
        notes: "Correccion manual",
      }),
    });
    expect(prisma.aiUsagePeriod.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          consumedTokens: { increment: -50 },
        },
      }),
    );
  });
});

function createUsagePrismaMock({
  consumedTokens,
  extraTokens,
  monthlyTokenLimit,
  reservedTokens,
}: {
  consumedTokens: number;
  extraTokens: number;
  monthlyTokenLimit: number;
  reservedTokens: number;
}) {
  const client = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "user-1",
        aiTokenExtraMonthly: extraTokens,
        membershipPlan: {
          monthlyTokenLimit,
        },
      }),
    },
    aiUsagePeriod: {
      findUnique: vi.fn().mockResolvedValue({
        consumedTokens,
        reservedTokens,
      }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    aiTokenLedger: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(async (callback: (tx: typeof client) => Promise<unknown>) => callback(client)),
  };

  return client;
}
