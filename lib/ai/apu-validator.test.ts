import { describe, expect, it } from "vitest";
import { validateApuCatalogProposal } from "@/lib/ai/apu-validator";
import type { AiApuCatalogProposal } from "@/lib/ai/types";
import type { ResourceRecord } from "@/types/resource";

const resources: ResourceRecord[] = [
  {
    id: "res-cemento",
    code: "MAT-001",
    description: "Cemento Portland Tipo I",
    category: "MATERIAL",
    unit: "bol",
    unitPrice: 32,
    currency: "PEN",
  },
  {
    id: "res-operario",
    code: "MO-001",
    description: "Operario",
    category: "LABOR",
    unit: "hh",
    unitPrice: 25,
    currency: "PEN",
  },
];

describe("apu-validator", () => {
  it("accepts catalog-backed proposal items and enriches them from catalog resources", () => {
    const proposal: AiApuCatalogProposal = {
      partida_name: "Concreto f'c=210 kg/cm2 para columnas",
      unit: "m3",
      based_on_partida_id: "par-1",
      confidence: 0.86,
      items: [
        {
          resource_id: "res-cemento",
          name: "Cemento Portland Tipo I",
          type: "MATERIAL",
          unit: "bol",
          quantity: 7.5,
          source: "catalog",
          requires_review: false,
        },
      ],
      suggested_new_resources: [],
      warnings: [],
      requires_human_review: true,
    };

    const result = validateApuCatalogProposal({ proposal, resources });

    expect(result.isValid).toBe(true);
    expect(result.proposal.items[0]?.name).toBe("Cemento Portland Tipo I");
    expect(result.proposal.items[0]?.unit).toBe("bol");
    expect(result.warnings).toEqual([]);
  });

  it("rejects invented resources and unit changes while keeping review warnings", () => {
    const proposal: AiApuCatalogProposal = {
      partida_name: "Concreto f'c=210 kg/cm2 para columnas",
      unit: "m3",
      confidence: 0.5,
      items: [
        {
          resource_id: "res-falso",
          name: "Super Cemento Inventado",
          type: "MATERIAL",
          unit: "kg",
          quantity: 100000,
          source: "catalog",
          requires_review: false,
        },
        {
          resource_id: "res-operario",
          name: "Operario",
          type: "LABOR",
          unit: "jor",
          quantity: 1,
          source: "catalog",
          requires_review: false,
        },
      ],
      suggested_new_resources: [],
      warnings: [],
      requires_human_review: true,
    };

    const result = validateApuCatalogProposal({ proposal, resources });

    expect(result.isValid).toBe(false);
    expect(result.warnings).toContain("El recurso res-falso no existe en el catalogo disponible.");
    expect(result.warnings).toContain("La unidad de Operario debe ser hh, no jor.");
    expect(result.warnings).toContain("La confianza es baja; requiere revision tecnica.");
    expect(result.warnings).toContain("La cantidad 100000 de Super Cemento Inventado es sospechosa.");
    expect(result.proposal.items.map((item) => item.resource_id)).toEqual(["res-operario"]);
  });
});
