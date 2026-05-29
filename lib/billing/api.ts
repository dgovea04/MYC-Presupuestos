import { NextResponse } from "next/server";

import { FeatureAccessError, PlanLimitError, type FeatureKey } from "@/lib/billing/entitlements";

export const BILLING_UPGRADE_URL = "/account";

export function createBillingErrorResponse(error: unknown) {
  if (error instanceof FeatureAccessError) {
    return NextResponse.json(
      {
        error: error.message,
        feature: error.feature,
        upgradeRequired: true,
        upgradeUrl: BILLING_UPGRADE_URL,
      },
      { status: 403 },
    );
  }

  if (error instanceof PlanLimitError) {
    return NextResponse.json(
      {
        error: error.message,
        resource: error.resource,
        limit: error.limit,
        usage: error.usage,
        upgradeRequired: true,
        upgradeUrl: BILLING_UPGRADE_URL,
      },
      { status: 403 },
    );
  }

  return null;
}

export function createUpgradePayload(feature: FeatureKey) {
  return {
    feature,
    upgradeRequired: true,
    upgradeUrl: BILLING_UPGRADE_URL,
  };
}
