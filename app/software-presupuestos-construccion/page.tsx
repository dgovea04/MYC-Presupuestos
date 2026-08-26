import type { Metadata } from "next";
import { TrackLandingView } from "@/components/analytics/track-landing-view";
import { AcquisitionNavbar } from "@/components/landing/acquisition/acquisition-navbar";
import { AcquisitionHeroSection } from "@/components/landing/acquisition/acquisition-hero-section";
import { ExcelWorkflowSection } from "@/components/landing/acquisition/excel-workflow-section";
import { ConnectedApuSection } from "@/components/landing/acquisition/connected-apu-section";
import { TakeoffsSection } from "@/components/landing/acquisition/takeoffs-section";
import { PolynomialFormulaSection } from "@/components/landing/acquisition/polynomial-formula-section";
import { ImportMigrationSection } from "@/components/landing/acquisition/import-migration-section";
import { KhipuSupportSection } from "@/components/landing/acquisition/khipu-support-section";
import { AcquisitionOffersSection } from "@/components/landing/acquisition/acquisition-offers-section";
import { DemoSection } from "@/components/landing/acquisition/demo-section";
import { PilotApplicationSection } from "@/components/landing/acquisition/pilot-application-section";
import { ScheduleSection } from "@/components/landing/acquisition/schedule-section";
import { AcquisitionFinalCtaSection } from "@/components/landing/acquisition/acquisition-final-cta-section";

export const metadata: Metadata = {
  title: "Presupuestos de obra gratis | MC Presupuestos",
  description: "Crea tu primer presupuesto de obra gratis con partidas, metrados, APU, fórmula polinómica y cronograma en un flujo simple.",
  alternates: { canonical: "/software-presupuestos-construccion" },
  openGraph: {
    title: "Crea tu primer presupuesto de obra gratis",
    description: "Presupuesto, metrados, APU, fórmula polinómica y cronograma en un flujo simple.",
    url: "/software-presupuestos-construccion",
    siteName: "MC Presupuestos",
    locale: "es_PE",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Presupuestos de obra gratis | MC Presupuestos", description: "Crea tu primer presupuesto con partidas, metrados, APU, fórmula polinómica y cronograma." },
};

export default function ConstructionBudgetingLanding() {
  return <main className="min-h-screen bg-white text-slate-950"><TrackLandingView path="/software-presupuestos-construccion" variant="acquisition-v1" /><AcquisitionNavbar /><AcquisitionHeroSection /><ExcelWorkflowSection /><ConnectedApuSection /><TakeoffsSection /><PolynomialFormulaSection /><ScheduleSection /><ImportMigrationSection /><KhipuSupportSection /><AcquisitionOffersSection /><DemoSection /><PilotApplicationSection /><AcquisitionFinalCtaSection /><footer className="border-t border-slate-200 bg-white py-8"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><span>© {new Date().getFullYear()} MC Presupuestos</span><span>Plataforma moderna de costos y presupuestos de obra.</span></div></footer></main>;
}
