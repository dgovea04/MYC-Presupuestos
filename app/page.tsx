import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TrackLandingView } from "@/components/analytics/track-landing-view";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { ComparisonSection } from "@/components/landing/comparison-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FinalCTASection } from "@/components/landing/final-cta-section";
import { HeroSection } from "@/components/landing/hero-section";
import { KhipuIASection } from "@/components/landing/khipu-ia-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LegacyPainSection } from "@/components/landing/legacy-pain-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { ProductPreviewSection } from "@/components/landing/product-preview-section";
import { SmartFlowsSection } from "@/components/landing/smart-flows-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { WorkspaceSection } from "@/components/landing/workspace-section";
import { getAuthSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "MC Presupuestos | Plataforma moderna de costos y presupuestos de obra",
  description:
    "MC Presupuestos conecta presupuesto, APU, metrados, fórmula polinómica, cronograma, exportables, workspace y Khipu IA en un flujo técnico moderno.",
  openGraph: {
    title: "MC Presupuestos | Plataforma moderna de costos y presupuestos de obra",
    description:
      "Presupuestos, APU, workspace, cronograma, exportables y Khipu IA integrados para oficinas técnicas y constructoras.",
    siteName: "MC Presupuestos",
    locale: "es_PE",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default async function Home() {
  const session = await getAuthSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <TrackLandingView path="/" />
      <LandingNavbar />
      <HeroSection />
      <LegacyPainSection />
      <FeaturesSection />
      <KhipuIASection />
      <ProductPreviewSection />
      <WorkspaceSection />
      <SmartFlowsSection />
      <ComparisonSection />
      <BenefitsSection />
      <TestimonialsSection />
      <FaqSection />
      <PricingSection />
      <FinalCTASection />
      <LandingFooter />
    </main>
  );
}
