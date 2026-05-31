import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProLockedPreview, UpgradeCTA } from "@/components/billing/upgrade-cta";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe("UpgradeCTA", () => {
  it("renders a clear Pro upgrade message with default benefits", () => {
    const markup = renderToStaticMarkup(<UpgradeCTA />);

    expect(markup).toContain("Modulo disponible en Pro");
    expect(markup).toContain("IA local y generacion asistida");
    expect(markup).toContain("Cronograma, riesgo y reajustes avanzados");
    expect(markup).toContain("Exportaciones y flujos tecnicos ampliados");
    expect(markup).toContain('href="/account"');
    expect(markup).toContain("Actualizar a Pro");
  });

  it("allows module-specific benefits and preview content", () => {
    const markup = renderToStaticMarkup(
      <ProLockedPreview
        title="Riesgo Monte Carlo disponible en Pro"
        description="Evalua contingencias antes de cerrar el presupuesto."
        benefits={["Percentiles y curva acumulada"]}
      >
        <div>Vista previa de simulacion</div>
      </ProLockedPreview>,
    );

    expect(markup).toContain("Riesgo Monte Carlo disponible en Pro");
    expect(markup).toContain("Evalua contingencias antes de cerrar el presupuesto.");
    expect(markup).toContain("Percentiles y curva acumulada");
    expect(markup).toContain("Vista previa de simulacion");
  });
});
