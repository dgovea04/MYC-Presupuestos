import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { IdentifyAnalyticsUser } from "@/components/analytics/identify-user";
import type { CSSProperties, ReactNode } from "react";
import { GlobalAiAssistantProvider } from "@/components/ai/global-ai-assistant-provider";
import { getAuthSession } from "@/lib/auth/session";
import { isExternalAnalyticsEnabled } from "@/lib/analytics/environment";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { touchWorkspaceMembershipActivity } from "@/lib/workspace/activity";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";
import { APP_VIEW_MODE_COOKIE_NAME, coerceViewMode } from "@/lib/budget/view-mode";
import {
  getSidebarWidthCssValue,
  isSidebarMode,
  SIDEBAR_MODE_COOKIE_NAME,
  SIDEBAR_WIDTH_CSS_VARIABLE,
} from "@/lib/layout/sidebar-mode";
import { APP_THEME_COOKIE_NAME, isAppThemeOption } from "@/lib/theme/app-theme";
import {
  DEFAULT_WORK_SCHEDULE_TIMELINE_PANEL_WIDTH,
  getWorkScheduleTimelinePanelWidthCssValue,
  parseWorkScheduleTimelinePanelWidth,
  WORK_SCHEDULE_TIMELINE_PANEL_WIDTH_COOKIE_NAME,
} from "@/lib/work-schedule/overview-panel-width";
import { DEFAULT_APP_THEME } from "@/types/settings";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  title: "MC Presupuestos",
  description: "Plataforma moderna de costos y presupuestos de obra para Peru",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const [cookieStore, session] = await Promise.all([cookies(), getAuthSession()]);
  const activeWorkspaceId = session?.user?.id ? await getActiveWorkspaceId(session.user.id) : null;
  if (session?.user?.id && activeWorkspaceId) {
    await touchWorkspaceMembershipActivity({ userId: session.user.id, companyId: activeWorkspaceId }).catch(() => undefined);
  }
  const license = session?.user?.id
    ? await getEffectiveWorkspaceLicense({ userId: session.user.id, companyId: activeWorkspaceId })
    : null;
  const canUseKhipu = hasFeatureAccess(license, "khipu.agent");
  const storedThemeCookie = cookieStore.get(APP_THEME_COOKIE_NAME)?.value;
  const storedViewModeCookie = cookieStore.get(APP_VIEW_MODE_COOKIE_NAME)?.value;
  const storedSidebarModeCookie = cookieStore.get(SIDEBAR_MODE_COOKIE_NAME)?.value;
  const initialTheme = isAppThemeOption(storedThemeCookie) ? storedThemeCookie : DEFAULT_APP_THEME;
  const initialViewMode =
    storedViewModeCookie === "excel" || storedViewModeCookie === "modern"
      ? coerceViewMode(storedViewModeCookie)
      : undefined;
  const initialSidebarMode = isSidebarMode(storedSidebarModeCookie) ? storedSidebarModeCookie : "expanded";
  const storedWorkScheduleTimelinePanelWidthCookie = cookieStore.get(WORK_SCHEDULE_TIMELINE_PANEL_WIDTH_COOKIE_NAME)?.value;
  const initialWorkScheduleTimelinePanelWidth =
    parseWorkScheduleTimelinePanelWidth(storedWorkScheduleTimelinePanelWidthCookie) ?? DEFAULT_WORK_SCHEDULE_TIMELINE_PANEL_WIDTH;
  const htmlStyle = {
    [SIDEBAR_WIDTH_CSS_VARIABLE]: getSidebarWidthCssValue(initialSidebarMode),
    "--work-schedule-timeline-panel-width": getWorkScheduleTimelinePanelWidthCssValue(initialWorkScheduleTimelinePanelWidth),
  } as CSSProperties;

  return (
    <html
      lang="es"
      className="h-full antialiased"
      data-theme={initialTheme}
      data-view-mode={initialViewMode}
      style={htmlStyle}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" data-theme={initialTheme} suppressHydrationWarning>
        <GoogleAnalytics
          measurementId={isExternalAnalyticsEnabled() ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID : undefined}
          isAuthenticated={Boolean(session?.user?.id)}
        />
        <IdentifyAnalyticsUser userId={session?.user?.id ?? null} />
        <Script id="chat-panel-width-init" strategy="beforeInteractive">
          {`(function(){var w=localStorage.getItem('myc-khipu-agent-chat-panel-width');if(w){document.documentElement.style.setProperty('--chat-width',w+'px');}})()`}
        </Script>
        <GlobalAiAssistantProvider canUseKhipu={canUseKhipu}>{children}</GlobalAiAssistantProvider>
      </body>
    </html>
  );
}
