import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { estimateAiCostMinor, estimateAiReservationCostMinor } from "@/lib/ai/cost";

export type ScopedBillingScope = "PLATFORM" | "WORKSPACE" | "USER";

export type ScopedAiUsageInput = {
  userId: string;
  workspaceId?: string | null;
  billingScope: ScopedBillingScope;
  credentialSource?: string | null;
  credentialId?: string | null;
  requestId?: string;
  provider: string;
  model: string;
  action: string;
  estimatedTokens: number;
  actualTokens?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostMinor?: number | null;
  actualCostMinor?: number | null;
  reservedCostMinor?: number | null;
  failureCode?: string | null;
  fallbackUsed?: boolean;
  periodStart?: Date;
  prisma?: UsageClient;
};

type UsageClient = Pick<PrismaClient, "aiUsagePeriod" | "aiWorkspaceUsagePeriod" | "aiUserWorkspaceUsagePeriod" | "aiTokenLedger" | "$transaction">;

type PeriodDelegate = {
  findUnique: (args: { where: Record<string, unknown>; select: { consumedTokens: true; reservedTokens: true; reservedCostMinor: true; actualCostMinor: true } }) => Promise<{ consumedTokens: number; reservedTokens: number; reservedCostMinor: number | null; actualCostMinor: number | null } | null>;
  upsert: (args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
  updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
};

export class ScopedAiBudgetExceededError extends Error {
  readonly statusCode = 429;

  constructor(
    readonly scope: ScopedBillingScope,
    readonly allowance: number,
    readonly usedTokens: number,
    readonly requestedTokens: number,
    readonly allowanceKind: "tokens" | "cost" = "tokens",
  ) {
    super(allowanceKind === "cost"
      ? "Se alcanzó el límite monetario de uso IA del alcance de facturación."
      : "Se alcanzó el límite de tokens IA del alcance de facturación.");
    this.name = "ScopedAiBudgetExceededError";
  }
}

export type ScopedAiAllowance = {
  scope: ScopedBillingScope;
  allowance: number | null;
  consumedTokens: number;
  reservedTokens: number;
  availableTokens: number | null;
  periodStart: Date;
  alertThresholds?: number[];
  triggeredAlertThresholds?: number[];
  usagePercent?: number;
};

export async function assertAiBudgetAvailable(input: {
  userId: string;
  workspaceId?: string | null;
  billingScope: ScopedBillingScope;
  estimatedTokens: number;
  estimatedCostMinor?: number | null;
  allowance?: number | null;
  budgetMinor?: number | null;
  periodStart?: Date;
  hardLimit?: boolean;
  alertThresholds?: number[];
  prisma?: UsageClient;
}): Promise<ScopedAiAllowance> {
  const periodStart = input.periodStart ?? getScopedUsagePeriod();
  const prisma = input.prisma ?? defaultPrisma;
  const allowance = await readScopedAllowance({ ...input, periodStart, prisma });
  assertAllowance({
    allowance,
    estimatedTokens: normalizeTokens(input.estimatedTokens),
    estimatedCostMinor: normalizeMinor(input.estimatedCostMinor),
    budgetMinor: input.budgetMinor,
    scope: input.billingScope,
    hardLimit: input.hardLimit ?? true,
  });
  return {
    ...allowance,
    alertThresholds: normalizeAlertThresholds(input.alertThresholds),
    triggeredAlertThresholds: getTriggeredAlertThresholds(
      calculateUsagePercent(allowance, input.estimatedTokens),
      input.alertThresholds,
    ),
    usagePercent: calculateUsagePercent(allowance, input.estimatedTokens),
  };
}

export async function reserveAiUsage(input: {
  userId: string;
  workspaceId?: string | null;
  billingScope: ScopedBillingScope;
  estimatedTokens: number;
  allowance?: number | null;
  budgetMinor?: number | null;
  provider: string;
  model: string;
  action: string;
  credentialSource?: string | null;
  credentialId?: string | null;
  requestId?: string;
  estimatedCostMinor?: number | null;
  hardLimit?: boolean;
  alertThresholds?: number[];
  periodStart?: Date;
  prisma?: UsageClient;
}) {
  const estimatedTokens = normalizeTokens(input.estimatedTokens);
  const periodStart = input.periodStart ?? getScopedUsagePeriod();
  const prisma = input.prisma ?? defaultPrisma;
  const idempotencyKey = input.requestId ? `${input.requestId}:RESERVE` : `reserve:${randomUUID()}`;
  const estimatedCostMinor = normalizeMinor(input.estimatedCostMinor) ?? estimateAiReservationCostMinor({ provider: input.provider, model: input.model, estimatedTokens });

  return runSerializableTransaction(prisma, async (tx) => {
    const existing = await tx.aiTokenLedger.findUnique({
      where: { idempotencyKey },
      select: { type: true, tokens: true, estimatedTokens: true, estimatedCostMinor: true, periodStart: true },
    });
    if (existing) {
      if (existing.type !== "RESERVE") throw new Error("La clave de idempotencia ya fue usada por otro evento de uso IA.");
      return {
        requestId: input.requestId ?? idempotencyKey,
        estimatedTokens: existing.estimatedTokens ?? Math.abs(existing.tokens),
        estimatedCostMinor: existing.estimatedCostMinor ?? 0,
        triggeredAlertThresholds: [],
        periodStart: existing.periodStart,
      };
    }

    const allowance = await readScopedAllowance({ ...input, periodStart, prisma: tx });
    assertAllowance({ allowance, estimatedTokens, estimatedCostMinor, budgetMinor: input.budgetMinor, scope: input.billingScope, hardLimit: input.hardLimit ?? true });

    await incrementReserved({ workspaceId: input.workspaceId, userId: input.userId, billingScope: input.billingScope, periodStart, prisma: tx }, estimatedTokens, estimatedCostMinor);
    await tx.aiTokenLedger.create({
      data: ledgerData(input, {
        periodStart,
        type: "RESERVE",
        tokens: estimatedTokens,
        estimatedTokens,
        actualTokens: null,
        estimatedCostMinor,
        actualCostMinor: null,
        reservedCostMinor: estimatedCostMinor,
        idempotencyKey,
      }),
    });

    const projectedUsagePercent = calculateUsagePercent(allowance, estimatedTokens);
    return {
      requestId: input.requestId ?? idempotencyKey,
      estimatedTokens,
      estimatedCostMinor,
      triggeredAlertThresholds: getTriggeredAlertThresholds(projectedUsagePercent, input.alertThresholds),
      periodStart,
    };
  });
}

export async function recordScopedAiUsage(input: ScopedAiUsageInput, prisma: UsageClient = input.prisma ?? defaultPrisma) {
  const periodStart = input.periodStart ?? getScopedUsagePeriod();
  const estimatedTokens = normalizeTokens(input.estimatedTokens);
  const actualTokens = normalizeTokens(input.actualTokens ?? estimatedTokens);
  const idempotencyKey = input.requestId ? `${input.requestId}:CONSUME` : `consume:${randomUUID()}`;
  const actualCostMinor = normalizeMinor(input.actualCostMinor) ?? estimateAiCostMinor({ provider: input.provider, model: input.model, inputTokens: input.inputTokens ?? estimatedTokens, outputTokens: input.outputTokens ?? Math.max(0, actualTokens - (input.inputTokens ?? estimatedTokens)) });
  const estimatedCostMinor = normalizeMinor(input.estimatedCostMinor);

  return runSerializableTransaction(prisma, async (tx) => {
    const existing = await tx.aiTokenLedger.findUnique({
      where: { idempotencyKey },
      select: { type: true, tokens: true, actualTokens: true, actualCostMinor: true, periodStart: true },
    });
    if (existing) {
      if (existing.type !== "CONSUME") throw new Error("La clave de idempotencia ya fue usada por otro evento de uso IA.");
      return {
        requestId: input.requestId ?? idempotencyKey,
        actualTokens: existing.actualTokens ?? Math.abs(existing.tokens),
        actualCostMinor: existing.actualCostMinor ?? 0,
        periodStart: existing.periodStart,
      };
    }

    await decrementReserved(
      { workspaceId: input.workspaceId, userId: input.userId, billingScope: input.billingScope, periodStart, prisma: tx },
      estimatedTokens,
      normalizeMinor(input.reservedCostMinor ?? estimatedCostMinor ?? actualCostMinor) ?? 0,
    );
    await incrementConsumed({ workspaceId: input.workspaceId, userId: input.userId, billingScope: input.billingScope, periodStart, prisma: tx }, actualTokens, actualCostMinor);
    await tx.aiTokenLedger.create({
      data: ledgerData(input, {
        periodStart,
        type: "CONSUME",
        tokens: actualTokens,
        estimatedTokens,
        actualTokens,
        estimatedCostMinor: estimatedCostMinor ?? actualCostMinor,
        actualCostMinor,
        reservedCostMinor: normalizeMinor(input.reservedCostMinor ?? estimatedCostMinor) ?? 0,
        idempotencyKey,
      }),
    });
    return { requestId: input.requestId ?? idempotencyKey, actualTokens, actualCostMinor, periodStart };
  });
}

export type PlatformAiUsageInput = {
  userId: string;
  workspaceId?: string | null;
  requestId?: string;
  provider: string;
  model: string;
  action: string;
  estimatedTokens: number;
  actualTokens?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  fallbackUsed?: boolean;
  periodStart?: Date;
  prisma?: UsageClient;
};

/**
 * Registra consumo facturado a la plataforma (key del sistema) en el ledger de
 * tokens, con atribución completa (usuario, workspace, proveedor, modelo,
 * acción). Es un registro contable INDEPENDIENTE: no reserva ni descuenta del
 * cupo de ningún usuario/workspace, ni aplica límites de presupuesto. La key
 * del sistema la paga la plataforma, pero el uso queda visible y filtrable en
 * los reportes de administración.
 */
export async function recordPlatformAiUsage(input: PlatformAiUsageInput, prisma: UsageClient = input.prisma ?? defaultPrisma) {
  const periodStart = input.periodStart ?? getScopedUsagePeriod();
  const estimatedTokens = normalizeTokens(input.estimatedTokens);
  const actualTokens = normalizeTokens(input.actualTokens ?? estimatedTokens);
  const idempotencyKey = input.requestId ? `${input.requestId}:CONSUME` : `consume:${randomUUID()}`;
  const inputTokens = input.inputTokens ?? estimatedTokens;
  const outputTokens = input.outputTokens ?? Math.max(0, actualTokens - inputTokens);
  const actualCostMinor = estimateAiCostMinor({ provider: input.provider, model: input.model, inputTokens, outputTokens });

  return runSerializableTransaction(prisma, async (tx) => {
    const existing = await tx.aiTokenLedger.findUnique({
      where: { idempotencyKey },
      select: { type: true, tokens: true, actualTokens: true, actualCostMinor: true, periodStart: true },
    });
    if (existing) {
      if (existing.type !== "CONSUME") throw new Error("La clave de idempotencia ya fue usada por otro evento de uso IA.");
      return {
        requestId: input.requestId ?? idempotencyKey,
        actualTokens: existing.actualTokens ?? Math.abs(existing.tokens),
        actualCostMinor: existing.actualCostMinor ?? 0,
        periodStart: existing.periodStart,
      };
    }

    await tx.aiTokenLedger.create({
      data: ledgerData(
        { ...input, billingScope: "PLATFORM" as const, credentialSource: "PLATFORM" as const, inputTokens, outputTokens, actualCostMinor },
        {
          periodStart,
          type: "CONSUME",
          tokens: actualTokens,
          estimatedTokens,
          actualTokens,
          estimatedCostMinor: actualCostMinor,
          actualCostMinor,
          reservedCostMinor: null,
          idempotencyKey,
        },
      ),
    });
    return { requestId: input.requestId ?? idempotencyKey, actualTokens, actualCostMinor, periodStart };
  });
}

export async function releaseAiUsage(input: {
  userId: string;
  workspaceId?: string | null;
  billingScope: ScopedBillingScope;
  estimatedTokens: number;
  provider: string;
  model: string;
  action: string;
  credentialSource?: string | null;
  credentialId?: string | null;
  requestId?: string;
  estimatedCostMinor?: number | null;
  periodStart?: Date;
  prisma?: UsageClient;
}) {
  const tokens = normalizeTokens(input.estimatedTokens);
  const periodStart = input.periodStart ?? getScopedUsagePeriod();
  const prisma = input.prisma ?? defaultPrisma;
  const idempotencyKey = input.requestId ? `${input.requestId}:RELEASE` : `release:${randomUUID()}`;
  const cost = normalizeMinor(input.estimatedCostMinor) ?? estimateAiReservationCostMinor({ provider: input.provider, model: input.model, estimatedTokens: tokens });

  return runSerializableTransaction(prisma, async (tx) => {
    const existing = await tx.aiTokenLedger.findUnique({
      where: { idempotencyKey },
      select: { type: true, tokens: true, periodStart: true },
    });
    if (existing) {
      if (existing.type !== "RELEASE") throw new Error("La clave de idempotencia ya fue usada por otro evento de uso IA.");
      return {
        requestId: input.requestId ?? idempotencyKey,
        releasedTokens: Math.abs(existing.tokens),
        periodStart: existing.periodStart,
      };
    }

    await decrementReserved({ workspaceId: input.workspaceId, userId: input.userId, billingScope: input.billingScope, periodStart, prisma: tx }, tokens, cost);
    await tx.aiTokenLedger.create({
      data: ledgerData(input, {
        periodStart,
        type: "RELEASE",
        tokens: -tokens,
        estimatedTokens: tokens,
        actualTokens: null,
        estimatedCostMinor: cost,
        actualCostMinor: null,
        reservedCostMinor: cost,
        idempotencyKey,
      }),
    });
    return { requestId: input.requestId ?? idempotencyKey, releasedTokens: tokens, periodStart };
  });
}

export function getScopedUsagePeriod(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

async function readScopedAllowance(input: {
  userId: string;
  workspaceId?: string | null;
  billingScope: ScopedBillingScope;
  allowance?: number | null;
  budgetMinor?: number | null;
  periodStart: Date;
  prisma: UsageClient;
}): Promise<ScopedAiAllowance & { reservedCostMinor: number; actualCostMinor: number }> {
  const period = await readPeriod(input);
  const allowance = input.allowance === undefined ? null : input.allowance;
  return {
    scope: input.billingScope,
    allowance,
    consumedTokens: period.consumedTokens,
    reservedTokens: period.reservedTokens,
    availableTokens: allowance === null ? null : Math.max(0, allowance - period.consumedTokens - period.reservedTokens),
    periodStart: input.periodStart,
    reservedCostMinor: period.reservedCostMinor ?? 0,
    actualCostMinor: period.actualCostMinor ?? 0,
    triggeredAlertThresholds: [],
  };
}

async function readPeriod(input: {
  userId: string;
  workspaceId?: string | null;
  billingScope: ScopedBillingScope;
  periodStart: Date;
  prisma: UsageClient;
}) {
  const delegate = getPeriodDelegate(input);
  const where = getPeriodWhere(input);
  const period = await delegate.findUnique({ where, select: { consumedTokens: true, reservedTokens: true, reservedCostMinor: true, actualCostMinor: true } });
  return period ?? { consumedTokens: 0, reservedTokens: 0, reservedCostMinor: 0, actualCostMinor: 0 };
}

function getPeriodDelegate(input: { billingScope: ScopedBillingScope; workspaceId?: string | null; prisma: UsageClient }): PeriodDelegate {
  if (input.billingScope === "WORKSPACE") return input.prisma.aiWorkspaceUsagePeriod as unknown as PeriodDelegate;
  if (input.billingScope === "USER" && input.workspaceId) return input.prisma.aiUserWorkspaceUsagePeriod as unknown as PeriodDelegate;
  return input.prisma.aiUsagePeriod as unknown as PeriodDelegate;
}

function getPeriodWhere(input: { userId: string; workspaceId?: string | null; billingScope: ScopedBillingScope; periodStart: Date }) {
  if (input.billingScope === "WORKSPACE") {
    if (!input.workspaceId) throw new Error("Workspace requerido para uso con alcance Workspace.");
    return { workspaceId_periodStart: { workspaceId: input.workspaceId, periodStart: input.periodStart } };
  }
  if (input.billingScope === "USER" && input.workspaceId) {
    return { userId_workspaceId_periodStart: { userId: input.userId, workspaceId: input.workspaceId, periodStart: input.periodStart } };
  }
  return { userId_periodStart: { userId: input.userId, periodStart: input.periodStart } };
}

async function incrementReserved(input: { workspaceId?: string | null; userId: string; billingScope: ScopedBillingScope; periodStart: Date; prisma: UsageClient }, tokens: number, costMinor: number) {
  const delegate = getPeriodDelegate(input);
  const where = getPeriodWhere(input);
  const identity = getPeriodIdentity(input);
  await delegate.upsert({
    where,      create: { ...identity, consumedTokens: 0, reservedTokens: tokens, reservedCostMinor: costMinor, estimatedCostMinor: costMinor },
    update: { reservedTokens: { increment: tokens }, reservedCostMinor: { increment: costMinor }, estimatedCostMinor: { increment: costMinor } },
  });
}

async function incrementConsumed(input: { workspaceId?: string | null; userId: string; billingScope: ScopedBillingScope; periodStart: Date; prisma: UsageClient }, tokens: number, costMinor: number) {
  const delegate = getPeriodDelegate(input);
  const where = getPeriodWhere(input);
  const identity = getPeriodIdentity(input);
  await delegate.upsert({
    where,
    create: { ...identity, consumedTokens: tokens, reservedTokens: 0, reservedCostMinor: 0, actualCostMinor: costMinor, estimatedCostMinor: null },
    update: { consumedTokens: { increment: tokens }, actualCostMinor: { increment: costMinor } },
  });
}

async function decrementReserved(input: { workspaceId?: string | null; userId: string; billingScope: ScopedBillingScope; periodStart: Date; prisma: UsageClient }, tokens: number, costMinor: number) {
  const delegate = getPeriodDelegate(input);
  const current = await delegate.findUnique({
    where: getPeriodWhere(input),
    select: { consumedTokens: true, reservedTokens: true, reservedCostMinor: true, actualCostMinor: true },
  });
  if (!current || current.reservedTokens < tokens) {
    throw new Error("La reserva de uso IA no existe, ya fue procesada o quedó inconsistente.");
  }

  // El coste real puede superar la reserva conservadora. Solo se descuenta
  // de la bolsa reservada hasta su saldo disponible; el excedente se registra
  // como coste real consumido sin permitir saldos negativos.
  const reservedCostToRelease = Math.min(
    Math.max(0, costMinor),
    Math.max(0, current.reservedCostMinor ?? 0),
  );
  // updateMany solo acepta filtros de campo (WhereInput), NO llaves únicas
  // compuestas como userId_periodStart. Se construye el where plano equivalente.
  const updated = await delegate.updateMany({
    where: {
      ...getPeriodFilterWhere(input),
      reservedTokens: { gte: tokens },
      reservedCostMinor: { gte: reservedCostToRelease },
    },
    data: {
      reservedTokens: { decrement: tokens },
      reservedCostMinor: { decrement: reservedCostToRelease },
    },
  });
  if (updated.count !== 1) throw new Error("La reserva de uso IA no existe, ya fue procesada o quedó inconsistente.");
}

function getPeriodFilterWhere(input: { workspaceId?: string | null; userId: string; billingScope: ScopedBillingScope; periodStart: Date }) {
  if (input.billingScope === "WORKSPACE") {
    return { workspaceId: input.workspaceId, periodStart: input.periodStart };
  }
  if (input.billingScope === "USER" && input.workspaceId) {
    return { userId: input.userId, workspaceId: input.workspaceId, periodStart: input.periodStart };
  }
  return { userId: input.userId, periodStart: input.periodStart };
}

function getPeriodIdentity(input: { workspaceId?: string | null; userId: string; billingScope: ScopedBillingScope; periodStart: Date }) {
  if (input.billingScope === "WORKSPACE") return { workspaceId: input.workspaceId, periodStart: input.periodStart };
  if (input.billingScope === "USER" && input.workspaceId) return { userId: input.userId, workspaceId: input.workspaceId, periodStart: input.periodStart };
  return { userId: input.userId, workspaceId: input.workspaceId ?? null, periodStart: input.periodStart };
}

function assertAllowance(input: {
  allowance: ScopedAiAllowance & { reservedCostMinor: number; actualCostMinor: number };
  estimatedTokens: number;
  estimatedCostMinor: number | null;
  budgetMinor?: number | null;
  scope: ScopedBillingScope;
  hardLimit: boolean;
}) {
  if (input.hardLimit && input.allowance.allowance !== null && input.allowance.consumedTokens + input.allowance.reservedTokens + input.estimatedTokens > input.allowance.allowance) {
    throw new ScopedAiBudgetExceededError(input.scope, input.allowance.allowance, input.allowance.consumedTokens + input.allowance.reservedTokens, input.estimatedTokens, "tokens");
  }
  if (input.hardLimit && input.budgetMinor !== null && input.budgetMinor !== undefined && input.allowance.actualCostMinor + input.allowance.reservedCostMinor + (input.estimatedCostMinor ?? 0) > input.budgetMinor) {
    throw new ScopedAiBudgetExceededError(input.scope, input.budgetMinor, input.allowance.reservedCostMinor, input.estimatedCostMinor ?? 0, "cost");
  }
}

function calculateUsagePercent(allowance: ScopedAiAllowance & { reservedCostMinor: number; actualCostMinor: number }, estimatedTokens: number) {
  if (allowance.allowance === null || allowance.allowance <= 0) return 0;
  return Math.round(((allowance.consumedTokens + allowance.reservedTokens + estimatedTokens) / allowance.allowance) * 100);
}

function normalizeAlertThresholds(thresholds?: number[]) {
  return [...new Set((thresholds ?? []).filter((threshold) => Number.isFinite(threshold) && threshold > 0 && threshold <= 100))].sort((a, b) => a - b);
}

function getTriggeredAlertThresholds(usagePercent: number, thresholds?: number[]) {
  return normalizeAlertThresholds(thresholds).filter((threshold) => usagePercent >= threshold);
}

async function runSerializableTransaction<T>(prisma: UsageClient, callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 2) throw error;
    }
  }
  throw new Error("No se pudo completar la transacción de uso IA.");
}

function isSerializationConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2034";
}

function normalizeTokens(value: number) {
  if (!Number.isFinite(value)) throw new Error("Token count must be finite.");
  return Math.max(0, Math.ceil(value));
}

function normalizeMinor(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) throw new Error("Cost must be finite.");
  return Math.max(0, Math.ceil(value));
}

function ledgerData(input: ScopedAiUsageInput & { estimatedTokens?: number }, output: {
  periodStart: Date;
  type: "RESERVE" | "CONSUME" | "RELEASE";
  tokens: number;
  estimatedTokens: number;
  actualTokens: number | null;
  estimatedCostMinor: number | null;
  actualCostMinor: number | null;
  reservedCostMinor: number | null;
  idempotencyKey: string;
}) {
  return {
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    periodStart: output.periodStart,
    type: output.type,
    tokens: output.tokens,
    estimatedTokens: output.estimatedTokens,
    actualTokens: output.actualTokens,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    estimatedCostMinor: output.estimatedCostMinor,
    actualCostMinor: output.actualCostMinor,
    reservedCostMinor: output.reservedCostMinor,
    provider: input.provider,
    model: input.model,
    action: input.action,
    credentialSource: input.credentialSource ?? null,
    credentialId: input.credentialId ?? null,
    billingScope: input.billingScope,
    idempotencyKey: output.idempotencyKey,
    requestId: input.requestId ?? output.idempotencyKey,
    failureCode: input.failureCode ?? null,
    fallbackUsed: input.fallbackUsed ?? false,
  };
}
