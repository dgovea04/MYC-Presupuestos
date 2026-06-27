import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import type { CSSProperties, ReactNode } from "react";
import { GlobalAiAssistantProvider } from "@/components/ai/global-ai-assistant-provider";
import {
  getSidebarWidthCssValue,
  isSidebarMode,
  SIDEBAR_MODE_COOKIE_NAME,
  SIDEBAR_WIDTH_CSS_VARIABLE,
} from "@/lib/layout/sidebar-mode";
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
  title: "MYC Presupuestos",
  description: "Plataforma moderna de costos y presupuestos de obra para Peru",
};

const APP_PREFERENCES_BOOTSTRAP = `
try {
  var theme = window.localStorage.getItem("myc:app-theme");
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
    document.cookie = "myc_app_theme=" + theme + "; path=/; max-age=31536000; samesite=lax";
  }

  if (document.body && (theme === "light" || theme === "dark")) {
    document.body.dataset.theme = theme;
  }

  var isLandingPage = window.location.pathname === "/" || window.location.pathname === "/landing-v2";
  var mode = window.localStorage.getItem("app_view_mode");

  if (isLandingPage) {
    delete document.documentElement.dataset.viewMode;
  } else if (mode === "excel" || mode === "modern") {
    document.documentElement.dataset.viewMode = mode;
    document.cookie = "app_view_mode=" + mode + "; path=/; max-age=31536000; samesite=lax";
  }

  var sidebarMode = window.localStorage.getItem("myc:sidebar-mode");

  if (sidebarMode === "mini" || sidebarMode === "expanded") {
    document.documentElement.style.setProperty(
      "--app-sidebar-initial-width",
      sidebarMode === "mini" ? "80px" : "280px",
    );
  }
} catch {}
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const storedSidebarModeCookie = cookieStore.get(SIDEBAR_MODE_COOKIE_NAME)?.value;
  const initialSidebarMode = isSidebarMode(storedSidebarModeCookie) ? storedSidebarModeCookie : "expanded";
  const htmlStyle = {
    [SIDEBAR_WIDTH_CSS_VARIABLE]: getSidebarWidthCssValue(initialSidebarMode),
  } as CSSProperties;

  return (
    <html
      lang="es"
      className={`${inter.variable} ${plusJakartaSans.variable} h-full antialiased`}
      data-theme={DEFAULT_APP_THEME}
      style={htmlStyle}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" data-theme={DEFAULT_APP_THEME} suppressHydrationWarning>
        <Script id="app-preferences-bootstrap" strategy="beforeInteractive">
          {APP_PREFERENCES_BOOTSTRAP}
        </Script>
        <GlobalAiAssistantProvider>{children}</GlobalAiAssistantProvider>
      </body>
    </html>
  );
}
