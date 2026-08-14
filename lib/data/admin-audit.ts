import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ensureDate } from "@/lib/utils";

export type AdminAuditInput = {
  actorUserId: string | null;
  targetUserId: string | null;
  targetEmail: string;
  action: string;
  detail?: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AdminAuditFilters = {
  query?: string;
  action?: string;
  page?: number;
  pageSize?: number;
};

export const ADMIN_AUDIT_PAGE_SIZE = 20;
export const ADMIN_AUDIT_EXPORT_PAGE_SIZE = 5_000;

export type AdminAuditLogEntry = {
  id: string;
  action: string;
  detail: string | null;
  targetEmail: string;
  actorEmail: string | null;
  createdAt: string;
};

export async function recordAdminAudit(input: AdminAuditInput, client: typeof prisma = prisma) {
  await client.$executeRaw`
    INSERT INTO "admin_audit_logs" (
      "id", "actorUserId", "targetUserId", "targetEmail", "action", "detail", "metadata", "ipAddress", "userAgent"
    )
    VALUES (
      ${randomUUID()},
      ${input.actorUserId},
      ${input.targetUserId},
      ${input.targetEmail},
      ${input.action},
      ${input.detail ?? null},
      CAST(${input.metadata ? JSON.stringify(input.metadata) : null} AS jsonb),
      ${input.ipAddress ?? null},
      ${input.userAgent ?? null}
    )
  `;
}

export async function listAdminAuditLogs(filters: AdminAuditFilters = {}) {
  const query = normalizeAdminAuditQuery(filters.query);
  const action = normalizeAdminAuditAction(filters.action);
  const pageSize = normalizeAdminAuditPageSize(filters.pageSize);
  const requestedPage = normalizeAdminAuditPage(filters.page);
  const where = buildAuditWhere({ query, action });
  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "admin_audit_logs" AS logs
    LEFT JOIN "User" AS actor ON actor."id" = logs."actorUserId"
    WHERE ${where}
  `;
  const totalEntries = Number(countRows[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const entries = await prisma.$queryRaw<
    Array<{
      id: string;
      action: string;
      detail: string | null;
      targetEmail: string;
      actorEmail: string | null;
      createdAt: Date;
    }>
  >`
    SELECT
      logs."id",
      logs."action",
      logs."detail",
      logs."targetEmail",
      actor."email" AS "actorEmail",
      logs."createdAt"
    FROM "admin_audit_logs" AS logs
    LEFT JOIN "User" AS actor ON actor."id" = logs."actorUserId"
    WHERE ${where}
    ORDER BY logs."createdAt" DESC
    LIMIT ${pageSize}
    OFFSET ${(page - 1) * pageSize}
  `;
  const actions = await listAdminAuditActions();

  return {
    entries: entries.map(toAdminAuditLogEntry),
    actions,
    pagination: {
      page,
      pageSize,
      totalEntries,
      totalPages,
    },
    filters: {
      query: query ?? "",
      action: action ?? "",
    },
  };
}

export function normalizeAdminAuditQuery(value?: string) {
  const normalized = value?.trim().slice(0, 100);
  return normalized || undefined;
}

export function normalizeAdminAuditAction(value?: string) {
  const normalized = value?.trim().slice(0, 80);
  return normalized || undefined;
}

export function normalizeAdminAuditPage(value?: number) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

export function normalizeAdminAuditPageSize(value?: number) {
  if (!Number.isInteger(value) || !value || value < 1) {
    return ADMIN_AUDIT_PAGE_SIZE;
  }

  return Math.min(value, ADMIN_AUDIT_EXPORT_PAGE_SIZE);
}

function buildAuditWhere(filters: { query?: string; action?: string }) {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];

  if (filters.query) {
    const pattern = `%${filters.query}%`;
    conditions.push(Prisma.sql`(
      logs."targetEmail" ILIKE ${pattern}
      OR COALESCE(logs."detail", '') ILIKE ${pattern}
      OR logs."action" ILIKE ${pattern}
      OR COALESCE(actor."email", '') ILIKE ${pattern}
    )`);
  }

  if (filters.action) {
    conditions.push(Prisma.sql`logs."action" = ${filters.action}`);
  }

  return Prisma.join(conditions, " AND ");
}

async function listAdminAuditActions() {
  const rows = await prisma.$queryRaw<Array<{ action: string }>>`
    SELECT DISTINCT "action"
    FROM "admin_audit_logs"
    ORDER BY "action" ASC
  `;

  return rows.map((row) => row.action);
}

function toAdminAuditLogEntry(entry: {
  id: string;
  action: string;
  detail: string | null;
  targetEmail: string;
  actorEmail: string | null;
  createdAt: Date;
}): AdminAuditLogEntry {
  return {
    id: entry.id,
    action: entry.action,
    detail: entry.detail,
    targetEmail: entry.targetEmail,
    actorEmail: entry.actorEmail,
    createdAt: ensureDate(entry.createdAt).toISOString(),
  };
}
