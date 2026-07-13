/* @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import {
  BUNDLE_CONFIG,
  BUNDLE_SLUG_LABELS,
  BUNDLE_SUGGESTIONS,
} from "@/components/ai/agent/BundleConfig";
import type { BundleSlug } from "@/components/ai/agent/BundleConfig";

describe("BundleConfig", () => {
  describe("BUNDLE_CONFIG", () => {
    it("has exactly 6 bundles", () => {
      expect(BUNDLE_CONFIG).toHaveLength(6);
    });

    it("each bundle has a unique slug", () => {
      const slugs = BUNDLE_CONFIG.map((b) => b.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it("each bundle has a unique bundleSlug", () => {
      const bundleSlugs = BUNDLE_CONFIG.map((b) => b.bundleSlug);
      expect(new Set(bundleSlugs).size).toBe(bundleSlugs.length);
    });

    it("each bundle has name and description", () => {
      for (const bundle of BUNDLE_CONFIG) {
        expect(bundle.name).toBeTruthy();
        expect(bundle.description).toBeTruthy();
      }
    });

    it("each bundle has color, borderColor, bgLight, textColor", () => {
      for (const bundle of BUNDLE_CONFIG) {
        expect(bundle.color).toBeTruthy();
        expect(bundle.borderColor).toBeTruthy();
        expect(bundle.bgLight).toBeTruthy();
        expect(bundle.textColor).toBeTruthy();
      }
    });

    it("each bundle has an icon property defined", () => {
      for (const bundle of BUNDLE_CONFIG) {
        expect(bundle.icon).toBeDefined();
      }
    });

    it("first bundle is 'asistente-general'", () => {
      expect(BUNDLE_CONFIG[0].slug).toBe("asistente-general");
      expect(BUNDLE_CONFIG[0].bundleSlug).toBe("khipu-agent");
    });
  });

  describe("BUNDLE_SLUG_LABELS", () => {
    it("has labels for all 6 bundleSlugs", () => {
      const bundleSlugs = BUNDLE_CONFIG.map((b) => b.bundleSlug);
      for (const slug of bundleSlugs) {
        expect(BUNDLE_SLUG_LABELS[slug]).toBeTruthy();
      }
    });

    it('khipu-agent maps to "General"', () => {
      expect(BUNDLE_SLUG_LABELS["khipu-agent"]).toBe("General");
    });

    it('budget-agent maps to "Presupuestos"', () => {
      expect(BUNDLE_SLUG_LABELS["budget-agent"]).toBe("Presupuestos");
    });

    it('returns undefined for unknown slugs', () => {
      expect(BUNDLE_SLUG_LABELS["unknown-agent"]).toBeUndefined();
    });
  });

  describe("BUNDLE_SUGGESTIONS", () => {
    it("has suggestions for all 6 bundle slugs", () => {
      const slugs: BundleSlug[] = BUNDLE_CONFIG.map((b) => b.slug);
      for (const slug of slugs) {
        const suggestions = BUNDLE_SUGGESTIONS[slug];
        expect(Array.isArray(suggestions)).toBe(true);
        expect(suggestions).toHaveLength(4);
      }
    });

    it("each suggestion is a non-empty string", () => {
      for (const [, suggestions] of Object.entries(BUNDLE_SUGGESTIONS)) {
        for (const s of suggestions) {
          expect(typeof s).toBe("string");
          expect(s.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it("asistente-general has general-purpose suggestions", () => {
      expect(BUNDLE_SUGGESTIONS["asistente-general"]).toContain("Revisar APU de concreto armado");
    });

    it("crear-presupuesto-base has budget-specific suggestions", () => {
      expect(BUNDLE_SUGGESTIONS["crear-presupuesto-base"]).toContain("Crear presupuesto para vivienda de 3 pisos");
    });

    it("optimizar-apu has APU-specific suggestions", () => {
      expect(BUNDLE_SUGGESTIONS["optimizar-apu"]).toContain("Optimizar APU de concreto f'c=210 kg/cm2");
    });

    it("generar-cronograma has scheduling suggestions", () => {
      expect(BUNDLE_SUGGESTIONS["generar-cronograma"]).toContain("Calcular ruta crítica del proyecto");
    });

    it("revisar-apu-proyecto has review suggestions", () => {
      expect(BUNDLE_SUGGESTIONS["revisar-apu-proyecto"]).toContain("Detectar partidas duplicadas");
    });

    it("exportar-reportes has export suggestions", () => {
      expect(BUNDLE_SUGGESTIONS["exportar-reportes"]).toContain("Exportar presupuesto a PDF");
    });
  });
});
