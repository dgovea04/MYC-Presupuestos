/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
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

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

afterEach(async () => {
  if (!activeContainer) {
    return;
  }

  const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;

  if (root) {
    await act(async () => {
      root.unmount();
    });
  }

  activeContainer.remove();
  activeContainer = null;
});

describe("MYC landing page sections", () => {
  it("renders HeroSection with headline, CTAs, trust signals, and social proof badges", async () => {
    const container = await renderNode(<HeroSection />);

    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toContain("Presupuesta obras con más control");

    expect(container.textContent).toContain("Crear cuenta gratis");
    expect(container.textContent).toContain("Ver plataforma");
    expect(container.textContent).toContain("IA local revisable");
    expect(container.textContent).toContain("Cronograma valorizado");
    expect(container.textContent).toContain("Exportes PDF / Excel / ZIP");
    expect(container.textContent).toContain("Diseñado para oficinas técnicas");
    expect(container.textContent).toContain("Compatible con flujo Excel");
    expect(container.textContent).toContain("Pensado para presupuestos en Perú");

    // Uses shared landing-shell
    const shell = container.querySelector(".landing-shell");
    expect(shell).not.toBeNull();
  });

  it("renders FeaturesSection with 6 feature cards and shared elevated surfaces", async () => {
    const container = await renderNode(<FeaturesSection />);

    const section = container.querySelector("#features");
    expect(section?.className).toContain("landing-section");
    expect(section?.className).toContain("landing-shell");

    const cards = section?.querySelectorAll(".landing-surface-elevated");
    expect(cards?.length).toBe(6);

    expect(container.textContent).toContain("Presupuesto y APU conectado");
    expect(container.textContent).toContain("Reutiliza insumos y partidas sin duplicar información");
    expect(container.textContent).toContain("Generador de partidas por similitud");
    expect(container.textContent).toContain("IA local para revisión y APU");
    expect(container.textContent).toContain("Convierte tu presupuesto en cronograma valorizado");
    expect(container.textContent).toContain("Entrega reportes listos para cliente, obra o licitación");
  });

  it("renders SmartFlowsSection with 3 flow cards and step chains", async () => {
    const container = await renderNode(<SmartFlowsSection />);

    const section = container.querySelector("#flows");
    expect(section?.className).toContain("landing-section-tight");

    const cards = section?.querySelectorAll(".landing-surface-elevated");
    expect(cards?.length).toBe(3);

    expect(container.textContent).toContain("De partida nueva a APU sugerido");
    expect(container.textContent).toContain("De presupuesto a cronograma valorizado");
    expect(container.textContent).toContain("De revisión técnica a pendientes");
  });

  it("renders ProductPreviewSection with table, notes sidebar, and export formats", async () => {
    const container = await renderNode(<ProductPreviewSection />);

    const section = container.querySelector("#preview");
    expect(section?.className).toContain("landing-section");

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(container.textContent).toContain("Presupuesto de estructuras");
    expect(container.textContent).toContain("Trazo, niveles y replanteo");
    expect(container.textContent).toContain("Concreto f'c=210 kg/cm2");
    expect(container.textContent).toContain("S/ 78,524.85");
    expect(container.textContent).toContain("PDF");
    expect(container.textContent).toContain("Excel");
    expect(container.textContent).toContain("CSV");
    expect(container.textContent).toContain("ZIP");
  });

  it("renders ComparisonSection with comparison table and status indicators", async () => {
    const container = await renderNode(<ComparisonSection />);

    const section = container.querySelector("#comparison");
    expect(section?.className).toContain("landing-section");

    const table = section?.querySelector('[role="table"]');
    expect(table).not.toBeNull();
    expect(container.textContent).toContain("Comparativo de experiencia operativa");
    expect(container.textContent).toContain("Estructura de presupuestos jerárquica");
    expect(container.textContent).toContain("Fórmula polinómica integrada");
    expect(container.textContent).toContain("MYC Presupuestos");

    // Uses shared landing chips
    const chips = container.querySelectorAll(".landing-chip");
    expect(chips.length).toBe(3);
  });

  it("renders BenefitsSection with 4 benefit cards on contrast surface", async () => {
    const container = await renderNode(<BenefitsSection />);

    const section = container.querySelector("section");
    expect(section?.className).toContain("landing-section-contrast");

    const cards = container.querySelectorAll(".landing-surface-contrast");
    expect(cards.length).toBeGreaterThanOrEqual(4);

    expect(container.textContent).toContain("Menos saltos entre hojas");
    expect(container.textContent).toContain("Automatización revisable");
    expect(container.textContent).toContain("Entregables listos para obra");
    expect(container.textContent).toContain("Control técnico para crecer");
  });

  it("renders TestimonialsSection with 3 testimonials and star ratings", async () => {
    const container = await renderNode(<TestimonialsSection />);

    const cards = container.querySelectorAll(".landing-surface-elevated");
    expect(cards.length).toBeGreaterThanOrEqual(3);

    expect(container.textContent).toContain("Ing. Carlos Paredes");
    expect(container.textContent).toContain("Arq. Daniela Salazar");
    expect(container.textContent).toContain("Luis Huamán");
  });

  it("renders FaqSection with category filters and expandable questions", async () => {
    const container = await renderNode(<FaqSection />);

    const section = container.querySelector("#faq");
    expect(section?.className).toContain("landing-section");

    // 3 category filter buttons
    const buttons = section?.querySelectorAll("button");
    expect(buttons?.length).toBeGreaterThanOrEqual(3);

    expect(container.textContent).toContain("Generales");
    expect(container.textContent).toContain("Planes y precios");
    expect(container.textContent).toContain("Técnicas");

    // First question is visible
    expect(container.textContent).toContain("¿Qué norma peruana usan para la fórmula polinómica?");
  });

  it("renders PricingSection with 3 plan cards including highlighted Pro tier", async () => {
    const container = await renderNode(<PricingSection />);

    const section = container.querySelector("#pricing");
    expect(section?.className).toContain("scroll-mt-28");

    const elevatedCards = section?.querySelectorAll(".landing-surface-elevated");
    expect(elevatedCards?.length).toBe(2);

    const contrastCard = section?.querySelector(".landing-surface-contrast");
    expect(contrastCard).not.toBeNull();
    expect(contrastCard?.textContent).toContain("Pro");

    expect(container.textContent).toContain("Starter");
    expect(container.textContent).toContain("Pro");
    expect(container.textContent).toContain("Empresa");
    expect(container.textContent).toContain("Elegir Pro");
    expect(container.textContent).toContain("Khipu con IA local");
  });

  it("renders FinalCTASection with contrast surface and CTAs", async () => {
    const container = await renderNode(<FinalCTASection />);

    const section = container.querySelector("section");
    expect(section?.className).toContain("landing-section-tight");

    const contrast = section?.querySelector(".landing-surface-contrast");
    expect(contrast).not.toBeNull();

    expect(container.textContent).toContain("Crear cuenta gratis");
    expect(container.textContent).toContain("Solicitar demostración");
  });

  it("renders all MYC landing sections together with shared primitives", async () => {
    const container = await renderNode(
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
      </main>,
    );

    // Section count (including nested sections in ProductPreview)
    const sections = container.querySelectorAll("section");
    expect(sections.length).toBeGreaterThanOrEqual(9);

    // Shared elevated surfaces
    const elevatedSurfaces = container.querySelectorAll(".landing-surface-elevated");
    expect(elevatedSurfaces.length).toBeGreaterThanOrEqual(15);

    // Shared contrast surfaces
    const contrastSurfaces = container.querySelectorAll(".landing-surface-contrast");
    expect(contrastSurfaces.length).toBeGreaterThanOrEqual(5);

    // Shared landing chips
    const chips = container.querySelectorAll(".landing-chip");
    expect(chips.length).toBeGreaterThanOrEqual(3);

    // Key landmark texts from each section
    expect(container.textContent).toContain("Presupuesta obras con más control");
    expect(container.textContent).toContain("Presupuesto y APU conectado");
    expect(container.textContent).toContain("De partida nueva a APU sugerido");
    expect(container.textContent).toContain("Presupuesto de estructuras");
    expect(container.textContent).toContain("Comparativo de experiencia operativa");
    expect(container.textContent).toContain("Menos saltos entre hojas");
    expect(container.textContent).toContain("Ing. Carlos Paredes");
    expect(container.textContent).toContain("¿Qué norma peruana usan para la fórmula polinómica?");
    expect(container.textContent).toContain("Starter");
    expect(container.textContent).toContain("Crear cuenta gratis");

    // Navbar and footer present
    expect(container.textContent).toContain("MYC Presupuestos");
  });
});

async function renderNode(node: React.ReactNode) {
  activeContainer = document.createElement("div");
  document.body.appendChild(activeContainer);

  const root = createRoot(activeContainer);
  (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(node);
  });

  return activeContainer;
}
