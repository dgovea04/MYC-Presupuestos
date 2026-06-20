import type { Metadata } from "next";
import { KhipuHero } from "@/components/khipu-landing/KhipuHero";
import { KhipuFeatureGrid } from "@/components/khipu-landing/KhipuFeatureGrid";
import { KhipuWorkflow } from "@/components/khipu-landing/KhipuWorkflow";
import { KhipuUseCases } from "@/components/khipu-landing/KhipuUseCases";
import { KhipuChatPreview } from "@/components/khipu-landing/KhipuChatPreview";
import { KhipuTrustSection } from "@/components/khipu-landing/KhipuTrustSection";
import { KhipuCTA } from "@/components/khipu-landing/KhipuCTA";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";

export const metadata: Metadata = {
  title: "Khipu IA | Asistente técnico para presupuestos de construcción",
  description:
    "Khipu es el asistente IA de MC Presupuestos. Analiza presupuestos, APU, metrados y catálogos para ayudarte a detectar inconsistencias, comparar alternativas y tomar mejores decisiones técnicas.",
  openGraph: {
    title: "Khipu IA | Asistente técnico para presupuestos de construcción",
    description:
      "Khipu conecta datos, entiende tus proyectos y te ayuda a construir mejores decisiones. IA local revisable dentro de MC Presupuestos.",
    siteName: "MC Presupuestos",
    locale: "es_PE",
    type: "website",
  },
};

export default function KhipuLandingPage() {
  return (
    <main className="min-h-screen bg-khipu-bg text-slate-950">
      <LandingNavbar />
      <KhipuHero />
      <KhipuFeatureGrid />
      <KhipuWorkflow />
      <KhipuChatPreview />
      <KhipuUseCases />
      <KhipuTrustSection />
      <KhipuCTA />
      <LandingFooter />
    </main>
  );
}
