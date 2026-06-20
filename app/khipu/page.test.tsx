/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { KhipuHero } from "@/components/khipu-landing/KhipuHero";
import { KhipuFeatureGrid } from "@/components/khipu-landing/KhipuFeatureGrid";
import { KhipuWorkflow } from "@/components/khipu-landing/KhipuWorkflow";
import { KhipuUseCases } from "@/components/khipu-landing/KhipuUseCases";
import { KhipuChatPreview } from "@/components/khipu-landing/KhipuChatPreview";
import { KhipuTrustSection } from "@/components/khipu-landing/KhipuTrustSection";
import { KhipuCTA } from "@/components/khipu-landing/KhipuCTA";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";

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

describe("Khipu landing page sections", () => {
  it("renders the KhipuHero with headline, CTAs, trust signals, and the Khipu symbol", async () => {
    const container = await renderNode(<KhipuHero />);

    const h1 = container.querySelector("h1");
    const ctaSection = container.querySelector("section");

    expect(h1?.textContent).toContain("Khipu, la IA que entiende tus presupuestos");
    expect(ctaSection?.querySelector(".landing-shell")).not.toBeNull();
    expect(container.textContent).toContain("Probar Khipu IA");
    expect(container.textContent).toContain("Ver cómo funciona");
    expect(container.textContent).toContain("Siempre con revisión humana");
    expect(container.textContent).toContain("IA local revisable");
    expect(container.textContent).toContain("No modifica presupuestos sin intervención humana");
    expect(container.textContent).toContain("Siempre declara supuestos");

    // Trust signals use the shared landing-chip class
    const chips = container.querySelectorAll(".landing-chip");
    expect(chips.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the KhipuFeatureGrid with 6 feature cards and shared surface classes", async () => {
    const container = await renderNode(<KhipuFeatureGrid />);

    const section = container.querySelector("#features");
    expect(section?.className).toContain("landing-section");
    expect(section?.className).toContain("landing-shell");

    const badges = container.querySelectorAll("[data-slot='badge']");
    const badge = badges[0];
    expect(badge?.textContent).toBe("Capacidades");

    const h2 = container.querySelector("h2");
    expect(h2?.textContent).toContain("Análisis técnico conectado a tu presupuesto");

    const cards = container.querySelectorAll("#features .landing-surface-elevated");
    expect(cards.length).toBe(6);

    expect(container.textContent).toContain("Analiza presupuestos");
    expect(container.textContent).toContain("Revisa APU");
    expect(container.textContent).toContain("Compara alternativas");
    expect(container.textContent).toContain("Sugiere mejoras");
    expect(container.textContent).toContain("Usa contexto del proyecto");
    expect(container.textContent).toContain("Genera reportes técnicos");
  });

  it("renders the KhipuWorkflow with 3 steps and connecting lines", async () => {
    const container = await renderNode(<KhipuWorkflow />);

    const section = container.querySelector("#como-funciona");
    expect(section?.className).toContain("landing-section");
    expect(section?.className).toContain("landing-shell");

    expect(container.textContent).toContain("Cómo trabaja Khipu");
    expect(container.textContent).toContain("Paso 1");
    expect(container.textContent).toContain("Paso 2");
    expect(container.textContent).toContain("Paso 3");
    expect(container.textContent).toContain("Conecta el contexto");
    expect(container.textContent).toContain("Analiza la información");
    expect(container.textContent).toContain("Entrega recomendaciones");
  });

  it("renders the KhipuUseCases with 5 example prompts", async () => {
    const container = await renderNode(<KhipuUseCases />);

    const section = container.querySelector("section");
    expect(section?.className).toContain("landing-section");
    expect(section?.className).toContain("landing-shell");

    expect(container.textContent).toContain("Casos de uso");
    expect(container.textContent).toContain("Revisión de presupuesto");
    expect(container.textContent).toContain("Análisis de APU");
    expect(container.textContent).toContain("Control de metrados");
    expect(container.textContent).toContain("Optimización de costos");
    expect(container.textContent).toContain("Reporte técnico");

    // Each use case has a prompt in italics
    const italicElements = container.querySelectorAll("p.italic");
    expect(italicElements.length).toBeGreaterThanOrEqual(5);
  });

  it("renders the KhipuChatPreview with mock chat messages and the Khipu symbol", async () => {
    const container = await renderNode(<KhipuChatPreview />);

    const section = container.querySelector("section");
    expect(section?.className).toContain("landing-section");
    expect(section?.className).toContain("landing-shell");

    expect(container.textContent).toContain("Vista previa");
    expect(container.textContent).toContain("Khipu IA");
    expect(container.textContent).toContain("Tu asistente en MC Presupuestos");
    expect(container.textContent).toContain("¡Hola! Soy Khipu");

    // Chat input bar
    expect(container.textContent).toContain("Escribe tu consulta técnica");
  });

  it("renders the KhipuTrustSection with 5 guardrail principles", async () => {
    const container = await renderNode(<KhipuTrustSection />);

    const section = container.querySelector("section");
    expect(section?.className).toContain("landing-section");
    expect(section?.className).toContain("landing-shell");

    expect(container.textContent).toContain("Confianza");
    expect(container.textContent).toContain("IA diseñada para presupuestos");

    expect(container.textContent).toContain("No modifica presupuestos automáticamente.");
    expect(container.textContent).toContain("No inventa precios exactos.");
    expect(container.textContent).toContain("Declara supuestos cuando falta información.");
    expect(container.textContent).toContain("Recomienda acciones para revisión humana.");
    expect(container.textContent).toContain("Mantiene lenguaje técnico claro.");
  });

  it("renders the KhipuCTA with the contrast surface and both CTA buttons", async () => {
    const container = await renderNode(<KhipuCTA />);

    const section = container.querySelector("section");
    expect(section?.className).toContain("landing-section-tight");

    const contrastSurface = container.querySelector(".landing-surface-contrast");
    expect(contrastSurface).not.toBeNull();

    expect(container.textContent).toContain("Tu asistente IA de obra");
    expect(container.textContent).toContain("Khipu conecta datos");
    expect(container.textContent).toContain("Probar Khipu IA");
    expect(container.textContent).toContain("Solicitar demostración");
  });

  it("renders all Khipu landing sections together with shared primitives", async () => {
    const container = await renderNode(
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
      </main>,
    );

    // All sections use landing-section or landing-section-tight
    const sections = container.querySelectorAll("section");
    expect(sections.length).toBeGreaterThanOrEqual(7);

    // Shared surface classes are reused
    const elevatedSurfaces = container.querySelectorAll(".landing-surface-elevated");
    expect(elevatedSurfaces.length).toBeGreaterThanOrEqual(6);

    const contrastSurfaces = container.querySelectorAll(".landing-surface-contrast");
    expect(contrastSurfaces.length).toBeGreaterThanOrEqual(1);

    // Key landmark texts
    expect(container.textContent).toContain("Khipu, la IA que entiende tus presupuestos");
    expect(container.textContent).toContain("Análisis técnico conectado a tu presupuesto");
    expect(container.textContent).toContain("Cómo trabaja Khipu");
    expect(container.textContent).toContain("Vista previa");
    expect(container.textContent).toContain("Casos de uso");
    expect(container.textContent).toContain("Confianza");
    expect(container.textContent).toContain("Khipu conecta datos");

    // Landing chips are reused in hero trust signals
    const chips = container.querySelectorAll(".landing-chip");
    expect(chips.length).toBeGreaterThanOrEqual(3);

    // Navbar is present
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
