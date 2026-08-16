"use client";

import { getAnalyticsConsent } from "@/lib/analytics/consent";
import { ANALYTICS_CLIENT_ID_COOKIE, getAttributionEventParams, captureUtmAttribution } from "@/lib/analytics/utm";
import type { AnalyticsEventName } from "@/lib/analytics/events";
import { getGtag, type GtagEventParams } from "@/lib/analytics/gtag";

export type ClientAnalyticsEventName = Extract<
  AnalyticsEventName,
  "landing_view" | "signup_started" | "pricing_viewed" | "upgrade_clicked" | "beta_upgrade_clicked" | "excel_paste_used"
>;

export function trackClientEvent(
  name: ClientAnalyticsEventName,
  params: GtagEventParams = {},
): void {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "granted") {
    return;
  }

  captureUtmAttribution();
  const eventParams: GtagEventParams = {
    ...getAttributionEventParams(),
    ...params,
    event_version: "1",
    page_path: window.location.pathname,
  };
  const clientId = getOrCreateAnalyticsClientId();

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, clientId, params: eventParams }),
    keepalive: true,
  }).catch(() => {
    // Analytics ingestion must never affect the product interaction.
  });

  getGtag()?.("event", name, eventParams);
}

export function setAnalyticsUserId(userId: string | null): void {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "granted") {
    return;
  }

  getGtag()?.("set", { user_id: userId });
}

function getOrCreateAnalyticsClientId(): string {
  const existing = readCookie(ANALYTICS_CLIENT_ID_COOKIE);
  if (existing) {
    return existing;
  }

  const generated = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `anonymous-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ANALYTICS_CLIENT_ID_COOKIE}=${encodeURIComponent(generated)}; Max-Age=${90 * 24 * 60 * 60}; Path=/; SameSite=Lax${secure}`;
  return generated;
}

function readCookie(name: string): string | null {
  const rawValue = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);

  if (!rawValue) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(rawValue).trim().slice(0, 160);
    return decoded || null;
  } catch {
    return null;
  }
}
