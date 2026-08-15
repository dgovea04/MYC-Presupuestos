"use client";

import { useEffect, useRef } from "react";
import { ANALYTICS_CONSENT_EVENT } from "@/lib/analytics/consent";
import { getAnalyticsConsent } from "@/lib/analytics/consent";
import { trackClientEvent } from "@/lib/analytics/client";

export function TrackPricingView() {
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const trackedRef = useRef(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        visibleRef.current = Boolean(entry?.isIntersecting);
        if (!visibleRef.current || trackedRef.current || getAnalyticsConsent() !== "granted") {
          return;
        }

        trackedRef.current = true;
        trackClientEvent("pricing_viewed", {
          pricing_variant: "default",
          plan_highlighted: "pro",
        });
        observer.disconnect();
      },
      { threshold: 0.5 },
    );

    observer.observe(marker);
    const handleConsentChange = () => {
      if (visibleRef.current && getAnalyticsConsent() === "granted" && !trackedRef.current) {
        trackedRef.current = true;
        trackClientEvent("pricing_viewed", {
          pricing_variant: "default",
          plan_highlighted: "pro",
        });
        observer.disconnect();
      }
    };
    window.addEventListener(ANALYTICS_CONSENT_EVENT, handleConsentChange);

    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, handleConsentChange);
      observer.disconnect();
    };
  }, []);

  return <span ref={markerRef} className="pointer-events-none absolute h-px w-px" aria-hidden="true" />;
}
