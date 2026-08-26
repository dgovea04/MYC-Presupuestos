import { describe, expect, it, vi } from "vitest";
import {
  ScopedAiBudgetExceededError,
  recordScopedAiUsage,
  releaseAiUsage,
  reserveAiUsage,
} from "@/lib/ai/usage-scope";

describe("scoped AI usage", () => {
  it("reserves and records Workspace usage with detailed attribution", async () => {
    const prisma = createScopedUsageMock({ consumedTokens: 100, reservedTokens: 0 });

    await reserveAiUsage({
      userId: "user-1",
      workspaceId: "workspace-1",
      billingScope: "WORKSPACE",
      estimatedTokens: 50,
      allowance: 500,
      provider: "openai",
      model: "gpt-5-mini",
      action: "chat",
      credentialSource: "WORKSPACE",
      credentialId: "credential-1",
      requestId: "request-1",
      prisma,
    });

    expect(prisma.aiWorkspaceUsagePeriod.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId_periodStart: expect.any(Object) },
      update: expect.objectContaining({ reservedTokens: { increment: 50 } }),
    }));
    expect(prisma.aiTokenLedger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        billingScope: "WORKSPACE",
        credentialSource: "WORKSPACE",
        credentialId: "credential-1",
        requestId: "request-1",
        type: "RESERVE",
      }),
    }));

    await recordScopedAiUsage({
      userId: "user-1",
      workspaceId: "workspace-1",
      billingScope: "WORKSPACE",
      estimatedTokens: 50,
      actualTokens: 42,
      provider: "openai",
      model: "gpt-5-mini",
      action: "chat",
      credentialSource: "WORKSPACE",
      credentialId: "credential-1",
      requestId: "request-1",
      prisma,
    });

    expect(prisma.aiWorkspaceUsagePeriod.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reservedTokens: { decrement: 50 } }),
    }));
    expect(prisma.aiWorkspaceUsagePeriod.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ consumedTokens: { increment: 42 } }),
    }));
  });

  it("rejects a reservation over the scoped allowance", async () => {
    const prisma = createScopedUsageMock({ consumedTokens: 490, reservedTokens: 0 });

    await expect(reserveAiUsage({
      userId: "user-1",
      workspaceId: "workspace-1",
      billingScope: "WORKSPACE",
      estimatedTokens: 20,
      allowance: 500,
      provider: "openai",
      model: "gpt-5-mini",
      action: "chat",
      prisma,
    })).rejects.toBeInstanceOf(ScopedAiBudgetExceededError);

    expect(prisma.aiUserWorkspaceUsagePeriod.upsert).not.toHaveBeenCalled();
  });

  it("returns configured alert thresholds when a reservation crosses them", async () => {
    const prisma = createScopedUsageMock({ consumedTokens: 390, reservedTokens: 0 });

    const reservation = await reserveAiUsage({
      userId: "user-1",
      workspaceId: "workspace-1",
      billingScope: "WORKSPACE",
      estimatedTokens: 20,
      allowance: 500,
      alertThresholds: [100, 80, 80, 90],
      provider: "openai",
      model: "gpt-5-mini",
      action: "chat",
      requestId: "request-alert",
      prisma,
    });

    expect(reservation.triggeredAlertThresholds).toEqual([80]);
  });

  it("rejects a reservation that exceeds the configured monetary budget", async () => {
    const prisma = createScopedUsageMock({ consumedTokens: 0, reservedTokens: 0 });

    await expect(reserveAiUsage({
      userId: "user-1",
      workspaceId: "workspace-1",
      billingScope: "WORKSPACE",
      estimatedTokens: 10,
      estimatedCostMinor: 10,
      budgetMinor: 5,
      provider: "openai",
      model: "gpt-5-mini",
      action: "chat",
      prisma,
    })).rejects.toBeInstanceOf(ScopedAiBudgetExceededError);
  });

  it("does not reserve or release twice for the same request", async () => {
    const prisma = createScopedUsageMock({ consumedTokens: 0, reservedTokens: 40 });

    const firstReservation = await reserveAiUsage({
      userId: "user-1",
      workspaceId: "workspace-1",
      billingScope: "WORKSPACE",
      estimatedTokens: 10,
      estimatedCostMinor: 4,
      provider: "openai",
      model: "gpt-5-mini",
      action: "chat",
      requestId: "request-idempotent",
      prisma,
    });
    const secondReservation = await reserveAiUsage({
      userId: "user-1",
      workspaceId: "workspace-1",
      billingScope: "WORKSPACE",
      estimatedTokens: 10,
      estimatedCostMinor: 4,
      provider: "openai",
      model: "gpt-5-mini",
      action: "chat",
      requestId: "request-idempotent",
      prisma,
    });

    expect(secondReservation.estimatedCostMinor).toBe(firstReservation.estimatedCostMinor);
    expect(prisma.aiTokenLedger.create).toHaveBeenCalledTimes(1);

    await releaseAiUsage({
      userId: "user-1",
      workspaceId: "workspace-1",
      billingScope: "WORKSPACE",
      estimatedTokens: 10,
      estimatedCostMinor: firstReservation.estimatedCostMinor,
      provider: "openai",
      model: "gpt-5-mini",
      action: "chat",
      requestId: "request-idempotent",
      prisma,
    });
    await releaseAiUsage({
      userId: "user-1",
      workspaceId: "workspace-1",
      billingScope: "WORKSPACE",
      estimatedTokens: 10,
      estimatedCostMinor: firstReservation.estimatedCostMinor,
      provider: "openai",
      model: "gpt-5-mini",
      action: "chat",
      requestId: "request-idempotent",
      prisma,
    });

    expect(prisma.aiTokenLedger.create).toHaveBeenCalledTimes(2);
  });

  it("releases reserved Workspace usage and appends a compensating event", async () => {
    const prisma = createScopedUsageMock({ consumedTokens: 0, reservedTokens: 40 });

    await releaseAiUsage({
      userId: "user-1",
      workspaceId: "workspace-1",
      billingScope: "WORKSPACE",
      estimatedTokens: 40,
      provider: "openai",
      model: "gpt-5-mini",
      action: "chat",
      requestId: "request-2",
      prisma,
    });

    expect(prisma.aiWorkspaceUsagePeriod.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reservedTokens: { decrement: 40 } }),
    }));
    expect(prisma.aiTokenLedger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "RELEASE", tokens: -40, requestId: "request-2" }),
    }));
  });
});

function createScopedUsageMock({ consumedTokens, reservedTokens }: { consumedTokens: number; reservedTokens: number }) {
  const period = {
    consumedTokens,
    reservedTokens,
    reservedCostMinor: 0,
    actualCostMinor: 0,
  };
  const ledger = new Map<string, {
    type: "RESERVE" | "CONSUME" | "RELEASE";
    tokens: number;
    estimatedTokens?: number | null;
    actualTokens?: number | null;
    estimatedCostMinor?: number | null;
    actualCostMinor?: number | null;
    periodStart: Date;
  }>();

  const readPeriod = vi.fn().mockImplementation(async () => ({ ...period }));
  const upsert = vi.fn().mockImplementation(async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
    const update = args.update;
    const increment = (key: string) => {
      const value = update[key];
      return typeof value === "object" && value !== null && "increment" in value
        ? Number((value as { increment: number }).increment)
        : 0;
    };
    period.consumedTokens += increment("consumedTokens");
    period.reservedTokens += increment("reservedTokens");
    period.reservedCostMinor = (period.reservedCostMinor ?? 0) + increment("reservedCostMinor");
    period.actualCostMinor = (period.actualCostMinor ?? 0) + increment("actualCostMinor");
    return {};
  });
  const updateMany = vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
    const decrement = (key: string) => {
      const value = args.data[key];
      return typeof value === "object" && value !== null && "decrement" in value
        ? Number((value as { decrement: number }).decrement)
        : 0;
    };
    period.reservedTokens -= decrement("reservedTokens");
    period.reservedCostMinor = (period.reservedCostMinor ?? 0) - decrement("reservedCostMinor");
    return { count: 1 };
  });
  const periodDelegate = { findUnique: readPeriod, upsert, updateMany };

  const client = {
    aiUsagePeriod: periodDelegate,
    aiWorkspaceUsagePeriod: periodDelegate,
    aiUserWorkspaceUsagePeriod: periodDelegate,
    aiTokenLedger: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { idempotencyKey: string } }) => ledger.get(where.idempotencyKey) ?? null),
      create: vi.fn().mockImplementation(async ({ data }: { data: { idempotencyKey: string; type: "RESERVE" | "CONSUME" | "RELEASE"; tokens: number; estimatedTokens?: number | null; actualTokens?: number | null; estimatedCostMinor?: number | null; actualCostMinor?: number | null; periodStart: Date } }) => {
        ledger.set(data.idempotencyKey, data);
        return data;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: typeof client) => Promise<unknown>) => callback(client)),
  };
  return client;
}
