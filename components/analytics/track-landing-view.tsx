"use client";

import { useEffect } from "react";
import { ANALYTICS_CONSENT_EVENT } from "@/lib/analytics/consent";
import { trackClientEvent } from "@/lib/analytics/client";

export function TrackLandingView({ path, variant = "default" }: { path: string; variant?: string }) {
  useEffect(() => {
    const sendLandingView = () => {
      trackClientEvent("landing_view", {
        landing_path: path,
        landing_variant: variant,
      });
    };

    sendLandingView();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, sendLandingView);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, sendLandingView);
  }, [path, variant]);

  return null;
}
