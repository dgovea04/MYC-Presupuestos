import type { AnalyticsPrimitive } from "@/lib/analytics/gtag";
import { isExternalAnalyticsEnabled } from "@/lib/analytics/environment";
import { persistMarketingEvent } from "@/lib/analytics/store";

export type AnalyticsEventName =
  | "landing_view"
  | "pilot_application_started"
  | "pilot_application_submitted"
  | "signup_started"
  | "signup_completed"
  | "project_created"
  | "budget_created"
  | "budget_imported"
  | "pdf_import_analyzed"
  | "pdf_import_draft_created"
  | "pdf_import_failed"
  | "pdf_import_imported"
  | "excel_paste_used"
  | "apu_created"
  | "formula_created"
  | "khipu_used"
  | "export_completed"
  | "pricing_viewed"
  | "upgrade_clicked"
  | "checkout_started"
  | "subscription_created"
  | "demo_project_created"
  | "demo_project_creation_failed"
  | "demo_project_already_exists"
  | "demo_project_opened"
  | "demo_budget_opened"
  | "demo_apu_opened"
  | "demo_formula_opened"
  | "demo_export_completed"
  | "first_non_demo_project_created"
  | "beta_eligible"
  | "beta_assigned"
  | "beta_started"
  | "beta_feature_used"
  | "beta_expiring_14d"
  | "beta_expiring_7d"
  | "beta_expiring_1d"
  | "beta_expired"
  | "beta_upgrade_clicked"
  | "beta_checkout_started"
  | "beta_converted"
  | "beta_revoked";

export type AnalyticsEventPayload = {
  userId: string;
  clientId?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  generalBudgetId?: string | null;
  warnings?: readonly string[];
  [key: string]: AnalyticsPrimitive | readonly string[] | undefined;
};

const GOOGLE_ANALYTICS_ENDPOINT = "https://www.google-analytics.com/mp/collect";

export async function trackServerEvent(
  name: AnalyticsEventName,
  payload: AnalyticsEventPayload,
): Promise<void> {
  const params = Object.fromEntries(
    Object.entries(payload).filter(
      (entry): entry is [string, AnalyticsPrimitive] => isSafeAnalyticsParameter(entry[0], entry[1]),
    ),
  );

  try {
    await persistMarketingEvent({
      name,
      userId: payload.userId,
      clientId: payload.clientId,
      projectId: payload.projectId,
      budgetId: payload.generalBudgetId,
      params,
    });
  } catch {
    // Internal analytics must never interrupt the product operation being tracked.
  }

  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;

  if (!measurementId || !apiSecret || !isExternalAnalyticsEnabled()) {
    return;
  }

  const response = await fetch(
    `${GOOGLE_ANALYTICS_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: `server.${payload.userId}`,
        user_id: payload.userId,
        events: [
          {
            name,
            params: {
              event_version: "1",
              source: "server",
              ...params,
            },
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Google Analytics rejected ${name} with status ${response.status}`);
  }
}

function isSafeAnalyticsParameter(key: string, value: AnalyticsPrimitive | readonly string[]): value is AnalyticsPrimitive {
  if (key === "userId" || key === "clientId" || key === "companyId" || key === "projectId" || key === "generalBudgetId") {
    return false;
  }

  if (!SAFE_PARAMETER_KEYS.has(key)) {
    return false;
  }

  return value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

const SAFE_PARAMETER_KEYS = new Set([
  "event_version",
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
  "fileCount",
  "pageCount",
  "ocrPageCount",
  "itemCount",
  "apuCount",
  "subpartidaCount",
  "warningCount",
  "usedAi",
  "stage",
  "budgetCount",
  "resourceCount",
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
  "campaign",
  "campaign_type",
  "duration_days",
  "grant_source",
  "days_remaining",
  "feature",
  "conversion_window",
]);
