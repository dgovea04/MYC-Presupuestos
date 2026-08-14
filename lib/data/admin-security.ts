import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ensureDate } from "@/lib/utils";

const SECURITY_WINDOW_HOURS = 24;
const RECENT_EVENT_LIMIT = 8;
const HIGH_ACTIVITY_THRESHOLD = 20;
const MULTIPLE_IP_THRESHOLD = 3;

const criticalActions = [
  "USER_DELETION_REQUESTED",
  "USER_DELETED_PERMANENTLY",
  "USER_DELETION_REJECTED",
  "USER_ACCESS_UPDATED",
  "USER_BULK_SUSPENDED",
  "USER_BULK_REACTIVATED",
  "USER_BULK_SESSIONS_REVOKED",
  "USER_SESSIONS_REVOKED",
  "PASSWORD_RESET_REQUESTED",
  "MFA_ENABLED",
  "MFA_DISABLED",
  "SYSTEM_SETTINGS_UPDATED",
] as const;

type ActivityRow = {
  actorEmail: string | null;
  eventCount: bigint;
  distinctIpCount: bigint;
};

type RecentEventRow = {
  id: string;
  action: string;
  targetEmail: string;
  actorEmail: string | null;
  ipAddress: string | null;
  detail: string | null;
  createdAt: Date;
};

export type AdminSecuritySignal = {
  kind: "HIGH_ACTIVITY" | "MULTIPLE_IPS";
  actorEmail: string;
  detail: string;
};

export async function getAdminSecurityOverview(now = new Date()) {
  const since = new Date(now.getTime() - SECURITY_WINDOW_HOURS * 60 * 60 * 1000);
  const [summaryRows, criticalRows, activityRows, recentRows] = await Promise.all([
    prisma.$queryRaw<Array<{ totalEvents: bigint; uniqueActors: bigint; uniqueIps: bigint }>>`
      SELECT
        COUNT(*)::bigint AS "totalEvents",
        COUNT(DISTINCT "actorUserId")::bigint AS "uniqueActors",
        COUNT(DISTINCT NULLIF("ipAddress", ''))::bigint AS "uniqueIps"
      FROM "admin_audit_logs"
      WHERE "createdAt" >= ${since}
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count"
      FROM "admin_audit_logs"
      WHERE "createdAt" >= ${since}
        AND "action" IN (${Prisma.join(criticalActions)})
    `,
    prisma.$queryRaw<ActivityRow[]>`
      SELECT
        actor."email" AS "actorEmail",
        COUNT(*)::bigint AS "eventCount",
        COUNT(DISTINCT NULLIF(logs."ipAddress", ''))::bigint AS "distinctIpCount"
      FROM "admin_audit_logs" AS logs
      LEFT JOIN "User" AS actor ON actor."id" = logs."actorUserId"
      WHERE logs."createdAt" >= ${since}
        AND logs."actorUserId" IS NOT NULL
      GROUP BY logs."actorUserId", actor."email"
      HAVING COUNT(*) >= ${HIGH_ACTIVITY_THRESHOLD}
        OR COUNT(DISTINCT NULLIF(logs."ipAddress", '')) >= ${MULTIPLE_IP_THRESHOLD}
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `,
    prisma.$queryRaw<RecentEventRow[]>`
      SELECT
        logs."id",
        logs."action",
        logs."targetEmail",
        actor."email" AS "actorEmail",
        logs."ipAddress",
        logs."detail",
        logs."createdAt"
      FROM "admin_audit_logs" AS logs
      LEFT JOIN "User" AS actor ON actor."id" = logs."actorUserId"
      WHERE logs."createdAt" >= ${since}
      ORDER BY logs."createdAt" DESC
      LIMIT ${RECENT_EVENT_LIMIT}
    `,
  ]);

  const summary = summaryRows[0];
  const signals = activityRows.flatMap((row) => {
    if (!row.actorEmail) return [];

    const actorSignals: AdminSecuritySignal[] = [];
    const eventCount = Number(row.eventCount);
    const distinctIpCount = Number(row.distinctIpCount);

    if (eventCount >= HIGH_ACTIVITY_THRESHOLD) {
      actorSignals.push({
        kind: "HIGH_ACTIVITY",
        actorEmail: row.actorEmail,
        detail: `${eventCount} acciones administrativas en las últimas ${SECURITY_WINDOW_HOURS} horas.`,
      });
    }

    if (distinctIpCount >= MULTIPLE_IP_THRESHOLD) {
      actorSignals.push({
        kind: "MULTIPLE_IPS",
        actorEmail: row.actorEmail,
        detail: `Actividad administrativa desde ${distinctIpCount} direcciones IP distintas en las últimas ${SECURITY_WINDOW_HOURS} horas.`,
      });
    }

    return actorSignals;
  });

  return {
    windowHours: SECURITY_WINDOW_HOURS,
    metrics: {
      totalEvents: Number(summary?.totalEvents ?? 0),
      criticalEvents: Number(criticalRows[0]?.count ?? 0),
      uniqueActors: Number(summary?.uniqueActors ?? 0),
      uniqueIps: Number(summary?.uniqueIps ?? 0),
    },
    signals,
    recentEvents: recentRows.map((row) => ({
      id: row.id,
      action: row.action,
      targetEmail: row.targetEmail,
      actorEmail: row.actorEmail,
      ipAddress: row.ipAddress,
      detail: row.detail,
      createdAt: ensureDate(row.createdAt).toISOString(),
    })),
  };
}
