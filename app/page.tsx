import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { ComparisonSection } from "@/components/landing/comparison-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FinalCTASection } from "@/components/landing/final-cta-section";
import { HeroSection } from "@/components/landing/hero-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { PricingSection } from "@/components/landing/pricing-section";
import { ProductPreviewSection } from "@/components/landing/product-preview-section";
import { SmartFlowsSection } from "@/components/landing/smart-flows-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { getAuthSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "MYC Presupuestos | Plataforma moderna de costos y presupuestos de obra",
  description:
    "Crea presupuestos, APU, cronogramas y reportes profesionales para construcción en Perú. IA local revisable, fórmula polinómica y exportaciones PDF/Excel/ZIP.",
  openGraph: {
    title: "MYC Presupuestos | Costos y presupuestos de obra modernos",
    description:
      "Presupuestos, APU, cronogramas y reportes profesionales conectados en una sola plataforma para ingenieros y oficinas técnicas.",
    siteName: "MYC Presupuestos",
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
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
      <SmartFlowsSection />
      <ProductPreviewSection />
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
