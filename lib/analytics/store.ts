import { prisma } from "@/lib/db/prisma";
import type { AnalyticsEventName } from "@/lib/analytics/events";
import type { AnalyticsPrimitive } from "@/lib/analytics/gtag";

const MAX_VALUE_LENGTH = 160;

const STORED_PARAMETER_KEYS = new Set([
  "event_version",
  "source",
  "page_path",
  "plan",
  "is_demo",
  "registration_method",
  "demo_status",
  "cta_location",
  "landing_path",
  "landing_variant",
  "pricing_variant",
  "plan_highlighted",
  "source_location",
  "target_plan",
  "import_source",
  "format",
  "row_count_bucket",
  "creation_source",
  "budget_kind",
  "action_type",
  "provider",
  "export_target",
  "billing_period",
  "subscription_status",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "first_touch_utm_source",
  "first_touch_utm_medium",
  "first_touch_utm_campaign",
  "first_touch_utm_content",
]);

export type PersistMarketingEventInput = {
  name: AnalyticsEventName;
  userId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  budgetId?: string | null;
  params?: Record<string, AnalyticsPrimitive>;
  occurredAt?: Date;
};

export async function persistMarketingEvent(input: PersistMarketingEventInput): Promise<void> {
  const params = sanitizeParameters(input.params ?? {});
  const isDemo = readBoolean(params.is_demo);

  await prisma.marketingEvent.create({
    data: {
      name: input.name,
      userId: normalizeValue(input.userId),
      clientId: normalizeValue(input.clientId),
      projectId: normalizeValue(input.projectId),
      budgetId: normalizeValue(input.budgetId),
      eventVersion: readString(params.event_version) ?? "1",
      pagePath: readString(params.page_path),
      plan: readString(params.plan),
      isDemo,
      utmSource: readString(params.utm_source),
      utmMedium: readString(params.utm_medium),
      utmCampaign: readString(params.utm_campaign),
      utmContent: readString(params.utm_content),
      firstTouchUtmSource: readString(params.first_touch_utm_source),
      firstTouchUtmMedium: readString(params.first_touch_utm_medium),
      firstTouchUtmCampaign: readString(params.first_touch_utm_campaign),
      firstTouchUtmContent: readString(params.first_touch_utm_content),
      parameters: Object.keys(params).length > 0 ? params : undefined,
      occurredAt: input.occurredAt,
    },
  });
}

function sanitizeParameters(params: Record<string, AnalyticsPrimitive>): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(params)) {
    if (!STORED_PARAMETER_KEYS.has(key) || value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string") {
      const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_VALUE_LENGTH);
      if (normalized) {
        sanitized[key] = normalized;
      }
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function normalizeValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_VALUE_LENGTH);
  return normalized || null;
}

function readString(value: string | number | boolean | undefined) {
  return typeof value === "string" ? value : undefined;
}

function readBoolean(value: string | number | boolean | undefined) {
  return typeof value === "boolean" ? value : undefined;
}
