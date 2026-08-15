import { ANALYTICS_CLIENT_ID_COOKIE, ATTRIBUTION_COOKIE_NAME, parseAttributionCookie } from "@/lib/analytics/utm";
import type { AnalyticsPrimitive } from "@/lib/analytics/gtag";

export function getAnalyticsRequestContext(request: Request): {
  clientId: string | null;
  params: Record<string, AnalyticsPrimitive>;
} {
  const cookies = readCookies(request.headers.get("cookie"));
  const clientId = sanitizeValue(cookies.get(ANALYTICS_CLIENT_ID_COOKIE));
  const attributionCookie = cookies.get(ATTRIBUTION_COOKIE_NAME);
  const attribution = attributionCookie ? parseAttributionCookie(attributionCookie) : null;

  if (!attribution) {
    return { clientId, params: {} };
  }

  return {
    clientId,
    params: {
      utm_source: attribution.lastTouch.utm_source,
      utm_medium: attribution.lastTouch.utm_medium,
      utm_campaign: attribution.lastTouch.utm_campaign,
      utm_content: attribution.lastTouch.utm_content,
      first_touch_utm_source: attribution.firstTouch.utm_source,
      first_touch_utm_medium: attribution.firstTouch.utm_medium,
      first_touch_utm_campaign: attribution.firstTouch.utm_campaign,
      first_touch_utm_content: attribution.firstTouch.utm_content,
    },
  };
}

function readCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name && value) {
      cookies.set(name, value);
    }
  }
  return cookies;
}

function sanitizeValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 160);
    return decoded || null;
  } catch {
    return null;
  }
}
