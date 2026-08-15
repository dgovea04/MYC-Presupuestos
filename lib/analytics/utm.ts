import type { AnalyticsPrimitive } from "@/lib/analytics/gtag";

export const ATTRIBUTION_COOKIE_NAME = "mc-attribution";
export const ANALYTICS_CLIENT_ID_COOKIE = "mc-analytics-client-id";
export const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
type UtmKey = (typeof UTM_KEYS)[number];

type UtmValues = Partial<Record<UtmKey, string>>;

export type Attribution = {
  firstTouch: UtmValues;
  lastTouch: UtmValues;
};

const MAX_UTM_VALUE_LENGTH = 160;

export function parseUtmParams(searchParams: URLSearchParams): UtmValues {
  const values: UtmValues = {};

  for (const key of UTM_KEYS) {
    const value = sanitizeUtmValue(searchParams.get(key));
    if (value) {
      values[key] = value;
    }
  }

  return values;
}

export function mergeAttribution(existing: Attribution | null, incoming: UtmValues): Attribution | null {
  if (Object.keys(incoming).length === 0) {
    return existing;
  }

  return {
    firstTouch: existing?.firstTouch ?? incoming,
    lastTouch: incoming,
  };
}

export function readAttribution(): Attribution | null {
  if (typeof document === "undefined") {
    return null;
  }

  const rawValue = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ATTRIBUTION_COOKIE_NAME}=`))
    ?.slice(ATTRIBUTION_COOKIE_NAME.length + 1);

  if (!rawValue) {
    return null;
  }

  return parseAttributionCookie(rawValue);
}

export function parseAttributionCookie(rawValue: string): Attribution | null {
  try {
    return normalizeAttribution(JSON.parse(decodeURIComponent(rawValue)) as unknown);
  } catch {
    return null;
  }
}

export function captureUtmAttribution(searchParams?: URLSearchParams): Attribution | null {
  if (typeof window === "undefined") {
    return null;
  }

  const nextAttribution = mergeAttribution(
    readAttribution(),
    parseUtmParams(searchParams ?? new URLSearchParams(window.location.search)),
  );
  if (!nextAttribution) {
    return null;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(nextAttribution))}; Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  return nextAttribution;
}

export function getAttributionEventParams(): Record<string, AnalyticsPrimitive> {
  const attribution = readAttribution();
  if (!attribution) {
    return {};
  }

  return {
    utm_source: attribution.lastTouch.utm_source,
    utm_medium: attribution.lastTouch.utm_medium,
    utm_campaign: attribution.lastTouch.utm_campaign,
    utm_content: attribution.lastTouch.utm_content,
    first_touch_utm_source: attribution.firstTouch.utm_source,
    first_touch_utm_medium: attribution.firstTouch.utm_medium,
    first_touch_utm_campaign: attribution.firstTouch.utm_campaign,
    first_touch_utm_content: attribution.firstTouch.utm_content,
  };
}

function sanitizeUtmValue(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_UTM_VALUE_LENGTH);
  return sanitized || undefined;
}

export function normalizeAttribution(value: unknown): Attribution | null {
  if (!isRecord(value)) {
    return null;
  }

  const firstTouch = normalizeUtmValues(value.firstTouch);
  const lastTouch = normalizeUtmValues(value.lastTouch);

  if (!firstTouch || !lastTouch) {
    return null;
  }

  return { firstTouch, lastTouch };
}

function normalizeUtmValues(value: unknown): UtmValues | null {
  if (!isRecord(value)) {
    return null;
  }

  const normalized: UtmValues = {};
  for (const key of UTM_KEYS) {
    const item = value[key];
    if (typeof item === "string") {
      const sanitized = sanitizeUtmValue(item);
      if (sanitized) {
        normalized[key] = sanitized;
      }
    }
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
