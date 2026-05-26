import { prisma as defaultPrisma } from "@/lib/db/prisma";
import type { AiAction } from "@/lib/ai/types";

export type AiUsagePeriodInput = {
  month?: number;
  year?: number;
};

type MembershipPlanForAllowance = {
  monthlyTokenLimit: number;
};

type UserForAllowance = {
  id: string;
  aiTokenExtraMonthly: number;
  membershipPlan: MembershipPlanForAllowance | null;
};

type UsagePeriodRecord = {
  consumedTokens: number;
  reservedTokens: number;
};

type AiUsagePrismaClient = {
  user: {
    findUnique: (args: {
      where: { id: string };
      select: {
        id: true;
        aiTokenExtraMonthly: true;
        membershipPlan: {
          select: {
            monthlyTokenLimit: true;
          };
        };
      };
    }) => Promise<UserForAllowance | null>;
  };
  aiUsagePeriod: {
    findUnique: (args: {
      where: {
        userId_periodStart: {
          userId: string;
          periodStart: Date;
        };
      };
      select: {
        consumedTokens: true;
        reservedTokens: true;
      };
    }) => Promise<UsagePeriodRecord | null>;
    upsert: (args: {
      where: {
        userId_periodStart: {
          userId: string;
          periodStart: Date;
        };
      };
      create: {
        userId: string;
        periodStart: Date;
        consumedTokens: number;
        reservedTokens?: number;
      };
      update: {
        consumedTokens?: { increment: number };
        reservedTokens?: { increment: number };
      };
    }) => Promise<unknown>;
  };
  aiTokenLedger: {
    create: (args: {
      data: {
        userId: string;
        adminUserId?: string | null;
        periodStart: Date;
        type: "RESERVE" | "CONSUME" | "RELEASE" | "ADJUSTMENT";
        tokens: number;
        estimatedTokens?: number | null;
        actualTokens?: number | null;
        provider: string;
        model: string;
        action: string;
        notes?: string | null;
      };
    }) => Promise<unknown>;
  };
  $transaction: <T>(callback: (tx: AiUsagePrismaClient) => Promise<T>) => Promise<T>;
};

export class AiTokenLimitExceededError extends Error {
  constructor(
    readonly allowance: number,
    readonly usedTokens: number,
    readonly requestedTokens: number,
  ) {
    super("El usuario no tiene tokens IA suficientes para completar la solicitud.");
    this.name = "AiTokenLimitExceededError";
  }
}

export function calculateAiTokenAllowance({
  extraTokens,
  monthlyTokenLimit,
}: {
  extraTokens: number;
  monthlyTokenLimit: number;
}) {
  return Math.max(0, monthlyTokenLimit + extraTokens);
}

export function getCurrentAiUsagePeriod(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

export async function getUserAiAllowance({
  periodStart = getCurrentAiUsagePeriod(),
  prisma = defaultPrisma as unknown as AiUsagePrismaClient,
  userId,
}: {
  periodStart?: Date;
  prisma?: AiUsagePrismaClient;
  userId: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      aiTokenExtraMonthly: true,
      membershipPlan: {
        select: {
          monthlyTokenLimit: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const usage = await prisma.aiUsagePeriod.findUnique({
    where: {
      userId_periodStart: {
        userId,
        periodStart,
      },
    },
    select: {
      consumedTokens: true,
      reservedTokens: true,
    },
  });

  const allowance = calculateAiTokenAllowance({
    monthlyTokenLimit: user.membershipPlan?.monthlyTokenLimit ?? 0,
    extraTokens: user.aiTokenExtraMonthly,
  });
  const consumedTokens = usage?.consumedTokens ?? 0;
  const reservedTokens = usage?.reservedTokens ?? 0;

  return {
    allowance,
    consumedTokens,
    reservedTokens,
    availableTokens: Math.max(0, allowance - consumedTokens - reservedTokens),
    periodStart,
  };
}

export async function assertCanUseAi({
  estimatedTokens,
  periodStart,
  prisma,
  userId,
}: {
  estimatedTokens: number;
  periodStart?: Date;
  prisma?: AiUsagePrismaClient;
  userId: string;
}) {
  const normalizedEstimate = normalizeTokenCount(estimatedTokens);
  const allowance = await getUserAiAllowance({ userId, periodStart, prisma });

  if (allowance.consumedTokens + allowance.reservedTokens + normalizedEstimate > allowance.allowance) {
    throw new AiTokenLimitExceededError(
      allowance.allowance,
      allowance.consumedTokens + allowance.reservedTokens,
      normalizedEstimate,
    );
  }

  return allowance;
}

export async function recordAiUsage({
  action,
  actualTokens,
  estimatedTokens,
  model,
  periodStart = getCurrentAiUsagePeriod(),
  prisma = defaultPrisma as unknown as AiUsagePrismaClient,
  provider,
  userId,
}: {
  action: AiAction;
  actualTokens: number;
  estimatedTokens: number;
  model: string;
  periodStart?: Date;
  prisma?: AiUsagePrismaClient;
  provider: string;
  userId: string;
}) {
  const normalizedActualTokens = normalizeTokenCount(actualTokens);
  const normalizedEstimatedTokens = normalizeTokenCount(estimatedTokens);

  await assertCanUseAi({
    userId,
    estimatedTokens: normalizedEstimatedTokens,
    periodStart,
    prisma,
  });

  await prisma.$transaction(async (tx) => {
    await tx.aiTokenLedger.create({
      data: {
        userId,
        periodStart,
        type: "CONSUME",
        tokens: normalizedActualTokens,
        estimatedTokens: normalizedEstimatedTokens,
        actualTokens: normalizedActualTokens,
        provider,
        model,
        action,
      },
    });

    await tx.aiUsagePeriod.upsert({
      where: {
        userId_periodStart: {
          userId,
          periodStart,
        },
      },
      create: {
        userId,
        periodStart,
        consumedTokens: normalizedActualTokens,
        reservedTokens: 0,
      },
      update: {
        consumedTokens: { increment: normalizedActualTokens },
      },
    });
  });
}

export async function recordAiAdjustment({
  adminUserId,
  periodStart = getCurrentAiUsagePeriod(),
  prisma = defaultPrisma as unknown as AiUsagePrismaClient,
  reason,
  tokens,
  userId,
}: {
  adminUserId: string;
  periodStart?: Date;
  prisma?: AiUsagePrismaClient;
  reason: string;
  tokens: number;
  userId: string;
}) {
  const normalizedTokens = normalizeSignedTokenCount(tokens);

  await prisma.$transaction(async (tx) => {
    await tx.aiTokenLedger.create({
      data: {
        userId,
        adminUserId,
        periodStart,
        type: "ADJUSTMENT",
        tokens: normalizedTokens,
        estimatedTokens: null,
        actualTokens: null,
        provider: "admin",
        model: "manual",
        action: "adjustment",
        notes: reason,
      },
    });

    await tx.aiUsagePeriod.upsert({
      where: {
        userId_periodStart: {
          userId,
          periodStart,
        },
      },
      create: {
        userId,
        periodStart,
        consumedTokens: normalizedTokens,
        reservedTokens: 0,
      },
      update: {
        consumedTokens: { increment: normalizedTokens },
      },
    });
  });
}

function normalizeTokenCount(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("Token count must be finite");
  }

  return Math.max(0, Math.ceil(value));
}

function normalizeSignedTokenCount(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("Token count must be finite");
  }

  return Math.trunc(value);
}
