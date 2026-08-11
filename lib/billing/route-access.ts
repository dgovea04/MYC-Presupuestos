import { assertFeatureAccess, type FeatureKey } from "@/lib/billing/entitlements";
import { createBillingErrorResponse } from "@/lib/billing/api";

export async function getFeatureAccessResponse(userId: string, feature: FeatureKey): Promise<Response | null> {
  try {
    await assertFeatureAccess({ userId, feature });
    return null;
  } catch (error) {
    return createBillingErrorResponse(error);
  }
}
