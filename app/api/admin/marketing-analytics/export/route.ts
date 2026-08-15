import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";
import {
  formatAdminMarketingDateInput,
  getAdminMarketingAnalytics,
  normalizeAdminMarketingDateRange,
} from "@/lib/data/admin-marketing-analytics";

export async function GET(request: Request) {
  const session = await requireAdminSession("users.read");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit({
    key: `admin-marketing-export:${session.user.id}:${getRequestClientIp(request)}`,
    maxAttempts: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas exportaciones. Intenta nuevamente más tarde." },
      { status: 429, headers: getRateLimitHeaders(rateLimit) },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const range = normalizeAdminMarketingDateRange(searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined);
  const analytics = await getAdminMarketingAnalytics(range);

  if (!analytics.available) {
    return NextResponse.json({ error: "Marketing Analytics no está disponible." }, { status: 503 });
  }

  const csv = buildMarketingAnalyticsCsv(analytics);
  const dateFrom = formatAdminMarketingDateInput(range.from);
  const dateTo = formatAdminMarketingDateInput(new Date(range.to.getTime() - 24 * 60 * 60 * 1000));

  return new NextResponse(`\uFEFF${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mc-presupuestos-marketing-${dateFrom}-${dateTo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildMarketingAnalyticsCsv(analytics: Awaited<ReturnType<typeof getAdminMarketingAnalytics>>) {
  const rows: string[][] = [
    ["Sección", "Métrica", "Valor"],
    ["Funnel", "Visitantes", String(analytics.metrics.visitors)],
    ["Funnel", "Signup", String(analytics.metrics.signups)],
    ["Funnel", "Activated", String(analytics.metrics.activated)],
    ["Funnel", "WAU", String(analytics.metrics.wau)],
    ["Funnel", "WAB", String(analytics.metrics.wab)],
    ["Funnel", "Pro activos", String(analytics.metrics.pro)],
    ["Funnel", "Pro nuevos", String(analytics.metrics.newPro)],
    ["Funnel", "Tasa visitante a signup", `${analytics.rates.signupRate}%`],
    ["Funnel", "Tasa signup a activación", `${analytics.rates.activationRate}%`],
    ["Funnel", "Tasa activación a Pro", `${analytics.rates.proRate}%`],
    ["Funnel", "Upgrade clicked", String(analytics.metrics.upgradeClicked)],
    ["Funnel", "Checkout started", String(analytics.metrics.checkoutStarted)],
    ["Funnel", "Suscripciones creadas", String(analytics.metrics.subscriptionCreated)],
    [],
    ["Aha moment", "Primera acción", "Usuarios", "Signup a activación", "Participación"],
    ...analytics.ahaMoments.map((entry) => [
      "Aha moment",
      entry.eventName,
      String(entry.users),
      `${entry.activationRate}%`,
      `${entry.shareOfActivated}%`,
    ]),
    [],
    ["UTM", "Fuente", "Medio", "Campaña", "Contenido", "Signup", "Activados"],
    ...analytics.byUtm.map((entry) => [
      "UTM",
      entry.source,
      entry.medium,
      entry.campaign,
      entry.content,
      String(entry.signups),
      String(entry.activated),
    ]),
    [],
    ["Cohorte", "Semana", "Signup", "Activated", "Tasa activación", "W1", "W4", "W8"],
    ...analytics.cohorts.map((cohort) => [
      "Cohorte",
      cohort.week,
      String(cohort.signups),
      String(cohort.activated),
      `${cohort.activationRate}%`,
      formatRetention(cohort.w1),
      formatRetention(cohort.w4),
      formatRetention(cohort.w8),
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

function formatRetention(value: { users: number | null; rate: number | null }) {
  return value.users === null || value.rate === null ? "" : `${value.users} (${value.rate}%)`;
}

function escapeCsvValue(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
