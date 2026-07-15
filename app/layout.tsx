import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { GlobalAiAssistantProvider } from "@/components/ai/global-ai-assistant-provider";
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

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MC Presupuestos",
  description: "Plataforma moderna de costos y presupuestos de obra para Peru",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
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
      className={`${inter.variable} ${plusJakartaSans.variable} h-full antialiased`}
      data-theme={initialTheme}
      data-view-mode={initialViewMode}
      style={htmlStyle}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" data-theme={initialTheme} suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var w=localStorage.getItem('myc-khipu-agent-chat-panel-width');if(w){document.documentElement.style.setProperty('--chat-width',w+'px');}})()`,
          }}
        />
        <GlobalAiAssistantProvider>{children}</GlobalAiAssistantProvider>
      </body>
    </html>
  );
}
