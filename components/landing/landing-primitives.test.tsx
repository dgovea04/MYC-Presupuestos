/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { ComparisonSection } from "@/components/landing/comparison-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FinalCTASection } from "@/components/landing/final-cta-section";
import { HeroSection } from "@/components/landing/hero-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingLinkButton } from "@/components/landing/landing-link-button";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { PricingSection } from "@/components/landing/pricing-section";
import { ProductPreviewSection } from "@/components/landing/product-preview-section";
import { SectionHeading } from "@/components/landing/section-heading";
import { TestimonialsSection } from "@/components/landing/testimonials-section";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

beforeEach(() => {
  class MockIntersectionObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(async () => {
  if (!activeContainer) {
    vi.unstubAllGlobals();
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
  vi.unstubAllGlobals();
});

describe("landing primitives", () => {
  it("renders centered section headings with the canonical rhythm classes", async () => {
    const container = await renderNode(
      <SectionHeading
        badge="Preview"
        title="Consistent hierarchy"
        description="Readable width and spacing should come from one shared primitive."
        align="center"
      />,
    );

    const wrapper = container.firstElementChild as HTMLElement;
    const title = container.querySelector("h2");
    const description = container.querySelector("p:last-of-type");

    expect(wrapper.className).toContain("mx-auto");
    expect(wrapper.className).toContain("max-w-[56rem]");
    expect(title?.className).toContain("font-display");
    expect(title?.className).toContain("leading-[1.05]");
    expect(description?.className).toContain("max-w-[44rem]");
  });

  it("keeps dark section headings on the contrast palette", async () => {
    const container = await renderNode(
      <SectionHeading
        badge="Beneficios"
        title="Dark heading"
        description="Contrast sections should keep the shared spacing with dark colors."
        tone="dark"
      />,
    );

    const badge = container.querySelector("[data-slot='badge']");
    const title = container.querySelector("h2");

    expect(badge?.className).toContain("bg-white/10");
    expect(title?.className).toContain("text-white");
  });

  it("renders primary and secondary landing buttons with distinct hierarchy classes", async () => {
    const container = await renderNode(
      <div>
        <LandingLinkButton href="/register" target="_blank" rel="noreferrer" aria-label="Primary CTA link">
          Primary CTA
        </LandingLinkButton>
        <LandingLinkButton href="/login" variant="secondary">
          Secondary CTA
        </LandingLinkButton>
      </div>,
    );

    const links = container.querySelectorAll("a");

    expect(links[0]?.className).toContain("rounded-xl");
    expect(links[0]?.className).toContain("shadow-[0_12px_30px_-12px_rgba(37,99,235,0.55)]");
    expect(links[0]?.getAttribute("target")).toBe("_blank");
    expect(links[1]?.className).toContain("border-slate-200/90");
    expect(links[1]?.className).toContain("bg-white/90");
  });

  it("applies the shared section shell and chip treatment to landing sections", async () => {
    const container = await renderNode(
      <div>
        <HeroSection />
        <FeaturesSection />
      </div>,
    );

    const featureSection = container.querySelector("#features");
    const heroInner = container.querySelector("section > .landing-shell");
    const heroChip = [...container.querySelectorAll("span")].find((node) => node.textContent?.includes("IA local revisable"));

    expect(featureSection?.className).toContain("landing-section");
    expect(featureSection?.className).toContain("landing-shell");
    expect(heroInner?.className).toContain("landing-shell");
    expect(heroChip?.className).toContain("landing-chip");
  });

  it("uses the shared elevated product surface across hero, preview, and comparison", async () => {
    const container = await renderNode(
      <div>
        <HeroSection />
        <ProductPreviewSection />
        <ComparisonSection />
      </div>,
    );

    const heroSurface = container.querySelector("section:not([id]) .landing-surface-elevated");
    const previewSurface = container.querySelector("#preview .landing-surface-elevated");
    const comparisonSurface = container.querySelector("#comparison .landing-surface-elevated");

    expect(heroSurface).not.toBeNull();
    expect(previewSurface).not.toBeNull();
    expect(comparisonSurface).not.toBeNull();
    expect(container.textContent).toContain("Presupuesta obras con mÃ¡s control");
    expect(container.textContent).toContain("Presupuesto de estructuras");
    expect(container.textContent).toContain("Comparativo de experiencia operativa");
  });

  it("reuses the premium light-card treatment across features, testimonials, and non-highlighted pricing", async () => {
    const container = await renderNode(
      <div>
        <FeaturesSection />
        <TestimonialsSection />
        <PricingSection />
      </div>,
    );

    const featuresSurface = container.querySelector("#features .landing-surface-elevated");
    const testimonialsSection = [...container.querySelectorAll("section")].find((node) => node.textContent?.includes("Testimonios"));
    const testimonialsSurface = testimonialsSection?.querySelector(".landing-surface-elevated");
    const pricingSection = container.querySelector("#pricing");
    const pricingSurfaces = container.querySelectorAll("#pricing .landing-surface-elevated");

    expect(featuresSurface).not.toBeNull();
    expect(testimonialsSection).toBeDefined();
    expect(testimonialsSurface).not.toBeNull();
    expect(pricingSection).not.toBeNull();
    expect(pricingSurfaces).toHaveLength(2);
  });

  it("reuses the contrast surface system across benefits and the final cta", async () => {
    const container = await renderNode(
      <div>
        <BenefitsSection />
        <FinalCTASection />
        <LandingFooter />
      </div>,
    );

    const benefitsSection = [...container.querySelectorAll("section")].find((node) => node.textContent?.includes("Beneficios"));
    const finalCtaSection = [...container.querySelectorAll("section")].find((node) => node.textContent?.includes("Crear cuenta gratis"));

    expect(benefitsSection?.querySelector(".landing-surface-contrast")).not.toBeNull();
    expect(finalCtaSection?.querySelector(".landing-surface-contrast")).not.toBeNull();
    expect(container.textContent).toContain("Beneficios");
    expect(container.textContent).toContain("Crear cuenta gratis");
    expect(container.textContent).toContain("Iniciar sesion");
  });

  it("keeps the navbar login action on the shared secondary CTA treatment", async () => {
    const container = await renderNode(<LandingNavbar />);
    const loginLink = container.querySelector('a[href="/login"]');
    const navbarInner = container.querySelector("header > div");

    expect(loginLink?.className).toContain("border-slate-200/90");
    expect(loginLink?.className).toContain("bg-white/90");
    expect(navbarInner?.className).toContain("landing-shell");
  });

  it("keeps footer navigation aligned with real landing sections and auth routes", async () => {
    const container = await renderNode(<LandingFooter />);
    const links = Array.from(container.querySelectorAll("a")).map((link) => ({
      text: link.textContent,
      href: link.getAttribute("href"),
    }));

    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "Diferenciales", href: "#features" }),
        expect.objectContaining({ text: "Khipu IA", href: "#khipu" }),
        expect.objectContaining({ text: "Flujo conectado", href: "#flows" }),
        expect.objectContaining({ text: "Vista del producto", href: "#preview" }),
        expect.objectContaining({ text: "Comparacion", href: "#comparison" }),
        expect.objectContaining({ text: "Beneficios", href: "#benefits" }),
        expect.objectContaining({ text: "Testimonios", href: "#testimonios" }),
        expect.objectContaining({ text: "Preguntas frecuentes", href: "#faq" }),
        expect.objectContaining({ text: "Precios", href: "#pricing" }),
        expect.objectContaining({ text: "Crear cuenta", href: "/register" }),
        expect.objectContaining({ text: "Iniciar sesion", href: "/login" }),
      ]),
    );
  });

  it("moves focus into the mobile dialog, traps tabbing, and restores focus to the trigger", async () => {
    const container = await renderNode(<LandingNavbar />);
    const openButton = container.querySelector('button[aria-label="Abrir menu"]') as HTMLButtonElement | null;

    expect(openButton).not.toBeNull();
    openButton?.focus();

    await act(async () => {
      openButton?.click();
    });

    const closeButton = container.querySelector('button[aria-label="Cerrar menu"]') as HTMLButtonElement | null;
    const dialog = container.querySelector("#landing-mobile-navigation");
    const lastLink = dialog?.querySelector('a[href="/register"]') as HTMLAnchorElement | null;

    expect(document.activeElement).toBe(closeButton);
    expect(dialog?.getAttribute("role")).toBe("dialog");

    lastLink?.focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    expect(document.activeElement).toBe(closeButton);

    closeButton?.focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    });
    expect(document.activeElement).toBe(lastLink);

    await act(async () => {
      closeButton?.click();
    });
    expect(document.activeElement).toBe(openButton);
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
