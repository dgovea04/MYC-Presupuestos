import type { ReactNode } from "react";

import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { hasFeatureAccess, type EffectiveUserLicense, type FeatureKey } from "@/lib/billing/entitlements";

export function FeatureGate({
  children,
  description,
  feature,
  license,
  title,
}: {
  children: ReactNode;
  description?: string;
  feature: FeatureKey;
  license: EffectiveUserLicense;
  title?: string;
}) {
  if (hasFeatureAccess(license, feature)) {
    return <>{children}</>;
  }

  return <UpgradeCTA description={description} title={title} />;
}
