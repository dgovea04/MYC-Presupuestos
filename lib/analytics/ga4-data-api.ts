import { createSign } from "node:crypto";
import type { AdminMarketingDateRange } from "@/lib/data/admin-marketing-analytics";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REPORT_ENDPOINT = "https://analyticsdata.googleapis.com/v1beta";
const READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

const REPORT_EVENT_NAMES = [
  "landing_view",
  "signup_completed",
  "project_created",
  "budget_created",
  "budget_imported",
  "excel_paste_used",
  "apu_created",
  "formula_created",
  "khipu_used",
  "export_completed",
  "upgrade_clicked",
  "checkout_started",
  "subscription_created",
] as const;

export type Ga4MarketingReport =
  | {
      available: true;
      activeUsers: number;
      events: Array<{ name: string; count: number; users: number }>;
    }
  | {
      available: false;
      reason: string;
    };

export async function getGa4MarketingReport(range: AdminMarketingDateRange): Promise<Ga4MarketingReport> {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const serviceAccountEmail = process.env.GA4_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!propertyId || !serviceAccountEmail || !privateKey) {
    return {
      available: false,
      reason: "Configura GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_EMAIL y GA4_SERVICE_ACCOUNT_PRIVATE_KEY.",
    };
  }

  if (!/^\d+$/.test(propertyId)) {
    return { available: false, reason: "GA4_PROPERTY_ID debe ser el Property ID numérico de GA4." };
  }

  try {
    const accessToken = await requestAccessToken({ serviceAccountEmail, privateKey });
    const dateRange = {
      startDate: formatDate(range.from),
      endDate: formatDate(new Date(range.to.getTime() - 24 * 60 * 60 * 1000)),
    };
    const [eventReport, activeUsersReport] = await Promise.all([
      runReport(accessToken, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
        limit: "1000",
      }),
      runReport(accessToken, propertyId, {
        dateRanges: [dateRange],
        metrics: [{ name: "activeUsers" }],
      }),
    ]);

    const events = eventReport.rows
      .map((row) => ({
        name: readDimension(row, 0),
        count: readMetric(row, 0),
        users: readMetric(row, 1),
      }))
      .filter((event) => REPORT_EVENT_NAMES.includes(event.name as (typeof REPORT_EVENT_NAMES)[number]));

    return {
      available: true,
      activeUsers: readMetric(activeUsersReport.rows[0], 0),
      events,
    };
  } catch {
    return {
      available: false,
      reason: "GA4 Data API no disponible. Verifica permisos de la cuenta de servicio sobre la propiedad.",
    };
  }
}

type ReportResponse = {
  rows: ReportRow[];
};

type ReportRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

async function runReport(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>,
): Promise<ReportResponse> {
  const response = await fetch(`${REPORT_ENDPOINT}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GA4 Data API responded with ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data)) {
    throw new Error("GA4 Data API returned an invalid response.");
  }

  return {
    rows: Array.isArray(data.rows) ? data.rows.filter(isReportRow) : [],
  };
}

async function requestAccessToken(input: { serviceAccountEmail: string; privateKey: string }) {
  const now = Math.floor(Date.now() / 1000);
  const unsignedToken = `${encodeBase64Url({ alg: "RS256", typ: "JWT" })}.${encodeBase64Url({
    iss: input.serviceAccountEmail,
    scope: READONLY_SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(input.privateKey, "base64url");
  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google OAuth responded with ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data) || typeof data.access_token !== "string") {
    throw new Error("Google OAuth returned no access token.");
  }

  return data.access_token;
}

function encodeBase64Url(value: Record<string, string | number>) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function readDimension(row: ReportRow, index: number) {
  return row.dimensionValues?.[index]?.value ?? "";
}

function readMetric(row: ReportRow | undefined, index: number) {
  const value = Number(row?.metricValues?.[index]?.value ?? "0");
  return Number.isFinite(value) ? value : 0;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReportRow(value: unknown): value is ReportRow {
  return isRecord(value);
}
