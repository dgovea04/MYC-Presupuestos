import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import type { CSSProperties, ReactNode } from "react";
import { APP_VIEW_MODE_STORAGE_KEY } from "@/lib/budget/view-mode";
import {
  getSidebarWidthCssValue,
  isSidebarMode,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_MINI_WIDTH,
  SIDEBAR_MODE_COOKIE_NAME,
  SIDEBAR_MODE_STORAGE_KEY,
  SIDEBAR_WIDTH_CSS_VARIABLE,
} from "@/lib/layout/sidebar-mode";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MYC Presupuestos",
  description: "MVP SaaS de presupuestos de obra con metodología APU para Perú",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialSidebarMode = cookieStore.get(SIDEBAR_MODE_COOKIE_NAME)?.value;
  const htmlStyle = {
    [SIDEBAR_WIDTH_CSS_VARIABLE]: getSidebarWidthCssValue(isSidebarMode(initialSidebarMode) ? initialSidebarMode : "expanded"),
  } as CSSProperties;
  const appPreferencesBootstrapScript = `try{var mode=window.localStorage.getItem(${JSON.stringify(APP_VIEW_MODE_STORAGE_KEY)});if(mode==='excel'||mode==='modern'){document.documentElement.dataset.viewMode=mode;}var sidebarMode=window.localStorage.getItem(${JSON.stringify(SIDEBAR_MODE_STORAGE_KEY)});if(sidebarMode==='mini'||sidebarMode==='expanded'){document.documentElement.style.setProperty('--app-sidebar-initial-width',sidebarMode==='mini'?'${SIDEBAR_MINI_WIDTH}px':'${SIDEBAR_EXPANDED_WIDTH}px');}}catch{}`;

  return (
    <html
      lang="es"
      className={`${inter.variable} ${plusJakartaSans.variable} h-full antialiased`}
      style={htmlStyle}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <Script id="app-preferences-bootstrap" strategy="beforeInteractive">
          {appPreferencesBootstrapScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
