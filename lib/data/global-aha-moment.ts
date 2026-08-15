import { prisma } from "@/lib/db/prisma";
import { getOnboardingRecommendation, type OnboardingRecommendation } from "@/lib/dashboard/onboarding-recommendation";

const ACTIVATION_EVENTS = new Set([
  "project_created",
  "budget_created",
  "budget_imported",
  "excel_paste_used",
  "apu_created",
  "formula_created",
  "export_completed",
]);

export async function getGlobalOnboardingRecommendation(): Promise<OnboardingRecommendation | null> {
  try {
    const events = await prisma.marketingEvent.findMany({
      where: {
        name: { in: ["signup_completed", ...ACTIVATION_EVENTS] },
      },
      select: {
        id: true,
        name: true,
        userId: true,
        clientId: true,
        isDemo: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: "asc" },
    });

    const aliases = new Map<string, string>();
    for (const event of events) {
      const identity = event.userId ?? event.clientId;
      if (!identity) continue;
      if (event.userId) aliases.set(event.userId, identity);
      if (event.clientId) aliases.set(event.clientId, identity);
    }

    const signupDates = new Map<string, Date>();
    for (const event of events) {
      if (event.name !== "signup_completed") continue;
      const identity = resolveIdentity(event, aliases);
      const existing = signupDates.get(identity);
      if (!existing || event.occurredAt < existing) {
        signupDates.set(identity, event.occurredAt);
      }
    }

    const firstActions = new Map<string, { eventName: string; occurredAt: Date }>();
    for (const event of events) {
      if (event.name === "signup_completed" || event.isDemo === true || !event.userId || !ACTIVATION_EVENTS.has(event.name)) {
        continue;
      }

      const identity = resolveIdentity(event, aliases);
      const signupAt = signupDates.get(identity);
      if (!signupAt || event.occurredAt <= signupAt || event.occurredAt >= addDays(signupAt, 7)) {
        continue;
      }

      const existing = firstActions.get(identity);
      if (!existing || event.occurredAt < existing.occurredAt) {
        firstActions.set(identity, { eventName: event.name, occurredAt: event.occurredAt });
      }
    }

    const usersByAction = new Map<string, number>();
    for (const action of firstActions.values()) {
      usersByAction.set(action.eventName, (usersByAction.get(action.eventName) ?? 0) + 1);
    }

    const leadingAction = [...usersByAction.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
    return getOnboardingRecommendation(leadingAction ? {
      eventName: leadingAction,
      users: usersByAction.get(leadingAction) ?? 0,
      activationRate: 0,
      shareOfActivated: 0,
    } : undefined);
  } catch {
    return null;
  }
}

function resolveIdentity(event: { id: string; userId: string | null; clientId: string | null }, aliases: ReadonlyMap<string, string>) {
  const identity = event.userId ?? event.clientId ?? `event:${event.id}`;
  return aliases.get(identity) ?? identity;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}
