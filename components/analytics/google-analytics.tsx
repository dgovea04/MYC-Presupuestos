"use client";

import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import {
  ANALYTICS_CONSENT_EVENT,
  getAnalyticsConsent,
  setAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics/consent";
import { getGtag } from "@/lib/analytics/gtag";

export function GoogleAnalytics({ measurementId }: { measurementId?: string }): React.ReactNode {
  const consent = useSyncExternalStore(
    (onStoreChange) => {
      const handleConsentChange = () => onStoreChange();
      window.addEventListener(ANALYTICS_CONSENT_EVENT, handleConsentChange);
      return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, handleConsentChange);
    },
    getAnalyticsConsent,
    () => null,
  );

  useEffect(() => {
    if (!measurementId || consent !== "granted") {
      return;
    }

    const gtag = getGtag();
    if (!gtag) {
      return;
    }

    gtag("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
    });
    gtag("config", measurementId, { send_page_view: true });
  }, [consent, measurementId]);

  if (!measurementId) {
    return null;
  }

  return (
    <>
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){window.dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',wait_for_update:500});gtag('config','${measurementId}',{send_page_view:false});`}
      </Script>
      <Script
        id="google-analytics-script"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      {consent === null ? <AnalyticsConsentBanner /> : null}
    </>
  );
}

function AnalyticsConsentBanner() {
  function decide(consent: AnalyticsConsent) {
    setAnalyticsConsent(consent);
  }

  return (
    <aside
      className="fixed inset-x-4 bottom-4 z-[70] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-950/15 sm:left-auto sm:max-w-md"
      role="dialog"
      aria-label="Preferencias de analytics"
    >
      <p className="text-sm font-semibold text-slate-950">Ayúdanos a mejorar MC Presupuestos</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Usamos analytics anónimo para entender visitas, activación y uso del producto. No enviamos tu presupuesto ni datos financieros a Google.
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => decide("denied")}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          No gracias
        </button>
        <button
          type="button"
          onClick={() => decide("granted")}
          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Aceptar analytics
        </button>
      </div>
    </aside>
  );
}
