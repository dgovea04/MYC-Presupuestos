import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import type { CSSProperties, ReactNode } from "react";
import {
  getSidebarWidthCssValue,
  isSidebarMode,
  SIDEBAR_MODE_COOKIE_NAME,
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
  description: "Plataforma moderna de costos y presupuestos de obra para Peru",
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

  return (
    <html
      lang="es"
      className={`${inter.variable} ${plusJakartaSans.variable} h-full antialiased`}
      style={htmlStyle}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        {children}
        <Script id="app-preferences-bootstrap" src="/app-preferences-bootstrap.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
