/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { ComparisonSection } from "@/components/landing/comparison-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FinalCTASection } from "@/components/landing/final-cta-section";
import { HeroSection } from "@/components/landing/hero-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { ProductPreviewSection } from "@/components/landing/product-preview-section";
import { SmartFlowsSection } from "@/components/landing/smart-flows-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";

type RedirectError = Error & {
  digest: string;
};

const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    const error = new Error(`NEXT_REDIRECT:${path}`) as RedirectError;
    error.digest = `NEXT_REDIRECT;replace;${path}`;
    throw error;
  }),
}));

const authMocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: navigationMocks.redirect,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: authMocks.getAuthSession,
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

afterEach(async () => {
  if (activeContainer) {
    const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;

    if (root) {
      await act(async () => {
        root.unmount();
      });
    }

    activeContainer.remove();
    activeContainer = null;
  }

  authMocks.getAuthSession.mockReset();
  navigationMocks.redirect.mockClear();
});

describe("MC landing page sections", () => {
  it("renders FeaturesSection with 6 feature cards and shared elevated surfaces", async () => {
    const container = await renderNode(<FeaturesSection />);

    const section = container.querySelector("#features");
    expect(section?.className).toContain("landing-section");
    expect(section?.className).toContain("landing-shell");

    const cards = section?.querySelectorAll(".landing-surface-elevated");
    expect(cards?.length).toBe(6);

    expect(container.textContent).toContain("Diferenciales");
    expect(container.textContent).toContain("Una plataforma conectada rinde mejor que un flujo fragmentado.");
    expect(container.textContent).toContain("Presupuesto conectado");
    expect(container.textContent).toContain("APU con trazabilidad");
    expect(container.textContent).toContain("Formula y cronograma dentro del flujo");
    expect(container.textContent).toContain("Exportables listos para oficina tecnica");
    expect(container.textContent).toContain("Khipu IA con contexto visible");
    expect(container.textContent).toContain("Operacion preparada para crecer");
    expect(container.textContent).not.toContain("Presupuesto y APU conectado");
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

    const buttons = section?.querySelectorAll("button");
    expect(buttons?.length).toBeGreaterThanOrEqual(3);

    expect(container.textContent).toContain("Generales");
    expect(container.textContent).toContain("Planes y precios");
    expect(container.textContent).toContain("Técnicas");
    expect(container.textContent).toContain("¿Qué norma peruana usan para la fórmula polinómica?");
    expect(container.textContent).toContain("Abrir formulario");
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

    expect(container.textContent).toContain("MC Presupuestos conecta la operacion. Khipu IA acelera la revision.");
    expect(container.textContent).toContain(
      "Moderniza la forma en que tu oficina tecnica prepara, revisa y entrega presupuestos de obra sin volver al flujo fragmentado.",
    );
    expect(container.textContent).toContain("Crear cuenta gratis");
    expect(container.textContent).toContain("Iniciar sesion");
  });

  it("redirects authenticated sessions before rendering the landing page", async () => {
    authMocks.getAuthSession.mockResolvedValue({ user: { email: "test@example.com" } });

    await expect(renderHomePage()).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace;/dashboard",
    });
    expect(navigationMocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("locks the future MC landing contract across sections and homepage", async () => {
    const featuresContainer = await renderNode(<FeaturesSection />);
    const heroContainer = await renderNode(<HeroSection />);
    const smartFlowsContainer = await renderNode(<SmartFlowsSection />);
    const comparisonContainer = await renderNode(<ComparisonSection />);
    const featuresText = featuresContainer.textContent ?? "";
    const comparisonSection = comparisonContainer.querySelector("#comparison");
    const comparisonText = comparisonSection?.textContent ?? "";

    expect(heroContainer.textContent).toContain("La forma antigua de presupuestar obra ya no alcanza.");
    expect(heroContainer.textContent).toContain(
      "MC Presupuestos conecta presupuesto, APU, metrados, formula polinomica, cronograma y exportables",
    );
    expect(heroContainer.textContent).toContain("Khipu IA integrada");

    expect(featuresText).toContain("Diferenciales");
    expect(featuresText).toContain("Presupuesto conectado");
    expect(featuresText).toContain("APU con trazabilidad");
    expect(featuresText).toContain("Formula y cronograma dentro del flujo");

    expect(smartFlowsContainer.textContent).toContain("Flujo conectado");
    expect(smartFlowsContainer.textContent).toContain("Importa o construye");
    expect(smartFlowsContainer.textContent).toContain("Estructura y conecta");
    expect(smartFlowsContainer.textContent).toContain("Revisa con Khipu");
    expect(smartFlowsContainer.textContent).toContain("Prepara entregables");

    expect(comparisonText).toContain("Flujo fragmentado");
    expect(comparisonText).toContain("Flujo conectado");
    expect(comparisonText).not.toContain("Software tradicional");
    expect(comparisonText).not.toContain("Excel");

    authMocks.getAuthSession.mockResolvedValue(null);

    const container = await renderHomePage();
    const main = container.querySelector("main");
    const sections = Array.from(main?.querySelectorAll("section") ?? []);
    const sectionText = sections.map((section) => section.textContent ?? "");

    const heroIndex = sectionText.findIndex((text) => text.includes("La forma antigua de presupuestar obra ya no alcanza."));
    const legacyPainIndex = sectionText.findIndex((text) =>
      text.includes("El problema no es calcular menos. Es coordinar mejor."),
    );
    const khipuIndex = sectionText.findIndex((text) =>
      text.includes("Khipu IA revisa el presupuesto con contexto visible."),
    );
    const smartFlowsIndex = sectionText.findIndex((text) => text.includes("Importa o construye"));
    const comparisonIndex = sectionText.findIndex(
      (text) => text.includes("Flujo fragmentado") && text.includes("Flujo conectado"),
    );

    expect(main).not.toBeNull();
    expect(main?.textContent).toContain("MC Presupuestos");
    expect(heroIndex).toBeGreaterThanOrEqual(0);
    expect(legacyPainIndex).toBeGreaterThan(heroIndex);
    expect(khipuIndex).toBeGreaterThan(legacyPainIndex);
    expect(smartFlowsIndex).toBeGreaterThan(khipuIndex);
    expect(comparisonIndex).toBeGreaterThan(smartFlowsIndex);
    expect(container.querySelector("footer")?.textContent).toContain("MC Presupuestos");
    expect(navigationMocks.redirect).not.toHaveBeenCalled();
  });
});

async function renderHomePage() {
  const { default: Home } = await import("./page");
  const node = await Home();
  return renderNode(node);
}

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
