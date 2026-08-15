"use client";

import { useEffect } from "react";
import { ANALYTICS_CONSENT_EVENT } from "@/lib/analytics/consent";
import { setAnalyticsUserId } from "@/lib/analytics/client";

export function IdentifyAnalyticsUser({ userId }: { userId: string | null }) {
  useEffect(() => {
    const identify = () => setAnalyticsUserId(userId);
    identify();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, identify);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, identify);
  }, [userId]);

  return null;
}
