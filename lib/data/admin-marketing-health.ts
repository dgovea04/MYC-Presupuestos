import { prisma } from "@/lib/db/prisma";
import type { AdminMarketingDateRange } from "@/lib/data/admin-marketing-analytics";

const CORE_EVENTS = [
  "landing_view",
  "signup_started",
  "signup_completed",
  "project_created",
  "budget_created",
  "budget_imported",
  "excel_paste_used",
  "apu_created",
  "formula_created",
  "khipu_used",
  "export_completed",
  "pricing_viewed",
  "upgrade_clicked",
  "checkout_started",
  "subscription_created",
] as const;

export type AdminMarketingHealth = Awaited<ReturnType<typeof getAdminMarketingHealth>>;

export async function getAdminMarketingHealth(range: AdminMarketingDateRange) {
  try {
    const events = await prisma.marketingEvent.findMany({
      where: { occurredAt: { gte: range.from, lt: range.to } },
      select: {
        id: true,
        name: true,
        userId: true,
        clientId: true,
        utmSource: true,
        firstTouchUtmSource: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: "desc" },
    });

    const counts = new Map<string, number>();
    const duplicateBuckets = new Map<string, number>();
    let anonymousEvents = 0;
    let unattributedSignups = 0;

    for (const event of events) {
      counts.set(event.name, (counts.get(event.name) ?? 0) + 1);
      if (!event.userId) {
        anonymousEvents += 1;
      }
      if (
        event.name === "signup_completed" &&
        !event.utmSource &&
        !event.firstTouchUtmSource
      ) {
        unattributedSignups += 1;
      }

      const identity = event.userId ?? event.clientId ?? "anonymous";
      const minuteBucket = Math.floor(event.occurredAt.getTime() / 60000);
      const duplicateKey = `${event.name}:${identity}:${minuteBucket}`;
      duplicateBuckets.set(duplicateKey, (duplicateBuckets.get(duplicateKey) ?? 0) + 1);
    }

    const possibleDuplicates = [...duplicateBuckets.values()]
      .filter((count) => count > 1)
      .reduce((total, count) => total + count - 1, 0);

    return {
      available: true,
      totalEvents: events.length,
      lastEventAt: events[0]?.occurredAt.toISOString() ?? null,
      anonymousEvents,
      unattributedSignups,
      possibleDuplicates,
      missingCoreEvents: CORE_EVENTS.filter((name) => !counts.has(name)),
      eventCounts: [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
    };
  } catch {
    return {
      available: false,
      totalEvents: 0,
      lastEventAt: null,
      anonymousEvents: 0,
      unattributedSignups: 0,
      possibleDuplicates: 0,
      missingCoreEvents: [...CORE_EVENTS],
      eventCounts: [],
    };
  }
}
