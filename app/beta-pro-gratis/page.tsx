import type { Metadata } from "next";
import { TrackLandingView } from "@/components/analytics/track-landing-view";
import { BetaFreeLandingPage } from "@/components/landing/beta/beta-free-landing-page";

export const metadata: Metadata = {
  title: "Pro gratis por 60 días | MC Presupuestos",
  description: "Prueba MC Presupuestos Pro gratis durante 60 días con tu próximo presupuesto de obra. Sin tarjeta y sin cobro automático.",
  alternates: { canonical: "/beta-pro-gratis" },
  openGraph: {
    title: "Usa Pro gratis durante 60 días",
    description: "Únete a la cohorte fundadora de MC Presupuestos y prueba presupuesto, APU, metrados y fórmula polinómica con trabajo real.",
    url: "/beta-pro-gratis",
    siteName: "MC Presupuestos",
    locale: "es_PE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pro gratis por 60 días | MC Presupuestos",
    description: "Prueba el flujo técnico de MC Presupuestos sin tarjeta ni cobro automático.",
  },
};

export default function BetaFreePage() {
  return (
    <>
      <TrackLandingView path="/beta-pro-gratis" variant="beta-free-v1" />
      <BetaFreeLandingPage />
    </>
  );
}
