import type { Metadata } from "next";
import { LandingV2Hero } from "@/components/landing-v2/landing-v2-hero";
import { LandingV2Navbar } from "@/components/landing-v2/landing-v2-navbar";
import {
  LandingV2BenefitsSection,
  LandingV2ComparisonSection,
  LandingV2FeaturesSection,
  LandingV2FinalCtaSection,
  LandingV2Footer,
  LandingV2PricingSection,
  LandingV2ProductPreviewSection,
  LandingV2TestimonialsSection,
  LandingV2WorkflowSection,
} from "@/components/landing-v2/landing-v2-sections";

export const metadata: Metadata = {
  title: "MYC Presupuestos | Landing v2",
  description: "Landing alternativa para A/B testing de MYC Presupuestos.",
};

export default function LandingV2Page() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0f0f0f] text-white">
      <LandingV2Navbar />
      <LandingV2Hero />
      <LandingV2FeaturesSection />
      <LandingV2ProductPreviewSection />
      <LandingV2WorkflowSection />
      <LandingV2ComparisonSection />
      <LandingV2BenefitsSection />
      <LandingV2TestimonialsSection />
      <LandingV2PricingSection />
      <LandingV2FinalCtaSection />
      <LandingV2Footer />
    </main>
  );
}
