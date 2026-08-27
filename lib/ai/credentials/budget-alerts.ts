import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { getScopedUsagePeriod } from "@/lib/ai/usage-scope";

export type AiBudgetAlert = {
  threshold: number;
  usagePercent: number;
  kind: "tokens" | "cost";
  workspaceId: string;
  periodStart: Date;
};

export function getCrossedAlertThresholds(previousPercent: number, currentPercent: number, thresholds: number[]) {
  return [...new Set(thresholds)]
    .filter((threshold) => threshold > previousPercent && threshold <= currentPercent)
    .sort((a, b) => a - b);
}

export async function getWorkspaceAiBudgetAlerts(input: {
  workspaceId: string;
  tokenLimit?: number | null;
  budgetMinor?: number | null;
  alertThresholds?: number[];
  prisma?: typeof defaultPrisma;
}): Promise<AiBudgetAlert[]> {
  const client = input.prisma ?? defaultPrisma;
  const periodStart = getScopedUsagePeriod();
  const period = await client.aiWorkspaceUsagePeriod.findUnique({
    where: { workspaceId_periodStart: { workspaceId: input.workspaceId, periodStart } },
    select: { consumedTokens: true, reservedTokens: true, actualCostMinor: true, reservedCostMinor: true },
  });
  if (!period) return [];
  const thresholds = [...new Set((input.alertThresholds ?? []).filter((value) => Number.isInteger(value) && value > 0 && value <= 100))];
  const alerts: AiBudgetAlert[] = [];
  const tokenPercent = input.tokenLimit && input.tokenLimit > 0
    ? Math.round(((period.consumedTokens + period.reservedTokens) / input.tokenLimit) * 100)
    : null;
  const costUsed = (period.actualCostMinor ?? 0) + (period.reservedCostMinor ?? 0);
  const costPercent = input.budgetMinor && input.budgetMinor > 0 ? Math.round((costUsed / input.budgetMinor) * 100) : null;
  for (const threshold of thresholds) {
    if (tokenPercent !== null && tokenPercent >= threshold) alerts.push({ threshold, usagePercent: tokenPercent, kind: "tokens", workspaceId: input.workspaceId, periodStart });
    if (costPercent !== null && costPercent >= threshold) alerts.push({ threshold, usagePercent: costPercent, kind: "cost", workspaceId: input.workspaceId, periodStart });
  }
  return alerts;
}
